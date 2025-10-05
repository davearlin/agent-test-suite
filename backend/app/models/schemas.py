from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator, model_validator, computed_field, field_validator, ConfigDict
from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    test_manager = "test_manager"
    viewer = "viewer"


class Priority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class TestStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.viewer
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class User(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


# Quick Test Preferences Schema
class QuickTestPreferences(BaseModel):
    project_id: Optional[str] = None
    agent_id: Optional[str] = None
    flow_id: Optional[str] = None
    page_id: Optional[str] = None
    playbook_id: Optional[str] = None
    llm_model_id: Optional[str] = None
    session_id: Optional[str] = None
    session_parameters: Optional[Dict[str, str]] = None  # Generic key-value session parameters
    pre_prompt_messages: Optional[List[str]] = None  # Pre-prompt messages for Quick Test
    post_prompt_messages: Optional[List[str]] = None  # Post-prompt messages for Quick Test
    enable_webhook: Optional[bool] = None  # Enable webhook setting for Quick Test

    model_config = ConfigDict(from_attributes=True)


class QuickTestPreferencesUpdate(BaseModel):
    project_id: Optional[str] = None
    agent_id: Optional[str] = None
    flow_id: Optional[str] = None
    page_id: Optional[str] = None
    playbook_id: Optional[str] = None
    llm_model_id: Optional[str] = None
    session_id: Optional[str] = None
    session_parameters: Optional[Dict[str, str]] = None  # Generic key-value session parameters
    pre_prompt_messages: Optional[List[str]] = None  # Pre-prompt messages for Quick Test
    post_prompt_messages: Optional[List[str]] = None  # Post-prompt messages for Quick Test
    enable_webhook: Optional[bool] = None  # Enable webhook setting for Quick Test


# Test Run Preferences Schema
class TestRunPreferences(BaseModel):
    test_run_project_id: Optional[str] = None
    test_run_agent_id: Optional[str] = None
    test_run_flow_id: Optional[str] = None
    test_run_page_id: Optional[str] = None
    test_run_playbook_id: Optional[str] = None
    test_run_llm_model_id: Optional[str] = None
    test_run_session_parameters: Optional[Dict[str, str]] = None  # Generic key-value session parameters
    test_run_pre_prompt_messages: Optional[List[str]] = None  # Pre-prompt messages for Test Run
    test_run_post_prompt_messages: Optional[List[str]] = None  # Post-prompt messages for Test Run
    test_run_enable_webhook: Optional[bool] = None  # Enable webhook setting
    test_run_evaluation_parameters: Optional[str] = None  # JSON string of evaluation parameters
    test_run_batch_size: Optional[int] = None  # Preferred batch size for Test Run

    model_config = ConfigDict(from_attributes=True)


class TestRunPreferencesUpdate(BaseModel):
    test_run_project_id: Optional[str] = None
    test_run_agent_id: Optional[str] = None
    test_run_flow_id: Optional[str] = None
    test_run_page_id: Optional[str] = None
    test_run_playbook_id: Optional[str] = None
    test_run_llm_model_id: Optional[str] = None
    test_run_session_parameters: Optional[Dict[str, str]] = None  # Generic key-value session parameters
    test_run_pre_prompt_messages: Optional[List[str]] = None  # Pre-prompt messages for Test Run
    test_run_post_prompt_messages: Optional[List[str]] = None  # Post-prompt messages for Quick Test
    test_run_enable_webhook: Optional[bool] = None  # Enable webhook setting
    test_run_evaluation_parameters: Optional[str] = None  # JSON string of evaluation parameters
    test_run_batch_size: Optional[int] = None  # Preferred batch size for Test Run


# Question Schemas
class QuestionBase(BaseModel):
    question_text: str
    expected_answer: str
    detect_empathy: bool = False
    no_match: bool = False
    priority: Priority = Priority.medium
    tags: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = Field(default={}, alias="question_metadata")

    @field_validator('tags', mode='before')
    @classmethod
    def ensure_tags_is_list(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return []

    @field_validator('metadata', mode='before')
    @classmethod
    def ensure_metadata_is_dict(cls, v):
        if v is None:
            return {}
        if hasattr(v, '__dict__'):  # Handle any object that shouldn't be here
            return {}
        if isinstance(v, dict):
            return v
        return {}


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    expected_answer: Optional[str] = None
    detect_empathy: Optional[bool] = None
    no_match: Optional[bool] = None
    priority: Optional[Priority] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class Question(QuestionBase):
    id: int
    dataset_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# Dataset Schemas
class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    version: str = "1.0"


class DatasetCreate(DatasetBase):
    questions: Optional[List[QuestionCreate]] = []


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None


class Dataset(DatasetBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    questions: List[Question] = []

    model_config = ConfigDict(from_attributes=True)


class DatasetSummary(BaseModel):
    id: int
    name: str
    category: str
    version: str
    question_count: int
    created_at: datetime
    owner_name: str


# Test Run Schemas
class TestRunBase(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: str  # Full agent path for API calls
    agent_display_name: Optional[str] = None  # Display name for UI
    flow_name: str = "Default Start Flow"
    flow_display_name: Optional[str] = None  # Display name for UI
    page_name: str = "Start Page"
    page_display_name: Optional[str] = None  # Display name for UI
    environment: str = "draft"
    batch_size: int = 10
    session_parameters: Optional[Dict[str, str]] = None  # Generic key-value session parameters
    enable_webhook: bool = True  # Default to enabled webhooks
    # Pre/Post Prompt Messages
    pre_prompt_messages: Optional[List[str]] = None  # Messages to send before each main question
    post_prompt_messages: Optional[List[str]] = None  # Messages to send after each main question
    # Playbook support fields
    playbook_id: Optional[str] = None
    playbook_display_name: Optional[str] = None  # Display name for UI
    llm_model_id: Optional[str] = None
    # LLM Evaluation Model
    evaluation_model_id: str  # LLM model ID for LLM Judge evaluation (required)
    # Evaluation parameter configuration
    evaluation_parameters: Optional[List['EvaluationParameterConfig']] = None


class TestRunCreate(TestRunBase):
    __test__ = False  # Prevent pytest from collecting this class
    dataset_ids: List[int]  # Multiple datasets for multi-dataset test runs
    # Keep single dataset_id for backward compatibility
    dataset_id: Optional[int] = None


class TestRunUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TestStatus] = None


class TestRun(TestRunBase):
    id: int
    created_at: datetime
    created_by_id: int  # Changed from owner_id to match database model
    status: TestStatus = TestStatus.pending
    
    # Results tracking fields
    total_questions: int = 0
    completed_questions: int = 0
    average_score: Optional[int] = None  # 0-100
    
    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    datasets: List[Dataset] = []
    test_results: List["TestResult"] = []
    evaluation_config: Optional["TestRunEvaluationConfigRead"] = None

    model_config = ConfigDict(from_attributes=True)


class TestRunRead(TestRunBase):
    """Lightweight schema for listing test runs without heavy nested data"""
    id: int
    created_at: datetime
    created_by_id: int  # Changed from owner_id to match database model
    status: TestStatus = TestStatus.pending
    
    # Results tracking fields
    total_questions: int = 0
    completed_questions: int = 0
    average_score: Optional[int] = None  # 0-100
    
    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # User information fields
    created_by_email: Optional[str] = None
    created_by_name: Optional[str] = None
    
    # Lightweight dataset info (just names, not full objects)
    datasets: List[Dataset] = []

    model_config = ConfigDict(from_attributes=True)


class TestRunDetail(TestRunRead):
    """Detailed schema for individual test run view with all nested data"""
    test_results: List["TestResultWithParameters"] = []
    evaluation_config: Optional["TestRunEvaluationConfigRead"] = None
    
    # Computed field for backward compatibility
    @computed_field
    @property
    def overall_score(self) -> Optional[int]:
        if not self.test_results:
            return None
        
        scores = [
            r.overall_score
            for r in self.test_results 
            if r.overall_score is not None
        ]
        
        if not scores:
            return None
            
        return round(sum(scores) / len(scores))

    model_config = ConfigDict(from_attributes=True)


class WebhookInfo(BaseModel):
    called: bool
    url: Optional[str] = None
    status: Optional[str] = None
    request_payload: Optional[Dict[str, Any]] = None
    response_payload: Optional[List[Dict[str, Any]]] = None


class QuickTestRequest(BaseModel):
    prompt: str
    agent_id: str
    flow_id: Optional[str] = None
    page_id: Optional[str] = None
    playbook_id: Optional[str] = None
    llm_model_id: Optional[str] = None  # For playbooks: gemini-1.5-pro, etc.
    session_id: Optional[str] = None
    session_parameters: Optional[Dict[str, str]] = None  # Generic key-value session parameters
    enable_webhook: bool = True  # Default to enabled webhooks
    # Pre/Post Prompt Messages
    pre_prompt_messages: Optional[List[str]] = None  # Messages to send before the main prompt
    post_prompt_messages: Optional[List[str]] = None  # Messages to send after the main prompt


class QuickTestResponse(BaseModel):
    prompt: str
    response: str
    agent_id: str
    flow_id: Optional[str] = None
    page_id: Optional[str] = None
    playbook_id: Optional[str] = None
    llm_model_id: Optional[str] = None
    session_id: str
    response_time_ms: int
    intent: str
    confidence: float
    parameters: Dict[str, Any]
    response_messages: List[str]
    webhook_info: Optional[WebhookInfo] = None
    is_mock: bool = False
    message_sequence: Optional[List[Dict[str, Any]]] = None
    sequence_summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    dialogflow_response: Optional[Dict[str, Any]] = None


# Evaluation Configuration Schemas
class EvaluationParameterConfig(BaseModel):
    """Individual parameter configuration within a test run evaluation config"""
    parameter_id: int
    weight: int = Field(..., ge=0, le=100, description="Weight percentage (0-100)")
    enabled: bool = True


# Evaluation Parameter Schemas
class EvaluationParameterBase(BaseModel):
    name: str
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    is_active: bool = True

    @field_validator('prompt_template')
    @classmethod
    def validate_prompt_template(cls, v):
        """Validate that prompt template follows required structure"""
        if v is not None and v.strip():
            from app.core.prompt_templates import validate_prompt_template
            validation_result = validate_prompt_template(v)
            if not validation_result['valid']:
                raise ValueError(f"Invalid prompt template: {'; '.join(validation_result['errors'])}")
        return v


class EvaluationParameterCreate(EvaluationParameterBase):
    pass


class EvaluationParameterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('prompt_template')
    @classmethod
    def validate_prompt_template(cls, v):
        """Validate that prompt template follows required structure"""
        if v is not None and v.strip():
            from app.core.prompt_templates import validate_prompt_template
            validation_result = validate_prompt_template(v)
            if not validation_result['valid']:
                raise ValueError(f"Invalid prompt template: {'; '.join(validation_result['errors'])}")
        return v


class EvaluationParameter(EvaluationParameterBase):
    id: int
    is_system_default: bool
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Evaluation Preset Schemas
class EvaluationPresetBase(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: List[EvaluationParameterConfig]
    is_public: bool = False

    @model_validator(mode='before')
    @classmethod
    def validate_weights(cls, data):
        """Ensure at least one parameter is enabled and weights sum to 100"""
        if 'parameters' not in data or not isinstance(data['parameters'], list):
            return data

        parameters = data['parameters']
        enabled_params = [p for p in parameters if p.get('enabled', True)]
        if not enabled_params:
            raise ValueError("At least one evaluation parameter must be enabled")
        
        # Only count parameters with weight > 0 in the sum validation
        weighted_params = [p for p in enabled_params if p.get('weight', 0) > 0]
        if not weighted_params:
            # Allow if all weights are 0, e.g., for a draft preset
            pass
        else:
            total_weight = sum(p.get('weight', 0) for p in weighted_params)
            if total_weight != 100:
                raise ValueError(f"Enabled parameter weights must sum to 100, got {total_weight}")
        
        return data


class EvaluationPresetCreate(EvaluationPresetBase):
    pass


class EvaluationPresetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[List[EvaluationParameterConfig]] = None
    is_public: Optional[bool] = None

    @model_validator(mode='before')
    @classmethod
    def validate_weights(cls, data):
        if 'parameters' not in data or not isinstance(data.get('parameters'), list):
            return data

        parameters = data['parameters']
        enabled_params = [p for p in parameters if p.get('enabled', True)]
        if not enabled_params:
            raise ValueError("At least one evaluation parameter must be enabled")
        
        # Only count parameters with weight > 0 in the sum validation
        weighted_params = [p for p in enabled_params if p.get('weight', 0) > 0]
        if not weighted_params:
            # Allow if all weights are 0
            pass
        else:
            total_weight = sum(p.get('weight', 0) for p in weighted_params)
            if total_weight != 100:
                raise ValueError(f"Enabled parameter weights must sum to 100, got {total_weight}")
        
        return data


class EvaluationPreset(EvaluationPresetBase):
    id: int
    is_system_default: bool
    created_by_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Test Run Evaluation Configuration Schemas  
class TestRunEvaluationConfigBase(BaseModel):
    name: Optional[str] = None
    parameters: List[EvaluationParameterConfig]
    is_default: bool = False

    @model_validator(mode='before')
    @classmethod
    def validate_weights(cls, data):
        if 'parameters' not in data or not isinstance(data.get('parameters'), list):
            return data

        parameters = data['parameters']
        enabled_params = [p for p in parameters if p.get('enabled', True)]
        if not enabled_params:
            raise ValueError("At least one evaluation parameter must be enabled")
        
        # Only count parameters with weight > 0 in the sum validation
        weighted_params = [p for p in enabled_params if p.get('weight', 0) > 0]
        if not weighted_params:
            # Allow if all weights are 0
            pass
        else:
            total_weight = sum(p.get('weight', 0) for p in weighted_params)
            if total_weight != 100:
                raise ValueError(f"Enabled parameter weights must sum to 100, got {total_weight}")
        
        return data


class TestRunEvaluationConfigCreate(TestRunEvaluationConfigBase):
    pass


class TestRunEvaluationConfigUpdate(BaseModel):
    name: Optional[str] = None
    parameters: Optional[List[EvaluationParameterConfig]] = None
    is_default: Optional[bool] = None

    @model_validator(mode='before')
    @classmethod
    def validate_weights(cls, data):
        if 'parameters' not in data or not isinstance(data.get('parameters'), list):
            return data

        parameters = data['parameters']
        enabled_params = [p for p in parameters if p.get('enabled', True)]
        if not enabled_params:
            raise ValueError("At least one evaluation parameter must be enabled")
        
        # Only count parameters with weight > 0 in the sum validation
        weighted_params = [p for p in enabled_params if p.get('weight', 0) > 0]
        if not weighted_params:
            # Allow if all weights are 0
            pass
        else:
            total_weight = sum(p.get('weight', 0) for p in weighted_params)
            if total_weight != 100:
                raise ValueError(f"Enabled parameter weights must sum to 100, got {total_weight}")
        
        return data


class TestRunEvaluationConfig(TestRunEvaluationConfigBase):
    id: int
    test_run_id: Optional[int] = None
    user_id: int
    preset_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Read-only version without strict validation for existing data
class TestRunEvaluationConfigRead(BaseModel):
    id: int
    name: Optional[str] = None
    parameters: List[EvaluationParameterConfig] = []
    is_default: bool = False
    test_run_id: Optional[int] = None
    user_id: int
    preset_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
    
    # Override to skip parameter validation when reading existing data
    @classmethod
    def model_validate(cls, obj, **kwargs):
        # If this is a database object, extract and clean the data first
        if hasattr(obj, '__dict__'):
            data = {}
            for field_name, field_info in cls.model_fields.items():
                if hasattr(obj, field_name):
                    data[field_name] = getattr(obj, field_name)
            # For parameters, skip validation and just pass through
            if 'parameters' in data and data['parameters']:
                # Keep parameters as-is for reading, don't validate weights
                pass
            return cls(**data)
        return super().model_validate(obj, **kwargs)


# Test Result Schemas
class TestResultBase(BaseModel):
    actual_answer: Optional[str] = None
    dialogflow_response: Optional[Dict[str, Any]] = None
    evaluation_reasoning: Optional[str] = None
    no_match_detected: Optional[bool] = None
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None


class TestResult(TestResultBase):
    id: int
    test_run_id: int
    question_id: int
    created_at: datetime
    question: Question
    
    # Include parameter scores for multi-parameter evaluation
    parameter_scores: List["TestResultParameterScore"] = []

    model_config = ConfigDict(from_attributes=True)


# Dialogflow Schemas
class DialogflowAgent(BaseModel):
    name: str
    display_name: str
    location: str
    accessible: bool = True  # Default to True for backward compatibility


class DialogflowFlow(BaseModel):
    name: str
    display_name: str


class DialogflowPage(BaseModel):
    name: str
    display_name: str


# Analytics Schemas
class TestRunAnalytics(BaseModel):
    test_run_id: int
    test_run_name: str
    dataset_name: str
    average_score: Optional[int]
    total_questions: int
    completed_questions: int
    success_rate: float
    created_at: datetime
    execution_time_minutes: Optional[float]


class CategoryAnalytics(BaseModel):
    category: str
    total_tests: int
    average_score: float
    success_rate: float
    question_count: int


class TrendData(BaseModel):
    date: str
    average_score: float
    test_count: int
    success_rate: float


# File Upload Schemas
class DatasetImport(BaseModel):
    file_type: str  # csv, json, excel
    has_headers: bool = True
    question_column: str = "question"
    answer_column: str = "answer"
    empathy_column: Optional[str] = None
    no_match_column: Optional[str] = None
    priority_column: Optional[str] = None
    tags_column: Optional[str] = None
    metadata_columns: Optional[List[str]] = None  # Columns to store as metadata


class CSVPreview(BaseModel):
    """Preview of CSV file for column mapping"""
    headers: List[str]
    sample_rows: List[Dict[str, str]]
    total_rows: int
    html_analysis: Optional[Dict[str, Dict]] = None  # HTML analysis per column


# WebSocket Schemas
class TestProgress(BaseModel):
    test_run_id: int
    completed_questions: int
    total_questions: int
    current_question: str
    average_score: Optional[float] = None
    estimated_time_remaining: Optional[int] = None  # seconds
    status: TestStatus


class TestResultUpdate(BaseModel):
    test_run_id: int
    question_id: int
    result: "TestResultWithParameters"


# Test Result Parameter Score Schemas
class TestResultParameterScoreBase(BaseModel):
    parameter_id: int
    score: int = Field(..., ge=0, le=100, description="Parameter score (0-100)")
    weight_used: int = Field(..., ge=0, le=100, description="Weight percentage used")
    reasoning: Optional[str] = None


class TestResultParameterScoreCreate(TestResultParameterScoreBase):
    test_result_id: int


class TestResultParameterScore(TestResultParameterScoreBase):
    id: int
    test_result_id: int
    created_at: datetime
    parameter: Optional[EvaluationParameter] = None

    model_config = ConfigDict(from_attributes=True)


# Enhanced Test Result Schema with Parameter Breakdown
class TestResultWithParameters(BaseModel):
    """Enhanced test result that includes parameter score breakdown"""
    id: int
    test_run_id: int
    question_id: int
    actual_answer: Optional[str] = None
    dialogflow_response: Optional[Dict[str, Any]] = None
    
    evaluation_reasoning: Optional[str] = None
    no_match_detected: Optional[bool] = None
    
    # Dynamic parameter-based scoring (primary system)
    parameter_scores: List[TestResultParameterScore] = []
    
    # Execution details
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    # Related data
    question: Optional["Question"] = None

    # Computed legacy fields for backward compatibility (derived from parameter_scores)
    @computed_field
    @property
    def similarity_score(self) -> Optional[int]:
        """Backward compatibility: return Similarity Score parameter if available"""
        for param_score in self.parameter_scores:
            if hasattr(param_score, 'parameter') and param_score.parameter and param_score.parameter.name == "Similarity Score":
                return param_score.score
            # Fallback for cases where parameter relationship isn't loaded
            elif hasattr(param_score, 'parameter_id'):
                # This would need a lookup, but for now return None to avoid DB calls in computed field
                continue
        return None
    
    @computed_field
    @property 
    def empathy_score(self) -> Optional[int]:
        """Backward compatibility: return Empathy Level parameter if available"""
        for param_score in self.parameter_scores:
            if hasattr(param_score, 'parameter') and param_score.parameter and param_score.parameter.name == "Empathy Level":
                return param_score.score
        return None
    
    @computed_field
    @property
    def overall_score(self) -> Optional[int]:
        """Computed weighted average from all parameter scores"""
        if not self.parameter_scores:
            return None
            
        total_weighted_score = 0
        total_weight = 0
        
        for param_score in self.parameter_scores:
            if param_score.score is not None and param_score.weight_used is not None:
                total_weighted_score += param_score.score * param_score.weight_used
                total_weight += param_score.weight_used
        
        if total_weight > 0:
            return round(total_weighted_score / total_weight)
        return None

    model_config = ConfigDict(from_attributes=True)


# User Preferences for Evaluation Parameters
class UserEvaluationPreferences(BaseModel):
    """User's default evaluation parameter preferences"""
    default_config_id: Optional[int] = None
    saved_configs: List[TestRunEvaluationConfig] = []

    model_config = ConfigDict(from_attributes=True)


# Quick Add Parameter Schemas
class QuickAddParameterBase(BaseModel):
    name: str = Field(..., description="Display name for the parameter")
    key: str = Field(..., description="Parameter key")
    value: str = Field(..., description="Parameter value")
    description: Optional[str] = Field(None, description="Optional description")
    is_active: bool = Field(True, description="Whether the parameter is active")
    sort_order: int = Field(0, description="Sort order for UI display")


class QuickAddParameterCreate(QuickAddParameterBase):
    pass


class QuickAddParameterUpdate(BaseModel):
    name: Optional[str] = None
    key: Optional[str] = None
    value: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class QuickAddParameter(QuickAddParameterBase):
    id: int
    created_by_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Rebuild models to resolve forward references
TestRunBase.model_rebuild()
TestRunCreate.model_rebuild()
TestRunUpdate.model_rebuild()
TestRun.model_rebuild()
TestRunRead.model_rebuild()
TestResult.model_rebuild()
TestResultWithParameters.model_rebuild()
EvaluationPresetCreate.model_rebuild()
EvaluationPresetUpdate.model_rebuild()
EvaluationPreset.model_rebuild()
TestRunEvaluationConfigCreate.model_rebuild()
TestRunEvaluationConfigUpdate.model_rebuild()
TestRunEvaluationConfig.model_rebuild()
TestRunEvaluationConfigRead.model_rebuild()
UserEvaluationPreferences.model_rebuild()
QuickAddParameterCreate.model_rebuild()
QuickAddParameterUpdate.model_rebuild()
QuickAddParameter.model_rebuild()
TestResultUpdate.model_rebuild()