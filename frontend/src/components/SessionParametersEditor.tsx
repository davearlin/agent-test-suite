import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  CircularProgress,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { apiService } from '../services/api';
import { QuickAddParameter } from '../types';

interface SessionParametersEditorProps {
  sessionParameters: Record<string, string>;
  onChange: (parameters: Record<string, string>) => void;
  label?: string;
  helperText?: string;
}

const SessionParametersEditor: React.FC<SessionParametersEditorProps> = ({
  sessionParameters,
  onChange,
  label = "Session Parameters",
  helperText = "Add key-value pairs to pass as session parameters to Dialogflow"
}) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [quickAddParameters, setQuickAddParameters] = useState<QuickAddParameter[]>([]);
  const [loadingQuickAdd, setLoadingQuickAdd] = useState(true);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  useEffect(() => {
    loadQuickAddParameters();
  }, []);

  const loadQuickAddParameters = async () => {
    try {
      setLoadingQuickAdd(true);
      const parameters = await apiService.getQuickAddParameters();
      setQuickAddParameters(parameters);
      setQuickAddError(null);
    } catch (error) {
      console.error('Failed to load session parameters:', error);
      setQuickAddError('Failed to load session parameters');
      // Fall back to empty array so component still works
      setQuickAddParameters([]);
    } finally {
      setLoadingQuickAdd(false);
    }
  };

  const handleAdd = () => {
    if (newKey.trim() && newValue.trim()) {
      const updated = { ...sessionParameters, [newKey.trim()]: newValue.trim() };
      onChange(updated);
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemove = (key: string) => {
    const updated = { ...sessionParameters };
    delete updated[key];
    onChange(updated);
  };

  const handleKeyChange = (oldKey: string, newKey: string) => {
    if (newKey.trim() && newKey !== oldKey) {
      const updated = { ...sessionParameters };
      updated[newKey.trim()] = updated[oldKey];
      delete updated[oldKey];
      onChange(updated);
    }
  };

  const handleValueChange = (key: string, newValue: string) => {
    const updated = { ...sessionParameters, [key]: newValue };
    onChange(updated);
  };

  // Quick add common parameters
  const handleQuickAdd = (key: string, value: string) => {
    // Check if this key already exists (regardless of value)
    if (sessionParameters.hasOwnProperty(key)) {
      // Don't add if key already exists
      return;
    }
    
    const updated = { ...sessionParameters, [key]: value };
    onChange(updated);
  };

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {helperText}
      </Typography>

      {/* Quick add common parameters */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Quick Add Common Parameters:
        </Typography>
        
        {loadingQuickAdd ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Loading session parameters...
            </Typography>
          </Box>
        ) : quickAddError ? (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {quickAddError}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
            {quickAddParameters.map((param) => (
              <Chip
                key={param.id}
                label={`${param.key}: ${param.value}`}
                variant="outlined"
                clickable
                onClick={() => handleQuickAdd(param.key, param.value)}
                title={param.description || `Add ${param.key} parameter`}
                disabled={sessionParameters.hasOwnProperty(param.key)}
                sx={{ 
                  opacity: sessionParameters.hasOwnProperty(param.key) ? 0.5 : 1,
                  cursor: sessionParameters.hasOwnProperty(param.key) ? 'not-allowed' : 'pointer'
                }}
              />
            ))}
            {quickAddParameters.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No session parameters available. Manage them in Test Runs → Session Parameters.
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Existing parameters */}
      {Object.entries(sessionParameters).map(([key, value], index) => (
        <Grid container spacing={1} alignItems="center" key={`param-${index}`} sx={{ mb: 1 }}>
          <Grid item xs={5}>
            <TextField
              size="small"
              fullWidth
              label="Key"
              value={key}
              onChange={(e) => handleKeyChange(key, e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={5}>
            <TextField
              size="small"
              fullWidth
              label="Value"
              value={value}
              onChange={(e) => handleValueChange(key, e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={2}>
            <IconButton 
              color="error" 
              onClick={() => handleRemove(key)}
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Grid>
        </Grid>
      ))}

      {/* Add new parameter */}
      <Grid container spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <Grid item xs={5}>
          <TextField
            size="small"
            fullWidth
            label="New Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            variant="outlined"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAdd();
              }
            }}
          />
        </Grid>
        <Grid item xs={5}>
          <TextField
            size="small"
            fullWidth
            label="New Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            variant="outlined"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAdd();
              }
            }}
          />
        </Grid>
        <Grid item xs={2}>
          <Button
            variant="contained"
            size="small"
            onClick={handleAdd}
            disabled={!newKey.trim() || !newValue.trim()}
            startIcon={<AddIcon />}
          >
            Add
          </Button>
        </Grid>
      </Grid>

      {/* Current parameters display */}
      {Object.keys(sessionParameters).length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Current Parameters ({Object.keys(sessionParameters).length}):
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
            {Object.entries(sessionParameters).map(([key, value]) => (
              <Chip
                key={key}
                label={`${key}: ${value}`}
                variant="filled"
                size="small"
                onDelete={() => handleRemove(key)}
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default SessionParametersEditor;