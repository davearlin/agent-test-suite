import React, { useState, useEffect } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  FormControlLabel,
  Switch,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiService } from '../services/api';
import { DialogflowAgent, DialogflowFlow, DialogflowPage, DialogflowPlaybook, StartResource, QuickTestResponse, GoogleCloudProject, QuickTestPreferences } from '../types';
import SessionParametersEditor from '../components/SessionParametersEditor';

const QuickTestPage: React.FC = () => {
  // State for projects, agents, start resources (flows + playbooks), pages, and playbooks
  const [projects, setProjects] = useState<GoogleCloudProject[]>([]);
  const [agents, setAgents] = useState<DialogflowAgent[]>([]);
  const [flows, setFlows] = useState<DialogflowFlow[]>([]);
  const [pages, setPages] = useState<DialogflowPage[]>([]);
  const [playbooks, setPlaybooks] = useState<DialogflowPlaybook[]>([]);
  const [startResources, setStartResources] = useState<StartResource[]>([]);
  
  // State for form
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedAgentName, setSelectedAgentName] = useState<string>(''); // Store full agent name instead of just ID
  const [selectedStartResourceId, setSelectedStartResourceId] = useState<string>('');
  const [selectedStartResourceType, setSelectedStartResourceType] = useState<'flow' | 'playbook' | ''>('');
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionParameters, setSessionParameters] = useState<Record<string, string>>({ retirementPlaybookRole: 'employee' }); // Default to employee retirementPlaybookRole
  const [enableWebhook, setEnableWebhook] = useState<boolean>(true); // Default to enabled webhooks
  
  // State for pre/post prompt messages
  const [prePromptMessages, setPrePromptMessages] = useState<string[]>([]);
  const [postPromptMessages, setPostPromptMessages] = useState<string[]>([]);
  const [prePromptInput, setPrePromptInput] = useState<string>('');
  const [postPromptInput, setPostPromptInput] = useState<string>('');
  
  const [response, setResponse] = useState<QuickTestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // State for loading dropdowns
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [startResourcesLoading, setStartResourcesLoading] = useState(false);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [playbooksLoading, setPlaybooksLoading] = useState(false);
  
  // State for available models
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  
  // State for preferences loading
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [initialLoadingComplete, setInitialLoadingComplete] = useState(false);
  const [loadedPreferences, setLoadedPreferences] = useState<any>({});

  // State change tracking for dependencies
  useEffect(() => {
    // selectedProjectId changed
  }, [selectedProjectId]);

  useEffect(() => {
    // selectedAgentName changed
  }, [selectedAgentName]);

  useEffect(() => {
    // selectedFlowId changed
  }, [selectedFlowId]);

  useEffect(() => {
    // selectedStartResourceId changed
  }, [selectedStartResourceId]);

  useEffect(() => {
  }, [selectedStartResourceType]);

  useEffect(() => {
  }, [preferencesLoaded]);

  // Load preferences and projects on component mount
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        loadUserPreferences(),
        loadProjects(),
        loadAvailableModels()
      ]);
      // Mark initial loading as complete after all data is loaded
      // Increased timeout to give state time to settle
      setTimeout(() => {
        setInitialLoadingComplete(true);

      }, 250);
    };
    initializeData();
  }, []);

  // Load agents when project is selected
  useEffect(() => {

    
    // Only proceed after both preferences are loaded AND initial loading is complete
    if (!preferencesLoaded || !initialLoadingComplete) {

      return;
    }
    
    if (selectedProjectId) {
      loadAgents(selectedProjectId);
    } else if (selectedProjectId === '' && !loadedPreferences.agent_id) {

      // Only clear if explicitly no project selected AND no agent was loaded from preferences
      setAgents([]);
      setFlows([]);
      setPages([]);
      setPlaybooks([]);
      setStartResources([]);
      setSelectedAgentName('');
      setSelectedStartResourceId('');
      setSelectedStartResourceType('');
      setSelectedFlowId('');
      setSelectedPageId('');
      setSelectedPlaybookId('');
      setSelectedModelId('');
    } else {

    }
  }, [selectedProjectId, preferencesLoaded, initialLoadingComplete, loadedPreferences]);

  // Load start resources (flows + playbooks) when agent is selected
  useEffect(() => {

    if (selectedAgentName && selectedProjectId && preferencesLoaded) {
      const agentProjectId = extractProjectId(selectedAgentName);
      loadStartResources(selectedAgentName);
    } else if (preferencesLoaded && initialLoadingComplete && selectedAgentName === '' && selectedProjectId !== '') {

      // Only clear if explicitly no agent selected, not during initial preference loading
      setStartResources([]);
      setFlows([]);
      setPages([]);
      setPlaybooks([]);
      setSelectedStartResourceId('');
      setSelectedStartResourceType('');
      setSelectedFlowId('');
      setSelectedPageId('');
      setSelectedPlaybookId('');
      setSelectedModelId('');
    } else {

    }
  }, [selectedAgentName, selectedProjectId, preferencesLoaded, initialLoadingComplete]);

  // Handle start resource selection changes
  useEffect(() => {
    if (selectedStartResourceId && selectedStartResourceType && selectedAgentName && selectedProjectId && preferencesLoaded) {
      if (selectedStartResourceType === 'flow') {
        const agentProjectId = extractProjectId(selectedAgentName);
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
    } else if (preferencesLoaded && selectedStartResourceId === '' && selectedAgentName !== '' && selectedProjectId !== '') {
      // Clear dependent selections when start resource is cleared
      setPages([]);
      setSelectedPageId('');
      setSelectedFlowId('');
      setSelectedPlaybookId('');
      setSelectedModelId('');
    }
  }, [selectedStartResourceId, selectedStartResourceType, selectedAgentName, selectedProjectId, preferencesLoaded]);

  // Load pages when flow is selected (kept for backward compatibility)
  useEffect(() => {
    if (selectedAgentName && selectedFlowId && selectedProjectId && preferencesLoaded && selectedStartResourceType === 'flow' && selectedFlowId !== '00000000-0000-0000-0000-000000000000') {
      const agentProjectId = extractProjectId(selectedAgentName);
      loadPages(extractAgentId(selectedAgentName), selectedFlowId, agentProjectId);
    } else if (preferencesLoaded && selectedFlowId === '' && selectedAgentName !== '' && selectedProjectId !== '') {
      // Only clear if explicitly no flow selected, not during initial preference loading
      setPages([]);
      setSelectedPageId('');
    }
  }, [selectedAgentName, selectedFlowId, selectedProjectId, preferencesLoaded, selectedStartResourceType]);

  // Auto-select first project if no preference is set (after both projects and preferences are loaded)
  useEffect(() => {
    if (preferencesLoaded && !projectsLoading && projects.length > 0 && !selectedProjectId) {

      const firstProject = projects[0];
      setSelectedProjectId(firstProject.project_id);
      savePreference('project_id', firstProject.project_id);
    }
  }, [preferencesLoaded, projectsLoading, projects, selectedProjectId]);

  const loadUserPreferences = async () => {
    try {
      const preferences = await apiService.getQuickTestPreferences();
      
      
      // Store what preferences were actually loaded
      setLoadedPreferences(preferences);
      
      // Set preferences if they exist
      if (preferences.project_id) {
        setSelectedProjectId(preferences.project_id);
        // Let the useEffect handle agent loading to avoid race conditions
      }
      if (preferences.agent_id) {
        // Don't set selectedAgentName here - just store in loadedPreferences for later restoration
        // This prevents race conditions where selectedAgentName doesn't match any loaded agent
      }
      if (preferences.flow_id) {
        setSelectedFlowId(preferences.flow_id);
        // If flow is saved, mark as flow start resource
        setSelectedStartResourceId(preferences.flow_id);
        setSelectedStartResourceType('flow');
      }
      if (preferences.playbook_id) {
        setSelectedPlaybookId(preferences.playbook_id);
        // If playbook is saved, mark as playbook start resource
        setSelectedStartResourceId(preferences.playbook_id);
        setSelectedStartResourceType('playbook');
      }
      if (preferences.page_id) {
        setSelectedPageId(preferences.page_id);
      }
      if (preferences.llm_model_id) {
        setSelectedModelId(preferences.llm_model_id);
      }
      if (preferences.session_id) {
        setSessionId(preferences.session_id);
      }
      if (preferences.session_parameters) {
        setSessionParameters(preferences.session_parameters);
      }
      if (preferences.pre_prompt_messages) {
        setPrePromptMessages(preferences.pre_prompt_messages);
      }
      if (preferences.post_prompt_messages) {
        setPostPromptMessages(preferences.post_prompt_messages);
      }
      if (preferences.enable_webhook !== undefined) {
        setEnableWebhook(preferences.enable_webhook);
      }
      
      return preferences;
      
    } catch (err) {
      setLoadedPreferences({});
      return {};
    } finally {
      setPreferencesLoaded(true);
    }
  };

  const savePreference = async (key: keyof QuickTestPreferences, value: string) => {
    try {
      await apiService.updateQuickTestPreferences({ [key]: value });
    } catch (err) {
      console.error('Failed to save preference:', err);
    }
  };

  const savePromptMessages = async (preMessages: string[], postMessages: string[]) => {
    try {
      await apiService.updateQuickTestPreferences({ 
        pre_prompt_messages: preMessages,
        post_prompt_messages: postMessages 
      });
    } catch (err) {
      console.error('Failed to save prompt message preferences:', err);
    }
  };

  const saveSessionParameters = async (parameters: Record<string, string>) => {
    try {
      await apiService.updateQuickTestPreferences({ session_parameters: parameters });
    } catch (err) {
      console.error('Failed to save session parameters:', err);
    }
  };

  const saveWebhookPreference = async (enableWebhook: boolean) => {
    try {
      await apiService.updateQuickTestPreferences({ enable_webhook: enableWebhook });
    } catch (err) {
      console.error('Failed to save webhook preference:', err);
    }
  };

  const loadProjects = async () => {
    try {
      setProjectsLoading(true);
      const projectsList = await apiService.getGoogleCloudProjects();
      setProjects(projectsList);
      
      // Don't auto-select a project here - let preferences loading handle it
      // This prevents overriding user preferences during initialization
      
    } catch (err) {
      setError('Failed to load projects');
      console.error('Error loading projects:', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadAgents = async (projectId?: string) => {
    try {
      // Prevent duplicate calls for the same project
      if (agentsLoading) {

        return;
      }
      
      setAgentsLoading(true);

      
      const agentsList = await apiService.getDialogflowAgents(projectId);
      setAgents(agentsList);
      
      // Check if we should restore an agent from preferences or keep current selection
      let agentToSelect = '';
      
      // First, check if the currently selected agent belongs to this project
      if (selectedAgentName) {
        const currentAgentProject = extractProjectId(selectedAgentName);
        if (currentAgentProject === projectId) {
          // Current agent belongs to this project, keep it selected
          const currentAgentInList = agentsList.find(agent => agent.name === selectedAgentName);
          if (currentAgentInList) {
            agentToSelect = selectedAgentName;
          }
        } else {

        }
      }
      
      // If no agent selected yet, try to restore from preferences
      if (!agentToSelect && loadedPreferences.agent_id) {
        const agentFromPrefs = agentsList.find(agent => extractAgentId(agent.name) === loadedPreferences.agent_id);
        if (agentFromPrefs) {
          agentToSelect = agentFromPrefs.name;
        } else {

        }
      }
      
      // Auto-select the first available agent only if no preference was restored and no current selection
      if (!agentToSelect && agentsList.length > 0) {

        agentToSelect = agentsList[0].name;
      }
      
      // Apply the selection (this might clear it if no agent should be selected)
      setSelectedAgentName(agentToSelect);
      
      // Clear flows/pages if agent selection changed or cleared
      if (agentToSelect !== selectedAgentName) {
        setFlows([]);
        setPages([]);
        setSelectedFlowId('');
        setSelectedPageId('');
      }
      
    } catch (err) {
      setError('Failed to load agents');
      console.error('❌ Error loading agents:', err);
    } finally {
      setAgentsLoading(false);
    }
  };

  // Helper function to extract project ID from agent name
  const extractProjectId = (agentName: string): string => {
    // Agent name format: projects/{project-id}/locations/{location}/agents/{agent-id}
    const parts = agentName.split('/');
    if (parts.length >= 2 && parts[0] === 'projects') {
      return parts[1];
    }
    return ''; // fallback
  };

  const loadStartResources = async (agentName: string) => {
    try {
      setStartResourcesLoading(true);

      const startResourcesList = await apiService.getStartResources(agentName);
      setStartResources(startResourcesList);
      
      // Check if we need to restore a saved preference from loadedPreferences
      const hasSavedPlaybookPreference = loadedPreferences.playbook_id && loadedPreferences.playbook_id !== '';
      const hasSavedFlowPreference = loadedPreferences.flow_id && loadedPreferences.flow_id !== '';
      
      if (hasSavedPlaybookPreference) {
        // Try to restore playbook preference
        const matchingPlaybook = startResourcesList.find(resource => 
          resource.type === 'playbook' && resource.id === loadedPreferences.playbook_id
        );
        if (matchingPlaybook) {

          setSelectedStartResourceId(matchingPlaybook.id);
          setSelectedStartResourceType('playbook');
          setSelectedPlaybookId(matchingPlaybook.id);
          // Auto-select first model if saved model preference exists
          if (loadedPreferences.llm_model_id && availableModels.find(m => m.id === loadedPreferences.llm_model_id)) {
            setSelectedModelId(loadedPreferences.llm_model_id);
          } else if (availableModels.length > 0) {
            setSelectedModelId(availableModels[0].id);
          }
        } else {

        }
      } else if (hasSavedFlowPreference) {
        // Try to restore flow preference  
        const matchingFlow = startResourcesList.find(resource => 
          resource.type === 'flow' && resource.id === loadedPreferences.flow_id
        );
        if (matchingFlow) {

          setSelectedStartResourceId(matchingFlow.id);
          setSelectedStartResourceType('flow');
          setSelectedFlowId(matchingFlow.id);
          // Note: Pages will be loaded automatically by the selectedFlowId useEffect
          if (matchingFlow.id !== '00000000-0000-0000-0000-000000000000') {

          }
        } else {

        }
      }
      
      // Only auto-select "Default Start Flow" if no preference was restored and no current selection
      if (!hasSavedPlaybookPreference && !hasSavedFlowPreference && !selectedStartResourceId) {
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
    } catch (err) {
      setError('Failed to load start resources');
      console.error('Error loading start resources:', err);
    } finally {
      setStartResourcesLoading(false);
    }
  };

  const loadFlows = async (agentId: string, projectId?: string) => {
    try {
      setFlowsLoading(true);

      const flowsList = await apiService.getAgentFlows(agentId, projectId); // Use getAgentFlows with agent ID
      setFlows(flowsList);
      
      // Auto-select "Default Start Flow" if it exists and no preference is set
      if (!selectedFlowId) {
        const defaultFlow = flowsList.find(flow => 
          flow.display_name.toLowerCase().includes('default') || 
          flow.display_name.toLowerCase().includes('start')
        );
        if (defaultFlow) {
          const flowId = defaultFlow.name.split('/').pop() || '';
          setSelectedFlowId(flowId);
        }
      }
    } catch (err) {
      setError('Failed to load flows');
      console.error('Error loading flows:', err);
    } finally {
      setFlowsLoading(false);
    }
  };

  const loadPages = async (agentId: string, flowId: string, projectId?: string) => {
    try {
      setPagesLoading(true);
      const pagesList = await apiService.getFlowPages(agentId, flowId, projectId);

      setPages(pagesList);
      
      // Try to restore page preference from stored preferences (like Start Resource restoration)
      const hasSavedPagePreference = loadedPreferences.page_id !== undefined && loadedPreferences.page_id !== null && loadedPreferences.page_id !== '';
      
      if (hasSavedPagePreference) {
        const matchingPage = pagesList.find(page => 
          page.name.split('/').pop() === loadedPreferences.page_id
        );
        if (matchingPage) {
          const pageId = matchingPage.name.split('/').pop() || '';

          setSelectedPageId(pageId);
        } else {

          // Fall back to auto-selection
          const startPage = pagesList.find(page => 
            page.display_name.toLowerCase().includes('start') ||
            page.display_name.toLowerCase().includes('default')
          );
          if (startPage) {
            const pageId = startPage.name.split('/').pop() || '';

            setSelectedPageId(pageId);
          }
        }
      } else {
        // No saved preference - auto-select "Start Page" if it exists
        const startPage = pagesList.find(page => 
          page.display_name.toLowerCase().includes('start') ||
          page.display_name.toLowerCase().includes('default')
        );
        if (startPage) {
          const pageId = startPage.name.split('/').pop() || '';

          setSelectedPageId(pageId);
        }
      }
    } catch (err) {
      setError('Failed to load pages');
      console.error('Error loading pages:', err);
    } finally {
      setPagesLoading(false);
    }
  };

  const handleQuickTest = async () => {
    if (!selectedProjectId || !selectedAgentName || !prompt.trim()) {
      setError('Please select a project, agent, and enter a prompt');
      return;
    }

    // Additional validation based on start resource type
    if (selectedStartResourceType === 'playbook' && !selectedPlaybookId) {
      setError('Please select a playbook');
      return;
    }
    
    if (selectedStartResourceType === 'playbook' && !selectedModelId) {
      setError('Please select an LLM model for playbook testing');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const agentProjectId = extractProjectId(selectedAgentName);
      
      // Build request based on start resource type
      const requestData: any = {
        prompt: prompt.trim(),
        agent_id: extractAgentId(selectedAgentName),
        session_id: sessionId || undefined,
        session_parameters: sessionParameters,
        enable_webhook: enableWebhook,
        pre_prompt_messages: prePromptMessages.length > 0 ? prePromptMessages : undefined,
        post_prompt_messages: postPromptMessages.length > 0 ? postPromptMessages : undefined,
      };

      if (selectedStartResourceType === 'flow') {
        // Flow-based testing
        requestData.flow_id = selectedFlowId || undefined;
        requestData.page_id = selectedPageId || undefined;

      } else if (selectedStartResourceType === 'playbook') {
        // Playbook-based testing
        requestData.playbook_id = selectedPlaybookId;
        requestData.llm_model_id = selectedModelId;
      }
      
      const result = await apiService.quickTest(requestData, agentProjectId);
      

      setResponse(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to test prompt');
      console.error('Error testing prompt:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPrompt('');
    setResponse(null);
    setError('');
    setSessionId('');
  };

  const extractAgentId = (agentName: string): string => {
    return agentName.split('/').pop() || '';
  };

  const extractFlowId = (flowName: string): string => {
    return flowName.split('/').pop() || '';
  };

  const extractPageId = (pageName: string): string => {
    return pageName.split('/').pop() || '';
  };

  const loadAvailableModels = async () => {
    try {
      setModelsLoading(true);
      const response = await apiService.getAvailableModels();
      if (response.models && response.models.length > 0) {
        setAvailableModels(response.models);
      }
    } catch (err) {
      // Silently fail - models will remain empty
    } finally {
      setModelsLoading(false);
    }
  };

  const handleRefreshModels = async () => {
    try {
      setModelsLoading(true);
      const response = await apiService.refreshModels();
      if (response.models && response.models.length > 0) {
        setAvailableModels(response.models);
      }
    } catch (err) {
      // Silently fail - models will remain as they were
    } finally {
      setModelsLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Quick Test Dialogflow Agent
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Test prompts against your Dialogflow CX agent with optional flow and page selection.
      </Typography>

      {/* User-Specific Authentication Notice */}
      {agents.length > 0 && agents[0]?.display_name?.includes('Please authenticate') && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                color="inherit" 
                size="small"
                variant="outlined"
                onClick={() => window.open('http://localhost:8000/api/v1/auth/google', '_blank')}
              >
                Upgrade Permissions
              </Button>
              <Button 
                color="inherit" 
                size="small"
                variant="text"
                onClick={() => loadAgents(selectedProjectId)}
                disabled={agentsLoading}
              >
                {agentsLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Box>
          }
        >
          <Typography variant="subtitle2" gutterBottom>
            Permission Upgrade Required
          </Typography>
          <Typography variant="body2">
            <strong>One-time setup:</strong> Your account needs expanded Google Cloud permissions to access Dialogflow agents. 
            After clicking "Upgrade Permissions" and completing OAuth, click "Refresh" to reload your agents.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            After this upgrade, you'll see your real Dialogflow agents based on your individual Google Cloud IAM permissions.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Configuration Panel */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Agent Configuration
            </Typography>
            
            {/* Project Selection */}
            <Autocomplete
              fullWidth
              options={[...projects].sort((a, b) => a.name.localeCompare(b.name))}
              getOptionLabel={(option) => `${option.name} (${option.project_id})`}
              value={projects.find(p => p.project_id === selectedProjectId) || null}
              onChange={(event, newValue) => {
                const newProjectId = newValue?.project_id || '';
                setSelectedProjectId(newProjectId);
                if (newProjectId) {
                  savePreference('project_id', newProjectId);
                }
              }}
              disabled={projectsLoading}
              loading={projectsLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Google Cloud Project"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {projectsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ mb: 2 }}
            />
            
            {/* Agent Selection */}
            <Autocomplete
              fullWidth
              options={[...agents].sort((a, b) => {
                // Sort accessible agents first, then inaccessible
                if (a.accessible !== b.accessible) {
                  return a.accessible ? -1 : 1;
                }
                return a.display_name.localeCompare(b.display_name);
              })}
              getOptionLabel={(option) => option.accessible ? option.display_name : `${option.display_name} (No Access)`}
              groupBy={(option) => option.accessible ? 'Available Agents' : 'Unavailable Agents (View Only)'}
              value={agents.find(a => a.name === selectedAgentName) || null}
              onChange={(event, newValue) => {
                const newAgentName = newValue ? newValue.name : '';
                setSelectedAgentName(newAgentName);
                if (newAgentName) {
                  savePreference('agent_id', extractAgentId(newAgentName)); // Still save the ID for consistency
                }
              }}
              disabled={agentsLoading}
              loading={agentsLoading}
              renderInput={(params) => {
                const selectedAgent = agents.find(a => a.name === selectedAgentName);
                const isInaccessible = selectedAgent && !selectedAgent.accessible;
                
                return (
                  <TextField
                    {...params}
                    label="Agent"
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
                                  loadAgents(selectedProjectId);
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
              sx={{ mb: 2 }}
            />

            {/* Start Resource Selection (Flows + Playbooks) */}
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
                    apiService.updateQuickTestPreferences({ 
                      flow_id: newValue.id, 
                      playbook_id: '' 
                    });
                  } else {
                    apiService.updateQuickTestPreferences({ 
                      playbook_id: newValue.id, 
                      flow_id: '' 
                    });
                  }
                } else {
                  // Default flow selected
                  setSelectedStartResourceId('');
                  setSelectedStartResourceType('flow');
                  apiService.updateQuickTestPreferences({ 
                    flow_id: '', 
                    playbook_id: '' 
                  });
                }
              }}
              disabled={!selectedAgentName || startResourcesLoading}
              loading={startResourcesLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Start Resource"
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

            {/* Conditional Selection: Pages for Flows, Models for Playbooks */}
            {selectedStartResourceType === 'flow' && (
              /* Page Selection - Only shown when a flow is selected */
              <Autocomplete
                fullWidth
                options={[{ display_name: 'Default Start Page', name: '' }, ...[...pages].sort((a, b) => a.display_name.localeCompare(b.display_name))]}
                getOptionLabel={(option) => option.display_name || 'Default Start Page'}
                value={selectedPageId ? pages.find(p => extractPageId(p.name) === selectedPageId) || null : { display_name: 'Default Start Page', name: '' }}
                onChange={(event, newValue) => {
                  const newPageId = newValue && newValue.name ? extractPageId(newValue.name) : '';
                  setSelectedPageId(newPageId);
                  if (newPageId) {
                    savePreference('page_id', newPageId);
                  }
                }}
                disabled={!selectedFlowId || pagesLoading}
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
                sx={{ mb: 2 }}
              />
            )}

            {selectedStartResourceType === 'playbook' && (
              /* Model Selection - Only shown when a playbook is selected */
              <Autocomplete
                fullWidth
                options={availableModels}
                getOptionLabel={(option) => option.name}
                value={availableModels.find(m => m.id === selectedModelId) || null}
                onChange={(event, newValue) => {
                  const newModelId = newValue?.id || '';
                  setSelectedModelId(newModelId);
                  if (newModelId) {
                    savePreference('llm_model_id', newModelId);
                  }
                }}
                disabled={!selectedPlaybookId}
                loading={modelsLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Playbook LLM Model"
                    helperText={availableModels.length > 0 
                      ? `Select from ${availableModels.length} available models`
                      : "Select the language model to test the playbook against"
                    }
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
                                handleRefreshModels();
                              }}
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
                sx={{ mb: 2 }}
              />
            )}

            {/* Session ID */}
            <TextField
              fullWidth
              label="Session ID (Optional)"
              value={sessionId}
              onChange={(e) => {
                const newSessionId = e.target.value;
                setSessionId(newSessionId);
                // Save session ID preference (save both empty and non-empty values)
                savePreference('session_id', newSessionId);
              }}
              placeholder="Auto-generated if empty"
              sx={{ mb: 2 }}
              helperText="Leave empty to auto-generate a unique session ID"
            />

            {/* Session Parameters */}
            <SessionParametersEditor
              sessionParameters={sessionParameters}
              onChange={(parameters) => {
                setSessionParameters(parameters);
                saveSessionParameters(parameters);
              }}
              label="Session Parameters"
              helperText="Configure session parameters to pass to Dialogflow agent"
            />

            {/* Webhook Settings */}
            <FormControlLabel
              control={
                <Switch
                  checked={enableWebhook}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const newValue = e.target.checked;
                    setEnableWebhook(newValue);
                    saveWebhookPreference(newValue);
                  }}
                  color="primary"
                />
              }
              label="Enable Webhooks"
              sx={{ mt: 2 }}
            />
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
              When enabled, Dialogflow will call configured webhooks during conversation processing
            </Typography>

            {/* Pre-Prompt Messages */}
            <Accordion sx={{ mt: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">
                  Pre-Prompt Messages ({prePromptMessages.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Messages to send before the main prompt to initialize context (optional)
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Enter a message to send before the main prompt..."
                    value={prePromptInput}
                    onChange={(e) => setPrePromptInput(e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
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
                  <Box>
                    {prePromptMessages.map((message, index) => (
                      <Chip
                        key={index}
                        label={`${index + 1}. ${message.length > 40 ? message.substring(0, 40) + '...' : message}`}
                        onDelete={() => {
                          const newMessages = [...prePromptMessages];
                          newMessages.splice(index, 1);
                          setPrePromptMessages(newMessages);
                          savePromptMessages(newMessages, postPromptMessages);
                        }}
                        sx={{ m: 0.5 }}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Post-Prompt Messages */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">
                  Post-Prompt Messages ({postPromptMessages.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Messages to send after the main prompt for cleanup or confirmation (optional)
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Enter a message to send after the main prompt..."
                    value={postPromptInput}
                    onChange={(e) => setPostPromptInput(e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
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
                  <Box>
                    {postPromptMessages.map((message, index) => (
                      <Chip
                        key={index}
                        label={`${index + 1}. ${message.length > 40 ? message.substring(0, 40) + '...' : message}`}
                        onDelete={() => {
                          const newMessages = [...postPromptMessages];
                          newMessages.splice(index, 1);
                          setPostPromptMessages(newMessages);
                          savePromptMessages(prePromptMessages, newMessages);
                        }}
                        sx={{ m: 0.5 }}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </Paper>
        </Grid>

        {/* Test Panel */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Test Prompt
            </Typography>

            {/* Prompt Input */}
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Enter your prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type your question or prompt here..."
              sx={{ mb: 2 }}
            />

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                onClick={handleQuickTest}
                disabled={
                  loading || 
                  !selectedProjectId || 
                  !selectedAgentName || 
                  !prompt.trim() ||
                  // Disable if selected agent is not accessible
                  !agents.find(a => a.name === selectedAgentName)?.accessible
                }
                startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              >
                {loading ? 'Testing...' : 'Send Test'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleClear}
                disabled={loading}
              >
                Clear
              </Button>
            </Box>

            {/* Error Display */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* Response Display */}
            {response && (
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Agent Response
                  </Typography>
                  
                  {/* Main Response */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Response:
                    </Typography>
                    {response.response_messages && response.response_messages.length > 0 ? (
                      <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                        {response.response_messages.map((message, index) => (
                          <Typography 
                            key={index} 
                            component="li" 
                            variant="body1" 
                            sx={{ fontStyle: 'italic', mb: 1 }}
                          >
                            "{message}"
                          </Typography>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                        "{response.response}"
                      </Typography>
                    )}
                  </Box>

                  {/* Response Metadata */}
                  <Divider sx={{ my: 2 }} />
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block">
                        Response Time: {response.response_time_ms}ms
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block">
                        Session: {response.session_id}
                      </Typography>
                    </Grid>
                  </Grid>

                  {/* Intent and Confidence */}
                  {response.intent && (
                    <Box sx={{ mt: 2 }}>
                      <Chip 
                        label={`Intent: ${response.intent}`} 
                        color="primary" 
                        size="small" 
                        sx={{ mr: 1 }} 
                      />
                      {response.confidence && (
                        <Chip 
                          label={`Confidence: ${(response.confidence * 100).toFixed(1)}%`} 
                          color="secondary" 
                          size="small" 
                        />
                      )}
                    </Box>
                  )}



                  {/* Parameters */}
                  {response.parameters && Object.keys(response.parameters).length > 0 && (
                    <Accordion sx={{ mt: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2">
                          Parameters ({Object.keys(response.parameters).length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                          {JSON.stringify(response.parameters, null, 2)}
                        </pre>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Webhook Details - Only show if webhook was actually called */}
                  {response.webhook_info?.called && (
                    <Accordion sx={{ mt: 2, '&.Mui-expanded': { mt: 2 } }} TransitionProps={{ unmountOnExit: true }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ flexShrink: 0, mr: 2 }}>Webhook Details</Typography>
                        <Chip
                          label={`Status: ${response.webhook_info.status || 'Unknown'}`}
                          color={response.webhook_info.status?.startsWith('OK') ? 'success' : 'error'}
                          size="small"
                        />
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box>
                          {response.webhook_info.url && (
                            <Typography variant="body2" sx={{ mb: 2 }}>
                              <strong>URL:</strong> {response.webhook_info.url}
                            </Typography>
                          )}

                          {response.webhook_info.request_payload && (
                            <Accordion TransitionProps={{ unmountOnExit: true }}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Request Payload</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Paper component="pre" variant="outlined" sx={{ p: 1.5, backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#222' : '#f5f5f5', overflowX: 'auto', maxHeight: '400px' }}>
                                  <code>{JSON.stringify(response.webhook_info.request_payload, null, 2)}</code>
                                </Paper>
                              </AccordionDetails>
                            </Accordion>
                          )}

                          {response.webhook_info.response_payload && (
                            <Accordion sx={{ mt: 1 }} TransitionProps={{ unmountOnExit: true }}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Response Payload</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <Paper component="pre" variant="outlined" sx={{ p: 1.5, backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#222' : '#f5f5f5', overflowX: 'auto', maxHeight: '400px' }}>
                                  <code>{JSON.stringify(response.webhook_info.response_payload, null, 2)}</code>
                                </Paper>
                              </AccordionDetails>
                            </Accordion>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Raw Response for backward compatibility */}
                  {response.dialogflow_response && (
                    <Accordion sx={{ mt: 2, '&.Mui-expanded': { mt: 2 } }} TransitionProps={{ unmountOnExit: true }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Raw Response</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Paper component="pre" variant="outlined" sx={{ p: 1.5, backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#222' : '#f5f5f5', overflowX: 'auto', maxHeight: '600px' }}>
                          <code>{JSON.stringify(response.dialogflow_response, null, 2)}</code>
                        </Paper>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QuickTestPage;