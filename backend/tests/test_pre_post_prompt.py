"""
Test suite for pre/post prompt functionality in test runs.
This ensures that test runs properly use detect_intent_with_message_sequence
when pre/post prompts are configured, matching Quick Test behavior.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from typing import List, Dict, Any

from app.services.test_execution_service import TestRunExecutionService
from app.services.dialogflow_service import DialogflowService
from app.models import TestRun, Question, User


class TestPrePostPromptExecution:
    """Test cases for pre/post prompt message execution in test runs."""

    @pytest.fixture
    def mock_test_run(self):
        """Create a mock test run with pre/post prompts configured."""
        test_run = MagicMock()
        test_run.id = 123
        test_run.agent_name = "projects/test-project/locations/us-central1/agents/test-agent"
        test_run.batch_size = 2
        test_run.pre_prompt_messages = ["Hello", "How are you?"]
        test_run.post_prompt_messages = ["Thank you", "Goodbye"]
        test_run.session_parameters = {"role": "employee"}
        test_run.playbook_id = None
        test_run.enable_webhook = True
        return test_run

    @pytest.fixture
    def mock_test_run_no_prompts(self):
        """Create a mock test run without pre/post prompts."""
        test_run = MagicMock()
        test_run.id = 124
        test_run.agent_name = "projects/test-project/locations/us-central1/agents/test-agent"
        test_run.batch_size = 5
        test_run.pre_prompt_messages = []
        test_run.post_prompt_messages = []
        test_run.session_parameters = None
        test_run.playbook_id = None
        test_run.enable_webhook = True
        return test_run

    @pytest.fixture
    def mock_questions(self):
        """Create mock questions for testing."""
        questions = []
        for i in range(3):
            question = MagicMock()
            question.id = i + 1
            question.question_text = f"Test question {i + 1}?"
            question.expected_answer = f"Expected answer {i + 1}"
            questions.append(question)
        return questions

    @pytest.fixture
    def mock_dialogflow_service(self):
        """Create a mock DialogflowService with proper async methods."""
        service = MagicMock(spec=DialogflowService)
        
        # Mock detect_intent_with_message_sequence method
        async def mock_detect_intent_with_message_sequence(*args, **kwargs):
            return {
                "response_text": "Mock response from message sequence",
                "total_execution_time_ms": 1500,
                "message_sequence": [
                    {"type": "pre_prompt", "message": "Hello", "response": "Hi there"},
                    {"type": "pre_prompt", "message": "How are you?", "response": "I'm good"},
                    {"type": "main_question", "message": kwargs.get("main_question", "Test?"), "response": "Mock response"},
                    {"type": "post_prompt", "message": "Thank you", "response": "You're welcome"},
                    {"type": "post_prompt", "message": "Goodbye", "response": "Bye"}
                ],
                "sequence_summary": {
                    "pre_prompt_count": 2,
                    "post_prompt_count": 2,
                    "total_messages": 5
                },
                "webhook_info": {
                    "webhook_called": True,
                    "webhook_status": "success"
                }
            }
        
        service.detect_intent_with_message_sequence = AsyncMock(
            side_effect=mock_detect_intent_with_message_sequence
        )
        
        # Mock batch_detect_intent method
        async def mock_batch_detect_intent(*args, **kwargs):
            questions = kwargs.get("questions", [])
            return [
                {
                    "response_text": f"Mock batch response {i+1}",
                    "execution_time_ms": 800,
                    "webhook_info": {"webhook_called": True}
                }
                for i in range(len(questions))
            ]
        
        service.batch_detect_intent = AsyncMock(side_effect=mock_batch_detect_intent)
        
        return service

    @pytest.fixture
    def test_execution_service(self, mock_db, mock_user):
        """Create a TestRunExecutionService instance for testing."""
        return TestRunExecutionService(user=mock_user, db=mock_db)

    @pytest.mark.asyncio
    async def test_pre_post_prompt_execution_uses_message_sequence(
        self, 
        test_execution_service, 
        mock_test_run, 
        mock_questions, 
        mock_dialogflow_service
    ):
        """Test that when pre/post prompts are configured, detect_intent_with_message_sequence is used."""
        
        # Execute the batch processing
        results = await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service,
            test_run=mock_test_run,
            questions=mock_questions
        )
        
        # Verify that detect_intent_with_message_sequence was called for each question
        assert mock_dialogflow_service.detect_intent_with_message_sequence.call_count == 3
        
        # Verify that batch_detect_intent was NOT called (since we have pre/post prompts)
        mock_dialogflow_service.batch_detect_intent.assert_not_called()
        
        # Verify results structure
        assert len(results) == 3
        for result in results:
            assert "response_text" in result
            assert "message_sequence" in result
            assert "sequence_summary" in result
            assert result["sequence_summary"]["pre_prompt_count"] == 2
            assert result["sequence_summary"]["post_prompt_count"] == 2

    @pytest.mark.asyncio
    async def test_no_pre_post_prompts_uses_batch_processing(
        self, 
        test_execution_service, 
        mock_test_run_no_prompts, 
        mock_questions, 
        mock_dialogflow_service
    ):
        """Test that when no pre/post prompts are configured, batch_detect_intent is used."""
        
        # Execute the batch processing
        results = await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service,
            test_run=mock_test_run_no_prompts,
            questions=mock_questions
        )
        
        # Verify that batch_detect_intent was called
        mock_dialogflow_service.batch_detect_intent.assert_called_once()
        
        # Verify that detect_intent_with_message_sequence was NOT called
        mock_dialogflow_service.detect_intent_with_message_sequence.assert_not_called()
        
        # Verify results structure
        assert len(results) == 3
        for result in results:
            assert "response_text" in result
            assert "execution_time_ms" in result

    @pytest.mark.asyncio
    async def test_pre_prompt_only_uses_message_sequence(
        self, 
        test_execution_service, 
        mock_questions, 
        mock_dialogflow_service
    ):
        """Test that having only pre-prompts (no post-prompts) still uses message sequence."""
        
        # Create test run with only pre-prompts
        test_run = MagicMock()
        test_run.id = 125
        test_run.agent_name = "projects/test/locations/us-central1/agents/test"
        test_run.pre_prompt_messages = ["Initialize context"]
        test_run.post_prompt_messages = []
        test_run.session_parameters = None
        test_run.playbook_id = None
        test_run.enable_webhook = True
        
        # Execute the batch processing
        results = await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service,
            test_run=test_run,
            questions=mock_questions
        )
        
        # Verify that detect_intent_with_message_sequence was called
        assert mock_dialogflow_service.detect_intent_with_message_sequence.call_count == 3
        
        # Verify that batch_detect_intent was NOT called
        mock_dialogflow_service.batch_detect_intent.assert_not_called()

    @pytest.mark.asyncio
    async def test_post_prompt_only_uses_message_sequence(
        self, 
        test_execution_service, 
        mock_questions, 
        mock_dialogflow_service
    ):
        """Test that having only post-prompts (no pre-prompts) still uses message sequence."""
        
        # Create test run with only post-prompts
        test_run = MagicMock()
        test_run.id = 126
        test_run.agent_name = "projects/test/locations/us-central1/agents/test"
        test_run.pre_prompt_messages = []
        test_run.post_prompt_messages = ["Cleanup context"]
        test_run.session_parameters = None
        test_run.playbook_id = None
        test_run.enable_webhook = True
        
        # Execute the batch processing
        results = await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service,
            test_run=test_run,
            questions=mock_questions
        )
        
        # Verify that detect_intent_with_message_sequence was called
        assert mock_dialogflow_service.detect_intent_with_message_sequence.call_count == 3
        
        # Verify that batch_detect_intent was NOT called
        mock_dialogflow_service.batch_detect_intent.assert_not_called()

    @pytest.mark.asyncio
    async def test_webhook_configuration_passed_correctly(
        self, 
        test_execution_service, 
        mock_test_run, 
        mock_questions, 
        mock_dialogflow_service
    ):
        """Test that webhook configuration is properly passed to DialogflowService."""
        
        # Set webhook disabled
        mock_test_run.enable_webhook = False
        
        # Execute the batch processing
        await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service,
            test_run=mock_test_run,
            questions=mock_questions
        )
        
        # Verify that detect_intent_with_message_sequence was called with correct webhook setting
        call_args_list = mock_dialogflow_service.detect_intent_with_message_sequence.call_args_list
        
        for call_args in call_args_list:
            kwargs = call_args[1]  # Get keyword arguments
            assert kwargs["enable_webhook"] == False

    @pytest.mark.asyncio
    async def test_session_parameters_passed_correctly(
        self, 
        test_execution_service, 
        mock_test_run, 
        mock_questions, 
        mock_dialogflow_service
    ):
        """Test that session parameters are properly passed to DialogflowService."""
        
        # Set custom session parameters
        mock_test_run.session_parameters = {"role": "admin", "context": "test"}
        
        # Execute the batch processing
        await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service,
            test_run=mock_test_run,
            questions=mock_questions
        )
        
        # Verify that detect_intent_with_message_sequence was called with correct session parameters
        call_args_list = mock_dialogflow_service.detect_intent_with_message_sequence.call_args_list
        
        for call_args in call_args_list:
            kwargs = call_args[1]  # Get keyword arguments
            assert kwargs["session_parameters"] == {"role": "admin", "context": "test"}

    @pytest.mark.asyncio
    async def test_error_handling_in_message_sequence(
        self, 
        test_execution_service, 
        mock_test_run, 
        mock_questions, 
        mock_dialogflow_service
    ):
        """Test that errors in message sequence are properly handled."""
        
        # Configure mock to raise exception for second question
        async def mock_detect_intent_with_error(*args, **kwargs):
            # Get the main question to determine which call this is
            main_question = kwargs.get("main_question", "")
            if "question 2" in main_question:
                raise Exception("Simulated Dialogflow error")
            
            return {
                "response_text": "Success response",
                "total_execution_time_ms": 1000,
                "message_sequence": [],
                "sequence_summary": {"pre_prompt_count": 2, "post_prompt_count": 2}
            }
        
        mock_dialogflow_service.detect_intent_with_message_sequence = AsyncMock(
            side_effect=mock_detect_intent_with_error
        )
        
        # Execute the batch processing
        results = await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service,
            test_run=mock_test_run,
            questions=mock_questions
        )
        
        # Verify that we got results for all questions
        assert len(results) == 3
        
        # Verify that the error case returned an error result
        assert results[1]["error"] == "Simulated Dialogflow error"
        assert results[1]["execution_time_ms"] == 0
        
        # Verify that other questions still succeeded
        assert "response_text" in results[0]
        assert "response_text" in results[2]


class TestTestRunCreation:
    """Test cases for test run creation with pre/post prompts."""

    def test_test_run_creation_saves_pre_post_prompts(self, mock_db, mock_user):
        """Test that test run creation properly saves pre/post prompt messages."""
        from app.models.schemas import TestRunCreate

        # Create test run data with pre/post prompts
        test_run_data = TestRunCreate(
            name="Test Run with Prompts",
            description="Testing pre/post prompts",
            dataset_ids=[1],
            agent_name="projects/test/locations/us-central1/agents/test",
            agent_display_name="Test Agent",
            flow_name="Default Start Flow",
            page_name="Start Page",
            environment="draft",
            batch_size=5,
            session_parameters={"role": "employee"},
            enable_webhook=True,
            pre_prompt_messages=["Hello", "Initialize context"],
            post_prompt_messages=["Thank you", "Cleanup context"],
            evaluation_model_id="models/gemini-2.0-flash",  # Required field we added
            evaluation_parameters=[]
        )        # Mock the dataset query
        mock_dataset = MagicMock()
        mock_dataset.id = 1
        mock_dataset.name = "Test Dataset"
        mock_dataset.created_by_id = mock_user.id
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_dataset
        mock_db.query.return_value.count.return_value = 10  # 10 questions in dataset
        
        # Import and test the function (we can't easily test the full API endpoint without more setup)
        # Instead, let's test that our TestRun model creation includes the fields
        from app.models import TestRun
        
        test_run = TestRun(
            name=test_run_data.name,
            description=test_run_data.description,
            dataset_id=test_run_data.dataset_id,
            created_by_id=mock_user.id,
            agent_name=test_run_data.agent_name,
            agent_display_name=test_run_data.agent_display_name,
            flow_name=test_run_data.flow_name,
            page_name=test_run_data.page_name,
            environment=test_run_data.environment,
            batch_size=test_run_data.batch_size,
            session_parameters=test_run_data.session_parameters,
            enable_webhook=test_run_data.enable_webhook,
            pre_prompt_messages=test_run_data.pre_prompt_messages,
            post_prompt_messages=test_run_data.post_prompt_messages,
            total_questions=10,
            status="pending"
        )
        
        # Verify that all fields are properly set
        assert test_run.pre_prompt_messages == ["Hello", "Initialize context"]
        assert test_run.post_prompt_messages == ["Thank you", "Cleanup context"]
        assert test_run.enable_webhook == True
        assert test_run.session_parameters == {"role": "employee"}


class TestQuickTestComparison:
    """Test cases to ensure Test Runs behave the same as Quick Test."""

    @pytest.fixture
    def mock_dialogflow_service_comprehensive(self):
        """Create a comprehensive mock DialogflowService for comparison testing."""
        service = MagicMock(spec=DialogflowService)
        
        # Mock both quick_test and detect_intent_with_message_sequence
        async def mock_quick_test(*args, **kwargs):
            pre_prompts = kwargs.get("pre_prompt_messages", [])
            post_prompts = kwargs.get("post_prompt_messages", [])
            
            if pre_prompts or post_prompts:
                # Should use message sequence
                return {
                    "prompt": kwargs.get("prompt", "Test question"),
                    "response": "Quick test response with message sequence",
                    "message_sequence": [
                        {"type": "pre_prompt", "message": msg, "response": f"Response to {msg}"}
                        for msg in pre_prompts
                    ] + [
                        {"type": "main_question", "message": kwargs.get("prompt", "Test"), "response": "Main response"}
                    ] + [
                        {"type": "post_prompt", "message": msg, "response": f"Response to {msg}"}
                        for msg in post_prompts
                    ],
                    "sequence_summary": {
                        "pre_prompt_count": len(pre_prompts),
                        "post_prompt_count": len(post_prompts),
                        "total_messages": len(pre_prompts) + 1 + len(post_prompts)
                    }
                }
            else:
                # Should use single detect_intent
                return {
                    "prompt": kwargs.get("prompt", "Test question"),
                    "response": "Quick test response without message sequence"
                }
        
        async def mock_detect_intent_with_message_sequence(*args, **kwargs):
            pre_prompts = kwargs.get("pre_prompt_messages", [])
            post_prompts = kwargs.get("post_prompt_messages", [])
            
            return {
                "response_text": "Test run response with message sequence",
                "message_sequence": [
                    {"type": "pre_prompt", "message": msg, "response": f"Response to {msg}"}
                    for msg in pre_prompts
                ] + [
                    {"type": "main_question", "message": kwargs.get("main_question", "Test"), "response": "Main response"}
                ] + [
                    {"type": "post_prompt", "message": msg, "response": f"Response to {msg}"}
                    for msg in post_prompts
                ],
                "sequence_summary": {
                    "pre_prompt_count": len(pre_prompts),
                    "post_prompt_count": len(post_prompts),
                    "total_messages": len(pre_prompts) + 1 + len(post_prompts)
                }
            }
        
        service.quick_test = AsyncMock(side_effect=mock_quick_test)
        service.detect_intent_with_message_sequence = AsyncMock(side_effect=mock_detect_intent_with_message_sequence)
        
        return service

    @pytest.mark.asyncio
    async def test_quick_test_and_test_run_parity_with_prompts(
        self, 
        test_execution_service, 
        mock_dialogflow_service_comprehensive
    ):
        """Test that Quick Test and Test Run produce similar results when pre/post prompts are configured."""
        
        pre_prompts = ["Hello", "Initialize context"]
        post_prompts = ["Thank you", "Cleanup"]
        main_question = "What is your name?"
        
        # Test Quick Test behavior
        quick_test_result = await mock_dialogflow_service_comprehensive.quick_test(
            agent_id="test-agent",
            prompt=main_question,
            pre_prompt_messages=pre_prompts,
            post_prompt_messages=post_prompts,
            enable_webhook=True
        )
        
        # Test Test Run behavior
        mock_test_run = MagicMock()
        mock_test_run.id = 1
        mock_test_run.agent_name = "projects/test/locations/us-central1/agents/test-agent"
        mock_test_run.pre_prompt_messages = pre_prompts
        mock_test_run.post_prompt_messages = post_prompts
        mock_test_run.session_parameters = None
        mock_test_run.playbook_id = None
        mock_test_run.enable_webhook = True
        
        mock_question = MagicMock()
        mock_question.question_text = main_question
        
        test_run_results = await test_execution_service._process_dialogflow_batch(
            dialogflow_service=mock_dialogflow_service_comprehensive,
            test_run=mock_test_run,
            questions=[mock_question]
        )
        
        test_run_result = test_run_results[0]
        
        # Verify both use message sequence
        assert "message_sequence" in quick_test_result
        assert "message_sequence" in test_run_result
        
        # Verify sequence summaries are similar
        quick_summary = quick_test_result["sequence_summary"]
        test_summary = test_run_result["sequence_summary"]
        
        assert quick_summary["pre_prompt_count"] == test_summary["pre_prompt_count"]
        assert quick_summary["post_prompt_count"] == test_summary["post_prompt_count"]
        assert quick_summary["total_messages"] == test_summary["total_messages"]