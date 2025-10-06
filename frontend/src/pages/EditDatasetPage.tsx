import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchDataset, updateDataset } from '../store/datasetsSlice';

const EditDatasetPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentDataset, loading, error } = useAppSelector(state => state.datasets);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    version: '',
  });
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      dispatch(fetchDataset(parseInt(id)));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (currentDataset) {
      setFormData({
        name: currentDataset.name,
        description: currentDataset.description || '',
        category: currentDataset.category,
        version: currentDataset.version,
      });
    }
  }, [currentDataset]);

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSelectChange = (field: string) => (event: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setUpdateError(null);

    if (!id) return;

    try {
      await dispatch(updateDataset({
        id: parseInt(id),
        data: formData,
      })).unwrap();
      navigate('/datasets');
    } catch (error: any) {
      setUpdateError(error.message || 'Failed to update dataset');
    }
  };

  const handleBack = () => {
    navigate('/datasets');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (!currentDataset) {
    return (
      <Box>
        <Alert severity="error">Dataset not found</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          variant="outlined"
        >
          Back to Datasets
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Edit Dataset
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {updateError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {updateError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Dataset Name"
            value={formData.name}
            onChange={handleInputChange('name')}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={handleInputChange('description')}
            margin="normal"
            multiline
            rows={3}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              onChange={handleSelectChange('category')}
              label="Category"
            >
              <MenuItem value="General">General</MenuItem>
              <MenuItem value="Customer Service">Customer Service</MenuItem>
              <MenuItem value="Technical Support">Technical Support</MenuItem>
              <MenuItem value="Sales">Sales</MenuItem>
              <MenuItem value="HR">HR</MenuItem>
              <MenuItem value="Finance">Finance</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Version"
            value={formData.version}
            onChange={handleInputChange('version')}
            margin="normal"
            required
          />

          <Box mt={3} display="flex" gap={2}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Dataset'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleBack}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default EditDatasetPage;
