import React, { useState, useEffect, useRef } from 'react';
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  CircularProgress,
  LinearProgress,
  Tooltip,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Checkbox,
  FormControlLabel,
  Stack,
  Switch
} from '@mui/material';
import {
  Visibility as ViewIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  GetApp as GetAppIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchTestRuns, deleteTestRun, deleteMultipleTestRuns, cancelTestRun, fetchRunningTestRunsStatus } from '../store/testRunsSlice';
import { TestRun } from '../types';
import { apiService } from '../services/api';

const TestRunsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { testRuns, loading, error } = useAppSelector((state) => state.testRuns);

  // Helper function to get clean agent name for display
  const getCleanAgentName = (testRun: TestRun) => {
    // If we have a display name, use it
    if (testRun.agent_display_name) {
      return testRun.agent_display_name;
    }
    
    // If agent_name contains a path, extract just the agent ID part
    if (testRun.agent_name && testRun.agent_name.includes('/agents/')) {
      const parts = testRun.agent_name.split('/agents/');
      if (parts.length > 1) {
        return parts[1]; // Return just the agent ID
      }
    }
    
    // Fallback to full agent name
    return testRun.agent_name;
  };

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testRunToDelete, setTestRunToDelete] = useState<TestRun | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Bulk selection state
  const [selectedTestRuns, setSelectedTestRuns] = useState<number[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Use ref to get current testRuns in interval callback
  const testRunsRef = useRef(testRuns);
  testRunsRef.current = testRuns;

  useEffect(() => {
    dispatch(fetchTestRuns());
  }, [dispatch]);

  // Auto-refresh for running test runs
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      // Find test runs that are still running or pending
      const currentTestRuns = testRunsRef.current;
      const runningTestRuns = currentTestRuns.filter(tr => 
        tr.status === 'running' || tr.status === 'pending'
      );
      
      if (runningTestRuns.length > 0) {
        const runningIds = runningTestRuns.map(tr => tr.id);
        dispatch(fetchRunningTestRunsStatus(runningIds));
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [dispatch, autoRefreshEnabled]); // Remove testRuns from dependencies

  const handleDeleteClick = (testRun: TestRun) => {
    setTestRunToDelete(testRun);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!testRunToDelete) return;
    
    try {
      setDeleting(true);
      await dispatch(deleteTestRun(testRunToDelete.id));
      setDeleteDialogOpen(false);
      setTestRunToDelete(null);
    } catch (error) {
      console.error('Error deleting test run:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedTestRuns(testRuns.map(tr => tr.id));
    } else {
      setSelectedTestRuns([]);
    }
  };

  const handleSelectTestRun = (testRunId: number) => {
    setSelectedTestRuns(prev => {
      if (prev.includes(testRunId)) {
        return prev.filter(id => id !== testRunId);
      } else {
        return [...prev, testRunId];
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedTestRuns.length === 0) return;
    
    try {
      setDeleting(true);
      await dispatch(deleteMultipleTestRuns(selectedTestRuns));
      setBulkDeleteDialogOpen(false);
      setSelectedTestRuns([]);
    } catch (error) {
      console.error('Error deleting test runs:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleStopTestRun = async (testRun: TestRun) => {
    try {
      await dispatch(cancelTestRun(testRun.id));
      // Refresh the test runs to get updated status
      dispatch(fetchTestRuns());
    } catch (error) {
      console.error('Error stopping test run:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CircularProgress size={16} />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDatasetNames = (testRun: TestRun) => {
    if (testRun.datasets && testRun.datasets.length > 0) {
      return testRun.datasets.map(d => d.name).join(', ');
    }
    return 'N/A';
  };

  const getProgress = (testRun: TestRun) => {
    if (testRun.total_questions > 0) {
      return (testRun.completed_questions / testRun.total_questions) * 100;
    }
    return 0;
  };

  // CSV Export function for individual test run
  const exportTestRunToCSV = async (testRun: TestRun) => {
    try {
      await apiService.exportTestRunToCSV(testRun.id);
    } catch (error) {
      console.error('Error exporting test run to CSV:', error);
      alert('Failed to export test run. Please try again.');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Test Runs
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                size="small"
              />
            }
            label="Auto-refresh"
            sx={{ mr: 1 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/test-runs/create')}
          >
            Create Test Run
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Bulk Actions */}
      {selectedTestRuns.length > 0 && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
          <Typography variant="body2" color="primary.contrastText">
            {selectedTestRuns.length} test run{selectedTestRuns.length !== 1 ? 's' : ''} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            Delete Selected
          </Button>
        </Stack>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedTestRuns.length > 0 && selectedTestRuns.length < testRuns.length}
                  checked={testRuns.length > 0 && selectedTestRuns.length === testRuns.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Datasets</TableCell>
              <TableCell>Agent Configuration</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {testRuns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No test runs found. Create your first test run to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              testRuns.map((testRun) => (
                <TableRow key={testRun.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedTestRuns.includes(testRun.id)}
                      onChange={() => handleSelectTestRun(testRun.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">{testRun.name}</Typography>
                      {testRun.description && (
                        <Typography variant="caption" color="text.secondary">
                          {testRun.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(testRun.status)}
                      <Chip
                        label={testRun.status}
                        color={getStatusColor(testRun.status) as any}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={getDatasetNames(testRun)}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {testRun.datasets?.length || 0} dataset{testRun.datasets?.length !== 1 ? 's' : ''}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getCleanAgentName(testRun)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ minWidth: 100 }}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption">
                          {testRun.completed_questions}/{testRun.total_questions}
                        </Typography>
                        <Typography variant="caption">
                          {Math.round(getProgress(testRun))}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={getProgress(testRun)}
                        sx={{ height: 4 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {testRun.average_score !== null ? (
                      <Typography variant="body2">
                        {testRun.average_score}%
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {testRun.created_by_name || 'Unknown'}
                      </Typography>
                      {testRun.created_by_email && (
                        <Typography variant="caption" color="text.secondary">
                          ({testRun.created_by_email})
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDate(testRun.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/test-runs/${testRun.id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {testRun.status.toLowerCase() === 'completed' && (
                        <Tooltip title="Export Results to CSV">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => exportTestRunToCSV(testRun)}
                          >
                            <GetAppIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {testRun.status === 'running' && (
                        <Tooltip title="Stop Test">
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => handleStopTestRun(testRun)}
                          >
                            <StopIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {testRun.status === 'pending' && (
                        <Tooltip title="Start Test">
                          <IconButton size="small" color="primary">
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Delete Test Run">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(testRun)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Test Run?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete "{testRunToDelete?.name}"? This action cannot be undone. 
            All test results and data associated with this test run will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained" 
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        aria-labelledby="bulk-delete-dialog-title"
        aria-describedby="bulk-delete-dialog-description"
      >
        <DialogTitle id="bulk-delete-dialog-title">
          Delete {selectedTestRuns.length} Test Run{selectedTestRuns.length !== 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="bulk-delete-dialog-description">
            Are you sure you want to delete {selectedTestRuns.length} test run{selectedTestRuns.length !== 1 ? 's' : ''}? 
            This action cannot be undone. All test results and data associated with these test runs will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleBulkDelete} 
            color="error" 
            variant="contained" 
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : `Delete ${selectedTestRuns.length} Test Run${selectedTestRuns.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TestRunsPage;
