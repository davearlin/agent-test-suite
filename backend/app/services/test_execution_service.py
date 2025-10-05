import asyncio
import time
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from app.core.config import settings
from app.models import TestRun, Question, TestResult, TestRunDataset, TestRunEvaluationConfig, EvaluationParameter, TestResultParameterScore
from app.services.dialogflow_service import DialogflowService
from app.services.llm_judge_service import LLMJudgeService


class TestRunExecutionService:
    __test__ = False  # Prevent pytest from collecting this class
    def __init__(self, user=None, db=None):
        self.engine = create_engine(settings.DATABASE_URL)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.user = user
        self.provided_db = db
        # Note: dialogflow_service will be created when needed in execute_test_run with proper session
        # LLM judge service will be created with user context when needed
        self.llm_judge_service = None

    def get_db(self):
        db = self.SessionLocal()
        try:
            return db
        finally:
            db.close()

    def _load_evaluation_parameters(self, db, test_run_id: int, user_id: int) -> List[Dict[str, Any]]:
        """Load evaluation parameters for a test run."""
        try:
            # First, try to get test run specific evaluation config
            eval_config = db.query(TestRunEvaluationConfig).filter(
                TestRunEvaluationConfig.test_run_id == test_run_id
            ).first()
            
            # If no test run specific config, try to get user's default config
            if not eval_config:
                eval_config = db.query(TestRunEvaluationConfig).filter(
                    TestRunEvaluationConfig.user_id == user_id,
                    TestRunEvaluationConfig.is_default == True,
                    TestRunEvaluationConfig.test_run_id.is_(None)
                ).first()

            if not eval_config or not eval_config.parameters:
                # Fallback to default parameters if no config found
                return self._get_default_evaluation_parameters(db)
            
            # Load the evaluation parameters based on the config
            evaluation_parameters = []
            for param_config in eval_config.parameters:
                parameter = db.query(EvaluationParameter).filter(
                    EvaluationParameter.id == param_config['parameter_id'],
                    EvaluationParameter.is_active == True
                ).first()
                
                if parameter:
                    evaluation_parameters.append({
                        'id': parameter.id,
                        'parameter_type': parameter.name.lower().replace(' ', '_'),
                        'weight': param_config.get('weight', 33),
                        'enabled': param_config.get('enabled', True),
                        'prompt_template': parameter.prompt_template
                    })
            
            return evaluation_parameters
            
        except Exception as e:
            print(f"Error loading evaluation parameters: {e}")
            return self._get_default_evaluation_parameters(db)
    
    def _get_default_evaluation_parameters(self, db) -> List[Dict[str, Any]]:
        """Get default evaluation parameters when no configuration is found."""
        try:
            # Get all active evaluation parameters as defaults
            default_params = db.query(EvaluationParameter).filter(
                EvaluationParameter.is_active == True
            ).all()
            
            if not default_params:
                # Absolute fallback - return empty list to use legacy evaluation
                return []
            
            # Distribute weights evenly among available parameters
            weight_per_param = 100 // len(default_params)
            remaining_weight = 100 % len(default_params)
            
            evaluation_parameters = []
            for i, param in enumerate(default_params):
                weight = weight_per_param
                if i < remaining_weight:  # Distribute remaining weight to first few params
                    weight += 1
                    
                evaluation_parameters.append({
                    'id': param.id,
                    'parameter_type': param.name.lower().replace(' ', '_'),
                    'weight': weight,
                    'enabled': True,
                    'prompt_template': param.prompt_template
                })
            
            return evaluation_parameters
            
        except Exception as e:
            print(f"Error getting default evaluation parameters: {e}")
            return []

    async def execute_test_run(self, test_run_id: int):
        """Execute a complete test run."""
        db = self.get_db()
        
        try:
            # Create DialogflowService with user and db session
            if not self.user:
                print("Error: No user provided for test execution")
                return
            
            dialogflow_service = DialogflowService(user=self.user, db=db)
            
            # Get test run
            test_run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
            if not test_run:
                return
            
            # Create LLM judge service with user context for consistent authentication
            # Note: test_run.llm_model_id is for Dialogflow Playbooks, not for LLM evaluation
            # Use test_run.evaluation_model_id (now required)
            evaluation_model = test_run.evaluation_model_id
            print(f"Using Test Run's selected evaluation model: {evaluation_model}")
            
            self.llm_judge_service = LLMJudgeService(
                user=self.user, 
                db=db, 
                model_name=evaluation_model
            )
            
            # Update status to running
            test_run.status = "running"
            test_run.started_at = datetime.utcnow()
            db.commit()
            
            # Get all questions from associated datasets
            questions = []
            
            # Check if this is a multi-dataset test run
            test_run_datasets = db.query(TestRunDataset).filter(
                TestRunDataset.test_run_id == test_run_id
            ).all()
            
            if test_run_datasets:
                # Multi-dataset test run - get questions from all associated datasets
                for trd in test_run_datasets:
                    dataset_questions = db.query(Question).filter(
                        Question.dataset_id == trd.dataset_id
                    ).all()
                    questions.extend(dataset_questions)
            else:
                # Single dataset test run (backward compatibility)
                questions = db.query(Question).filter(
                    Question.dataset_id == test_run.dataset_id
                ).all()
            
            if not questions:
                test_run.status = "failed"
                test_run.completed_at = datetime.utcnow()
                db.commit()
                return
            
            # Process questions in batches
            batch_size = test_run.batch_size
            total_questions = len(questions)
            completed_questions = 0
            total_score = 0
            successful_evaluations = 0
            
            for i in range(0, len(questions), batch_size):
                batch = questions[i:i + batch_size]
                
                # Process Dialogflow queries
                dialogflow_results = await self._process_dialogflow_batch(
                    dialogflow_service, test_run, batch
                )
                
                # Process LLM evaluations
                evaluation_results = await self._process_evaluation_batch(
                    test_run, batch, dialogflow_results
                )
                
                # Save results to database
                for j, question in enumerate(batch):
                    df_result = dialogflow_results[j] if j < len(dialogflow_results) else {}
                    eval_result = evaluation_results[j] if j < len(evaluation_results) else {}
                    
                    # NEW: Only use parameter-based evaluation - NO legacy fields populated
                    test_result = TestResult(
                        test_run_id=test_run_id,
                        question_id=question.id,
                        actual_answer=df_result.get("response_text", ""),
                        dialogflow_response=df_result.get("raw_response", {}),
                        evaluation_reasoning=eval_result.get("evaluation_reasoning", ""),
                        no_match_detected=eval_result.get("no_match_detected"),
                        execution_time_ms=df_result.get("execution_time_ms", 0),
                        error_message=df_result.get("error") or eval_result.get("error")
                        # Legacy fields (similarity_score, empathy_score, overall_score) are intentionally NOT populated
                        # All evaluation data comes from dynamic parameter_scores
                    )
                    
                    db.add(test_result)
                    db.flush()  # Get the test_result.id for parameter scores
                    
                    # Save individual parameter scores (primary evaluation system)
                    parameter_scores = eval_result.get("parameter_scores", [])
                    computed_overall_score = None
                    
                    if parameter_scores:
                        # Compute weighted average from parameter scores
                        total_weighted_score = 0
                        total_weight = 0
                        
                        for param_score in parameter_scores:
                            test_result_param_score = TestResultParameterScore(
                                test_result_id=test_result.id,
                                parameter_id=param_score["parameter_id"],
                                score=param_score["score"],
                                weight_used=param_score["weight"],
                                reasoning=param_score.get("reasoning", "")
                            )
                            db.add(test_result_param_score)
                            
                            # Calculate weighted score contribution
                            if param_score["score"] is not None and param_score["weight"] is not None:
                                total_weighted_score += param_score["score"] * param_score["weight"]
                                total_weight += param_score["weight"]
                        
                        # Compute overall score from weighted parameters
                        if total_weight > 0:
                            computed_overall_score = round(total_weighted_score / total_weight)
                    
                    # Update running totals using computed overall score
                    if computed_overall_score is not None:
                        total_score += computed_overall_score
                        successful_evaluations += 1
                    
                    completed_questions += 1
                
                # Update progress
                test_run.completed_questions = completed_questions
                if successful_evaluations > 0:
                    test_run.average_score = int(total_score / successful_evaluations)
                
                db.commit()
                
                # Check if test run was cancelled
                db.refresh(test_run)
                if test_run.status == "cancelled":
                    break
            
            # Mark as completed
            if test_run.status != "cancelled":
                test_run.status = "completed"
            test_run.completed_at = datetime.utcnow()
            db.commit()
            
        except Exception as e:
            # Mark as failed
            test_run.status = "failed"
            test_run.completed_at = datetime.utcnow()
            db.commit()
            
            # Log the error (in production, use proper logging)
            print(f"Test run {test_run_id} failed: {str(e)}")
        
        finally:
            db.close()

    async def _process_dialogflow_batch(
        self, 
        dialogflow_service: DialogflowService,
        test_run: TestRun, 
        questions: List[Question]
    ) -> List[Dict[str, Any]]:
        """Process a batch of questions through Dialogflow with optional pre/post prompt messages."""
        
        try:
            # Get pre/post prompt messages from test run configuration
            pre_prompt_messages = getattr(test_run, 'pre_prompt_messages', None) or []
            post_prompt_messages = getattr(test_run, 'post_prompt_messages', None) or []
            
            print(f"🔄 Processing batch for test run {test_run.id}:")
            print(f"   - Agent: {test_run.agent_name}")
            print(f"   - Pre-prompt messages: {pre_prompt_messages} (length: {len(pre_prompt_messages)})")
            print(f"   - Post-prompt messages: {post_prompt_messages} (length: {len(post_prompt_messages)})")
            print(f"   - Enable webhook: {getattr(test_run, 'enable_webhook', True)}")
            print(f"   - Will use message sequence: {bool(pre_prompt_messages or post_prompt_messages)}")
            
            results = []
            session_prefix = f"test_run_{test_run.id}"
            
            # Process each question individually when pre/post messages are configured
            if pre_prompt_messages or post_prompt_messages:
                for i, question in enumerate(questions):
                    session_id = f"{session_prefix}_{i}_{int(time.time())}"
                    
                    try:
                        result = await dialogflow_service.detect_intent_with_message_sequence(
                            agent_name=test_run.agent_name,
                            session_id=session_id,
                            pre_prompt_messages=pre_prompt_messages,
                            main_question=question.question_text,
                            post_prompt_messages=post_prompt_messages,
                            session_parameters=getattr(test_run, 'session_parameters', None),
                            playbook_id=getattr(test_run, 'playbook_id', None),
                            enable_webhook=getattr(test_run, 'enable_webhook', True)
                        )
                        results.append(result)
                        
                    except Exception as e:
                        # Handle individual question errors
                        error_result = {
                            "error": str(e),
                            "execution_time_ms": 0,
                            "response_text": "",
                            "raw_response": {}
                        }
                        results.append(error_result)
                        print(f"❌ Error processing question {i}: {str(e)}")
                    
                    # Small delay between questions to be respectful of rate limits
                    if i < len(questions) - 1:
                        await asyncio.sleep(0.2)
            else:
                # Use the existing batch processing when no pre/post messages are configured
                question_texts = [q.question_text for q in questions]
                
                results = await dialogflow_service.batch_detect_intent(
                    agent_name=test_run.agent_name,
                    questions=question_texts,
                    session_id_prefix=session_prefix,
                    batch_size=test_run.batch_size,
                    session_parameters=getattr(test_run, 'session_parameters', None),
                    playbook_id=getattr(test_run, 'playbook_id', None),
                    enable_webhook=getattr(test_run, 'enable_webhook', True)
                )
            
            return results
            
        except Exception as e:
            # Return error results for all questions in batch
            return [{"error": str(e), "execution_time_ms": 0} for _ in questions]

    async def _process_evaluation_batch(
        self,
        test_run: TestRun,
        questions: List[Question],
        dialogflow_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Process a batch of evaluations through LLM using configured evaluation parameters."""
        
        try:
            # Load evaluation parameters for this test run
            db = self.get_db()
            evaluation_parameters = self._load_evaluation_parameters(db, test_run.id, test_run.created_by_id)
            
            evaluations = []
            
            for i, question in enumerate(questions):
                df_result = dialogflow_results[i] if i < len(dialogflow_results) else {}
                actual_answer = df_result.get("response_text", "")
                
                evaluation_data = {
                    "question": question.question_text,
                    "expected_answer": question.expected_answer,
                    "actual_answer": actual_answer,
                    "detect_empathy": question.detect_empathy,
                    "no_match_expected": question.no_match
                }
                
                evaluations.append(evaluation_data)
            
            # Use new multi-parameter evaluation if parameters are configured
            if evaluation_parameters:
                results = await self.llm_judge_service.batch_evaluate_with_parameters(
                    evaluations, evaluation_parameters
                )
            else:
                # Fallback to legacy evaluation for backward compatibility
                results = await self.llm_judge_service.batch_evaluate(evaluations)
            
            return results
            
        except Exception as e:
            # Return error results for all questions in batch
            error_result = {"error": str(e), "similarity_score": 0}
            return [error_result for _ in questions]

    async def get_test_progress(self, test_run_id: int) -> Dict[str, Any]:
        """Get current progress of a test run."""
        db = self.get_db()
        
        try:
            test_run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
            if not test_run:
                return {"error": "Test run not found"}
            
            # Calculate estimated time remaining
            estimated_time_remaining = None
            if test_run.status == "running" and test_run.started_at and test_run.completed_questions > 0:
                elapsed_time = (datetime.utcnow() - test_run.started_at).total_seconds()
                time_per_question = elapsed_time / test_run.completed_questions
                remaining_questions = test_run.total_questions - test_run.completed_questions
                estimated_time_remaining = int(time_per_question * remaining_questions)
            
            # Get current question being processed (approximate)
            current_question = ""
            if test_run.status == "running" and test_run.completed_questions < test_run.total_questions:
                next_question = (
                    db.query(Question)
                    .filter(Question.dataset_id == test_run.dataset_id)
                    .offset(test_run.completed_questions)
                    .first()
                )
                if next_question:
                    current_question = next_question.question_text[:100] + "..."
            
            return {
                "test_run_id": test_run_id,
                "status": test_run.status,
                "completed_questions": test_run.completed_questions,
                "total_questions": test_run.total_questions,
                "current_question": current_question,
                "average_score": test_run.average_score,
                "estimated_time_remaining": estimated_time_remaining
            }
            
        finally:
            db.close()
