import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ButtonGroup,
  Alert,
  Tooltip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Snackbar,
  Collapse,
  Fade,
  Popper,
  Grow,
  MenuItem,
  MenuList,
  ClickAwayListener,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add,
  Upload as UploadIcon,
  GetApp as ExportIcon,
  HelpOutline as HelpIcon,
  Close as CloseIcon,
  Psychology as PsychologyIcon,
  TuneRounded as TuneIcon,
  BarChart as ChartIcon,
  PlaylistAddCheck as ChecklistIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';
import { EvaluationParameter } from '../types';

const EvaluationManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [parameters, setParameters] = useState<EvaluationParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [parameterToDelete, setParameterToDelete] = useState<EvaluationParameter | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchParameters();
  }, []);

  const fetchParameters = async () => {
    try {
      setLoading(true);
      const response = await apiService.getEvaluationParameters(true); // Include inactive parameters for management
      // Ensure response is an array and filter out invalid entries
      const validParameters = Array.isArray(response) 
        ? response.filter(param => param && typeof param === 'object' && param.id)
        : [];
      setParameters(validParameters);
      setError(null);
    } catch (error) {
      console.error('Error fetching evaluation parameters:', error);
      setError('Failed to load evaluation parameters');
      setParameters([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParameter = () => {
    navigate('/evaluation-management/edit/new');
  };

  const handleEditParameter = (id: number) => {
    navigate(`/evaluation-management/edit/${id}`);
  };

  const handleDeleteParameter = async (parameter: EvaluationParameter) => {
    setParameterToDelete(parameter);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!parameterToDelete) return;

    try {
      await apiService.deleteEvaluationParameter(parameterToDelete.id);
      setParameters(parameters.filter(p => p.id !== parameterToDelete.id));
      setDeleteDialogOpen(false);
      setParameterToDelete(null);
    } catch (error) {
      console.error('Error deleting parameter:', error);
      setError('Failed to delete parameter');
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const requireAccessToken = () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }
    return token;
  };

  const handleExportParameters = async () => {
    try {
      const token = requireAccessToken();
      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${baseURL}/api/v1/evaluation/parameters/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to export evaluation parameters');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'evaluation_parameters.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSnackbar('Evaluation parameters exported successfully', 'success');
    } catch (error) {
      console.error('Failed to export evaluation parameters:', error);
      showSnackbar('Failed to export evaluation parameters', 'error');
    }
  };

  const handleExportSingleParameter = async (parameter: EvaluationParameter) => {
    try {
      const token = requireAccessToken();
      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${baseURL}/api/v1/evaluation/parameters/export/${parameter.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export evaluation parameter');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (parameter.name || 'parameter').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `evaluation_parameter_${safeName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar(`Exported "${parameter.name}" successfully`, 'success');
    } catch (error) {
      console.error('Failed to export evaluation parameter:', error);
      showSnackbar('Failed to export evaluation parameter', 'error');
    }
  };

  const handleImportParameters = async () => {
    if (!importFile) {
      showSnackbar('Please select a file to import', 'error');
      return;
    }

    try {
      const token = requireAccessToken();
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('replace_existing', replaceExisting.toString());

      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${baseURL}/api/v1/evaluation/parameters/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to import evaluation parameters');

      const result = await response.json();
      showSnackbar(result.message, 'success');
      fetchParameters();
      handleCloseImportDialog();
    } catch (error) {
      console.error('Failed to import evaluation parameters:', error);
      showSnackbar('Failed to import evaluation parameters', 'error');
    }
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setImportFile(null);
    setReplaceExisting(false);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading evaluation parameters...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" component="h1">
            Evaluation Management
          </Typography>
          <IconButton
            onClick={() => setShowHelp(!showHelp)}
            size="small"
            sx={{
              color: showHelp ? '#90caf9' : '#777',
              backgroundColor: showHelp ? 'rgba(25, 118, 210, 0.12)' : 'transparent',
              '&:hover': {
                color: '#90caf9',
                backgroundColor: 'rgba(25, 118, 210, 0.08)',
              },
              transition: 'all 0.2s',
            }}
          >
            <HelpIcon />
          </IconButton>
        </Box>
        <ButtonGroup variant="contained" ref={addMenuAnchorRef}>
          <Button
            startIcon={<Add />}
            onClick={handleCreateParameter}
          >
            Add Evaluator
          </Button>
          <Button
            size="small"
            onClick={() => setAddMenuOpen((prev) => !prev)}
            sx={{ px: 0.5 }}
          >
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>
        <Popper
          open={addMenuOpen}
          anchorEl={addMenuAnchorRef.current}
          transition
          disablePortal
          placement="bottom-end"
          sx={{ zIndex: 1300 }}
        >
          {({ TransitionProps }) => (
            <Grow {...TransitionProps}>
              <Paper sx={{ mt: 0.5, minWidth: 200, bgcolor: '#2a2a2a', border: '1px solid #444' }}>
                <ClickAwayListener onClickAway={() => setAddMenuOpen(false)}>
                  <MenuList dense>
                    <MenuItem onClick={() => { handleCreateParameter(); setAddMenuOpen(false); }}>
                      <Add sx={{ mr: 1, fontSize: '1.1rem', color: '#90caf9' }} /> Create New
                    </MenuItem>
                    <MenuItem onClick={() => { setImportDialogOpen(true); setAddMenuOpen(false); }}>
                      <UploadIcon sx={{ mr: 1, fontSize: '1.1rem', color: '#66bb6a' }} /> Import from CSV
                    </MenuItem>
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </Box>

      {/* In-Context Help Banner */}
      <Collapse in={showHelp}>
        <Fade in={showHelp} timeout={400}>
          <Paper
            elevation={0}
            sx={{
              mb: 3,
              overflow: 'hidden',
              border: '1px solid rgba(25, 118, 210, 0.25)',
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.06) 0%, rgba(102, 187, 106, 0.04) 100%)',
            }}
          >
            {/* Header */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 1.5,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              background: 'linear-gradient(90deg, rgba(25, 118, 210, 0.10) 0%, rgba(102, 187, 106, 0.06) 100%)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PsychologyIcon sx={{ color: '#90caf9', fontSize: '1.3rem' }} />
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#e3f2fd' }}>
                  What Are Evaluation Parameters?
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setShowHelp(false)} sx={{ color: '#999' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ p: 3 }}>
              <Typography variant="body2" sx={{ color: '#ccc', lineHeight: 1.7, mb: 2.5 }}>
                Evaluation parameters are the <strong style={{ color: '#90caf9' }}>scoring dimensions</strong> used by an
                AI judge (LLM) to rate your Dialogflow agent's responses. Each parameter defines <em>what</em> to measure
                and <em>how</em> to score it, giving you granular insight into response quality beyond a single overall score.
              </Typography>

              {/* Feature cards */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
                gap: 2,
                mb: 2.5,
              }}>
                <Box sx={{
                  p: 2,
                  borderRadius: 1.5,
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  border: '1px solid rgba(25, 118, 210, 0.20)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TuneIcon sx={{ color: '#64b5f6', fontSize: '1.1rem' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#90caf9', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Fully Custom
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#bbb', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    Define any quality dimension — empathy, accuracy, tone, completeness, compliance — tailored to your use case.
                  </Typography>
                </Box>

                <Box sx={{
                  p: 2,
                  borderRadius: 1.5,
                  backgroundColor: 'rgba(46, 125, 50, 0.08)',
                  border: '1px solid rgba(46, 125, 50, 0.20)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ChartIcon sx={{ color: '#66bb6a', fontSize: '1.1rem' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#a5d6a7', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Weighted Scores
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#bbb', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    Assign weights when creating test runs so critical parameters count more toward the overall score.
                  </Typography>
                </Box>

                <Box sx={{
                  p: 2,
                  borderRadius: 1.5,
                  backgroundColor: 'rgba(156, 39, 176, 0.06)',
                  border: '1px solid rgba(156, 39, 176, 0.18)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PsychologyIcon sx={{ color: '#ce93d8', fontSize: '1.1rem' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#e1bee7', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      AI-Powered
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#bbb', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    An LLM judge reads each response and scores it 0-100 on your criteria, with detailed reasoning for every score.
                  </Typography>
                </Box>

                <Box sx={{
                  p: 2,
                  borderRadius: 1.5,
                  backgroundColor: 'rgba(255, 167, 38, 0.06)',
                  border: '1px solid rgba(255, 167, 38, 0.18)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ChecklistIcon sx={{ color: '#ffb74d', fontSize: '1.1rem' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#ffe0b2', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Import & Export
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#bbb', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    Share evaluation criteria across teams. Export to CSV, refine, and import back — or use seed data to bootstrap.
                  </Typography>
                </Box>
              </Box>

              {/* Quick-start hint */}
              <Box sx={{
                p: 2,
                borderRadius: 1.5,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}>
                <Add sx={{ color: '#64b5f6', fontSize: '1.2rem' }} />
                <Typography variant="body2" sx={{ color: '#aaa', fontSize: '0.85rem' }}>
                  <strong style={{ color: '#ccc' }}>Get started:</strong> Click <strong style={{ color: '#90caf9' }}>Add Evaluator</strong> to
                  create your first evaluator, or use the <strong style={{ color: '#90caf9' }}>▾ dropdown</strong> to import a batch from CSV.
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Fade>
      </Collapse>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parameters
              .filter(parameter => parameter && parameter.id) // Additional safety check
              .map((parameter) => (
              <TableRow key={parameter.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {parameter.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {parameter.description || 'No description'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={parameter.is_active ? 'Active' : 'Inactive'}
                    color={parameter.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(parameter.created_at)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Export this evaluator as CSV">
                      <IconButton
                        size="small"
                        onClick={() => handleExportSingleParameter(parameter)}
                        sx={{ color: '#aaa', '&:hover': { color: '#64b5f6' } }}
                      >
                        <ExportIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEditParameter(parameter.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteParameter(parameter)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {parameters.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No evaluators found. Click Add Evaluator to get started.
          </Typography>
        </Box>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the evaluator "{parameterToDelete?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={handleCloseImportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Import Evaluators from CSV</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Upload a CSV file to create or update evaluators. You can use a file exported from this page
            (via the <ExportIcon sx={{ fontSize: '0.9rem', verticalAlign: 'middle', mx: 0.3 }} /> icon on each row) as a starting point.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Required column:</strong> name.<br />
            <strong>Optional columns:</strong> description, evaluation_task, scoring_guidelines, is_system_default, is_active.
          </Typography>
          
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            style={{ marginBottom: '16px', width: '100%' }}
          />
          
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                />
              }
              label="Replace existing evaluators with same name"
            />
          </FormGroup>
          
          <Typography variant="caption" color="text.secondary">
            Tip: Export an evaluator, edit the CSV, and re-import to quickly duplicate or tweak scoring criteria.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog}>Cancel</Button>
          <Button 
            onClick={handleImportParameters} 
            variant="contained" 
            disabled={!importFile}
            startIcon={<UploadIcon />}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EvaluationManagementPage;
