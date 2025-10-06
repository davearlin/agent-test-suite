import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  Chip,
  Tooltip,
  Card,
  CardContent,
  CircularProgress,
  Checkbox,
  FormGroup
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  DragIndicator as DragIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Upload as UploadIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface QuickAddParameter {
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

interface QuickAddParameterForm {
  name: string;
  key: string;
  value: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

const SessionParametersPage: React.FC = () => {
  const navigate = useNavigate();
  const [parameters, setParameters] = useState<QuickAddParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [editingParameter, setEditingParameter] = useState<QuickAddParameter | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const [formData, setFormData] = useState<QuickAddParameterForm>({
    name: '',
    key: '',
    value: '',
    description: '',
    is_active: true,
    sort_order: 0
  });

  useEffect(() => {
    loadParameters();
  }, []);

  const loadParameters = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getQuickAddParameters();
      setParameters(data);
    } catch (error) {
      console.error('Failed to load quick add parameters:', error);
      setError('Failed to load parameters');
      showSnackbar('Failed to load parameters', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (parameter?: QuickAddParameter) => {
    if (parameter) {
      setEditingParameter(parameter);
      setFormData({
        name: parameter.name,
        key: parameter.key,
        value: parameter.value,
        description: parameter.description || '',
        is_active: parameter.is_active,
        sort_order: parameter.sort_order
      });
    } else {
      setEditingParameter(null);
      setFormData({
        name: '',
        key: '',
        value: '',
        description: '',
        is_active: true,
        sort_order: parameters.length
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingParameter(null);
    setFormData({
      name: '',
      key: '',
      value: '',
      description: '',
      is_active: true,
      sort_order: 0
    });
  };

  const handleSave = async () => {
    try {
      if (editingParameter) {
        // Update existing parameter
        await apiService.updateQuickAddParameter(editingParameter.id, formData);
        showSnackbar('Parameter updated successfully', 'success');
      } else {
        // Create new parameter
        await apiService.createQuickAddParameter(formData);
        showSnackbar('Parameter created successfully', 'success');
      }
      handleCloseDialog();
      loadParameters();
    } catch (error: any) {
      console.error('Failed to save parameter:', error);
      const message = error.response?.data?.detail || 'Failed to save parameter';
      showSnackbar(message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this parameter?')) {
      try {
        await apiService.deleteQuickAddParameter(id);
        showSnackbar('Parameter deleted successfully', 'success');
        loadParameters();
      } catch (error) {
        console.error('Failed to delete parameter:', error);
        showSnackbar('Failed to delete parameter', 'error');
      }
    }
  };

  const handleFormChange = (field: keyof QuickAddParameterForm, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isFormValid = () => {
    return formData.name.trim() !== '' && 
           formData.key.trim() !== '' && 
           formData.value.trim() !== '';
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
      const response = await fetch(`${baseURL}/api/v1/quick-add-parameters/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to export session parameters');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'session_parameters.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSnackbar('Session parameters exported successfully', 'success');
    } catch (error) {
      console.error('Failed to export session parameters:', error);
      showSnackbar('Failed to export session parameters', 'error');
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
      const response = await fetch(`${baseURL}/api/v1/quick-add-parameters/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to import session parameters');

      const result = await response.json();
      showSnackbar(result.message, 'success');
      loadParameters();
      handleCloseImportDialog();
    } catch (error) {
      console.error('Failed to import session parameters:', error);
      showSnackbar('Failed to import session parameters', 'error');
    }
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setImportFile(null);
    setReplaceExisting(false);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Session Parameters
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
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Parameter
          </Button>
        </Box>
      </Box>

      {/* Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body1" color="text.secondary">
            Session Parameters allow you to define common parameter key-value pairs that users can quickly add
            when configuring Quick Tests or Test Runs. This eliminates the need to manually type frequently used parameters
            and other agent-specific configurations.
          </Typography>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Parameters Table */}
      <TableContainer component={Paper} sx={{ bgcolor: '#1e1e1e' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Key</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : parameters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No session parameters found. Create your first parameter to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              parameters.map((parameter) => (
                <TableRow key={parameter.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DragIcon sx={{ color: 'text.secondary', mr: 1 }} />
                      {parameter.sort_order}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {parameter.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={parameter.key} 
                      size="small" 
                      variant="outlined" 
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={parameter.value} 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                      sx={{ fontFamily: 'monospace' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {parameter.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={parameter.is_active ? 'Active' : 'Inactive'} 
                      color={parameter.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit Parameter">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenDialog(parameter)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Parameter">
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDelete(parameter.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingParameter ? 'Edit Parameter' : 'Add New Parameter'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Display Name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              sx={{ mb: 2 }}
              placeholder="e.g., Department: Sales"
              helperText="A descriptive name shown to users"
            />
            
            <TextField
              fullWidth
              label="Parameter Key"
              value={formData.key}
              onChange={(e) => handleFormChange('key', e.target.value)}
              sx={{ mb: 2 }}
              placeholder="e.g., department"
              helperText="The session parameter key"
            />
            
            <TextField
              fullWidth
              label="Parameter Value"
              value={formData.value}
              onChange={(e) => handleFormChange('value', e.target.value)}
              sx={{ mb: 2 }}
              placeholder="e.g., sales"
              helperText="The session parameter value"
            />
            
            <TextField
              fullWidth
              label="Description (Optional)"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              sx={{ mb: 2 }}
              multiline
              rows={2}
              placeholder="Optional description of what this parameter does"
            />
            
            <TextField
              fullWidth
              label="Sort Order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => handleFormChange('sort_order', parseInt(e.target.value) || 0)}
              sx={{ mb: 2 }}
              helperText="Lower numbers appear first"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => handleFormChange('is_active', e.target.checked)}
                />
              }
              label="Active"
              sx={{ mb: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={!isFormValid()}
            startIcon={<SaveIcon />}
          >
            {editingParameter ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={handleCloseImportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Import Session Parameters</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload a CSV file with session parameters. Required columns: name, key, value. Optional columns: description, is_active, sort_order.
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
            If unchecked, existing parameters will be updated. If checked, all current parameters will be deactivated first.
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

export default SessionParametersPage;