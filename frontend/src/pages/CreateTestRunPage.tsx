import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Card,
  CardContent,
  Grid,
  Autocomplete,
  Checkbox,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
  IconButton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAppDispatch } from '../hooks/redux';
import { createTestRun } from '../store/testRunsSlice';
import {
  DatasetSummary,
  GoogleCloudProject,
  DialogflowAgent, 
  DialogflowFlow, 
  DialogflowPage, 
  DialogflowPlaybook,
  StartResource,
  CreateTestRunRequest,
  QuickTestPreferences,
  TestRunPreferences,
  EvaluationParameter,
  EvaluationParameterConfig,
  TestRunEvaluationConfig
} from '../types';
import SessionParametersEditor from '../components/SessionParametersEditor';
import EvaluationParameterConfiguration from '../components/EvaluationParameterConfiguration';

interface CreateTestRunPageProps {}

const CreateTestRunPage: React.FC<CreateTestRunPageProps> = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // State for test run basic info
  const [testRunName, setTestRunName] = useState<string>('');
  const [testRunDescription, setTestRunDescription] = useState<string>('');
  
  // State for Google Cloud Projects and Dialogflow entities
  const [projects, setProjects] = useState<GoogleCloudProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [agents, setAgents] = useState<DialogflowAgent[]>([]);
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');
  const [flows, setFlows] = useState<DialogflowFlow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [pages, setPages] = useState<DialogflowPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [playbooks, setPlaybooks] = useState<DialogflowPlaybook[]>([]);
  const [startResources, setStartResources] = useState<StartResource[]>([]);
  const [selectedStartResourceId, setSelectedStartResourceId] = useState<string>('');
  const [selectedStartResourceType, setSelectedStartResourceType] = useState<'flow' | 'playbook' | ''>('');
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedEvaluationModelId, setSelectedEvaluationModelId] = useState<string>('');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [sessionParameters, setSessionParameters] = useState<Record<string, string>>({});
  const [enableWebhook, setEnableWebhook] = useState<boolean>(true);
  
  // State for pre/post prompt messages
  const [prePromptMessages, setPrePromptMessages] = useState<string[]>([]);
  const [postPromptMessages, setPostPromptMessages] = useState<string[]>([]);
  const [prePromptInput, setPrePromptInput] = useState<string>('');
  const [postPromptInput, setPostPromptInput] = useState<string>('');

  // State for evaluation parameters
  const [availableEvaluationParameters, setAvailableEvaluationParameters] = useState<EvaluationParameter[]>([]);
  const [currentEvaluationConfig, setCurrentEvaluationConfig] = useState<TestRunEvaluationConfig | undefined>();
  const [evaluationParameterConfig, setEvaluationParameterConfig] = useState<EvaluationParameterConfig[]>([]);
  const [evaluationParametersLoading, setEvaluationParametersLoading] = useState(true);

  // State for preferences loading
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [initialLoadingComplete, setInitialLoadingComplete] = useState(false);
  const [loadedPreferences, setLoadedPreferences] = useState<TestRunPreferences>({});
  const [isLoadingFromAPI, setIsLoadingFromAPI] = useState(false);

  // Initialization guards to prevent duplicate API calls
  const hasLoadedPreferencesRef = useRef(false);
  const hasLoadedProjectsRef = useRef(false);
  const hasLoadedDatasetsRef = useRef(false);
  const hasLoadedEvaluationParamsRef = useRef(false);
  const lastLoadedProjectIdRef = useRef<string | null>(null);
  const lastLoadedStartResourcesAgentRef = useRef<string | null>(null);
  const lastLoadedFlowsKeyRef = useRef<string | null>(null);
  const lastLoadedPagesKeyRef = useRef<string | null>(null);

  const updateLoadedPreference = <K extends keyof TestRunPreferences>(key: K, value: TestRunPreferences[K]) => {
    setLoadedPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const stringPreferenceChanged = (key: keyof TestRunPreferences, value?: string | null) => {
    const current = loadedPreferences[key] as string | null | undefined;
    const normalizedCurrent = current === undefined ? null : current;
    const normalizedValue = value === undefined ? null : value;
    return normalizedCurrent !== normalizedValue;
  };

  const objectPreferenceChanged = (key: keyof TestRunPreferences, value: Record<string, any> | undefined) => {
    const current = loadedPreferences[key];
    return JSON.stringify(current ?? null) !== JSON.stringify(value ?? null);
  };

  const numberPreferenceChanged = (key: keyof TestRunPreferences, value?: number | null) => {
    const current = loadedPreferences[key] as number | null | undefined;
    const normalizedCurrent = current === undefined ? null : current;
    const normalizedValue = value === undefined ? null : value;
    return normalizedCurrent !== normalizedValue;
  };

  // Dynamic LLM models - loaded from API
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string, category?: string}>>([
    // Fallback models while loading
    { id: 'models/gemini-2.0-flash', name: 'Gemini 2.0 Flash (Loading...)' },
    { id: 'models/gemini-1.5-flash', name: 'Gemini 1.5 Flash (Loading...)' },
    { id: 'models/gemini-1.5-pro', name: 'Gemini 1.5 Pro (Loading...)' },
  ]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Utility functions for extracting IDs from full resource names
  const extractAgentId = (agentName: string): string => {
    return agentName.split('/').pop() || '';
  };

  const extractFlowId = (flowName: string): string => {
    return flowName.split('/').pop() || '';
  };

  const extractPageId = (pageName: string): string => {
    return pageName.split('/').pop() || '';
  };

  // Preference functions for persistence
  const loadUserPreferences = async () => {
    if (hasLoadedPreferencesRef.current) {
      return loadedPreferences;
    }

    try {
      hasLoadedPreferencesRef.current = true;
      setIsLoadingFromAPI(true); // Flag to prevent save loops during initial load
  const preferences = await apiService.getTestRunPreferences();
      
      // Store what preferences were actually loaded
      setLoadedPreferences(preferences);
      
      // Set preferences if they exist
      if (preferences.test_run_project_id) {
        setSelectedProjectId(preferences.test_run_project_id);
      }
      if (preferences.test_run_agent_id) {
        // Store agent ID from preferences for later restoration
        // Don't set selectedAgentName here - let the useEffect handle it to avoid race conditions
      }
      if (preferences.test_run_flow_id !== undefined && preferences.test_run_flow_id !== null) {
        setSelectedFlowId(preferences.test_run_flow_id);
        // If flow is saved, also set it as the start resource
        setSelectedStartResourceId(preferences.test_run_flow_id);
        setSelectedStartResourceType('flow');
      }
      if (preferences.test_run_playbook_id !== undefined && preferences.test_run_playbook_id !== null) {
        setSelectedPlaybookId(preferences.test_run_playbook_id);
        // If playbook is saved, also set it as the start resource (overrides flow)
        setSelectedStartResourceId(preferences.test_run_playbook_id);
        setSelectedStartResourceType('playbook');
      }
      if (preferences.test_run_page_id !== undefined && preferences.test_run_page_id !== null) {
        setSelectedPageId(preferences.test_run_page_id);
      }
      if (preferences.test_run_llm_model_id) {
        setSelectedModelId(preferences.test_run_llm_model_id);
      }
      if (preferences.test_run_session_parameters) {
        setSessionParameters(preferences.test_run_session_parameters);
      }
      
      // Load prompt messages from preferences
      if (preferences.test_run_pre_prompt_messages) {
        setPrePromptMessages(preferences.test_run_pre_prompt_messages);
      }
      if (preferences.test_run_post_prompt_messages) {
        setPostPromptMessages(preferences.test_run_post_prompt_messages);
      }
      
      if (preferences.test_run_enable_webhook !== undefined && preferences.test_run_enable_webhook !== null) {
        setEnableWebhook(preferences.test_run_enable_webhook);
      }

      if (preferences.test_run_evaluation_parameters) {
        try {
          const parsedPreference = JSON.parse(preferences.test_run_evaluation_parameters);
          const parsedParameters: EvaluationParameterConfig[] = Array.isArray(parsedPreference)
            ? parsedPreference
            : Array.isArray(parsedPreference?.parameters)
              ? parsedPreference.parameters
              : [];

          if (parsedParameters.length > 0) {
            const normalizedPreference = JSON.stringify({ parameters: parsedParameters });
            setEvaluationParameterConfig(parsedParameters);
            setCurrentEvaluationConfig({
              id: -1,
              user_id: -1,
              is_default: false,
              name: parsedPreference?.name ?? 'Saved Preference',
              parameters: parsedParameters,
              created_at: new Date().toISOString(),
            } as TestRunEvaluationConfig);
            updateLoadedPreference('test_run_evaluation_parameters', normalizedPreference);
          }
        } catch (e) {
          console.warn('Failed to parse evaluation parameters:', e);
        }
      }

      if (preferences.test_run_batch_size !== undefined && preferences.test_run_batch_size !== null) {
        setBatchSize(preferences.test_run_batch_size);
      }


      return preferences;
    } catch (err) {
      console.error('Failed to load preferences:', err);
      // Clear loaded preferences if loading fails
      setLoadedPreferences({});
      hasLoadedPreferencesRef.current = false;
      return {};
    } finally {
      setPreferencesLoaded(true);
      // Delay clearing the loading flag to ensure all state updates complete
      setTimeout(() => {
        setIsLoadingFromAPI(false);
      }, 100);
    }
  };

  const savePreference = async (key: keyof TestRunPreferences, value: string | null) => {
    try {
      await apiService.updateTestRunPreferences({ [key]: value });
      updateLoadedPreference(key, value);
    } catch (err) {
      console.error('Failed to save preference:', err);
    }
  };

  const saveNumericPreference = async <K extends keyof TestRunPreferences>(key: K, value: number | null) => {
    try {
      await apiService.updateTestRunPreferences({ [key]: value } as Partial<TestRunPreferences>);
      updateLoadedPreference(key, value as TestRunPreferences[K]);
    } catch (err) {
      console.error('Failed to save numeric preference:', err);
    }
  };

  const saveSessionParameters = async (parameters: Record<string, string>) => {
    try {
      await apiService.updateTestRunPreferences({ test_run_session_parameters: parameters });
      updateLoadedPreference('test_run_session_parameters', parameters);
    } catch (err) {
      console.error('Failed to save session parameters:', err);
    }
  };

  const savePromptMessages = async (preMessages: string[], postMessages: string[]) => {
    try {
      await apiService.updateTestRunPreferences({ 
        test_run_pre_prompt_messages: preMessages,
        test_run_post_prompt_messages: postMessages 
      });
      updateLoadedPreference('test_run_pre_prompt_messages', preMessages);
      updateLoadedPreference('test_run_post_prompt_messages', postMessages);
    } catch (err) {
      console.error('Failed to save prompt message preferences:', err);
    }
  };

  // State for datasets
  const [availableDatasets, setAvailableDatasets] = useState<DatasetSummary[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<DatasetSummary[]>([]);
  
  // State for loading and submission
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [startResourcesLoading, setStartResourcesLoading] = useState(false);
  const [datasetsLoading, setDatasetsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Load initial data and preferences
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadUserPreferences(),
        loadProjects(),
        loadDatasets(),
        loadEvaluationParameters(),
        loadAvailableModels()
      ]);
      // Mark initial loading as complete after all data is loaded
      setTimeout(() => {
        setInitialLoadingComplete(true);
      }, 250);
    };
    initializeData();
  }, []);

  // Save individual preferences when they change
  useEffect(() => {


    if (
      preferencesLoaded &&
      initialLoadingComplete &&
      selectedProjectId &&
      !isLoadingFromAPI &&
      stringPreferenceChanged('test_run_project_id', selectedProjectId)
    ) {

      savePreference('test_run_project_id', selectedProjectId);
    }
  }, [selectedProjectId, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  useEffect(() => {


    if (preferencesLoaded && initialLoadingComplete && selectedAgentName && !isLoadingFromAPI) {
      const agentId = extractAgentId(selectedAgentName);
      if (stringPreferenceChanged('test_run_agent_id', agentId)) {

        savePreference('test_run_agent_id', agentId);
      }
    }
  }, [selectedAgentName, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  // Removed complex page preference useEffect - now using direct save in onChange like QuickTest
  // Removed LLM model preference useEffect - now using direct save in onChange like QuickTest

  useEffect(() => {
    if (!preferencesLoaded || !initialLoadingComplete || isLoadingFromAPI) {
      return;
    }

    const normalizedBatchSize = Number.isFinite(batchSize) ? batchSize : null;
    if (!numberPreferenceChanged('test_run_batch_size', normalizedBatchSize)) {
      return;
    }

    saveNumericPreference('test_run_batch_size', normalizedBatchSize);
  }, [batchSize, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  useEffect(() => {
    if (
      preferencesLoaded &&
      initialLoadingComplete &&
      !isLoadingFromAPI &&
      objectPreferenceChanged('test_run_session_parameters', sessionParameters)
    ) {
      saveSessionParameters(sessionParameters);
    }
  }, [sessionParameters, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  useEffect(() => {
    if (!preferencesLoaded || !initialLoadingComplete || isLoadingFromAPI) {
      return;
    }

    if (loadedPreferences.test_run_enable_webhook === enableWebhook) {
      return;
    }

    (async () => {
      try {
        await apiService.updateTestRunPreferences({ test_run_enable_webhook: enableWebhook });
        updateLoadedPreference('test_run_enable_webhook', enableWebhook);
      } catch (err) {
        console.error('Failed to save webhook preference:', err);
      }
    })();
  }, [enableWebhook, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  useEffect(() => {
    if (!preferencesLoaded || isLoadingFromAPI || evaluationParametersLoading) {
      return;
    }

    if (evaluationParameterConfig.length === 0) {
      return;
    }

    const serializedConfig = JSON.stringify({ parameters: evaluationParameterConfig });
    if (!stringPreferenceChanged('test_run_evaluation_parameters', serializedConfig)) {
      return;
    }

    (async () => {
      try {
        await apiService.updateTestRunPreferences({ test_run_evaluation_parameters: serializedConfig });
        updateLoadedPreference('test_run_evaluation_parameters', serializedConfig);
      } catch (err) {
        console.error('Failed to save evaluation parameter preferences:', err);
      }
    })();
  }, [evaluationParameterConfig, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI, evaluationParametersLoading]);

  // Load evaluation parameters and default configuration
  const loadEvaluationParameters = async () => {
    if (hasLoadedEvaluationParamsRef.current) {
      return;
    }

    hasLoadedEvaluationParamsRef.current = true;

    try {
      setEvaluationParametersLoading(true);
      
      // Load available parameters
      const parameters = await apiService.getEvaluationParameters();
      setAvailableEvaluationParameters(parameters);
      
      // Load user's default configuration
      try {
        const defaultConfig = await apiService.getDefaultEvaluationConfig();
        setCurrentEvaluationConfig(prev => prev ?? defaultConfig);
        setEvaluationParameterConfig(prev =>
          prev.length > 0 ? prev : defaultConfig.parameters
        );
      } catch (error) {
        console.warn('No default evaluation config found, using system defaults');
        // Create default configuration from available parameters
        const systemDefaults = parameters
          .filter(p => p.is_system_default && p.is_active)
          .map(param => ({
            parameter_id: param.id,
            weight: getDefaultParameterWeight(param.name),
            enabled: true
          }));
        if (systemDefaults.length > 0) {
          setEvaluationParameterConfig(prev =>
            prev.length > 0 ? prev : systemDefaults
          );
          setCurrentEvaluationConfig(prev => prev ?? {
            id: -2,
            user_id: -1,
            is_default: true,
            name: 'System Defaults',
            parameters: systemDefaults,
            created_at: new Date().toISOString(),
          } as TestRunEvaluationConfig);
        }
      }
    } catch (error) {
      console.error('Error loading evaluation parameters:', error);
      hasLoadedEvaluationParamsRef.current = false;
    } finally {
      setEvaluationParametersLoading(false);
    }
  };

  const getDefaultParameterWeight = (parameterName: string): number => {
    switch (parameterName) {
      case 'Similarity Score': return 60;
      case 'Empathy Level': return 30;
      case 'No-Match Detection': return 10;
      default: return 20;
    }
  };

  const handleEvaluationConfigChange = (config: EvaluationParameterConfig[]) => {
    setEvaluationParameterConfig(config);
  };

  const handleSaveEvaluationConfig = async (name: string, config: EvaluationParameterConfig[]) => {
    try {
      await apiService.createEvaluationConfig({
        name,
        parameters: config,
        is_default: false
      });
    } catch (error) {
      console.error('Failed to save evaluation configuration:', error);
      throw error;
    }
  };

  // Load available LLM models
  const loadAvailableModels = async () => {
    try {
      setModelsLoading(true);
      const response = await apiService.getAvailableModels();
      
      if (response.models && response.models.length > 0) {
        setAvailableModels(response.models);
        setError(''); // Clear any previous errors
      } else {
        // No models available
        setAvailableModels([]);
        setError('No LLM models available. Please check your API configuration and try refreshing.');
      }
      
      // Log any errors for debugging
      if (response.error) {
        console.warn('Model loading warning:', response.error);
        setError(`Model loading issue: ${response.error}`);
      }
      
    } catch (error) {
      console.error('Failed to load available models:', error);
      setAvailableModels([]); // Clear models on error
      setError(`Failed to load models: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your connection and try refreshing.`);
    } finally {
      setModelsLoading(false);
    }
  };

  // Refresh models by forcing API call
  const refreshModels = async () => {
    try {
      setModelsLoading(true);
      setError('');
      
      // Call the refresh endpoint
      const response = await apiService.refreshModels();
      
      if (response.status === 'success') {
        setAvailableModels(response.models || []);
        // Optional: Show success message
      } else {
        throw new Error(response.error || 'Failed to refresh models');
      }
      
    } catch (error) {
      console.error('Failed to refresh models:', error);
      setError(`Failed to refresh models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setModelsLoading(false);
    }
  };

  // Load Google Cloud projects
  const loadProjects = async () => {
    if (hasLoadedProjectsRef.current) {
      return projects;
    }

    try {
      hasLoadedProjectsRef.current = true;
      setProjectsLoading(true);
      const projectData = await apiService.getGoogleCloudProjects();
      setProjects(projectData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to load Google Cloud projects');
      hasLoadedProjectsRef.current = false;
    } finally {
      setProjectsLoading(false);
    }
  };

  // Load datasets
  const loadDatasets = async () => {
    if (hasLoadedDatasetsRef.current) {
      return availableDatasets;
    }

    try {
      hasLoadedDatasetsRef.current = true;
      setDatasetsLoading(true);
      const datasetData = await apiService.getDatasets();
      setAvailableDatasets(datasetData);
    } catch (error) {
      console.error('Error loading datasets:', error);
      setError('Failed to load datasets');
      hasLoadedDatasetsRef.current = false;
    } finally {
      setDatasetsLoading(false);
    }
  };

  // Load agents when project is selected, taking preferences into account
  useEffect(() => {
    // Only proceed after both preferences are loaded AND initial loading is complete
    if (!preferencesLoaded || !initialLoadingComplete || isLoadingFromAPI) {
      return;
    }

    if (selectedProjectId) {
      if (lastLoadedProjectIdRef.current !== selectedProjectId) {
        lastLoadedProjectIdRef.current = selectedProjectId;
        loadAgents();
      }
    } else if (selectedProjectId === '' && !loadedPreferences.test_run_agent_id) {
      lastLoadedProjectIdRef.current = null;
      // Only clear if explicitly no project selected AND no agent was loaded from preferences
      setAgents([]);
      setSelectedAgentName('');
    } else if (!selectedProjectId) {
      lastLoadedProjectIdRef.current = null;
    }
  }, [selectedProjectId, preferencesLoaded, initialLoadingComplete, loadedPreferences, isLoadingFromAPI]);

  const loadAgents = async () => {
    if (!selectedProjectId) return;
    
    try {
      setAgentsLoading(true);
      const agentData = await apiService.getDialogflowAgents(selectedProjectId);
      const sortedAgents = agentData.sort((a, b) => a.display_name.localeCompare(b.display_name));
      setAgents(sortedAgents);

      // Restore agent from preferences if available
      if (loadedPreferences.test_run_agent_id && !selectedAgentName) {
        const agentFromPrefs = sortedAgents.find(agent => 
          extractAgentId(agent.name) === loadedPreferences.test_run_agent_id
        );
        if (agentFromPrefs) {
          setSelectedAgentName(agentFromPrefs.name);
        }
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      setError('Failed to load agents');
      lastLoadedProjectIdRef.current = null;
    } finally {
      setAgentsLoading(false);
    }
  };

  // Load start resources when agent is selected
  useEffect(() => {
    if (!preferencesLoaded || !initialLoadingComplete || isLoadingFromAPI) {
      return;
    }
    
    if (selectedAgentName) {
      if (lastLoadedStartResourcesAgentRef.current !== selectedAgentName) {
        lastLoadedStartResourcesAgentRef.current = selectedAgentName;
        loadStartResources();
      }
    } else {
      lastLoadedStartResourcesAgentRef.current = null;
      lastLoadedFlowsKeyRef.current = null;
      lastLoadedPagesKeyRef.current = null;
      setStartResources([]);
      setFlows([]);
      setSelectedStartResourceId('');
      setSelectedStartResourceType('');
      setSelectedFlowId('');
    }
  }, [selectedAgentName, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  const loadStartResources = async () => {
    if (!selectedAgentName) return;
    
    try {
      setStartResourcesLoading(true);
      const startResourcesList = await apiService.getStartResources(selectedAgentName);
      setStartResources(startResourcesList);
      
      const hasSavedPlaybookPreference = loadedPreferences.test_run_playbook_id !== undefined && loadedPreferences.test_run_playbook_id !== null && loadedPreferences.test_run_playbook_id !== '';
      const hasSavedFlowPreference = loadedPreferences.test_run_flow_id !== undefined && loadedPreferences.test_run_flow_id !== null;
      

      // Try to restore preferences if they exist and match available resources
      if (hasSavedPlaybookPreference) {
        const matchingPlaybook = startResourcesList.find(resource => 
          resource.type === 'playbook' && resource.id === loadedPreferences.test_run_playbook_id
        );
        if (matchingPlaybook) {

          setSelectedStartResourceId(matchingPlaybook.id);
          setSelectedStartResourceType('playbook');
          setSelectedPlaybookId(matchingPlaybook.id);
          setSelectedFlowId(''); // Clear flow when playbook is selected
          // Restore saved model if it exists
          if (loadedPreferences.test_run_llm_model_id && availableModels.find(m => m.id === loadedPreferences.test_run_llm_model_id)) {
            setSelectedModelId(loadedPreferences.test_run_llm_model_id);
          }
        } else {

        }
      } else if (hasSavedFlowPreference) {
        const matchingFlow = startResourcesList.find(resource => 
          resource.type === 'flow' && resource.id === loadedPreferences.test_run_flow_id
        );
        if (matchingFlow) {

          setSelectedStartResourceId(matchingFlow.id);
          setSelectedStartResourceType('flow');
          setSelectedFlowId(matchingFlow.id);
          setSelectedPlaybookId(''); // Clear playbook when flow is selected
          // Note: Pages will be loaded automatically by the selectedFlowId useEffect
          if (matchingFlow.id !== '00000000-0000-0000-0000-000000000000') {

          }
        } else {

        }
      }

      // Check if current selection is still valid
      const currentSelectionStillValid = selectedStartResourceId
        ? startResourcesList.some(resource => resource.id === selectedStartResourceId)
        : false;

      // Auto-select "Default Start Flow" only if no preference was restored and no valid current selection
      if (!hasSavedPlaybookPreference && !hasSavedFlowPreference && (!selectedStartResourceId || !currentSelectionStillValid)) {
        const defaultFlow = startResourcesList.find(resource => 
          resource.type === 'flow' && (
            resource.display_name.toLowerCase().includes('default') || 
            resource.display_name.toLowerCase().includes('start')
          )
        );
        if (defaultFlow) {

          setSelectedStartResourceId(defaultFlow.id);
          setSelectedStartResourceType('flow');
        }
      }
    } catch (error) {
      console.error('Error loading start resources:', error);
      setError('Failed to load start resources');
      lastLoadedStartResourcesAgentRef.current = null;
    } finally {
      setStartResourcesLoading(false);
    }
  };

  // Load flows when agent is selected (kept for backward compatibility)
  useEffect(() => {
    if (!preferencesLoaded || !initialLoadingComplete || isLoadingFromAPI) {
      return;
    }
    
    if (selectedAgentName && selectedProjectId) {
      const flowLoadKey = `${selectedAgentName}|${selectedProjectId}`;
      if (lastLoadedFlowsKeyRef.current !== flowLoadKey) {
        lastLoadedFlowsKeyRef.current = flowLoadKey;
        loadFlows();
      }
    } else {
      lastLoadedFlowsKeyRef.current = null;
      setFlows([]);
      setSelectedFlowId('');
    }
  }, [selectedAgentName, selectedProjectId, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  const loadFlows = async () => {
    if (!selectedAgentName) return;
    
    try {
      setFlowsLoading(true);
      const flowData = await apiService.getFlows(selectedAgentName, selectedProjectId);
      setFlows(flowData.sort((a, b) => a.display_name.localeCompare(b.display_name)));
    } catch (error) {
      console.error('Error loading flows:', error);
      setError('Failed to load flows');
      lastLoadedFlowsKeyRef.current = null;
    } finally {
      setFlowsLoading(false);
    }
  };

  // Load pages when flow is selected
  useEffect(() => {


    if (!preferencesLoaded || !initialLoadingComplete || isLoadingFromAPI) {

      return;
    }
    
    if (selectedAgentName && selectedFlowId && selectedProjectId && selectedStartResourceType === 'flow' && selectedFlowId !== '00000000-0000-0000-0000-000000000000') {
      // Only load pages for actual flows (not empty string or Default Start Flow)
      const pageLoadKey = `${selectedAgentName}|${selectedProjectId}|${selectedFlowId}`;
      if (lastLoadedPagesKeyRef.current !== pageLoadKey) {

        lastLoadedPagesKeyRef.current = pageLoadKey;
        loadPages();
      } else {

      }
    } else {

      // For Default Start Flow (all zeros), empty flowId, or playbooks, clear pages or set default
      lastLoadedPagesKeyRef.current = null;
      setPages([]);
      setSelectedPageId('');
    }
  }, [selectedAgentName, selectedFlowId, selectedProjectId, selectedStartResourceType, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  const loadPages = async () => {
    if (!selectedAgentName) return;
    
    try {
      setPagesLoading(true);
      const agentId = extractAgentId(selectedAgentName);
      const flowId = selectedFlowId; // Can be empty string for Default Start Flow
      const pageData = await apiService.getFlowPages(agentId, flowId, selectedProjectId);
      const sortedPages = pageData.sort((a, b) => a.display_name.localeCompare(b.display_name));
      setPages(sortedPages);

      // Apply page preference restoration (same pattern as Start Resource restoration)


      if (loadedPreferences.test_run_page_id) {
        const matchingPage = sortedPages.find(page => 
          extractPageId(page.name) === loadedPreferences.test_run_page_id
        );
        if (matchingPage) {
          const pageId = extractPageId(matchingPage.name);

          setSelectedPageId(pageId);
        } else {

          // Auto-select start page if preference not found
          const startPage = sortedPages.find(page => 
            page.display_name.toLowerCase().includes('start') || 
            page.display_name.toLowerCase().includes('default') ||
            page.display_name.toLowerCase().includes('entry')
          );
          if (startPage) {

            setSelectedPageId(extractPageId(startPage.name));
          }
        }
      } else {

        // Auto-select start page if no preference
        const startPage = sortedPages.find(page => 
          page.display_name.toLowerCase().includes('start') || 
          page.display_name.toLowerCase().includes('default') ||
          page.display_name.toLowerCase().includes('entry')
        );
        if (startPage) {

          setSelectedPageId(extractPageId(startPage.name));
        }
      }
    } catch (error) {
      console.error('Error loading pages:', error);
      setError('Failed to load pages');
      lastLoadedPagesKeyRef.current = null;
    } finally {
      setPagesLoading(false);
    }
  };

  // Handle start resource selection changes (flow vs playbook)
  useEffect(() => {
    if (!preferencesLoaded || !initialLoadingComplete || isLoadingFromAPI) {
      return;
    }
    
    if (selectedStartResourceId && selectedStartResourceType && selectedAgentName && selectedProjectId) {
      if (selectedStartResourceType === 'flow') {
        const agentId = extractAgentId(selectedAgentName);
        setSelectedFlowId(selectedStartResourceId); // Set flowId BEFORE calling loadPages
        setSelectedPlaybookId('');
        setSelectedModelId('');
        // Note: loadPages will be called by the selectedFlowId useEffect
      } else if (selectedStartResourceType === 'playbook') {
        setSelectedPlaybookId(selectedStartResourceId);
        setSelectedFlowId('');
        setSelectedPageId('');
        // Auto-select first model if no preference
        if (!selectedModelId && availableModels.length > 0) {
          setSelectedModelId(availableModels[0].id);
        }
      }
    } else if (selectedStartResourceId === '' && selectedAgentName !== '' && selectedProjectId !== '') {
      // Clear dependent selections when start resource is cleared
      setPages([]);
      setSelectedPageId('');
      setSelectedFlowId('');
      setSelectedPlaybookId('');
      setSelectedModelId('');
    }
  }, [selectedStartResourceId, selectedStartResourceType, selectedAgentName, selectedProjectId, preferencesLoaded, initialLoadingComplete, isLoadingFromAPI]);

  // Handle dataset selection
  const handleDatasetToggle = (dataset: DatasetSummary) => {
    setSelectedDatasets(prev => {
      const exists = prev.find(d => d.id === dataset.id);
      if (exists) {
        return prev.filter(d => d.id !== dataset.id);
      } else {
        return [...prev, dataset];
      }
    });
  };

  // Calculate total questions
  const getTotalQuestions = () => {
    return selectedDatasets.reduce((total, dataset) => total + dataset.question_count, 0);
  };

  // Helper function to validate evaluation parameter weights
  const areWeightsValid = () => {
    const enabledParams = evaluationParameterConfig.filter(p => p.enabled);
    
    // Must have at least one enabled parameter
    if (enabledParams.length === 0) {
      return false;
    }
    
    // Only count parameters with weight > 0 for sum validation
    const weightedParams = enabledParams.filter(p => p.weight > 0);
    
    // Must have at least one parameter with weight > 0
    if (weightedParams.length === 0) {
      return false;
    }
    
    // Weighted parameters must sum to 100
    const totalWeight = weightedParams.reduce((sum, p) => sum + p.weight, 0);
    return totalWeight === 100;
  };

  // Get weight validation status message
  const getWeightStatusMessage = () => {
    const enabledParams = evaluationParameterConfig.filter(p => p.enabled);
    
    if (enabledParams.length === 0) {
      return 'At least one evaluation parameter must be enabled';
    }
    
    const weightedParams = enabledParams.filter(p => p.weight > 0);
    
    if (weightedParams.length === 0) {
      return 'At least one enabled parameter must have weight > 0%';
    }
    
    const totalWeight = weightedParams.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight !== 100) {
      return `Parameter weights must sum to 100% (currently ${totalWeight}%)`;
    }
    
    return '';
  };

  // Form validation
  const isFormValid = () => {
    const basicValid = testRunName.trim() !== '' &&
           selectedProjectId !== '' &&
           selectedAgentName !== '' &&
           selectedDatasets.length > 0 &&
           selectedEvaluationModelId !== '' &&  // Evaluation model is now required
           availableModels.length > 0;  // Must have models available
    
    // Agent must be accessible
    const agentAccessible = agents.find(a => a.name === selectedAgentName)?.accessible ?? false;
    
    // Evaluation parameters must be valid
    const weightsValid = areWeightsValid();
    
    // Additional validation based on start resource type
    if (selectedStartResourceType === 'flow') {
      return basicValid && agentAccessible && weightsValid &&
             selectedFlowId !== null && selectedFlowId !== undefined &&
             selectedPageId !== null && selectedPageId !== undefined;
    } else if (selectedStartResourceType === 'playbook') {
      return basicValid && agentAccessible && weightsValid &&
             selectedPlaybookId !== '' &&
             selectedModelId !== '';
    }
    
    // Fallback to flow validation for backward compatibility
    return basicValid && agentAccessible && weightsValid &&
           selectedFlowId !== null && selectedFlowId !== undefined &&
           selectedPageId !== null && selectedPageId !== undefined;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid()) {
      return;
    }

    try {
      setSubmitting(true);
      
      const selectedFlow = flows.find(f => extractFlowId(f.name) === selectedFlowId);
      const selectedPage = pages.find(p => extractPageId(p.name) === selectedPageId);
      
      const testRunData: CreateTestRunRequest = {
        name: testRunName.trim(),
        description: testRunDescription.trim(),
        project_id: selectedProjectId,
        agent_id: extractAgentId(selectedAgentName),
        agent_name: selectedAgentName, // Store the full agent path for API calls
        agent_display_name: agents.find(a => a.name === selectedAgentName)?.display_name || selectedAgentName,
        flow_name: selectedFlow?.name || '',
        flow_display_name: selectedFlow?.display_name || 'Default Start Flow',
        page_name: selectedPage?.name || '',
        page_display_name: selectedPage?.display_name || 'Start Page',
        playbook_id: selectedStartResourceType === 'playbook' ? selectedPlaybookId : undefined,
        playbook_display_name: selectedStartResourceType === 'playbook' ? 
          playbooks.find(p => p.name === selectedPlaybookId)?.display_name || 'Routing Playbook' : undefined,
        llm_model_id: selectedStartResourceType === 'playbook' ? selectedModelId : undefined,
        evaluation_model_id: selectedEvaluationModelId,  // Required field
        environment: 'prod', // Default environment
        dataset_ids: selectedDatasets.map(d => d.id),
        batch_size: batchSize,
        session_parameters: sessionParameters,
        enable_webhook: enableWebhook,
        pre_prompt_messages: prePromptMessages.length > 0 ? prePromptMessages : undefined,
        post_prompt_messages: postPromptMessages.length > 0 ? postPromptMessages : undefined,
        evaluation_parameters: evaluationParameterConfig
      };

      // Use Redux action instead of direct API call to ensure test run is in the store
      const result = await dispatch(createTestRun(testRunData));
      
      if (createTestRun.fulfilled.match(result)) {
        // Navigate to the test run detail page
        navigate(`/test-runs/${result.payload.id}`);
      } else {
        throw new Error('Failed to create test run');
      }
      
    } catch (error) {
      console.error('Error creating test run:', error);
      setError('Failed to create test run. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      {/* Header with Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/test-runs')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Create Test Run
          </Typography>
        </Box>
      </Box>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Configure and run automated tests against your Dialogflow CX agent with multiple datasets.
      </Typography>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          handleSubmit(); 
        }}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Test Run Name"
                value={testRunName}
                onChange={(e) => setTestRunName(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Description (Optional)"
                value={testRunDescription}
                onChange={(e) => setTestRunDescription(e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Dialogflow Configuration */}
          <Typography variant="h6" gutterBottom>
            Dialogflow Configuration
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Google Cloud Project */}
            <Grid item xs={12} sm={6}>
              <Autocomplete
                fullWidth
                options={projects}
                loading={projectsLoading}
                value={projects.find(p => p.project_id === selectedProjectId) || null}
                onChange={(_, newValue) => {
                  setSelectedProjectId(newValue?.project_id || '');
                }}
                getOptionLabel={(option) => option.display_name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Google Cloud Project"
                    required
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {projectsLoading && <CircularProgress color="inherit" size={20} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            {/* Dialogflow Agent */}
            <Grid item xs={12} sm={6}>
              <Autocomplete
                fullWidth
                options={[...agents].sort((a, b) => {
                  // Sort accessible agents first, then inaccessible
                  if (a.accessible !== b.accessible) {
                    return a.accessible ? -1 : 1;
                  }
                  return a.display_name.localeCompare(b.display_name);
                })}
                groupBy={(option) => option.accessible ? 'Available Agents' : 'Unavailable Agents (View Only)'}
                loading={agentsLoading}
                value={agents.find(a => a.name === selectedAgentName) || null}
                onChange={(_, newValue) => {
                  setSelectedAgentName(newValue?.name || '');
                }}
                getOptionLabel={(option) => option.accessible ? option.display_name : `${option.display_name} (No Access)`}
                disabled={!selectedProjectId}
                renderInput={(params) => {
                  const selectedAgent = agents.find(a => a.name === selectedAgentName);
                  const isInaccessible = selectedAgent && !selectedAgent.accessible;
                  
                  return (
                    <TextField
                      {...params}
                      label="Dialogflow Agent"
                      required
                      error={isInaccessible}
                      helperText={isInaccessible ? 'This agent is unavailable - you do not have detectIntent permission' : ''}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: isInaccessible ? (
                          <Chip 
                            label="No Access" 
                            size="small" 
                            color="error" 
                            sx={{ mr: 1 }}
                          />
                        ) : null,
                        endAdornment: (
                          <>
                            {agentsLoading ? (
                              <CircularProgress color="inherit" size={20} />
                            ) : (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedProjectId) {
                                    loadAgents();
                                  }
                                }}
                                disabled={!selectedProjectId}
                                title="Refresh agents"
                                sx={{ mr: 0.5 }}
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  );
                }}
              />
            </Grid>

            {/* Start Resource Selection (Flows + Playbooks) */}
            <Grid item xs={12} sm={6}>
              <Autocomplete
                fullWidth
                options={[
                  { id: '', display_name: 'Default Start Flow', type: 'flow' as const }, 
                  ...startResources.sort((a, b) => {
                    // Sort by type first (flows then playbooks), then by name
                    if (a.type !== b.type) {
                      return a.type === 'flow' ? -1 : 1;
                    }
                    return a.display_name.localeCompare(b.display_name);
                  })
                ]}
                getOptionLabel={(option) => {
                  if (option.id === '') return 'Default Start Flow';
                  const typeLabel = option.type === 'flow' ? '🔄 Flow' : '📖 Playbook';
                  return `${typeLabel}: ${option.display_name}`;
                }}
                value={selectedStartResourceId ? 
                  startResources.find(r => r.id === selectedStartResourceId) || null : 
                  { id: '', display_name: 'Default Start Flow', type: 'flow' as const }
                }
                onChange={(event, newValue) => {
                  if (newValue && newValue.id) {


                    setSelectedStartResourceId(newValue.id);
                    setSelectedStartResourceType(newValue.type);
                    
                    // Save both preferences in a single API call
                    if (newValue.type === 'flow') {
                      setSelectedFlowId(newValue.id);
                      setSelectedPlaybookId(''); // Clear playbook when flow is selected

                      apiService.updateTestRunPreferences({ 
                        test_run_flow_id: newValue.id, 
                        test_run_playbook_id: null 
                      });
                    } else if (newValue.type === 'playbook') {
                      setSelectedPlaybookId(newValue.id);
                      setSelectedFlowId(''); // Clear flow when playbook is selected

                      apiService.updateTestRunPreferences({ 
                        test_run_playbook_id: newValue.id, 
                        test_run_flow_id: null 
                      });
                    }
                  } else {
                    // Default flow selected

                    setSelectedStartResourceId('');
                    setSelectedStartResourceType('flow');
                    setSelectedFlowId('');
                    setSelectedPlaybookId('');

                    apiService.updateTestRunPreferences({ 
                      test_run_flow_id: null, 
                      test_run_playbook_id: null 
                    });
                  }
                }}
                disabled={!selectedAgentName || startResourcesLoading}
                loading={startResourcesLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Start Resource"
                    required
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {startResourcesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                sx={{ mb: 2 }}
              />
            </Grid>

            {/* Conditional Selection: Pages for Flows, Models for Playbooks */}
            {selectedStartResourceType === 'flow' && (
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  fullWidth
                  options={[{ display_name: 'Default Start Page', name: '' }, ...[...pages].sort((a, b) => a.display_name.localeCompare(b.display_name))]}
                  getOptionLabel={(option) => option.display_name || 'Default Start Page'}
                  value={selectedPageId ? pages.find(p => extractPageId(p.name) === selectedPageId) || null : { display_name: 'Default Start Page', name: '' }}
                  onChange={(event, newValue) => {
                    const newPageId = newValue && newValue.name ? extractPageId(newValue.name) : '';
                    setSelectedPageId(newPageId);
                    // Save preference immediately like QuickTest (only save non-empty values)
                    if (newPageId) {

                      savePreference('test_run_page_id', newPageId);
                    }
                  }}
                  disabled={!selectedStartResourceId || pagesLoading}
                  loading={pagesLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Page (Optional)"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {pagesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
            )}

            {selectedStartResourceType === 'playbook' && (
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  fullWidth
                  options={availableModels}
                  getOptionLabel={(option) => option.name}
                  value={availableModels.find(m => m.id === selectedModelId) || null}
                  onChange={(event, newValue) => {
                    const newModelId = newValue?.id || '';
                    setSelectedModelId(newModelId);
                    if (newModelId) {
                      savePreference('test_run_llm_model_id', newModelId);
                    }
                  }}
                  disabled={!selectedPlaybookId}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Playbook LLM Model"
                      required
                      helperText="Select the language model to use for playbook testing"
                    />
                  )}
                />
              </Grid>
            )}

            {/* LLM Model Selection for Evaluation - Moved here to be right after LLM Model */}
            <Grid item xs={12} sm={6}>
              <Autocomplete
                fullWidth
                loading={modelsLoading}
                options={availableModels}
                getOptionLabel={(option) => option.name}
                value={availableModels.find(m => m.id === selectedEvaluationModelId) || null}
                onChange={(event, newValue) => {
                  const newModelId = newValue?.id || '';
                  setSelectedEvaluationModelId(newModelId);
                  // Note: Could save to preferences if desired
                }}
                groupBy={(option) => {
                  // Group by category if available
                  switch(option.category) {
                    case 'stable': return '🟢 Stable Models';
                    case 'latest': return '🆕 Latest Models'; 
                    case 'efficient': return '⚡ Efficient Models';
                    case 'fast': return '🚀 Fast Models';
                    case 'experimental': return '🧪 Experimental Models';
                    default: return '📋 Other Models';
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="LLM Model for Evaluation *"
                    required
                    helperText={modelsLoading 
                      ? "Loading available models..." 
                      : availableModels.length === 0 
                        ? "No models available. Check API connection and try refreshing."
                        : `Select from ${availableModels.length} available models. This field is required.`
                    }
                    error={availableModels.length === 0}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {modelsLoading ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshModels();
                              }}
                              disabled={modelsLoading}
                              title="Refresh models"
                              sx={{ mr: 0.5 }}
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            {/* Batch Size */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Batch Size"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                inputProps={{ min: 1, max: 100 }}
                helperText="Number of questions to test concurrently (1-100). Higher values = faster execution but more API load."
              />
            </Grid>

            {/* Session Parameters */}
            <Grid item xs={12}>
              <SessionParametersEditor
                sessionParameters={sessionParameters}
                onChange={setSessionParameters}
                label="Session Parameters"
                helperText="Configure session parameters to pass to Dialogflow agent during testing"
              />
            </Grid>

            {/* Webhook Settings */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableWebhook}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnableWebhook(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Webhooks"
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                When enabled, Dialogflow will call configured webhooks during test execution
              </Typography>
            </Grid>

            {/* Pre-Prompt Messages */}
            <Grid item xs={12} sm={6}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
                Pre-Prompt Messages
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Messages to send before each main question to initialize context (optional)
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Enter a message to send before each question..."
                  value={prePromptInput}
                  onChange={(e) => setPrePromptInput(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (prePromptInput.trim()) {
                      const newMessages = [...prePromptMessages, prePromptInput.trim()];
                      setPrePromptMessages(newMessages);
                      setPrePromptInput('');
                      savePromptMessages(newMessages, postPromptMessages);
                    }
                  }}
                  disabled={!prePromptInput.trim()}
                >
                  Add Pre-Prompt Message
                </Button>
              </Box>
              
              {prePromptMessages.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Pre-Prompt Messages ({prePromptMessages.length}):
                  </Typography>
                  {prePromptMessages.map((message, index) => (
                    <Chip
                      key={index}
                      label={`${index + 1}. ${message && message.length > 50 ? message.substring(0, 50) + '...' : (message || '')}`}
                      onDelete={() => {
                        const newMessages = [...prePromptMessages];
                        newMessages.splice(index, 1);
                        setPrePromptMessages(newMessages);
                        savePromptMessages(newMessages, postPromptMessages);
                      }}
                      sx={{ m: 0.5 }}
                    />
                  ))}
                </Box>
              )}
            </Grid>

            {/* Post-Prompt Messages */}
            <Grid item xs={12} sm={6}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
                Post-Prompt Messages
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Messages to send after each main question for cleanup or confirmation (optional)
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Enter a message to send after each question..."
                  value={postPromptInput}
                  onChange={(e) => setPostPromptInput(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (postPromptInput.trim()) {
                      const newMessages = [...postPromptMessages, postPromptInput.trim()];
                      setPostPromptMessages(newMessages);
                      setPostPromptInput('');
                      savePromptMessages(prePromptMessages, newMessages);
                    }
                  }}
                  disabled={!postPromptInput.trim()}
                >
                  Add Post-Prompt Message
                </Button>
              </Box>
              
              {postPromptMessages.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Post-Prompt Messages ({postPromptMessages.length}):
                  </Typography>
                  {postPromptMessages.map((message, index) => (
                    <Chip
                      key={index}
                      label={`${index + 1}. ${message && message.length > 50 ? message.substring(0, 50) + '...' : (message || '')}`}
                      onDelete={() => {
                        const newMessages = [...postPromptMessages];
                        newMessages.splice(index, 1);
                        setPostPromptMessages(newMessages);
                        savePromptMessages(prePromptMessages, newMessages);
                      }}
                      sx={{ m: 0.5 }}
                    />
                  ))}
                </Box>
              )}
            </Grid>

            {/* Evaluation Parameters */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1 }}>
                Evaluation Parameters
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure the evaluation criteria and their weights for scoring test results
              </Typography>
              
              {evaluationParametersLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <EvaluationParameterConfiguration
                  availableParameters={availableEvaluationParameters}
                  currentConfig={currentEvaluationConfig}
                  onChange={handleEvaluationConfigChange}
                  onSaveConfig={handleSaveEvaluationConfig}
                />
              )}
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Dataset Selection */}
          <Typography variant="h6" gutterBottom>
            Select Datasets
          </Typography>
          
          {datasetsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ mb: 4 }}>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">Select</TableCell>
                      <TableCell>Dataset Name</TableCell>
                      <TableCell>Questions</TableCell>
                      <TableCell>Category & Version</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableDatasets.map((dataset) => (
                      <TableRow key={dataset.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedDatasets.some(d => d.id === dataset.id)}
                            onChange={() => handleDatasetToggle(dataset)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {dataset.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={dataset.question_count}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {dataset.category} - v{dataset.version}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Selected datasets summary */}
              {selectedDatasets.length > 0 && (
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Selected Datasets ({selectedDatasets.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      {selectedDatasets.map((dataset) => (
                        <Chip
                          key={dataset.id}
                          label={`${dataset.name || 'Unknown'} (${dataset.question_count || 0})`}
                          onDelete={() => handleDatasetToggle(dataset)}
                          color="primary"
                        />
                      ))}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Questions: {getTotalQuestions()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Estimated Duration: {Math.ceil(getTotalQuestions() / batchSize) * 2} minutes
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Box>
          )}

          {/* Weight validation status */}
          {!areWeightsValid() && evaluationParameterConfig.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {getWeightStatusMessage()}
            </Alert>
          )}

          {/* Submit Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/test-runs')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!isFormValid() || submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : <PlayArrowIcon />}
            >
              {submitting ? 'Creating...' : 'Create & Run Test'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateTestRunPage;