import React, { useState, useEffect } from 'react';
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
  Alert,
  Tooltip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Snackbar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add,
  Upload as UploadIcon,
  GetApp as ExportIcon,
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
        <Typography variant="h4" component="h1">
          Evaluation Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExportParameters}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setImportDialogOpen(true)}
          >
            Import CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateParameter}
          >
            Add Parameter
          </Button>
        </Box>
      </Box>

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
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Edit Parameter">
                      <IconButton
                        size="small"
                        onClick={() => handleEditParameter(parameter.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Parameter">
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
            No evaluation parameters found. Create your first parameter to get started.
          </Typography>
        </Box>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the parameter "{parameterToDelete?.name}"?
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
        <DialogTitle>Import Evaluation Parameters</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV file with evaluation parameters. Required columns: name. Optional columns: description, prompt_template, is_system_default, is_active.
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
              label="Replace existing parameters"
            />
          </FormGroup>
          
          <Typography variant="caption" color="text.secondary">
            Note: Only administrators and test managers can import evaluation parameters.
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
