import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Quiz as QuestionIcon,
  Upload as UploadIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { apiService } from '../services/api';
import { DatasetSummary } from '../types';

interface Dataset {
  id: number;
  name: string;
  description: string;
  category: string;
  version: string;
  question_count: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

interface DatasetFormData {
  name: string;
  description: string;
  category: string;
  version: string;
  questions: any[];
}

export default function DatasetsPage() {
  const navigate = useNavigate();
  
  // Basic state
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<DatasetFormData>({
    name: '',
    description: '',
    category: '',
    version: '1.0',
    questions: []
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const data = await apiService.getDatasets();
      // API returns an array directly, not wrapped in a datasets property
      setDatasets(data as any || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDataset = async () => {
    try {
      await apiService.createDataset(formData);
      await fetchDatasets();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dataset');
    }
  };

  const handleUpdateDataset = async () => {
    if (!selectedDataset) return;
    
    try {
      await apiService.updateDataset(selectedDataset.id, formData);
      await fetchDatasets();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dataset');
    }
  };

  const handleDeleteDataset = async (id: number) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    
    try {
      await apiService.deleteDataset(id);
      await fetchDatasets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dataset');
    }
  };

  const handleImportDataset = async () => {
    if (!importFile) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', importFile);
      
      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${baseURL}/api/v1/datasets/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to import dataset');
      
      await fetchDatasets();
      handleCloseImportDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import dataset');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      version: '1.0',
      questions: []
    });
    setSelectedDataset(null);
  };

  const handleOpenDialog = (dataset?: Dataset) => {
    if (dataset) {
      setSelectedDataset(dataset);
      setFormData({
        name: dataset.name,
        description: dataset.description,
        category: dataset.category,
        version: dataset.version,
        questions: []
      });
    } else {
      resetForm();
    }
    setOpenDialog(true);
    setError(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
    setError(null);
  };

  const handleCloseImportDialog = () => {
    setOpenImportDialog(false);
    setImportFile(null);
    setError(null);
  };

  const handleViewQuestions = (dataset: Dataset) => {
    navigate(`/datasets/${dataset.id}/questions`);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, dataset: Dataset) => {
    setAnchorEl(event.currentTarget);
    setSelectedDataset(dataset);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDataset(null);
  };

  const handleExportDataset = async (dataset: Dataset) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('You must be logged in to export datasets. Please log in again.');
      }

      const response = await fetch(`/api/v1/datasets/${dataset.id}/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to export dataset');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from response headers or create default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `dataset_${dataset.id}_${dataset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=([^;]+)/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      handleMenuClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export dataset');
      handleMenuClose();
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
        <Typography variant="h4" component="h1" gutterBottom>
          Golden Datasets
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Dataset
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {datasets.map((dataset) => (
          <Grid item xs={12} md={6} lg={4} key={dataset.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  {dataset.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Category: {dataset.category}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Version: {dataset.version}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Questions: {dataset.question_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Owner: {dataset.owner_name}
                </Typography>
              </CardContent>
              <CardActions>
                <Button 
                  size="small" 
                  startIcon={<QuestionIcon />} 
                  onClick={() => handleViewQuestions(dataset)}
                  variant="contained"
                >
                  View Questions
                </Button>
                <IconButton 
                  size="small"
                  onClick={(e) => handleMenuClick(e, dataset)}
                >
                  <MoreVertIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedDataset) handleOpenDialog(selectedDataset);
          handleMenuClose();
        }}>
          <EditIcon sx={{ mr: 1 }} />
          Edit Dataset
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedDataset) handleExportDataset(selectedDataset);
        }}>
          <ExportIcon sx={{ mr: 1 }} />
          Export to CSV
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedDataset) handleDeleteDataset(selectedDataset.id);
          handleMenuClose();
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Dataset
        </MenuItem>
      </Menu>

      {/* Create/Edit Dataset Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedDataset ? 'Edit Dataset' : 'Create Dataset'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            label="Description"
            multiline
            rows={3}
            fullWidth
            margin="normal"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            label="Category"
            fullWidth
            margin="normal"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />
          <TextField
            label="Version"
            fullWidth
            margin="normal"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={selectedDataset ? handleUpdateDataset : handleCreateDataset} 
            variant="contained"
          >
            {selectedDataset ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dataset Dialog */}
      <Dialog open={openImportDialog} onClose={handleCloseImportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Import Dataset</DialogTitle>
        <DialogContent>
          <input
            type="file"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            style={{ marginTop: '16px' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog}>Cancel</Button>
          <Button onClick={handleImportDataset} variant="contained" disabled={!importFile}>
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}