import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import ScoringGuidelinesEditor from './ScoringGuidelinesEditor';

interface PromptEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (evaluationTask: string, scoringGuidelines: string) => void;
  initialTask?: string;
  initialGuidelines?: string;
  parameterName?: string;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  open,
  onClose,
  onSave,
  initialTask = '',
  initialGuidelines = '',
  parameterName = 'New Parameter',
}) => {
  const [evaluationTask, setEvaluationTask] = useState(initialTask);
  const [scoringGuidelines, setScoringGuidelines] = useState(initialGuidelines);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setEvaluationTask(initialTask);
    setScoringGuidelines(initialGuidelines);
    setErrors([]);
  }, [initialTask, initialGuidelines, open]);

  const validateInputs = () => {
    const newErrors: string[] = [];

    if (!evaluationTask.trim()) {
      newErrors.push('Evaluation task is required');
    } else if (evaluationTask.trim().length < 10) {
      newErrors.push('Evaluation task must be at least 10 characters');
    }

    if (!scoringGuidelines.trim()) {
      newErrors.push('Scoring guidelines are required');
    }

    // Additional validation will be handled by ScoringGuidelinesEditor component

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (validateInputs()) {
      onSave(evaluationTask, scoringGuidelines);
      onClose();
    }
  };

  const getPreview = () => {
    if (!evaluationTask.trim() && !scoringGuidelines.trim()) {
      return 'Enter evaluation task and scoring guidelines to see preview...';
    }

    return `You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task: ${parameterName}**
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

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        Edit Prompt for {parameterName}
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {errors.length > 0 && (
          <Alert severity="error">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, height: 'calc(100% - 100px)' }}>
          {/* Input Section */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
              Prompt Configuration
            </Typography>
            
            <TextField
              label="Evaluation Task"
              multiline
              rows={8}
              value={evaluationTask}
              onChange={(e) => setEvaluationTask(e.target.value)}
              placeholder="Describe what this evaluation parameter should assess (e.g., 'Evaluate how empathetic and understanding the actual response is')"
              helperText="Describe the specific aspect of the response you want to evaluate"
              fullWidth
            />

            <ScoringGuidelinesEditor
              value={scoringGuidelines}
              onChange={setScoringGuidelines}
              parameterName={parameterName}
            />
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Preview Section */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Prompt Preview
            </Typography>
            
            <Paper 
              variant="outlined" 
              sx={{ 
                flex: 1, 
                p: 3, 
                backgroundColor: '#2d2d2d',
                border: '1px solid #404040',
                overflow: 'auto',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                color: '#e0e0e0',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#1e1e1e',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#555555',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  backgroundColor: '#666666',
                },
              }}
            >
              <Typography 
                component="div" 
                sx={{ 
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  whiteSpace: 'pre-wrap',
                  color: 'inherit'
                }}
              >
                {getPreview()}
              </Typography>
            </Paper>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!evaluationTask.trim() || !scoringGuidelines.trim()}
        >
          Save Prompt
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromptEditor;