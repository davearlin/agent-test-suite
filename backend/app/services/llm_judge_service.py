import asyncio
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from google.api_core import exceptions as gcp_exceptions
from sqlalchemy.orm import Session
import re

from app.core.config import settings
from app.core.token_manager import TokenManager
from app.core.prompt_templates import get_default_templates, validate_prompt_template
from app.models import User, EvaluationParameter


class LLMJudgeService:
    """
    LLM-as-a-Judge service for evaluating Dialogflow response quality.
    
    This service uses Google's Gemini model to intelligently compare actual
    Dialogflow responses against expected responses, providing:
    - Similarity scores (0-100%)
    - Detailed evaluation reasoning
    - Empathy scoring for customer service contexts
    - No-match validation for appropriate "can't help" responses
    """
    
    def __init__(self, user: Optional[User] = None, db: Optional[Session] = None, model_name: Optional[str] = None):
        self.user = user
        self.db = db
        
        # Use provided model name or fall back to a reliable default
        # Model selection should come from user's test run configuration
        configured_model = model_name or 'models/gemini-2.0-flash'
        
        # Validate and set model name with fallbacks
        self.model_name = self._get_valid_model_name(configured_model)
        
        # Configure Gemini authentication
        self._configure_gemini_auth()
    
    def _get_valid_model_name(self, model_name: str) -> str:
        """
        Validate and normalize the Gemini model name.
        Ensures we use supported models with correct prefixes and avoid unavailable models.
        """
        # Known working model names for Gemini API (with correct prefixes)
        # Map user-friendly names to actual working model paths
        valid_models = {
            # Legacy mappings (for backward compatibility)
            'gemini-pro': 'models/gemini-2.0-flash',
            'gemini-1.5-pro': 'models/gemini-1.5-pro',
            'gemini-1.5-flash': 'models/gemini-1.5-flash', 
            'gemini-1.0-pro': 'models/gemini-2.0-flash',
            
            # Direct model path mappings (already have models/ prefix)
            'models/gemini-1.5-pro': 'models/gemini-1.5-pro',
            'models/gemini-1.5-pro-latest': 'models/gemini-1.5-pro-latest',
            'models/gemini-1.5-flash': 'models/gemini-1.5-flash',
            'models/gemini-1.5-flash-latest': 'models/gemini-1.5-flash-latest',
            'models/gemini-1.5-flash-8b': 'models/gemini-1.5-flash-8b',
            
            # 2.x generation models
            'models/gemini-2.0-flash': 'models/gemini-2.0-flash',
            'models/gemini-2.0-flash-lite': 'models/gemini-2.0-flash-lite',
            'models/gemini-2.0-pro-exp': 'models/gemini-2.0-pro-exp',
            'models/gemini-2.0-flash-thinking-exp': 'models/gemini-2.0-flash-thinking-exp',
            
            # 2.5 generation models
            'models/gemini-2.5-pro': 'models/gemini-2.5-pro',
            'models/gemini-2.5-flash': 'models/gemini-2.5-flash',
            'models/gemini-2.5-flash-lite': 'models/gemini-2.5-flash-lite',
        }
        
        # Clean the model name (remove version suffixes like -002, -001, etc.)
        cleaned_name = model_name
        if '-' in model_name and not model_name.startswith('models/'):
            # Remove version suffixes like -002, -001
            parts = model_name.split('-')
            if len(parts) > 2 and parts[-1].isdigit():
                # Remove the numeric suffix
                cleaned_name = '-'.join(parts[:-1])
                print(f"Cleaned model name: {model_name} -> {cleaned_name}")
        
        # Handle specific problematic models
        problematic_mappings = {
            'gemini-1.5-flash-002': 'models/gemini-1.5-flash',
            'gemini-1.5-pro-002': 'models/gemini-1.5-pro',
            'gemini-pro-002': 'models/gemini-2.0-flash',
        }
        
        # Check problematic mappings first
        if model_name in problematic_mappings:
            final_model = problematic_mappings[model_name]
            print(f"Using problematic model mapping: {model_name} -> {final_model}")
            return final_model
        
        # Check if we have a mapping for this model
        if cleaned_name in valid_models:
            final_model = valid_models[cleaned_name]
            print(f"Using validated model name: {final_model} (from {model_name})")
            return final_model
        elif model_name in valid_models:
            final_model = valid_models[model_name]
            print(f"Using validated model name: {final_model} (from {model_name})")
            return final_model
        
        # Fallback to working model if not recognized
        fallback_model = 'models/gemini-2.0-flash'
        print(f"Warning: Unknown model '{model_name}', falling back to '{fallback_model}'")
        return fallback_model

    def _configure_gemini_auth(self):
        """
        Determine authentication method and store for per-request use.
        DOES NOT call genai.configure() - that happens per-request in _create_model().
        """
        self.auth_configured = False
        self.model_available = False
        self.credentials = None  # Store credentials for per-request use
        self.api_key = None  # Store API key for per-request use
        self.auth_method = None  # Track which auth method we're using
        
        try:
            # Priority 1: Use user's OAuth credentials (preferred in production)
            if self.user and self.db:
                user_token = TokenManager.get_valid_token(self.user, self.db)
                if user_token:
                    print(f"📋 LLM Judge for user {self.user.email} will use OAuth credentials")
                    # Create credentials from user's OAuth token
                    from google.oauth2.credentials import Credentials
                    self.credentials = Credentials(token=user_token)
                    self.auth_configured = True
                    self.auth_method = "oauth"
                    print(f"✅ Gemini will authenticate with user OAuth token, model: {self.model_name}")
                    
                    # Test model availability
                    self._test_model_availability()
                    return
            
            # Priority 2: API key (for development/testing)
            api_key = getattr(settings, 'GOOGLE_API_KEY', None)
            if api_key:
                print(f"📋 LLM Judge will use API key authentication")
                self.api_key = api_key
                self.auth_configured = True
                self.auth_method = "api_key"
                print(f"✅ Gemini will authenticate with API key, model: {self.model_name}")
                self._test_model_availability()
                return
            
            # Priority 3: ADC fallback (service account or gcloud auth)
            print(f"📋 LLM Judge will use Application Default Credentials")
            self.auth_configured = True
            self.auth_method = "adc"
            print(f"✅ Gemini will authenticate with ADC, model: {self.model_name}")
            self._test_model_availability()
                
        except Exception as e:
            print(f"⚠️  Failed to configure Gemini authentication: {str(e)}")
            print("⚠️  LLM evaluation will use fallback scoring.")
            self.auth_configured = False

    def _test_model_availability(self):
        """Test if the configured model is accessible with current auth method."""
        try:
            # Create model with appropriate auth
            model = self._create_model()
            
            # Simple test query with proper generation config
            response = model.generate_content("Test", 
                                            generation_config={'max_output_tokens': 5})
            self.model_available = True
            print(f"✅ Model {self.model_name} is accessible")
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Model {self.model_name} is not accessible: {error_msg}")
            self.model_available = False
            
            # Suggest alternative approaches
            if "404" in error_msg or "not found" in error_msg.lower():
                print(f"💡 Suggestion: Model '{self.model_name}' not found. Check if Generative Language API is enabled.")
                print("💡 Alternative: Use rule-based evaluation or configure a different model.")
            elif "403" in error_msg or "permission" in error_msg.lower():
                print(f"💡 Suggestion: Permission denied for model '{self.model_name}'. Check API key permissions.")
            elif "quota" in error_msg.lower():
                print(f"💡 Suggestion: API quota exceeded for model '{self.model_name}'. Check usage limits.")
    
    def _create_model(self):
        """
        Create a GenerativeModel instance with appropriate authentication.
        
        CRITICAL: We must pass ONLY credentials OR api_key to configure(), never both.
        When using credentials, we explicitly pass credentials=X and api_key=None to override
        any environment variable (GOOGLE_API_KEY) that might be set.
        """
        if self.credentials:
            # Use OAuth credentials - explicitly disable api_key to avoid conflicts
            print(f"🔐 Configuring genai with OAuth credentials for model {self.model_name}")
            genai.configure(credentials=self.credentials, api_key=None)
            return genai.GenerativeModel(model_name=self.model_name)
        elif self.api_key:
            # Use API key - explicitly disable credentials to avoid conflicts
            print(f"🔑 Configuring genai with API key for model {self.model_name}")
            genai.configure(api_key=self.api_key, credentials=None)
            return genai.GenerativeModel(model_name=self.model_name)
        else:
            # Use ADC - no explicit auth, will use default credentials
            print(f"☁️ Using ADC for model {self.model_name}")
            genai.configure(api_key=None, credentials=None)
            return genai.GenerativeModel(self.model_name)

    async def evaluate_response(
        self,
        expected_answer: str,
        actual_answer: str,
        question: str,
        detect_empathy: bool = False,
        no_match_expected: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluate the quality of a Dialogflow response using Gemini as a judge.
        
        Args:
            expected_answer: The expected/ideal response
            actual_answer: The actual response from Dialogflow
            question: The original question/query
            detect_empathy: Whether to evaluate empathy in the response
            no_match_expected: Whether this should be a "can't help" response
            
        Returns:
            Dict containing similarity_score, evaluation_reasoning, empathy_score, etc.
        """
        
        # Check if we have LLM evaluation capability
        if not self.auth_configured or not self.model_available:
            print(f"LLM evaluation not available. Using fallback scoring for comparison.")
            return self._fallback_evaluation(expected_answer, actual_answer, question, detect_empathy, no_match_expected)

        try:
            # Construct the evaluation prompt
            prompt = self._build_evaluation_prompt(
                question, expected_answer, actual_answer, detect_empathy, no_match_expected
            )
            
            # Use Gemini for evaluation with appropriate authentication
            print(f"Using Gemini model: {self.model_name} for response evaluation")
            model = self._create_model()
            response = await asyncio.to_thread(model.generate_content, prompt)
            
            # Parse the response
            evaluation_result = self._parse_evaluation_response(response.text)
            evaluation_result["evaluation_method"] = "llm_judge"
            
            return evaluation_result
            
        except Exception as e:
            # Enhanced error logging for debugging model access issues
            error_msg = str(e)
            print(f"Error during LLM evaluation with model {self.model_name}: {error_msg}")
            
            # Check for specific model access errors
            if "Publisher Model" in error_msg or "was not found" in error_msg:
                print(f"Model access error detected. Check if model '{self.model_name}' is available with your current authentication method.")
                print("Consider using a standard model name like 'gemini-pro', 'gemini-1.5-pro', or 'gemini-1.5-flash'")
                
                # Try to use a fallback working model for this evaluation
                if self.model_name != 'models/gemini-1.5-flash':
                    print(f"Attempting fallback to models/gemini-1.5-flash for this evaluation")
                    try:
                        fallback_prompt = self._build_evaluation_prompt(
                            question, expected_answer, actual_answer, detect_empathy, no_match_expected
                        )
                        fallback_model = genai.GenerativeModel('models/gemini-1.5-flash')
                        response = await asyncio.to_thread(fallback_model.generate_content, fallback_prompt)
                        evaluation_result = self._parse_evaluation_response(response.text)
                        evaluation_result["evaluation_method"] = "llm_judge_fallback"
                        return evaluation_result
                    except Exception as fallback_error:
                        print(f"Fallback model also failed: {fallback_error}")
                        
            elif "403" in error_msg or "permission" in error_msg.lower():
                print("Permission denied. Check if the Generative Language API is enabled and API key has proper permissions.")
            elif "quota" in error_msg.lower():
                print("API quota exceeded. Check your usage limits.")
            
            # Fall back to rule-based evaluation
            print("Falling back to rule-based evaluation...")
            return self._fallback_evaluation(expected_answer, actual_answer, question, detect_empathy, no_match_expected, error_msg)

    def _build_evaluation_prompt(
        self,
        question: str,
        expected_answer: str,
        actual_answer: str,
        detect_empathy: bool,
        no_match_expected: bool
    ) -> str:
        """Build the evaluation prompt for the LLM judge."""
        
        base_prompt = f"""
You are an expert AI judge evaluating conversational AI responses for a customer service system. Your task is to evaluate how well an actual response matches an expected response.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Criteria:**
Please evaluate the actual answer against the expected answer and provide:

1. **SIMILARITY_SCORE**: A score from 0-100 indicating how well the actual answer matches the expected answer in terms of:
   - Semantic meaning and content accuracy
   - Helpfulness to the user
   - Completeness of information
   - Appropriateness of tone and professionalism
   
   **Scoring Guidelines:**
   - 90-100: Excellent match - covers all key points with appropriate tone
   - 70-89: Good match - covers most key points with minor gaps
   - 50-69: Partial match - covers some key points but missing important information
   - 30-49: Poor match - misses most key points or provides incorrect information
   - 0-29: No match - completely irrelevant or contradictory response

2. **REASONING**: A detailed explanation of your scoring decision, highlighting:
   - What the actual answer got right
   - What was missing or incorrect
   - How well it addresses the user's question
   - Quality of tone and professionalism
"""

        if detect_empathy:
            base_prompt += """

3. **EMPATHY_SCORE**: A score from 0-100 evaluating how empathetic and understanding the actual response is:
   - Shows understanding of user's situation
   - Uses appropriate empathetic language
   - Demonstrates care and concern
   - Maintains professional yet warm tone
"""

        if no_match_expected:
            base_prompt += """

3. **NO_MATCH_ANALYSIS**: Evaluate whether the actual response appropriately indicates that it cannot help with this question:
   - Does it clearly state it cannot provide the requested information?
   - Does it offer alternative help or escalation options?
   - Is the response polite and professional?
   - Set NO_MATCH_DETECTED to true if this is handled appropriately, false otherwise.
"""

        base_prompt += """

**Response Format:**
Please format your response exactly as follows:

SIMILARITY_SCORE: [0-100]
"""

        if detect_empathy:
            base_prompt += "EMPATHY_SCORE: [0-100]\n"
        
        if no_match_expected:
            base_prompt += "NO_MATCH_DETECTED: [true/false]\n"

        base_prompt += """REASONING: [Your detailed explanation]

**Important Notes:**
- Be objective and consistent in your evaluation
- Consider that customer service responses should be helpful, accurate, and professionally appropriate
- Responses don't need to be word-for-word identical to score highly - semantic equivalence and helpfulness are key
- Focus on whether the user's needs would be met by the actual response
"""

        return base_prompt

    def _parse_evaluation_response(self, response_text: str) -> Dict[str, Any]:
        """Parse the LLM judge evaluation response into structured data."""
        
        result = {
            "similarity_score": 0,
            "evaluation_reasoning": "",
            "empathy_score": None,
            "no_match_detected": None
        }
        
        try:
            lines = response_text.strip().split('\n')
            current_section = None
            reasoning_lines = []
            
            for line in lines:
                line = line.strip()
                
                if line.startswith("SIMILARITY_SCORE:"):
                    score_text = line.replace("SIMILARITY_SCORE:", "").strip()
                    try:
                        # Extract just the number from the score
                        import re
                        match = re.search(r'\d+', score_text)
                        if match:
                            result["similarity_score"] = int(match.group())
                        else:
                            result["similarity_score"] = 0
                    except ValueError:
                        result["similarity_score"] = 0
                
                elif line.startswith("EMPATHY_SCORE:"):
                    score_text = line.replace("EMPATHY_SCORE:", "").strip()
                    try:
                        import re
                        match = re.search(r'\d+', score_text)
                        if match:
                            result["empathy_score"] = int(match.group())
                        else:
                            result["empathy_score"] = 0
                    except ValueError:
                        result["empathy_score"] = 0
                
                elif line.startswith("NO_MATCH_DETECTED:"):
                    match_text = line.replace("NO_MATCH_DETECTED:", "").strip().lower()
                    result["no_match_detected"] = match_text == "true"
                
                elif line.startswith("REASONING:"):
                    current_section = "reasoning"
                    reasoning_text = line.replace("REASONING:", "").strip()
                    if reasoning_text:
                        reasoning_lines.append(reasoning_text)
                
                elif current_section == "reasoning" and line:
                    reasoning_lines.append(line)
            
            result["evaluation_reasoning"] = " ".join(reasoning_lines)
            
            # Ensure similarity score is within bounds
            result["similarity_score"] = max(0, min(100, result["similarity_score"]))
            
            if result["empathy_score"] is not None:
                result["empathy_score"] = max(0, min(100, result["empathy_score"]))
            
        except Exception as e:
            result["evaluation_reasoning"] = f"Error parsing LLM judge response: {str(e)}"
        
        return result

    async def batch_evaluate(
        self,
        evaluations: list,
        batch_size: int = 5
    ) -> list:
        """
        Evaluate multiple responses in batches to manage rate limits.
        
        Args:
            evaluations: List of evaluation data dictionaries
            batch_size: Number of evaluations to process concurrently
            
        Returns:
            List of evaluation results
        """
        
        results = []
        
        for i in range(0, len(evaluations), batch_size):
            batch = evaluations[i:i + batch_size]
            batch_tasks = []
            
            for eval_data in batch:
                task = self.evaluate_response(
                    expected_answer=eval_data["expected_answer"],
                    actual_answer=eval_data["actual_answer"],
                    question=eval_data["question"],
                    detect_empathy=eval_data.get("detect_empathy", False),
                    no_match_expected=eval_data.get("no_match_expected", False)
                )
                batch_tasks.append(task)
            
            # Process batch concurrently
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    results.append({
                        "similarity_score": 0,
                        "evaluation_reasoning": f"Error during LLM judge evaluation: {str(result)}",
                        "empathy_score": None,
                        "no_match_detected": None,
                        "error": str(result)
                    })
                else:
                    results.append(result)
            
            # Small delay between batches to respect rate limits
            if i + batch_size < len(evaluations):
                await asyncio.sleep(1)  # 1 second delay
        
        return results

    async def evaluate_with_parameters(
        self,
        expected_answer: str,
        actual_answer: str,
        question: str,
        evaluation_parameters: List[Dict[str, Any]],
        detect_empathy: bool = False,
        no_match_expected: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluate a response using a configurable set of evaluation parameters.
        
        Args:
            expected_answer: The expected/ideal response
            actual_answer: The actual response from Dialogflow
            question: The original question/query
            evaluation_parameters: List of parameter configs with {id, type, weight, enabled, prompt_template}
            detect_empathy: Whether to evaluate empathy (legacy support)
            no_match_expected: Whether this should be a "can't help" response (legacy support)
            
        Returns:
            Dict containing overall_score, parameter_scores, and legacy fields for backward compatibility
        """
        
        try:
            # Filter enabled parameters with non-zero weight
            enabled_params = [
                p for p in evaluation_parameters 
                if p.get('enabled', True) and p.get('weight', 0) > 0
            ]
            
            if not enabled_params:
                # Fallback to legacy evaluation if no parameters enabled or all have 0% weight
                return await self.evaluate_response(
                    expected_answer, actual_answer, question, detect_empathy, no_match_expected
                )
            
            # Evaluate each parameter individually
            parameter_results = []
            
            for param_config in enabled_params:
                param_type = param_config.get('parameter_type', param_config.get('type'))
                weight = param_config.get('weight', 33)
                
                # Evaluate this specific parameter
                param_result = await self._evaluate_single_parameter(
                    question, expected_answer, actual_answer, param_config
                )
                
                parameter_results.append({
                    'parameter_id': param_config.get('id'),
                    'parameter_type': param_type,
                    'score': param_result['score'],
                    'weight': weight,
                    'reasoning': param_result['reasoning'],
                    'parsing_errors': param_result.get('parsing_errors', [])
                })
            
            # Calculate weighted aggregate score
            weighted_result = self._calculate_weighted_score(parameter_results, enabled_params)
            
            # Maintain backward compatibility by extracting legacy scores
            legacy_scores = self._extract_legacy_scores(parameter_results)
            
            return {
                'overall_score': weighted_result['aggregate_score'],
                'parameter_scores': parameter_results,
                'weighted_breakdown': weighted_result,
                
                # Legacy fields for backward compatibility
                'similarity_score': legacy_scores.get('similarity_score'),
                'empathy_score': legacy_scores.get('empathy_score'),
                'no_match_detected': legacy_scores.get('no_match_detected'),
                'evaluation_reasoning': self._combine_reasoning(parameter_results)
            }
            
        except Exception as e:
            return {
                'overall_score': 0,
                'parameter_scores': [],
                'similarity_score': 0,
                'evaluation_reasoning': f"Error during multi-parameter evaluation: {str(e)}",
                'empathy_score': 0 if detect_empathy else None,
                'no_match_detected': False,
                'error': str(e)
            }

    async def _evaluate_single_parameter(
        self,
        question: str,
        expected_answer: str,
        actual_answer: str,
        param_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate a single parameter using either system prompts or custom prompts.
        
        Args:
            question: The original question
            expected_answer: Expected response
            actual_answer: Actual response
            param_config: Parameter configuration with type, prompt_template, etc.
            
        Returns:
            Dict with score and reasoning for this parameter
        """
        
        param_type = param_config.get('parameter_type', param_config.get('type'))
        custom_prompt = param_config.get('prompt_template')
        
        try:
            if custom_prompt:
                # Use custom prompt template
                prompt = self._build_custom_parameter_prompt(
                    question, expected_answer, actual_answer, custom_prompt, param_config
                )
            else:
                # Use system prompt for standard parameter types
                prompt = self._build_parameter_specific_prompt(
                    question, expected_answer, actual_answer, param_type
                )
            
            # Use Gemini for evaluation with appropriate authentication
            print(f"Using Gemini model: {self.model_name} for parameter evaluation: {param_type}")
            model = self._create_model()
            response = await asyncio.to_thread(model.generate_content, prompt)
            
            # Parse the response
            return self._parse_parameter_response(response.text, param_type)
            
        except Exception as e:
            # Enhanced error logging for debugging model access issues
            error_msg = str(e)
            print(f"Error evaluating parameter {param_type} with model {self.model_name}: {error_msg}")
            
            # Check for specific model access errors
            if "Publisher Model" in error_msg or "was not found" in error_msg:
                print(f"Model access error detected. Check if model '{self.model_name}' is available with your current authentication method.")
                print("Consider using a standard model name like 'gemini-pro', 'gemini-1.5-pro', or 'gemini-1.5-flash'")
            
            return {
                'score': 0,
                'reasoning': f"Error evaluating parameter {param_type}: {error_msg}"
            }

    def _build_parameter_specific_prompt(
        self,
        question: str,
        expected_answer: str,
        actual_answer: str,
        parameter_name: str,
        prompt_template: str = None
    ) -> str:
        """Build prompts using the parameter's custom prompt template or a default."""
        
        if prompt_template:
            # Use the custom prompt template from the parameter
            return prompt_template.format(
                question=question,
                expected_answer=expected_answer,
                actual_answer=actual_answer
            )
        
        # Fallback to a generic prompt based on parameter name
        base_context = f"""
You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task: {parameter_name} Assessment**
Evaluate the actual response for the "{parameter_name}" parameter.

**Scoring Guidelines:**
- 90-100: Excellent
- 70-89: Good
- 50-69: Average
- 30-49: Poor
- 0-29: Very Poor

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the assessment]

**Important Instructions:**
- Score must be between 0-100
- Provide clear reasoning for your score
- Consider the context and user's needs
- Be consistent and objective in your evaluation
"""
        return base_context

    def _build_custom_parameter_prompt(
        self,
        question: str,
        expected_answer: str,
        actual_answer: str,
        prompt_template: str,
        param_config: Dict[str, Any]
    ) -> str:
        """Build prompt using custom template with variable substitution and validation."""
        
        # Validate the template first
        validation_result = validate_prompt_template(prompt_template)
        if not validation_result['valid']:
            # Fall back to parameter-specific prompt if custom template is invalid
            param_type = param_config.get('parameter_type', param_config.get('type'))
            return self._build_parameter_specific_prompt(
                question, expected_answer, actual_answer, param_type
            )
        
        # Variable substitution
        try:
            prompt = prompt_template.format(
                question=question,
                expected_answer=expected_answer,
                actual_answer=actual_answer,
                parameter_name=param_config.get('name', 'Custom Parameter'),
                parameter_description=param_config.get('description', '')
            )
        except KeyError as e:
            # Template has unsupported variables, fall back to default
            param_type = param_config.get('parameter_type', param_config.get('type'))
            return self._build_parameter_specific_prompt(
                question, expected_answer, actual_answer, param_type
            )
        
        # Ensure structured response format is included
        if "SCORE:" not in prompt or "REASONING:" not in prompt:
            prompt += """

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the evaluation]

**Important Instructions:**
- Provide exactly one integer score between 0 and 100
- Include detailed reasoning that explains your scoring decision
- Be objective and consistent in your evaluation"""
        
        return prompt

    def _parse_parameter_response(self, response_text: str, parameter_name: str) -> Dict[str, Any]:
        """Parse parameter-specific evaluation response with enhanced validation."""
        
        result = {
            'score': 0,
            'reasoning': 'No valid response received',
            'parsing_errors': []
        }
        
        try:
            lines = response_text.strip().split('\n')
            reasoning_lines = []
            score_found = False
            
            for line in lines:
                line = line.strip()
                
                if line.startswith("SCORE:"):
                    score_text = line.replace("SCORE:", "").strip()
                    try:
                        # Extract numeric score using regex
                        match = re.search(r'\b(\d+)\b', score_text)
                        if match:
                            raw_score = int(match.group(1))
                            # Validate score is in 0-100 range
                            result['score'] = max(0, min(100, raw_score))
                            score_found = True
                            
                            # Warn if score was clamped
                            if raw_score != result['score']:
                                result['parsing_errors'].append(
                                    f"Score {raw_score} was clamped to {result['score']} (valid range: 0-100)"
                                )
                        else:
                            result['parsing_errors'].append("No numeric score found in SCORE line")
                    except ValueError as e:
                        result['parsing_errors'].append(f"Could not parse score: {str(e)}")
                
                elif line.startswith("REASONING:"):
                    reasoning_text = line.replace("REASONING:", "").strip()
                    if reasoning_text:
                        reasoning_lines.append(reasoning_text)
                    # Continue collecting reasoning from subsequent lines
                    
                elif reasoning_lines and line:  # Continuation of reasoning
                    reasoning_lines.append(line)
            
            # Compile reasoning
            if reasoning_lines:
                result['reasoning'] = " ".join(reasoning_lines)
            elif not score_found:
                result['reasoning'] = "Could not parse LLM response - no structured output found"
                result['parsing_errors'].append("No SCORE or REASONING sections found")
            
            # Validate minimum requirements
            if not score_found:
                result['score'] = 0
                result['parsing_errors'].append("No valid score found in response")
            
            if not result['reasoning'].strip():
                result['reasoning'] = "No reasoning provided by LLM"
                result['parsing_errors'].append("No reasoning text found")
                
        except Exception as e:
            result['reasoning'] = f"Error parsing LLM judge response: {str(e)}"
            result['parsing_errors'].append(f"Parsing exception: {str(e)}")
        
        return result

    def _calculate_weighted_score(
        self, 
        parameter_results: List[Dict[str, Any]], 
        parameters_config: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate weighted aggregate score from individual parameter scores."""
        
        total_weighted_score = 0
        total_weight = 0
        individual_scores = {}
        
        # Create a map of parameter types to weights
        weight_map = {}
        for config in parameters_config:
            param_type = config.get('parameter_type', config.get('type'))
            weight = config.get('weight', 33)  # Default weight
            weight_map[param_type] = weight
            total_weight += weight
        
        # Calculate weighted scores
        for result in parameter_results:
            param_type = result.get('parameter_type')
            score = result.get('score', 0)
            weight = weight_map.get(param_type, 33)
            
            individual_scores[param_type] = {
                'score': score,
                'weight': weight,
                'weighted_score': (score * weight / 100) if total_weight > 0 else 0
            }
            
            total_weighted_score += (score * weight / 100) if total_weight > 0 else 0
        
        # Normalize to 0-100 scale if weights don't sum to 100
        if total_weight != 100 and total_weight > 0:
            total_weighted_score = (total_weighted_score * 100) / total_weight
        
        # Clamp to valid range
        aggregate_score = max(0, min(100, round(total_weighted_score)))
        
        return {
            'aggregate_score': aggregate_score,
            'individual_scores': individual_scores,
            'total_weight': total_weight,
            'weights_normalized': total_weight != 100
        }

    def _extract_legacy_scores(self, parameter_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract legacy score fields for backward compatibility."""
        
        legacy_scores = {}
        
        for param_result in parameter_results:
            param_name = param_result.get('parameter_name', '')
            
            if param_name == 'Similarity Score':
                legacy_scores['similarity_score'] = param_result['score']
            elif param_name == 'Empathy Level':
                legacy_scores['empathy_score'] = param_result['score']
            elif param_name == 'No-Match Detection':
                # Convert score to boolean (>= 80 means properly detected)
                legacy_scores['no_match_detected'] = param_result['score'] >= 80
        
        return legacy_scores

    def _combine_reasoning(self, parameter_results: List[Dict[str, Any]]) -> str:
        """Combine reasoning from all parameters into a nicely formatted summary."""
        
        if not parameter_results:
            return "No parameter evaluations performed."
        
        total_params = len(parameter_results)
        
        # Create a concise, well-formatted summary
        if total_params == 1:
            reasoning = parameter_results[0].get('reasoning', '').strip()
            return reasoning if reasoning else "Evaluation completed."
        
        # For multiple parameters, create a structured summary
        formatted_lines = []
        for param_result in parameter_results:
            param_type = param_result.get('parameter_type', 'Unknown')
            score = param_result.get('score', 0)
            reasoning = param_result.get('reasoning', '').strip()
            
            if reasoning:
                # Format each evaluator as "• Type (Score): Reasoning"
                formatted_lines.append(f"• {param_type} ({score}/100): {reasoning}")
        
        if formatted_lines:
            header = f"Evaluation across {total_params} criteria:"
            return f"{header}\n" + "\n".join(formatted_lines)
        
        return "Evaluation completed but no detailed reasoning was provided."

    async def batch_evaluate_with_parameters(
        self,
        evaluations: List[Dict[str, Any]],
        evaluation_parameters: List[Dict[str, Any]],
        batch_size: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Evaluate multiple responses with configurable parameters in batches.
        
        Args:
            evaluations: List of evaluation data dictionaries
            evaluation_parameters: Parameter configuration for all evaluations
            batch_size: Number of evaluations to process concurrently
            
        Returns:
            List of evaluation results with parameter breakdowns
        """
        
        results = []
        
        for i in range(0, len(evaluations), batch_size):
            batch = evaluations[i:i + batch_size]
            batch_tasks = []
            
            for eval_data in batch:
                task = self.evaluate_with_parameters(
                    expected_answer=eval_data["expected_answer"],
                    actual_answer=eval_data["actual_answer"],
                    question=eval_data["question"],
                    evaluation_parameters=evaluation_parameters,
                    detect_empathy=eval_data.get("detect_empathy", False),
                    no_match_expected=eval_data.get("no_match_expected", False)
                )
                batch_tasks.append(task)
            
            # Process batch concurrently
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    results.append({
                        "overall_score": 0,
                        "parameter_scores": [],
                        "similarity_score": 0,
                        "evaluation_reasoning": f"Error during multi-parameter evaluation: {str(result)}",
                        "empathy_score": None,
                        "no_match_detected": None,
                        "error": str(result)
                    })
                else:
                    results.append(result)
            
            # Small delay between batches to respect rate limits
            if i + batch_size < len(evaluations):
                await asyncio.sleep(1)  # 1 second delay
        
        return results