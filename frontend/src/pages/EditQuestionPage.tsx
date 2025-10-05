import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  IconButton,
  Grid,
  Divider,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { addQuestion, updateQuestion, fetchDataset } from '../store/datasetsSlice';

interface Question {
  id: number;
  question_text: string;
  expected_answer: string;
  detect_empathy: boolean;
  no_match: boolean;
  priority: string;
  tags: string[];
  metadata: any;
}

interface MetadataEntry {
  key: string;
  value: string;
}

const EditQuestionPage: React.FC = () => {
  const { datasetId, questionId } = useParams<{ datasetId: string; questionId?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentDataset, loading, error } = useAppSelector(state => state.datasets);

  const [formData, setFormData] = useState({
    question_text: '',
    expected_answer: '',
    detect_empathy: false,
    no_match: false,
    priority: 'medium',
    tags: '',
  });

  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = !!questionId;
  const question = isEdit ? currentDataset?.questions?.find(q => q.id === parseInt(questionId!)) : null;

  useEffect(() => {
    if (datasetId) {
      dispatch(fetchDataset(parseInt(datasetId)));
    }
  }, [dispatch, datasetId]);

  useEffect(() => {
    if (isEdit && question) {
      setFormData({
        question_text: question.question_text,
        expected_answer: question.expected_answer,
        detect_empathy: question.detect_empathy,
        no_match: question.no_match,
        priority: question.priority,
        tags: question.tags.join(', '),
      });

      // Convert metadata object to key-value pairs
      const metadata = question.metadata || {};
      const entries = Object.entries(metadata).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value)
      }));
      setMetadataEntries(entries);
    }
  }, [isEdit, question]);

  const handleAddMetadataEntry = () => {
    setMetadataEntries([...metadataEntries, { key: '', value: '' }]);
  };

  const handleUpdateMetadataEntry = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...metadataEntries];
    updated[index][field] = value;
    setMetadataEntries(updated);
  };

  const handleDeleteMetadataEntry = (index: number) => {
    setMetadataEntries(metadataEntries.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!datasetId) return;

    setSaveError(null);

    // Convert metadata entries to object
    const metadata: any = {};
    for (const entry of metadataEntries) {
      if (entry.key.trim()) {
        // Try to parse as JSON, otherwise store as string
        try {
          metadata[entry.key.trim()] = JSON.parse(entry.value);
        } catch {
          metadata[entry.key.trim()] = entry.value;
        }
      }
    }

    const questionData = {
      question_text: formData.question_text,
      expected_answer: formData.expected_answer,
      detect_empathy: formData.detect_empathy,
      no_match: formData.no_match,
      priority: formData.priority as 'high' | 'medium' | 'low',
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      metadata
    };

    try {
      if (isEdit && question) {
        dispatch(updateQuestion({ questionId: question.id, ...questionData }));
      } else {
        dispatch(addQuestion({ datasetId: parseInt(datasetId), ...questionData }));
      }
      navigate(`/datasets/${datasetId}/questions`);
    } catch (error) {
      setSaveError('Failed to save question. Please try again.');
    }
  };

  const handleCancel = () => {
    navigate(`/datasets/${datasetId}/questions`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Back Button */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={handleCancel} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Question' : 'Add New Question'}
        </Typography>
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {saveError}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Question Text */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Question Text"
              value={formData.question_text}
              onChange={(e) => setFormData(prev => ({ ...prev, question_text: e.target.value }))}
              multiline
              rows={3}
              required
            />
          </Grid>

          {/* Expected Answer */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Expected Answer"
              value={formData.expected_answer}
              onChange={(e) => setFormData(prev => ({ ...prev, expected_answer: e.target.value }))}
              multiline
              rows={4}
              required
            />
          </Grid>

          {/* Tags */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Tags (comma-separated)"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
            />
          </Grid>

          {/* Priority */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              SelectProps={{ native: true }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </TextField>
          </Grid>

          {/* Checkboxes */}
          <Grid item xs={12}>
            <Box display="flex" gap={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.detect_empathy}
                    onChange={(e) => setFormData(prev => ({ ...prev, detect_empathy: e.target.checked }))}
                  />
                }
                label="Detect Empathy"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.no_match}
                    onChange={(e) => setFormData(prev => ({ ...prev, no_match: e.target.checked }))}
                  />
                }
                label="No Match Expected"
              />
            </Box>
          </Grid>

          {/* Metadata Section */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Metadata</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddMetadataEntry}
                variant="outlined"
                size="small"
              >
                Add Field
              </Button>
            </Box>

            {metadataEntries.length === 0 ? (
              <Typography color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                No metadata fields. Click "Add Field" to create key-value pairs.
              </Typography>
            ) : (
              <Box>
                {metadataEntries.map((entry, index) => (
                  <Box key={index} display="flex" gap={2} alignItems="center" mb={2}>
                    <TextField
                      label="Key"
                      value={entry.key}
                      onChange={(e) => handleUpdateMetadataEntry(index, 'key', e.target.value)}
                      size="small"
                      sx={{ flexBasis: '30%' }}
                    />
                    <TextField
                      label="Value"
                      value={entry.value}
                      onChange={(e) => handleUpdateMetadataEntry(index, 'value', e.target.value)}
                      size="small"
                      sx={{ flexGrow: 1 }}
                    />
                    <IconButton
                      onClick={() => handleDeleteMetadataEntry(index)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
              <Button onClick={handleCancel} variant="outlined">
                Cancel
              </Button>
              <Button onClick={handleSave} variant="contained">
                {isEdit ? 'Update Question' : 'Add Question'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default EditQuestionPage;