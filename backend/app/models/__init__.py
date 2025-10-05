from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    test_manager = "test_manager"
    viewer = "viewer"


class Priority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class TestStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.viewer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Google OAuth tokens for user-specific API access
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    google_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Quick Test preferences - remembers user's last selections
    quick_test_project_id = Column(String, nullable=True)
    quick_test_agent_id = Column(String, nullable=True)
    quick_test_flow_id = Column(String, nullable=True)
    quick_test_page_id = Column(String, nullable=True)
    quick_test_session_id = Column(String, nullable=True)
    quick_test_session_parameters = Column(JSON, nullable=True)  # Generic key-value session parameters
    quick_test_playbook_id = Column(String, nullable=True)  # Quick Test saved playbook
    quick_test_llm_model_id = Column(String, nullable=True)  # Quick Test saved LLM model
    quick_test_pre_prompt_messages = Column(JSON, nullable=True)  # Pre-prompt messages for Quick Test
    quick_test_post_prompt_messages = Column(JSON, nullable=True)  # Post-prompt messages for Quick Test
    quick_test_enable_webhook = Column(Boolean, nullable=True, default=True)  # Enable webhook setting for Quick Test
    
    # Test Run preferences - remembers user's last selections for test run creation
    test_run_project_id = Column(String, nullable=True)
    test_run_agent_id = Column(String, nullable=True)
    test_run_flow_id = Column(String, nullable=True)
    test_run_page_id = Column(String, nullable=True)
    test_run_playbook_id = Column(String, nullable=True)
    test_run_llm_model_id = Column(String, nullable=True)
    test_run_session_parameters = Column(JSON, nullable=True)  # Generic key-value session parameters
    test_run_pre_prompt_messages = Column(JSON, nullable=True)  # Pre-prompt messages for Test Run
    test_run_post_prompt_messages = Column(JSON, nullable=True)  # Post-prompt messages for Test Run
    test_run_enable_webhook = Column(Boolean, nullable=True)  # Enable webhook setting
    test_run_evaluation_parameters = Column(String, nullable=True)  # JSON string of evaluation parameters
    test_run_batch_size = Column(Integer, nullable=True)  # Preferred batch size for test runs
    
    # Relationships
    datasets = relationship("Dataset", back_populates="owner")
    test_runs = relationship("TestRun", back_populates="created_by")
    evaluation_parameters = relationship("EvaluationParameter", back_populates="created_by")
    evaluation_configs = relationship("TestRunEvaluationConfig", back_populates="user")
    evaluation_presets = relationship("EvaluationPreset", back_populates="created_by")


class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, nullable=False)  # HR, Payroll, Benefits, etc.
    version = Column(String, default="1.0")
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="datasets")
    questions = relationship("Question", back_populates="dataset", cascade="all, delete-orphan")
    test_runs = relationship("TestRun", back_populates="dataset")  # For backward compatibility
    test_runs_multi = relationship("TestRun", secondary="test_run_datasets", back_populates="datasets")


class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    question_text = Column(Text, nullable=False)
    expected_answer = Column(Text, nullable=False)
    detect_empathy = Column(Boolean, default=False)
    no_match = Column(Boolean, default=False)
    priority = Column(Enum(Priority), default=Priority.medium)
    tags = Column(JSON)  # List of tags as JSON
    question_metadata = Column(JSON)  # Additional metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    dataset = relationship("Dataset", back_populates="questions")
    test_results = relationship("TestResult", back_populates="question")


class TestRun(Base):
    __test__ = False  # Prevent pytest from collecting this class
    __tablename__ = "test_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)  # Optional description for the test run
    
    # For backward compatibility - nullable now since we use many-to-many
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
    # Google Cloud Configuration
    project_id = Column(String, nullable=True)  # Google Cloud Project ID
    agent_id = Column(String, nullable=True)   # Dialogflow Agent ID
    
    # Dialogflow Configuration
    agent_name = Column(String, nullable=False)  # Full agent path for API calls
    agent_display_name = Column(String, nullable=True)  # Display name for UI
    flow_name = Column(String, nullable=False)
    flow_display_name = Column(String, nullable=True)  # Display name for UI
    page_name = Column(String, nullable=False)
    page_display_name = Column(String, nullable=True)  # Display name for UI
    environment = Column(String, default="draft")
    
    # Test Configuration
    batch_size = Column(Integer, default=10)
    session_parameters = Column(JSON, nullable=True)  # Generic key-value session parameters
    enable_webhook = Column(Boolean, default=True)  # Whether to enable webhooks for this test run
    
    # Pre/Post Prompt Messages
    pre_prompt_messages = Column(JSON, nullable=True)  # Array of messages to send before each main question
    post_prompt_messages = Column(JSON, nullable=True)  # Array of messages to send after each main question
    
    # Playbook support fields
    playbook_id = Column(String, nullable=True)  # Playbook ID for playbook-based tests
    playbook_display_name = Column(String, nullable=True)  # Playbook display name for UI
    llm_model_id = Column(String, nullable=True)  # LLM model ID for playbook-based tests
    
    # LLM Evaluation Model
    evaluation_model_id = Column(String, nullable=False)  # LLM model ID for LLM Judge evaluation (required)
    
    status = Column(Enum(TestStatus), default=TestStatus.pending)
    
    # Results
    total_questions = Column(Integer, default=0)
    completed_questions = Column(Integer, default=0)
    average_score = Column(Integer)  # 0-100
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    dataset = relationship("Dataset", back_populates="test_runs")  # For backward compatibility
    created_by = relationship("User", back_populates="test_runs")
    test_results = relationship("TestResult", back_populates="test_run", cascade="all, delete-orphan")
    evaluation_config = relationship("TestRunEvaluationConfig", back_populates="test_run", uselist=False)
    
    # Many-to-many relationship with datasets
    datasets = relationship("Dataset", secondary="test_run_datasets", back_populates="test_runs_multi")


# Junction table for TestRun <-> Dataset many-to-many relationship
class TestRunDataset(Base):
    __tablename__ = "test_run_datasets"
    
    test_run_id = Column(Integer, ForeignKey("test_runs.id", ondelete="CASCADE"), primary_key=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TestResult(Base):
    __tablename__ = "test_results"
    
    id = Column(Integer, primary_key=True, index=True)
    test_run_id = Column(Integer, ForeignKey("test_runs.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    
    # Dialogflow Response
    actual_answer = Column(Text)
    dialogflow_response = Column(JSON)  # Full Dialogflow response
    
    # LLM Evaluation
    similarity_score = Column(Integer, nullable=True)  # DEPRECATED: Use parameter_scores instead
    evaluation_reasoning = Column(Text)
    empathy_score = Column(Integer, nullable=True)  # DEPRECATED: Use parameter_scores instead
    no_match_detected = Column(Boolean)  # If no_match was expected
    overall_score = Column(Integer, nullable=True)  # DEPRECATED: Computed from parameter_scores
    
    # Execution Details
    execution_time_ms = Column(Integer)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    test_run = relationship("TestRun", back_populates="test_results")
    question = relationship("Question", back_populates="test_results")
    parameter_scores = relationship("TestResultParameterScore", back_populates="test_result", cascade="all, delete-orphan")


class EvaluationParameter(Base):
    """
    Defines evaluation parameters that can be used in test runs.
    Users can configure which parameters to use and their weights.
    """
    __tablename__ = "evaluation_parameters"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g., "Similarity Score", "Empathy Level"
    description = Column(Text)  # Human-readable description
    prompt_template = Column(Text, nullable=True)  # Custom prompt for custom parameters
    is_system_default = Column(Boolean, default=False)  # System-defined vs user-created
    is_active = Column(Boolean, default=True)  # Can be disabled
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    created_by = relationship("User", back_populates="evaluation_parameters")


class EvaluationPreset(Base):
    """
    Stores named presets of evaluation configurations that users can save and reuse.
    Allows users to create custom evaluation templates.
    """
    __tablename__ = "evaluation_presets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g., "Customer Service Focus", "Technical Accuracy"
    description = Column(Text, nullable=True)  # Description of what this preset focuses on
    parameters = Column(JSON, nullable=False)  # Array of {parameter_id, weight, enabled}
    is_system_default = Column(Boolean, default=False)  # System vs user presets
    is_public = Column(Boolean, default=False)  # Can other users see this preset
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    created_by = relationship("User", back_populates="evaluation_presets")


class TestRunEvaluationConfig(Base):
    """
    Stores the evaluation configuration for a specific test run or user preferences.
    Links test runs to their evaluation parameters and weights.
    """
    __tablename__ = "test_run_evaluation_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    test_run_id = Column(Integer, ForeignKey("test_runs.id"), nullable=True)  # null for user preferences
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=True)  # Optional name for saved configurations
    is_default = Column(Boolean, default=False)  # User's default configuration
    preset_id = Column(Integer, ForeignKey("evaluation_presets.id"), nullable=True)  # Link to preset if used
    parameters = Column(JSON, nullable=False)  # Array of {parameter_id, weight, enabled}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    test_run = relationship("TestRun", back_populates="evaluation_config")
    user = relationship("User", back_populates="evaluation_configs")
    preset = relationship("EvaluationPreset")


class TestResultParameterScore(Base):
    """
    Stores individual parameter scores for each test result.
    Allows drill-down analysis of how the overall score was calculated.
    """
    __tablename__ = "test_result_parameter_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    test_result_id = Column(Integer, ForeignKey("test_results.id"), nullable=False)
    parameter_id = Column(Integer, ForeignKey("evaluation_parameters.id"), nullable=False)
    score = Column(Integer, nullable=False)  # 0-100
    weight_used = Column(Integer, nullable=False)  # Weight percentage used in calculation
    reasoning = Column(Text, nullable=True)  # Parameter-specific reasoning
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    test_result = relationship("TestResult", back_populates="parameter_scores")
    parameter = relationship("EvaluationParameter")


class QuickAddParameter(Base):
    """
    Stores configurable quick-add parameter options for session parameters.
    Allows admins to manage common parameter key-value pairs that users can quickly add.
    """
    __tablename__ = "quick_add_parameters"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # Display name for the parameter
    key = Column(String, nullable=False)  # Parameter key
    value = Column(String, nullable=False)  # Parameter value
    description = Column(Text, nullable=True)  # Optional description
    is_active = Column(Boolean, default=True)  # Can be disabled
    sort_order = Column(Integer, default=0)  # For ordering in UI
    created_by_id = Column(Integer, nullable=True)  # Will reference users.id when users table exists
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships will be added when users table exists
    # created_by = relationship("User", foreign_keys=[created_by_id])
