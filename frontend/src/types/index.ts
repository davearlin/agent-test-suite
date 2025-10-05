export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'test_manager' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface QuickTestPreferences {
  project_id?: string;
  agent_id?: string;
  flow_id?: string;
  page_id?: string;
  playbook_id?: string;
  llm_model_id?: string;
  session_id?: string;
  session_parameters?: Record<string, string>;  // Generic key-value session parameters
  pre_prompt_messages?: string[];  // Pre-prompt messages for Quick Test
  post_prompt_messages?: string[];  // Post-prompt messages for Quick Test
  enable_webhook?: boolean;  // Enable webhook setting for Quick Test
}

export interface TestRunPreferences {
  test_run_project_id?: string | null;
  test_run_agent_id?: string | null;
  test_run_flow_id?: string | null;
  test_run_page_id?: string | null;
  test_run_playbook_id?: string | null;
  test_run_llm_model_id?: string | null;
  test_run_session_parameters?: Record<string, string> | null;  // Generic key-value session parameters
  test_run_pre_prompt_messages?: string[] | null;  // Pre-prompt messages for Test Run
  test_run_post_prompt_messages?: string[] | null;  // Post-prompt messages for Test Run
  test_run_enable_webhook?: boolean | null;  // Enable webhook setting
  test_run_evaluation_parameters?: string | null;  // Serialized evaluation parameter configuration
  test_run_batch_size?: number | null;  // Stored batch size preference
}

export interface Dataset {
  id: number;
  name: string;
  description?: string;
  category: string;
  version: string;
  owner_id: number;
  created_at: string;
  updated_at?: string;
  questions: Question[];
}

export interface DatasetSummary {
  id: number;
  name: string;
  category: string;
  version: string;
  question_count: number;
  created_at: string;
  owner_name: string;
}

export interface Question {
  id: number;
  dataset_id: number;
  question_text: string;
  expected_answer: string;
  detect_empathy: boolean;
  no_match: boolean;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface TestRun {
  id: number;
  name: string;
  description?: string;
  dataset_id?: number; // For backward compatibility
  created_by_id: number;
  created_by_email?: string; // Email of the user who created this test run
  created_by_name?: string; // Full name of the user who created this test run
  project_id?: string;
  agent_id?: string;
  agent_name: string; // Full agent path for API calls
  agent_display_name?: string; // Display name for UI
  flow_name: string;
  flow_display_name?: string; // Display name for UI
  page_name: string;
  page_display_name?: string; // Display name for UI
  environment: string;
  batch_size: number;
  playbook_id?: string; // Playbook ID for playbook-based tests
  playbook_display_name?: string; // Playbook display name for UI
  llm_model_id?: string; // LLM model ID for playbook-based tests
  evaluation_model_id?: string; // LLM model ID for LLM Judge evaluation
  session_parameters?: Record<string, string>; // Session parameters
  enable_webhook?: boolean; // Whether to enable webhooks during test execution
  pre_prompt_messages?: string[]; // Messages to send before each main question
  post_prompt_messages?: string[]; // Messages to send after each main question
  evaluation_parameters?: EvaluationParameterConfig[]; // Evaluation parameter configuration
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_questions: number;
  completed_questions: number;
  average_score?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  datasets?: Dataset[]; // For multi-dataset test runs
}

export interface TestResult {
  id: number;
  test_run_id: number;
  question_id: number;
  actual_answer?: string;
  dialogflow_response?: Record<string, any>;
  similarity_score?: number; // Legacy field for backward compatibility
  overall_score?: number; // New weighted score from multiple parameters
  evaluation_reasoning?: string;
  empathy_score?: number;
  no_match_detected?: boolean;
  execution_time_ms?: number;
  error_message?: string;
  created_at: string;
  question: Question;
  parameter_scores?: TestResultParameterScore[]; // Individual parameter scores for drill-down
}

export interface GoogleCloudProject {
  project_id: string;
  name: string;
  display_name: string;
}

export interface DialogflowAgent {
  name: string;
  display_name: string;
  location: string;
  accessible: boolean;
}

export interface DialogflowFlow {
  name: string;
  display_name: string;
}

export interface DialogflowPage {
  name: string;
  display_name: string;
}

export interface DialogflowPlaybook {
  name: string;
  display_name: string;
}

export interface StartResource {
  id: string;
  name: string;
  display_name: string;
  type: 'flow' | 'playbook';
}

export interface QuickTestRequest {
  prompt: string;
  agent_id: string;
  flow_id?: string;
  page_id?: string;
  playbook_id?: string;
  llm_model_id?: string;
  session_id?: string;
  session_parameters?: Record<string, string>; // Generic key-value session parameters
  enable_webhook?: boolean; // Whether to enable webhooks during test execution
  pre_prompt_messages?: string[]; // Messages to send before the main prompt
  post_prompt_messages?: string[]; // Messages to send after the main prompt
}

export interface QuickTestResponse {
  prompt: string;
  response: string;
  agent_id: string;
  flow_id?: string;
  page_id?: string;
  playbook_id?: string;
  llm_model_id?: string;
  session_id: string;
  response_time_ms: number;
  intent?: string;
  confidence?: number;
  parameters?: Record<string, any>;
  response_messages: string[];
  dialogflow_response?: Record<string, any>; // Full raw response from Dialogflow
  pre_prompt_messages?: string[]; // Messages sent before the main prompt
  post_prompt_messages?: string[]; // Messages sent after the main prompt
  webhook_info?: {
    called: boolean;
    url?: string;
    status?: string;
    request_payload?: Record<string, any>;
    response_payload?: Array<Record<string, any>>;
  };
  is_mock?: boolean;
  has_webhook_error?: boolean;
  message_sequence?: Array<{
    type: string;
    message: string;
    response: string;
    timestamp: string;
    intent?: string;
    confidence?: number;
    execution_time_ms?: number;
  }>;
  sequence_summary?: {
    total_messages: number;
    total_execution_time_ms: number;
    main_question_index: number;
  };
  created_at: string;
}

export interface TestProgress {
  test_run_id: number;
  status: string;
  completed_questions: number;
  total_questions: number;
  current_question: string;
  average_score?: number;
  estimated_time_remaining?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  category: string;
  version?: string;
  questions?: Omit<Question, 'id' | 'dataset_id' | 'created_at'>[];
}

export interface CreateTestRunRequest {
  name: string;
  description?: string;
  dataset_id?: number; // For backward compatibility
  dataset_ids?: number[]; // For multi-dataset test runs
  project_id?: string;
  agent_id?: string;
  agent_name: string; // Full agent path for API calls
  agent_display_name?: string; // Display name for UI
  flow_name: string;
  flow_display_name?: string; // Display name for UI
  page_name: string;
  page_display_name?: string; // Display name for UI
  playbook_id?: string; // For playbook-based test runs
  playbook_display_name?: string; // Playbook display name for UI
  llm_model_id?: string; // For LLM model selection in playbook test runs
  evaluation_model_id?: string; // For LLM model selection in LLM Judge evaluation
  environment: string;
  batch_size: number;
  session_parameters?: Record<string, string>; // Generic key-value session parameters
  enable_webhook?: boolean; // Whether to enable webhooks during test execution
  pre_prompt_messages?: string[]; // Messages to send before each main question
  post_prompt_messages?: string[]; // Messages to send after each main question
  evaluation_parameters?: EvaluationParameterConfig[]; // Evaluation parameter configuration
}

export interface APIError {
  detail: string;
}

// Evaluation Parameter Types
export type EvaluationParameterType = 'similarity' | 'empathy' | 'no_match' | 'custom';

export interface EvaluationParameter {
  id: number;
  name: string;
  description?: string;
  parameter_type: EvaluationParameterType;
  prompt_template?: string;
  weight: number; // 1-100, default weight percentage
  is_system_default: boolean;
  is_active: boolean;
  created_by_id?: number;
  created_at: string;
  updated_at?: string;
}

export interface EvaluationParameterConfig {
  parameter_id: number;
  weight: number; // 0-100
  enabled: boolean;
}

export interface TestRunEvaluationConfig {
  id: number;
  test_run_id?: number;
  user_id: number;
  name?: string;
  is_default: boolean;
  preset_id?: number;
  parameters: EvaluationParameterConfig[];
  created_at: string;
  updated_at?: string;
}

export interface EvaluationPreset {
  id: number;
  name: string;
  description?: string;
  parameters: EvaluationParameterConfig[];
  is_system_default: boolean;
  is_public: boolean;
  created_by_id: number;
  created_at: string;
  updated_at?: string;
}

// Create/Update types for API operations
export interface EvaluationParameterCreate {
  name: string;
  description?: string;
  prompt_template?: string;
  parameter_type?: EvaluationParameterType;
  weight?: number; // 1-100
  is_active?: boolean;
}

export interface EvaluationParameterUpdate {
  name?: string;
  description?: string;
  prompt_template?: string;
  parameter_type?: EvaluationParameterType;
  weight?: number; // 1-100
  is_active?: boolean;
}

export interface EvaluationPresetCreate {
  name: string;
  description?: string;
  parameters: EvaluationParameterConfig[];
  is_public?: boolean;
}

export interface EvaluationPresetUpdate {
  name?: string;
  description?: string;
  parameters?: EvaluationParameterConfig[];
  is_public?: boolean;
}

export interface TestResultParameterScore {
  id: number;
  test_result_id: number;
  parameter_id: number;
  score: number; // 0-100
  weight_used: number; // 0-100
  reasoning?: string;
  created_at: string;
  parameter?: EvaluationParameter;
}

export interface TestResultWithParameters extends Omit<TestResult, 'similarity_score'> {
  overall_score?: number;
  parameter_scores: TestResultParameterScore[];
  // Legacy field still available for backward compatibility
  similarity_score?: number;
}

export interface UserEvaluationPreferences {
  default_config_id?: number;
  saved_configs: TestRunEvaluationConfig[];
}

// Evaluation Parameter Configuration UI Types
export interface EvaluationParameterConfigUI extends EvaluationParameterConfig {
  parameter: EvaluationParameter;
}

export interface EvaluationConfigPreset {
  name: string;
  description: string;
  parameters: EvaluationParameterConfig[];
}

export interface WeightAdjustmentProps {
  parameters: EvaluationParameterConfigUI[];
  onChange: (parameters: EvaluationParameterConfigUI[]) => void;
  disabled?: boolean;
}

// Quick Add Parameter Types
export interface QuickAddParameter {
  id: number;
  name: string;
  key: string;
  value: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_by_id: number;
  created_at: string;
  updated_at?: string;
}

export interface QuickAddParameterCreate {
  name: string;
  key: string;
  value: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
}

export interface QuickAddParameterUpdate {
  name?: string;
  key?: string;
  value?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

// Dashboard Analytics Types
export interface DashboardOverview {
  total_test_runs: number;
  average_agent_score: number;
  total_success_rate: number;
  active_datasets: number;
  total_questions_tested: number;
  last_30_days_tests: number;
  trending_score_change: number;
  user_context: {
    user_role: string;
    data_scope: 'all_users' | 'user_only';
    user_email: string;
    has_admin_access: boolean;
    total_users_in_system: number;
    date_range_days: number;
  };
}

export interface AgentPerformanceMetrics {
  agent_display_name: string;
  agent_id: string;
  total_tests: number;
  average_score: number;
  success_rate: number;
  last_test_date?: string;
  parameter_scores: Record<string, number>;
}

export interface RecentActivityItem {
  id: number;
  name: string;
  type: 'test_run' | 'quick_test';
  status: string;
  score?: number;
  agent_name: string;
  created_at: string;
  duration_minutes?: number;
  created_by_name?: string;  // User who created this activity
  created_by_email?: string; // Email of the user who created this activity
}

export interface PerformanceTrend {
  date: string;
  average_score: number;
  test_count: number;
  success_rate: number;
}

export interface ParameterPerformance {
  parameter_name: string;
  average_score: number;
  test_count: number;
}
