import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  AuthResponse, 
  LoginCredentials, 
  User, 
  Dataset, 
  DatasetSummary, 
  Question, 
  TestRun, 
  TestResult, 
  GoogleCloudProject,
  DialogflowAgent, 
  DialogflowFlow, 
  DialogflowPage,
  DialogflowPlaybook,
  StartResource,
  QuickTestRequest,
  QuickTestResponse,
  QuickTestPreferences,
  TestRunPreferences,
  EvaluationParameter,
  EvaluationParameterCreate,
  EvaluationParameterUpdate,
  CreateDatasetRequest,
  CreateTestRunRequest,
  EvaluationPreset,
  TestRunEvaluationConfig,
  EvaluationParameterConfig,
  UserEvaluationPreferences,
  QuickAddParameter,
  QuickAddParameterCreate,
  QuickAddParameterUpdate,
  DashboardOverview,
  AgentPerformanceMetrics,
  RecentActivityItem,
  PerformanceTrend,
  ParameterPerformance
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    // Use environment variable for backend URL, fallback to relative path for development
    const baseURL = import.meta.env.VITE_API_BASE_URL || '';
    
    this.api = axios.create({
      baseURL: baseURL,
      timeout: 30000,
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('access_token');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/v1/auth/login', credentials);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<User> = await this.api.get('/api/v1/auth/me');
    return response.data;
  }

  async getAuthStatus(): Promise<{authenticated: boolean, user: string | null, role: string | null, google_oauth_configured: boolean}> {
    const response = await this.api.get('/api/v1/auth/status');
    return response.data;
  }

  async initiateGoogleLogin(): Promise<{authorization_url: string, state: string}> {
    const response = await this.api.get('/api/v1/auth/google/login');
    return response.data;
  }

  // Datasets
  async getDatasets(params?: { 
    skip?: number; 
    limit?: number; 
    category?: string; 
  }): Promise<DatasetSummary[]> {
    const response: AxiosResponse<DatasetSummary[]> = await this.api.get('/api/v1/datasets/', { params });
    return response.data;
  }

  async getDataset(id: number): Promise<Dataset> {
    const response: AxiosResponse<Dataset> = await this.api.get(`/api/v1/datasets/${id}`);
    return response.data;
  }

  async createDataset(data: CreateDatasetRequest): Promise<Dataset> {
    const response: AxiosResponse<Dataset> = await this.api.post('/api/v1/datasets/', data);
    return response.data;
  }

  async updateDataset(id: number, data: Partial<CreateDatasetRequest>): Promise<Dataset> {
    const response: AxiosResponse<Dataset> = await this.api.put(`/api/v1/datasets/${id}`, data);
    return response.data;
  }

  async deleteDataset(id: number): Promise<void> {
    await this.api.delete(`/api/v1/datasets/${id}`);
  }

  async addQuestion(datasetId: number, question: Omit<Question, 'id' | 'dataset_id' | 'created_at'>): Promise<Question> {
    const response: AxiosResponse<Question> = await this.api.post(`/api/v1/datasets/${datasetId}/questions`, question);
    return response.data;
  }

  async updateQuestion(questionId: number, data: Partial<Question>): Promise<Question> {
    const response: AxiosResponse<Question> = await this.api.put(`/api/v1/datasets/questions/${questionId}`, data);
    return response.data;
  }

  async deleteQuestion(questionId: number): Promise<void> {
    await this.api.delete(`/api/v1/datasets/questions/${questionId}`);
  }

  async importDataset(datasetId: number, file: File): Promise<{ message: string; questions_added: number }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.api.post(`/api/v1/datasets/${datasetId}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes for large file uploads
    });
    return response.data;
  }

  async previewCsv(datasetId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.api.post(`/api/v1/datasets/${datasetId}/preview-csv`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes for CSV preview
    });
    return response.data;
  }

  async importCsvWithMapping(datasetId: number, file: File, mapping: any): Promise<{ message: string; questions_added: number }> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add individual mapping parameters as expected by backend
    const questionCol = mapping.question_column || 'question';
    const answerCol = mapping.answer_column || 'answer';
    
    formData.append('question_column', questionCol);
    formData.append('answer_column', answerCol);
    
    // Only append non-empty optional fields
    if (mapping.empathy_column && mapping.empathy_column.trim()) {
      formData.append('empathy_column', mapping.empathy_column);
    }
    if (mapping.no_match_column && mapping.no_match_column.trim()) {
      formData.append('no_match_column', mapping.no_match_column);
    }
    if (mapping.priority_column && mapping.priority_column.trim()) {
      formData.append('priority_column', mapping.priority_column);
    }
    if (mapping.tags_column && mapping.tags_column.trim()) {
      formData.append('tags_column', mapping.tags_column);
    }
    if (mapping.metadata_columns && mapping.metadata_columns.length > 0) {
      formData.append('metadata_columns', mapping.metadata_columns.join(','));
    }
    
    // Add HTML stripping options
    if (mapping.strip_html_from_question !== undefined) {
      formData.append('strip_html_from_question', mapping.strip_html_from_question.toString());
    }
    if (mapping.strip_html_from_answer !== undefined) {
      formData.append('strip_html_from_answer', mapping.strip_html_from_answer.toString());
    }
    
    const response = await this.api.post(`/api/v1/datasets/${datasetId}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes for large file uploads
    });
    return response.data;
  }

  // Dialogflow
  async getAgents(): Promise<DialogflowAgent[]> {
    const response: AxiosResponse<DialogflowAgent[]> = await this.api.get('/api/v1/dialogflow/agents');
    return response.data;
  }

  async getFlows(agentName: string, projectId?: string): Promise<DialogflowFlow[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response: AxiosResponse<DialogflowFlow[]> = await this.api.get(
      `/api/v1/dialogflow/agents/${encodeURIComponent(agentName)}/flows`,
      { params }
    );
    return response.data;
  }

  async getPages(flowName: string): Promise<DialogflowPage[]> {
    const response: AxiosResponse<DialogflowPage[]> = await this.api.get(`/api/v1/dialogflow/flows/${encodeURIComponent(flowName)}/pages`);
    return response.data;
  }

  async getPlaybooks(agentName: string): Promise<DialogflowPlaybook[]> {
    const response: AxiosResponse<DialogflowPlaybook[]> = await this.api.get(`/api/v1/dialogflow/agents/${encodeURIComponent(agentName)}/playbooks`);
    return response.data;
  }

  async getStartResources(agentName: string): Promise<StartResource[]> {
    const response: AxiosResponse<StartResource[]> = await this.api.get(`/api/v1/dialogflow/agents/${encodeURIComponent(agentName)}/start-resources`);
    return response.data;
  }

  // Test Runs
  async getTestRuns(params?: { 
    skip?: number; 
    limit?: number; 
    dataset_id?: number; 
    status?: string; 
  }): Promise<TestRun[]> {
    const response: AxiosResponse<TestRun[]> = await this.api.get('/api/v1/tests/', { params });
    return response.data;
  }

  async getTestRun(id: number): Promise<TestRun> {
    const response: AxiosResponse<TestRun> = await this.api.get(`/api/v1/tests/${id}`);
    return response.data;
  }

  async createTestRun(data: CreateTestRunRequest): Promise<TestRun> {
    const response: AxiosResponse<TestRun> = await this.api.post('/api/v1/tests/', data);
    return response.data;
  }

  async updateTestRun(id: number, data: Partial<TestRun>): Promise<TestRun> {
    const response: AxiosResponse<TestRun> = await this.api.put(`/api/v1/tests/${id}`, data);
    return response.data;
  }

  async deleteTestRun(id: number): Promise<void> {
    await this.api.delete(`/api/v1/tests/${id}`);
  }

  async cancelTestRun(id: number): Promise<{ message: string }> {
    const response = await this.api.post(`/api/v1/tests/${id}/cancel`);
    return response.data;
  }

  async getTestResults(testRunId: number, params?: { 
    skip?: number; 
    limit?: number; 
  }): Promise<TestResult[]> {
    const response: AxiosResponse<TestResult[]> = await this.api.get(`/api/v1/tests/${testRunId}/results`, { params });
    return response.data;
  }

  async exportTestRunToCSV(testRunId: number): Promise<void> {
    return this.exportTestRun(testRunId, 'csv');
  }

  async exportTestRunToExcel(testRunId: number): Promise<void> {
    return this.exportTestRun(testRunId, 'excel');
  }

  async exportTestRun(testRunId: number, format: 'csv' | 'excel' = 'csv'): Promise<void> {
    try {
      // Get user's timezone for Excel export
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      const response = await this.api.get(`/api/v1/tests/${testRunId}/export`, {
        params: { format, timezone },
        responseType: 'blob', // Important for file downloads
      });

      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers['content-disposition'];
      const extension = format === 'excel' ? 'xlsx' : 'csv';
      let filename = `test-run-${testRunId}-results.${extension}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=([^;]+)/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const mimeType = format === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;';
      const blob = new Blob([response.data], { type: mimeType });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error exporting test run to ${format.toUpperCase()}:`, error);
      throw new Error(`Failed to export test run to ${format.toUpperCase()}. Please try again.`);
    }
  }

  // WebSocket connection for real-time updates
  connectWebSocket(testRunId: number, onMessage: (data: any) => void): WebSocket {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${testRunId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return ws;
  }

  // Dialogflow
  async getGoogleCloudProjects(): Promise<GoogleCloudProject[]> {
    const response: AxiosResponse<GoogleCloudProject[]> = await this.api.get('/api/v1/dialogflow/projects');
    return response.data;
  }

  async getDialogflowAgents(projectId?: string): Promise<DialogflowAgent[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response: AxiosResponse<DialogflowAgent[]> = await this.api.get('/api/v1/dialogflow/agents', { 
      params,
      headers: { 'Cache-Control': 'no-cache' } // Force fresh agent data with accessibility info
    });
    return response.data;
  }

  async getAgentFlows(agentId: string, projectId?: string): Promise<DialogflowFlow[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response: AxiosResponse<DialogflowFlow[]> = await this.api.get(`/api/v1/dialogflow/agents/${agentId}/flows`, { params });
    return response.data;
  }

  async getFlowPages(agentId: string, flowId: string, projectId?: string): Promise<DialogflowPage[]> {
    const params = projectId ? { project_id: projectId } : {};
    const response: AxiosResponse<DialogflowPage[]> = await this.api.get(`/api/v1/dialogflow/agents/${agentId}/flows/${flowId}/pages`, { params });
    return response.data;
  }

  // Quick Test
  async quickTest(request: QuickTestRequest, projectId?: string): Promise<QuickTestResponse> {
    const params = projectId ? { project_id: projectId } : {};
    const response: AxiosResponse<QuickTestResponse> = await this.api.post('/api/v1/dialogflow/quick-test', request, { params });
    return response.data;
  }

  // User Preferences
  async getQuickTestPreferences(): Promise<QuickTestPreferences> {
    const response: AxiosResponse<QuickTestPreferences> = await this.api.get('/api/v1/auth/preferences/quick-test');
    return response.data;
  }

  async updateQuickTestPreferences(preferences: Partial<QuickTestPreferences>): Promise<QuickTestPreferences> {
    const response: AxiosResponse<QuickTestPreferences> = await this.api.put('/api/v1/auth/preferences/quick-test', preferences);
    return response.data;
  }

  async getTestRunPreferences(): Promise<TestRunPreferences> {
    const response: AxiosResponse<TestRunPreferences> = await this.api.get('/api/v1/auth/preferences/test-run');
    return response.data;
  }

  async updateTestRunPreferences(preferences: Partial<TestRunPreferences>): Promise<TestRunPreferences> {
    const response: AxiosResponse<TestRunPreferences> = await this.api.put('/api/v1/auth/preferences/test-run', preferences);
    return response.data;
  }

  // Evaluation Parameters API
  async getEvaluationParameters(includeInactive: boolean = false): Promise<EvaluationParameter[]> {
    const response: AxiosResponse<EvaluationParameter[]> = await this.api.get('/api/v1/evaluation/parameters', {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  }

  async createEvaluationParameter(parameter: EvaluationParameterCreate): Promise<EvaluationParameter> {
    const response: AxiosResponse<EvaluationParameter> = await this.api.post('/api/v1/evaluation/parameters', parameter);
    return response.data;
  }

  async updateEvaluationParameter(id: number, updates: EvaluationParameterUpdate): Promise<EvaluationParameter> {
    const response: AxiosResponse<EvaluationParameter> = await this.api.put(`/api/v1/evaluation/parameters/${id}`, updates);
    return response.data;
  }

  async deleteEvaluationParameter(id: number): Promise<void> {
    await this.api.delete(`/api/v1/evaluation/parameters/${id}`);
  }

  // Available Models API
  async getAvailableModels(): Promise<{
    models: Array<{id: string, name: string, category: string}>,
    total_count?: number,
    categories?: Record<string, Array<{id: string, name: string, category: string}>>,
    error?: string
  }> {
    const response = await this.api.get('/api/v1/evaluation/available-models');
    return response.data;
  }

  async refreshModels(): Promise<{
    status: string,
    message?: string,
    count?: number,
    models?: Array<{id: string, name: string, category: string}>,
    error?: string
  }> {
    const response = await this.api.post('/api/v1/tests/models/refresh');
    return response.data;
  }

  // Evaluation Configurations API
  async getEvaluationConfigs(includeTestRunConfigs: boolean = false): Promise<TestRunEvaluationConfig[]> {
    const response: AxiosResponse<TestRunEvaluationConfig[]> = await this.api.get('/api/v1/evaluation/configs', {
      params: { include_test_run_configs: includeTestRunConfigs }
    });
    return response.data;
  }

  async createEvaluationConfig(config: {
    name?: string;
    parameters: EvaluationParameterConfig[];
    is_default?: boolean;
  }): Promise<TestRunEvaluationConfig> {
    const response: AxiosResponse<TestRunEvaluationConfig> = await this.api.post('/api/v1/evaluation/configs', config);
    return response.data;
  }

  async updateEvaluationConfig(id: number, updates: {
    name?: string;
    parameters?: EvaluationParameterConfig[];
    is_default?: boolean;
  }): Promise<TestRunEvaluationConfig> {
    const response: AxiosResponse<TestRunEvaluationConfig> = await this.api.put(`/api/v1/evaluation/configs/${id}`, updates);
    return response.data;
  }

  async deleteEvaluationConfig(id: number): Promise<void> {
    await this.api.delete(`/api/v1/evaluation/configs/${id}`);
  }

  async getEvaluationPreferences(): Promise<UserEvaluationPreferences> {
    const response: AxiosResponse<UserEvaluationPreferences> = await this.api.get('/api/v1/evaluation/preferences');
    return response.data;
  }

  async getDefaultEvaluationConfig(): Promise<TestRunEvaluationConfig> {
    const response: AxiosResponse<TestRunEvaluationConfig> = await this.api.get('/api/v1/evaluation/defaults');
    return response.data;
  }

  // Evaluation Presets API
  async getEvaluationPresets(includeSystem: boolean = true, includePublic: boolean = true): Promise<EvaluationPreset[]> {
    const response: AxiosResponse<EvaluationPreset[]> = await this.api.get('/api/v1/evaluation/presets', {
      params: { 
        include_system: includeSystem,
        include_public: includePublic
      }
    });
    return response.data;
  }

  async getEvaluationPreset(id: number): Promise<EvaluationPreset> {
    const response: AxiosResponse<EvaluationPreset> = await this.api.get(`/api/v1/evaluation/presets/${id}`);
    return response.data;
  }

  async createEvaluationPreset(preset: {
    name: string;
    description?: string;
    parameters: EvaluationParameterConfig[];
    is_public?: boolean;
  }): Promise<EvaluationPreset> {
    const response: AxiosResponse<EvaluationPreset> = await this.api.post('/api/v1/evaluation/presets', preset);
    return response.data;
  }

  async updateEvaluationPreset(id: number, updates: {
    name?: string;
    description?: string;
    parameters?: EvaluationParameterConfig[];
    is_public?: boolean;
  }): Promise<EvaluationPreset> {
    const response: AxiosResponse<EvaluationPreset> = await this.api.put(`/api/v1/evaluation/presets/${id}`, updates);
    return response.data;
  }

  async deleteEvaluationPreset(id: number): Promise<void> {
    await this.api.delete(`/api/v1/evaluation/presets/${id}`);
  }

  // Quick Add Parameters
  async getQuickAddParameters(): Promise<QuickAddParameter[]> {
    const response: AxiosResponse<QuickAddParameter[]> = await this.api.get('/api/v1/quick-add-parameters/');
    return response.data;
  }

  async createQuickAddParameter(data: QuickAddParameterCreate): Promise<QuickAddParameter> {
    const response: AxiosResponse<QuickAddParameter> = await this.api.post('/api/v1/quick-add-parameters/', data);
    return response.data;
  }

  async updateQuickAddParameter(id: number, data: QuickAddParameterUpdate): Promise<QuickAddParameter> {
    const response: AxiosResponse<QuickAddParameter> = await this.api.put(`/api/v1/quick-add-parameters/${id}`, data);
    return response.data;
  }

  async deleteQuickAddParameter(id: number): Promise<void> {
    await this.api.delete(`/api/v1/quick-add-parameters/${id}`);
  }

  async reorderQuickAddParameters(parameterIds: number[]): Promise<void> {
    await this.api.post('/api/v1/quick-add-parameters/reorder', parameterIds);
  }

  // Dashboard Analytics API methods
  async getDashboardOverview(days: number = 30, projectId?: string): Promise<DashboardOverview> {
    const params = new URLSearchParams();
    params.append('days', days.toString());
    if (projectId) {
      params.append('project_id', projectId);
    }
    const response: AxiosResponse<DashboardOverview> = await this.api.get(`/api/v1/dashboard/overview?${params}`);
    return response.data;
  }

  async getPerformanceTrends(days: number = 30, projectId?: string): Promise<PerformanceTrend[]> {
    const params = new URLSearchParams();
    params.append('days', days.toString());
    if (projectId) {
      params.append('project_id', projectId);
    }
    const response: AxiosResponse<PerformanceTrend[]> = await this.api.get(`/api/v1/dashboard/performance-trends?${params}`);
    return response.data;
  }

  async getAgentPerformance(limit: number = 10, projectId?: string): Promise<AgentPerformanceMetrics[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (projectId) {
      params.append('project_id', projectId);
    }
    const response: AxiosResponse<AgentPerformanceMetrics[]> = await this.api.get(`/api/v1/dashboard/agent-performance?${params}`);
    return response.data;
  }

  async getRecentActivity(limit: number = 10, projectId?: string): Promise<RecentActivityItem[]> {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    if (projectId) {
      params.append('project_id', projectId);
    }
    const response: AxiosResponse<RecentActivityItem[]> = await this.api.get(`/api/v1/dashboard/recent-activity?${params}`);
    return response.data;
  }

  async getParameterPerformance(days: number = 30, projectId?: string): Promise<ParameterPerformance[]> {
    const params = new URLSearchParams();
    params.append('days', days.toString());
    if (projectId) {
      params.append('project_id', projectId);
    }
    const response: AxiosResponse<ParameterPerformance[]> = await this.api.get(`/api/v1/dashboard/parameter-performance?${params}`);
    return response.data;
  }
}

export const apiService = new ApiService();
