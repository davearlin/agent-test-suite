import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Collapse,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  InfoOutlined as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import ScoringGuidelinesEditor from '../components/ScoringGuidelinesEditor';
import { apiService } from '../services/api';

interface EvaluationParameter {
  id: number;
  name: string;
  description: string;
  prompt_template: string;
  is_active: boolean;
  is_system_default: boolean;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

const buildEvaluationPrompt = (evaluationTask: string, scoringGuidelines: string): string => {
  return `You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task:**
${evaluationTask}

**Scoring Guidelines:**
${scoringGuidelines}

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the assessment]

**Important Instructions:**
- Score must be between 0-100
- Provide clear reasoning for your score
- Consider the context and user's needs
- Be consistent and objective in your evaluation`;
};

const EditEvaluationParameterPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';
  
  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });
  
  const [evaluationTask, setEvaluationTask] = useState('');
  const [scoringGuidelines, setScoringGuidelines] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [scoringGuidelinesValid, setScoringGuidelinesValid] = useState(true);
  const [scoringGuidelinesErrors, setScoringGuidelinesErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!isCreateMode && id) {
      loadParameter();
    } else {
      setLoading(false);
    }
  }, [id, isCreateMode]);



  const loadParameter = async () => {
    try {
      setLoading(true);
      // Use the apiService to get evaluation parameters and find the one we need
      const parameters = await apiService.getEvaluationParameters(true);
      const parameter = parameters.find(p => p.id === parseInt(id!));
      
      if (parameter) {
        setFormData({
          name: parameter.name,
          description: parameter.description || '',
          is_active: parameter.is_active,
        });
        
        // Parse the prompt template to extract task and guidelines
        if (parameter.prompt_template) {
          const parsed = parsePromptTemplate(parameter.prompt_template);
          setEvaluationTask(parsed.task);
          setScoringGuidelines(parsed.guidelines);
        }
      } else {
        setError('Failed to load evaluation parameter');
      }
    } catch (err) {
      setError('Network error loading parameter');
    } finally {
      setLoading(false);
    }
  };

  const parsePromptTemplate = (template: string) => {
    // Extract evaluation task and scoring guidelines from template
    
    // Flexible approach: extract content between **Evaluation Task** and **Scoring Guidelines**
    // This handles various formats and newline patterns
    
    const taskRegex = /\*\*Evaluation Task[^*]*?\*\*\s*\n(.*?)(?=\n\s*\*\*Scoring Guidelines:\*\*)/s;
    const guidelinesRegex = /\*\*Scoring Guidelines:\*\*\s*\n(.*?)(?=\n\s*\*\*Response Format:\*\*)/s;
    
    const taskMatch = template.match(taskRegex);
    const guidelinesMatch = template.match(guidelinesRegex);
    
    const result = {
      task: taskMatch ? taskMatch[1].trim() : '',
      guidelines: guidelinesMatch ? guidelinesMatch[1].trim() : '',
    };
    
    return result;
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Parameter name is required');
    } else if (formData.name.trim().length < 3) {
      errors.push('Parameter name must be at least 3 characters');
    }

    if (!formData.description.trim()) {
      errors.push('Description is required');
    } else if (formData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters');
    }

    if (!evaluationTask.trim()) {
      errors.push('Evaluation task is required');
    } else if (evaluationTask.trim().length < 10) {
      errors.push('Evaluation task must be at least 10 characters');
    }

    if (!scoringGuidelines.trim()) {
      errors.push('Scoring guidelines are required');
    }

    // Add scoring guidelines validation errors
    if (!scoringGuidelinesValid) {
      errors.push(...scoringGuidelinesErrors);
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Track form validation state
  const [isFormValidState, setIsFormValidState] = useState(false);
  
  // Update validation whenever form fields change
  useEffect(() => {
    const isValid = formData.name.trim().length >= 3 &&
                   formData.description.trim().length >= 10 &&
                   evaluationTask.trim().length >= 10 &&
                   scoringGuidelines.trim().length > 0 &&
                   scoringGuidelinesValid;
    setIsFormValidState(isValid);
  }, [formData.name, formData.description, evaluationTask, scoringGuidelines, scoringGuidelinesValid]);
  
  const isFormValid = isFormValidState;

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const promptTemplate = buildEvaluationPrompt(evaluationTask, scoringGuidelines);
      
      const url = isCreateMode 
        ? '/api/v1/evaluation/parameters'
        : `/api/v1/evaluation/parameters/${id}`;
      
      const method = isCreateMode ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          ...formData,
          prompt_template: promptTemplate,
        }),
      });

      if (response.ok) {
        navigate('/evaluation-management');
      } else {
        const errorData = await response.json();
        setError(errorData.detail || `Failed to ${isCreateMode ? 'create' : 'update'} parameter`);
      }
    } catch (err) {
      setError(`Network error ${isCreateMode ? 'creating' : 'updating'} parameter`);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/evaluation-management');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={handleBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {isCreateMode ? 'Create Evaluator' : 'Edit Evaluator'}
          </Typography>
        </Box>
        {isCreateMode && (
          <Button
            startIcon={<InfoIcon />}
            onClick={() => setShowGuide(!showGuide)}
            variant={showGuide ? 'contained' : 'outlined'}
            size="small"
            sx={{
              borderColor: '#555',
              color: showGuide ? '#fff' : '#aaa',
              backgroundColor: showGuide ? 'rgba(25, 118, 210, 0.15)' : 'transparent',
              '&:hover': {
                borderColor: '#1976d2',
                backgroundColor: showGuide ? 'rgba(25, 118, 210, 0.25)' : 'rgba(25, 118, 210, 0.08)',
              },
            }}
          >
            {showGuide ? 'Hide Guide' : 'Getting Started'}
          </Button>
        )}
      </Box>

      {/* Getting Started Guide */}
      <Collapse in={showGuide}>
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
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(25, 118, 210, 0.08)',
          }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#e3f2fd' }}>
              How Evaluation Parameters Work
            </Typography>
            <IconButton size="small" onClick={() => setShowGuide(false)} sx={{ color: '#999' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ px: 3, py: 2.5 }}>
            <Typography variant="body2" sx={{ color: '#ccc', mb: 2.5, lineHeight: 1.7 }}>
              Evaluation parameters define <strong style={{ color: '#90caf9' }}>what the AI judge measures</strong> when
              scoring your Dialogflow agent's responses. Each parameter becomes a separate scoring dimension in your test results.
            </Typography>
            <Stepper orientation="vertical" activeStep={-1} sx={{
              '& .MuiStepLabel-label': { color: '#bbb', fontSize: '0.875rem' },
              '& .MuiStepConnector-line': { borderColor: 'rgba(255,255,255,0.1)' },
              '& .MuiStepIcon-root': { color: 'rgba(25, 118, 210, 0.4)' },
              '& .MuiStepIcon-text': { fill: '#fff' },
            }}>
              <Step expanded>
                <StepLabel>
                  <strong>Name & Describe</strong> — Give it a clear name like "Empathy Level" or "Answer Accuracy"
                </StepLabel>
              </Step>
              <Step expanded>
                <StepLabel>
                  <strong>Define the Task</strong> — Tell the AI judge exactly what to evaluate (e.g., "Assess whether the response demonstrates understanding of the user's emotional state")
                </StepLabel>
              </Step>
              <Step expanded>
                <StepLabel>
                  <strong>Set Scoring Guidelines</strong> — Define what each score range (0-100) means so the judge scores consistently
                </StepLabel>
              </Step>
              <Step expanded>
                <StepLabel>
                  <strong>Use in Test Runs</strong> — Activate the parameter and select it when creating test runs. Results show per-parameter scores and reasoning
                </StepLabel>
              </Step>
            </Stepper>
          </Box>
        </Paper>
      </Collapse>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        {/* Basic Information */}
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
          <TextField
            label="Evaluator Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Empathy Level, Similarity Score"
            helperText={`${formData.name.trim().length}/3 characters minimum`}
            error={formData.name.trim().length > 0 && formData.name.trim().length < 3}
            fullWidth
            required
          />
          
          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe what this evaluator measures"
            helperText={`${formData.description.trim().length}/10 characters minimum`}
            error={formData.description.trim().length > 0 && formData.description.trim().length < 10}
            multiline
            rows={3}
            fullWidth
            required
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Evaluation Task */}
        <Typography variant="h6" gutterBottom>
          Evaluation Task
        </Typography>
        
        <TextField
          label="Evaluation Task"
          value={evaluationTask}
          onChange={(e) => setEvaluationTask(e.target.value)}
          placeholder="Describe what this evaluation parameter should assess (e.g., 'Evaluate how empathetic and understanding the actual response is')"
          helperText={`${evaluationTask.trim().length}/10 characters minimum — describe the specific aspect of the response to evaluate`}
          error={evaluationTask.trim().length > 0 && evaluationTask.trim().length < 10}
          multiline
          rows={6}
          fullWidth
          required
          sx={{ mb: 4 }}
        />

        <Divider sx={{ my: 4 }} />

        {/* Scoring Guidelines */}
        <ScoringGuidelinesEditor
          value={scoringGuidelines}
          onChange={setScoringGuidelines}
          onValidationChange={(isValid, errors) => {
            setScoringGuidelinesValid(isValid);
            setScoringGuidelinesErrors(errors);
          }}
          parameterName={formData.name || 'New Evaluator'}
        />
      </Paper>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button
          onClick={handleBack}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isFormValid}
        >
          {saving ? 'Saving...' : (isCreateMode ? 'Create Evaluator' : 'Save Changes')}
        </Button>
      </Box>
    </Box>
  );
};

export default EditEvaluationParameterPage;