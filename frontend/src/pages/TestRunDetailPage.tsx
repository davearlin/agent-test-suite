import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  Chip, 
  CircularProgress, 
  Alert,
  Grid,
  LinearProgress,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Divider,
  Link,
  Tooltip,
  Button,
  TextField,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Menu,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import GetAppIcon from '@mui/icons-material/GetApp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchTestRuns, updateTestRunProgress, deleteTestRun, cancelTestRun } from '../store/testRunsSlice';
import { apiService } from '../services/api';
import { TestRun, TestResult } from '../types';
import ParameterScoreBreakdown from '../components/ParameterScoreBreakdown';
import { 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  TableSortLabel,
  TablePagination
} from '@mui/material';

// Generic component for expandable text
const ExpandableText: React.FC<{ 
  text: string; 
  maxLength?: number; 
  maxWidth?: number;
  variant?: 'body2' | 'body1';
}> = ({ text, maxLength = 100, maxWidth = 250, variant = 'body2' }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!text || text === 'N/A') {
    return <Typography variant={variant} color="text.secondary">N/A</Typography>;
  }
  
  const isLong = text.length > maxLength;
  const displayText = expanded || !isLong ? text : `${text.substring(0, maxLength)}...`;
  
  if (!isLong) {
    return <Typography variant={variant}>{text}</Typography>;
  }
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, maxWidth }}>
      <Typography variant={variant} sx={{ flex: 1, lineHeight: 1.4 }}>
        {displayText}
      </Typography>
      <Tooltip title={expanded ? "Show less" : "Show more"}>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ 
            p: 0.5, 
            minWidth: 'auto',
            color: 'primary.main',
            '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' }
          }}
        >
          <ExpandMoreIcon 
            sx={{ 
              fontSize: 16,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease-in-out'
            }} 
          />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// Component for expandable reasoning text (kept for backward compatibility)
const ExpandableReasoning: React.FC<{ reasoning: string }> = ({ reasoning }) => {
  return <ExpandableText text={reasoning} maxLength={100} maxWidth={300} />;
};

const TestRunDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { testRuns, loading, error } = useAppSelector((state) => state.testRuns);
  
  // Helper function to get flow display name from technical name
  const getFlowDisplayName = (flowName: string): string => {
    if (!flowName || flowName === 'Default Start Flow') return 'Default Start Flow';
    
    // Extract the last part after the final slash
    const parts = flowName.split('/');
    const lastPart = parts[parts.length - 1];
    
    // If it's a GUID, it's likely the default flow
    if (lastPart && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastPart)) {
      return 'Default Start Flow';
    }
    
    // Convert technical names to human-readable format
    if (lastPart) {
      return lastPart
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    
    return flowName;
  };

  // Helper function to get playbook display name from ID
  const getPlaybookDisplayName = (playbookId: string): string => {
    // This is a fallback - the backend should provide the real display name
    if (!playbookId) return 'Unknown Playbook';
    
    // Extract the last part after the final slash
    const parts = playbookId.split('/');
    const lastPart = parts[parts.length - 1];
    
    // If it's a GUID, show a user-friendly fallback
    if (lastPart && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastPart)) {
      return 'Routing Playbook'; // Hardcode known playbook for now
    }
    
    // If it's not a pure GUID, try to extract meaningful parts
    if (lastPart && lastPart.length > 10) {
      const nameMatch = lastPart.match(/^([a-zA-Z][a-zA-Z0-9\-_]*)/);
      if (nameMatch) {
        return nameMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    
    return lastPart || playbookId;
  };
  
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderBy, setOrderBy] = useState<keyof TestResult>('id');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // State for search/filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for auto-refresh control
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  // State to track current result count for incremental updates
  const [lastResultCount, setLastResultCount] = useState(0);
  
  // State for column visibility
  const [columnVisibility, setColumnVisibility] = useState({
    question: true,
    expectedAnswer: true,
    actualAnswer: true,
    score: true,
    reasoning: true,
    webhookInfo: false, // Hidden by default since not all tests use webhooks
    messageSequence: false, // Hidden by default since not all tests use pre/post prompts
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

  // Get the test run from Redux state
  const testRun = testRuns.find(run => run.id === parseInt(id || '0')) || null;

  const loadTestResults = async () => {
    if (!id) return;
    
    try {
      setLoadingResults(true);
      // Use apiService for consistent API calls
      const resultsData = await apiService.getTestResults(parseInt(id));
      setTestResults(resultsData);
      setLastResultCount(resultsData.length); // Track current result count
    } catch (error) {
      console.error('❌ loadTestResults: Error loading test results:', error);
      // Don't set error for results, as they might not exist yet
    } finally {
      setLoadingResults(false);
    }
  };

  const loadNewTestResults = async () => {
    if (!id) return;
    
    try {
      // Fetch only new results using skip parameter
      const newResultsData = await apiService.getTestResults(parseInt(id), {
        skip: lastResultCount,
        limit: 100 // Get up to 100 new results
      });
      
      if (newResultsData.length > 0) {
        // Append new results to existing ones
        setTestResults(prevResults => [...prevResults, ...newResultsData]);
        setLastResultCount(prevCount => prevCount + newResultsData.length);
      }
    } catch (error) {
      console.error('❌ loadNewTestResults: Error loading new test results:', error);
    }
  };

  const refreshTestRunStatus = async () => {
    if (!id) return;
    
    try {
      // Use the same base URL logic as the API service
      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const url = `${baseURL}/api/v1/tests/${id}`;
      
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const testRunData = await response.json();
      
      // Update the test run in the list using the updateTestRunProgress action
      dispatch(updateTestRunProgress({
        id: parseInt(id),
        progress: testRunData
      }));
    } catch (error) {
      console.error('❌ refreshTestRunStatus: Error refreshing test run status:', error);
    }
  };

  useEffect(() => {
    // ✅ REQUIRED PATTERN: Always load via fetchTestRuns() to avoid axios baseURL issues
    if (testRuns.length === 0) {
      dispatch(fetchTestRuns());
    }
    
    // Always try to load test results
    loadTestResults();
  }, [id, dispatch, testRuns.length]);

  // Auto-refresh for running tests - incremental updates to preserve scroll position
  useEffect(() => {
    if (autoRefreshEnabled && (testRun?.status === 'running' || testRun?.status === 'pending')) {
      const interval = setInterval(() => {
        // Use incremental update for test results to preserve scroll position and table state
        loadNewTestResults();
        // Still refresh test run status for progress bar updates
        refreshTestRunStatus();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [testRun?.status, autoRefreshEnabled, lastResultCount]);

  const handleDeleteTestRun = async () => {
    if (!id || !testRun) return;
    
    try {
      setDeleting(true);
      await dispatch(deleteTestRun(parseInt(id)));
      navigate('/test-runs'); // Navigate back after successful deletion
    } catch (error) {
      console.error('Error deleting test run:', error);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleStopTestRun = async () => {
    if (!id || !testRun) return;
    
    try {
      await dispatch(cancelTestRun(testRun.id));
      // Refresh the test run data to get updated status
      dispatch(fetchTestRuns());
    } catch (error) {
      console.error('Error stopping test run:', error);
    }
  };

  const handleSort = (property: keyof TestResult) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when searching
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(0);
  };

  // Column visibility handlers
  const handleColumnMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setColumnMenuAnchor(event.currentTarget);
  };

  const handleColumnMenuClose = () => {
    setColumnMenuAnchor(null);
  };

  const handleColumnToggle = (column: keyof typeof columnVisibility) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // CSV Export function for this test run's results
  const exportTestRunToCSV = async () => {
    try {
      if (!testRun) {
        alert('Test run data not available.');
        return;
      }

      await apiService.exportTestRunToCSV(testRun.id);
    } catch (error) {
      console.error('Error exporting test run to CSV:', error);
      alert('Failed to export test run. Please try again.');
    }
  };

  const filteredResults = React.useMemo(() => {
    if (!searchTerm.trim()) return testResults;
    
    const searchLower = searchTerm.toLowerCase();
    return testResults.filter(result => 
      result.question.question_text.toLowerCase().includes(searchLower) ||
      result.question.expected_answer.toLowerCase().includes(searchLower) ||
      (result.actual_answer && result.actual_answer.toLowerCase().includes(searchLower)) ||
      (result.dialogflow_response?.response_text && 
       result.dialogflow_response.response_text.toLowerCase().includes(searchLower)) ||
      (result.dialogflow_response?.fulfillment_text && 
       result.dialogflow_response.fulfillment_text.toLowerCase().includes(searchLower)) ||
      (result.evaluation_reasoning && 
       result.evaluation_reasoning.toLowerCase().includes(searchLower)) ||
      (result.error_message && 
       result.error_message.toLowerCase().includes(searchLower))
    );
  }, [testResults, searchTerm]);

  const sortedResults = React.useMemo(() => {
    return [...filteredResults].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      
      // Special handling for score sorting - compute from parameters when legacy scores unavailable
      if (orderBy === 'similarity_score') {
        // Helper function to compute score from parameter scores
        const computeScoreFromParameters = (result: any) => {
          if (!result.parameter_scores || result.parameter_scores.length === 0) return undefined;
          
          let totalWeightedScore = 0;
          let totalWeight = 0;
          
          result.parameter_scores.forEach((ps: any) => {
            if (ps.score != null && ps.weight_used != null) {
              totalWeightedScore += ps.score * ps.weight_used;
              totalWeight += ps.weight_used;
            }
          });
          
          return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : undefined;
        };
        
        // Priority: computed from parameters > overall_score > similarity_score
        aValue = computeScoreFromParameters(a) ?? a.overall_score ?? a.similarity_score;
        bValue = computeScoreFromParameters(b) ?? b.overall_score ?? b.similarity_score;
      }
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return order === 'asc' ? -1 : 1;
      if (bValue == null) return order === 'asc' ? 1 : -1;
      
      if (aValue < bValue) {
        return order === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredResults, order, orderBy]);

  const paginatedResults = sortedResults.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'primary';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const generateAgentUrlFromPath = (agentPath: string) => {
    // Parse the agent path: projects/{project}/locations/{location}/agents/{agent-id}
    const pathParts = agentPath.split('/');
    const projectIndex = pathParts.findIndex(part => part === 'projects');
    const locationIndex = pathParts.findIndex(part => part === 'locations');
    const agentIndex = pathParts.findIndex(part => part === 'agents');
    
    if (projectIndex !== -1 && locationIndex !== -1 && agentIndex !== -1 &&
        projectIndex + 1 < pathParts.length &&
        locationIndex + 1 < pathParts.length &&
        agentIndex + 1 < pathParts.length) {
      
      const projectId = pathParts[projectIndex + 1];
      let location = pathParts[locationIndex + 1];
      const agentId = pathParts[agentIndex + 1];
      
      // Fix: Change us-central1 to global, but keep other locations as-is
      if (location === 'us-central1') {
        location = 'global';
      }
      
      return `https://conversational-agents.cloud.google.com/projects/${projectId}/locations/${location}/agents/${agentId}/(graph//right-panel:simulator)`;
    }
    
    return null;
  };

  const generateAgentUrl = (projectId: string, agentId: string) => {
    // Use 'global' location as this is the correct location for agent URLs
    const location = 'global';
    return `https://conversational-agents.cloud.google.com/projects/${projectId}/locations/${location}/agents/${agentId}/(graph//right-panel:simulator)`;
  };

  const extractDisplayNameFromAgentName = (agentName: string) => {
    // If it's already a display name (no slashes), return as is
    if (!agentName.includes('/')) {
      return agentName;
    }
    
    // For legacy test runs with full paths, we'll still show the path as a link
    // but ideally new test runs will store the display name
    return agentName;
  };

  const getAgentDisplayName = (testRun: any) => {
    // Use agent_display_name if available (new test runs)
    // Otherwise fall back to agent_name for backward compatibility
    return testRun.agent_display_name || testRun.agent_name;
  };

  const getAgentUrl = (testRun: any) => {
    // First try using project_id and agent_id if available
    if (testRun.project_id && testRun.agent_id) {
      return generateAgentUrl(testRun.project_id, testRun.agent_id);
    }
    
    // Fallback: try parsing the agent_name if it's a full path
    if (testRun.agent_name && testRun.agent_name.includes('/')) {
      return generateAgentUrlFromPath(testRun.agent_name);
    }
    
    return null;
  };

  const calculateProgress = () => {
    if (!testRun) return 0;
    return testRun.total_questions > 0 ? (testRun.completed_questions / testRun.total_questions) * 100 : 0;
  };

  if (loading && !testRun) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!testRun) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Test run not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/test-runs')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }} gutterBottom>
          {testRun.name}
        </Typography>
        
        {/* Auto-refresh controls for running/pending tests */}
        {(testRun.status === 'running' || testRun.status === 'pending') && (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Chip
              icon={autoRefreshEnabled ? <AutorenewIcon /> : <PauseIcon />}
              label={autoRefreshEnabled ? 'Auto-refreshing' : 'Paused'}
              color={autoRefreshEnabled ? 'success' : 'default'}
              size="small"
              sx={{ mr: 1 }}
            />
            <Tooltip title={autoRefreshEnabled ? 'Pause auto-refresh' : 'Resume auto-refresh'}>
              <IconButton
                onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                size="small"
                color={autoRefreshEnabled ? 'success' : 'default'}
              >
                {autoRefreshEnabled ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
        
        {testRun.status === 'running' && (
          <Tooltip title="Stop Test Run">
            <IconButton 
              onClick={handleStopTestRun}
              sx={{ mr: 1 }}
              color="error"
            >
              <StopIcon />
            </IconButton>
          </Tooltip>
        )}
        <IconButton 
          onClick={exportTestRunToCSV}
          sx={{ mr: 1 }}
          title="Export test results to CSV"
        >
          <GetAppIcon />
        </IconButton>
        <IconButton onClick={() => { loadTestResults(); }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Status and Progress */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Status</Typography>
            <Chip 
              label={testRun.status.toUpperCase()} 
              color={getStatusColor(testRun.status) as any}
              size="small"
              sx={{ mt: 1 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Progress</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={calculateProgress()} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {testRun.completed_questions}/{testRun.total_questions}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Average Score</Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              {testRun.average_score !== null ? `${testRun.average_score}%` : 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" color="text.secondary">Created</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {formatDate(testRun.created_at)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Consolidated Configuration Accordion */}
      <Accordion sx={{ mb: 3 }} defaultExpanded={false}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="configuration-content"
          id="configuration-header"
        >
          <Typography variant="h6">Configuration</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {/* Left Column: Test Configuration and Timing */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Basic Configuration */}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Test Configuration
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>Agent</strong></TableCell>
                        <TableCell>
                          {getAgentUrl(testRun) ? (
                            <Link 
                              href={getAgentUrl(testRun)!} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              color="primary"
                            >
                              {getAgentDisplayName(testRun)}
                            </Link>
                          ) : (
                            getAgentDisplayName(testRun)
                          )}
                        </TableCell>
                      </TableRow>
                      {!testRun.playbook_id && (
                        <>
                          <TableRow>
                            <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>Flow</strong></TableCell>
                            <TableCell>{testRun.flow_display_name || getFlowDisplayName(testRun.flow_name || 'Default Start Flow')}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>Page</strong></TableCell>
                            <TableCell>{testRun.page_display_name || testRun.page_name || 'Default Start Page'}</TableCell>
                          </TableRow>
                        </>
                      )}
                      {testRun.playbook_id && (
                        <TableRow>
                          <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>Playbook</strong></TableCell>
                          <TableCell>{testRun.playbook_display_name || getPlaybookDisplayName(testRun.playbook_id)}</TableCell>
                        </TableRow>
                      )}
                      {testRun.llm_model_id && (
                        <TableRow>
                          <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>LLM Model</strong></TableCell>
                          <TableCell>{testRun.llm_model_id}</TableCell>
                        </TableRow>
                      )}
                      {testRun.evaluation_model_id && (
                        <TableRow>
                          <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>Evaluation Model</strong></TableCell>
                          <TableCell>{testRun.evaluation_model_id}</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>Batch Size</strong></TableCell>
                        <TableCell>{testRun.batch_size}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ width: '150px', whiteSpace: 'nowrap' }}><strong>Webhooks</strong></TableCell>
                        <TableCell>
                          <Chip 
                            label={testRun.enable_webhook !== false ? 'Enabled' : 'Disabled'} 
                            color={testRun.enable_webhook !== false ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>

                {/* Timing Information */}
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Timing
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ width: '150px' }}><strong>Created</strong></TableCell>
                        <TableCell>{formatDate(testRun.created_at)}</TableCell>
                      </TableRow>
                      {testRun.started_at && (
                        <TableRow>
                          <TableCell><strong>Started</strong></TableCell>
                          <TableCell>{formatDate(testRun.started_at)}</TableCell>
                        </TableRow>
                      )}
                      {testRun.completed_at && (
                        <TableRow>
                          <TableCell><strong>Completed</strong></TableCell>
                          <TableCell>{formatDate(testRun.completed_at)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            </Grid>

            {/* Right Column: Message Sequence and Session Parameters */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Message Sequence Configuration */}
                {((testRun.pre_prompt_messages && testRun.pre_prompt_messages.length > 0) || 
                  (testRun.post_prompt_messages && testRun.post_prompt_messages.length > 0)) && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                      Message Sequence
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {testRun.pre_prompt_messages && testRun.pre_prompt_messages.length > 0 && (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                            Pre-Prompt Messages ({testRun.pre_prompt_messages.length})
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.875rem' }}>
                            Messages sent before each main question:
                          </Typography>
                          <Box sx={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 1,
                            mt: 1
                          }}>
                            {testRun.pre_prompt_messages.map((message, index) => (
                              <Chip
                                key={index}
                                label={`${index + 1}. ${message.length > 50 ? message.substring(0, 50) + '...' : message}`}
                                variant="outlined"
                                size="small"
                                color="primary"
                                sx={{ 
                                  maxWidth: '100%',
                                  '& .MuiChip-label': {
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      {testRun.post_prompt_messages && testRun.post_prompt_messages.length > 0 && (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                            Post-Prompt Messages ({testRun.post_prompt_messages.length})
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.875rem' }}>
                            Messages sent after each main question:
                          </Typography>
                          <Box sx={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 1,
                            mt: 1
                          }}>
                            {testRun.post_prompt_messages.map((message, index) => (
                              <Chip
                                key={index}
                                label={`${index + 1}. ${message.length > 50 ? message.substring(0, 50) + '...' : message}`}
                                variant="outlined"
                                size="small"
                                color="secondary"
                                sx={{ 
                                  maxWidth: '100%',
                                  '& .MuiChip-label': {
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                {/* Session Parameters */}
                {testRun.session_parameters && Object.keys(testRun.session_parameters).length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                      Session Parameters ({Object.keys(testRun.session_parameters).length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
                      Key-value parameters passed to each test session:
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Parameter</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(testRun.session_parameters).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell sx={{ fontWeight: 'medium' }}>{key}</TableCell>
                            <TableCell>{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Description */}
      {testRun.description && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Description</Typography>
          <Typography variant="body1">{testRun.description}</Typography>
        </Paper>
      )}

      {/* Evaluation Parameters */}
      {testRun.evaluation_parameters && testRun.evaluation_parameters.length > 0 && (
        <Accordion sx={{ mb: 3 }} defaultExpanded={false}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="evaluation-parameters-content"
            id="evaluation-parameters-header"
          >
            <Typography variant="h6">Evaluation Parameters ({testRun.evaluation_parameters.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Evaluation metrics and their weights used for scoring:
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Parameter ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Weight (%)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {testRun.evaluation_parameters.map((param: any) => (
                  <TableRow key={param.parameter_id}>
                    <TableCell sx={{ fontWeight: 'medium' }}>{param.parameter_id}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={param.weight}
                          sx={{ 
                            flexGrow: 1, 
                            height: 8, 
                            borderRadius: 4,
                            backgroundColor: 'grey.300'
                          }}
                        />
                        <Typography variant="body2" sx={{ minWidth: '40px' }}>
                          {param.weight}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={param.enabled ? 'Enabled' : 'Disabled'}
                        color={param.enabled ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Test Results */}
      {!loadingResults && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Test Results</Typography>
          
          {testResults.length > 0 ? (
            <>
              {/* Search/Filter Box */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Search test results (questions, answers, reasoning, errors)..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleClearSearch}
                          edge="end"
                          size="small"
                          aria-label="clear search"
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'background.paper',
                    }
                  }}
                />
              </Box>

              {/* Column Visibility Controls */}
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Tooltip title="Toggle column visibility">
                  <IconButton
                    onClick={handleColumnMenuOpen}
                    size="small"
                  >
                    <ViewColumnIcon />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={columnMenuAnchor}
                  open={Boolean(columnMenuAnchor)}
                  onClose={handleColumnMenuClose}
                >
                  <MenuItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={columnVisibility.question}
                          onChange={() => handleColumnToggle('question')}
                          size="small"
                        />
                      }
                      label="Question"
                    />
                  </MenuItem>
                  <MenuItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={columnVisibility.expectedAnswer}
                          onChange={() => handleColumnToggle('expectedAnswer')}
                          size="small"
                        />
                      }
                      label="Expected Answer"
                    />
                  </MenuItem>
                  <MenuItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={columnVisibility.actualAnswer}
                          onChange={() => handleColumnToggle('actualAnswer')}
                          size="small"
                        />
                      }
                      label="Actual Answer"
                    />
                  </MenuItem>
                  <MenuItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={columnVisibility.score}
                          onChange={() => handleColumnToggle('score')}
                          size="small"
                        />
                      }
                      label="Score"
                    />
                  </MenuItem>
                  <MenuItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={columnVisibility.reasoning}
                          onChange={() => handleColumnToggle('reasoning')}
                          size="small"
                        />
                      }
                      label="Reasoning"
                    />
                  </MenuItem>
                  <MenuItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={columnVisibility.webhookInfo}
                          onChange={() => handleColumnToggle('webhookInfo')}
                          size="small"
                        />
                      }
                      label="Webhook Status"
                    />
                  </MenuItem>
                  <MenuItem>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={columnVisibility.messageSequence}
                          onChange={() => handleColumnToggle('messageSequence')}
                          size="small"
                        />
                      }
                      label="Message Sequence"
                    />
                  </MenuItem>
                </Menu>
              </Box>

              {sortedResults.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Results Match Your Search
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No test results found matching "{searchTerm}". Try a different search term or{' '}
                    <Button variant="text" size="small" onClick={handleClearSearch}>
                      clear the search
                    </Button>
                    .
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Summary Information */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, sortedResults.length)} of {sortedResults.length} results
                      {searchTerm && (
                        <> (filtered from {testResults.length} total)</>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sorted by {orderBy === 'question' ? 'Question' : 
                               orderBy === 'actual_answer' ? 'Actual Answer' :
                               orderBy === 'similarity_score' ? 'Score' : orderBy} ({order}ending)
                    </Typography>
                  </Box>

                  <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {columnVisibility.question && (
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <TableSortLabel
                        active={orderBy === 'question'}
                        direction={orderBy === 'question' ? order : 'asc'}
                        onClick={() => handleSort('question')}
                      >
                        Question
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {columnVisibility.expectedAnswer && (
                    <TableCell sx={{ verticalAlign: 'top' }}>Expected Answer</TableCell>
                  )}
                  {columnVisibility.actualAnswer && (
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <TableSortLabel
                        active={orderBy === 'actual_answer'}
                        direction={orderBy === 'actual_answer' ? order : 'asc'}
                        onClick={() => handleSort('actual_answer')}
                      >
                        Actual Answer
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {columnVisibility.score && (
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <TableSortLabel
                        active={orderBy === 'similarity_score'}
                        direction={orderBy === 'similarity_score' ? order : 'asc'}
                        onClick={() => handleSort('similarity_score')}
                      >
                        Score
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {columnVisibility.reasoning && (
                    <TableCell sx={{ verticalAlign: 'top' }}>Reasoning</TableCell>
                  )}
                  {columnVisibility.webhookInfo && (
                    <TableCell sx={{ verticalAlign: 'top' }}>Webhook Status</TableCell>
                  )}
                  {columnVisibility.messageSequence && (
                    <TableCell sx={{ verticalAlign: 'top' }}>Message Sequence</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedResults.map((result) => (
                  <TableRow key={result.id}>
                    {columnVisibility.question && (
                      <TableCell sx={{ maxWidth: 200, verticalAlign: 'top' }}>
                        <ExpandableText 
                          text={result.question.question_text} 
                          maxLength={80}
                          maxWidth={200}
                        />
                      </TableCell>
                    )}
                    {columnVisibility.expectedAnswer && (
                      <TableCell sx={{ maxWidth: 150, verticalAlign: 'top' }}>
                        <ExpandableText 
                          text={result.question.expected_answer} 
                          maxLength={60}
                          maxWidth={150}
                        />
                      </TableCell>
                    )}
                    {columnVisibility.actualAnswer && (
                      <TableCell sx={{ maxWidth: 150, verticalAlign: 'top' }}>
                        <ExpandableText 
                          text={result.actual_answer || 
                               result.dialogflow_response?.response_text || 
                               result.dialogflow_response?.fulfillment_text || 
                               (result.error_message ? `Error: ${result.error_message}` : 'No response')}
                          maxLength={60}
                          maxWidth={150}
                        />
                      </TableCell>
                    )}
                    {columnVisibility.score && (
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <ParameterScoreBreakdown
                          overallScore={result.overall_score}
                          similarityScore={result.similarity_score}
                          parameterScores={result.parameter_scores}
                          showExpandable={true}
                          size="small"
                        />
                      </TableCell>
                    )}
                    {columnVisibility.reasoning && (
                      <TableCell sx={{ maxWidth: 300, verticalAlign: 'top' }}>
                        <ExpandableReasoning reasoning={result.evaluation_reasoning || 'N/A'} />
                      </TableCell>
                    )}
                    {columnVisibility.webhookInfo && (
                      <TableCell sx={{ maxWidth: 120, verticalAlign: 'top' }}>
                        {(() => {
                          // Extract webhook information from dialogflow_response
                          const webhookInfo = result.dialogflow_response?.webhook_info;
                          if (webhookInfo) {
                            const isWebhookCalled = webhookInfo.webhook_called;
                            const hasError = webhookInfo.webhook_error || webhookInfo.webhook_status === 'error';
                            
                            return (
                              <Box>
                                <Chip
                                  label={isWebhookCalled ? (hasError ? 'Error' : 'Called') : 'Not Called'}
                                  color={
                                    isWebhookCalled 
                                      ? (hasError ? 'error' : 'success')
                                      : 'default'
                                  }
                                  size="small"
                                  sx={{ mb: 0.5 }}
                                />
                                {webhookInfo.webhook_error && (
                                  <Typography variant="caption" color="error" sx={{ display: 'block', fontSize: '0.7rem' }}>
                                    {webhookInfo.webhook_error}
                                  </Typography>
                                )}
                              </Box>
                            );
                          } else if (testRun.enable_webhook === false) {
                            return (
                              <Chip
                                label="Disabled"
                                color="default"
                                size="small"
                              />
                            );
                          } else {
                            return (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                N/A
                              </Typography>
                            );
                          }
                        })()}
                      </TableCell>
                    )}
                    {columnVisibility.messageSequence && (
                      <TableCell sx={{ maxWidth: 200, verticalAlign: 'top' }}>
                        {(() => {
                          // Extract message sequence from dialogflow_response
                          const messageSequence = result.dialogflow_response?.message_sequence;
                          const sequenceSummary = result.dialogflow_response?.sequence_summary;
                          
                          if (messageSequence && messageSequence.length > 0) {
                            return (
                              <Box>
                                <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                                  {sequenceSummary ? 
                                    `${sequenceSummary.total_messages} messages` : 
                                    `${messageSequence.length} messages`}
                                </Typography>
                                {sequenceSummary && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                    Pre: {sequenceSummary.pre_prompt_count}, Post: {sequenceSummary.post_prompt_count}
                                  </Typography>
                                )}
                                <Box sx={{ mt: 0.5 }}>
                                  {messageSequence.slice(0, 3).map((msg: any, idx: number) => (
                                    <Chip
                                      key={idx}
                                      label={`${msg.type === 'pre_prompt' ? 'Pre' : msg.type === 'post_prompt' ? 'Post' : 'Main'}`}
                                      size="small"
                                      variant="outlined"
                                      color={msg.type === 'main_question' ? 'primary' : 'default'}
                                      sx={{ mr: 0.25, mb: 0.25, fontSize: '0.6rem', height: '20px' }}
                                    />
                                  ))}
                                  {messageSequence.length > 3 && (
                                    <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                                      +{messageSequence.length - 3} more
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            );
                          } else if (testRun.pre_prompt_messages?.length || testRun.post_prompt_messages?.length) {
                            return (
                              <Typography variant="body2" color="warning.main" sx={{ fontSize: '0.8rem' }}>
                                Configured but not found
                              </Typography>
                            );
                          } else {
                            return (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                Not used
                              </Typography>
                            );
                          }
                        })()}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={sortedResults.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
                </>
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Test Results Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {testRun?.status === 'pending' && (
                  <>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    Test is pending execution. Results will appear here once the test starts running.
                  </>
                )}
                {testRun?.status === 'running' && (
                  <>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    Test is currently running. Results will appear here as they are completed.
                  </>
                )}
                {testRun?.status === 'completed' && (
                  'Test completed but no results were generated.'
                )}
                {testRun?.status === 'failed' && (
                  'Test failed to execute properly.'
                )}
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default TestRunDetailPage;
