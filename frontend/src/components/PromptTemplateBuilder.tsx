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
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore,
  Help,
  Preview,
  Save,
  RestartAlt
} from '@mui/icons-material';

interface ScoringGuideline {
  minScore: number;
  maxScore: number;
  description: string;
}

interface PromptTemplateBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (template: string) => void;
  initialTemplate?: string;
  parameterName: string;
  parameterType: string;
}

const defaultTemplates = {
  similarity: {
    context: 'Question: "{question}"\nExpected Answer: "{expected_answer}"\nActual Answer: "{actual_answer}"',
    task: 'Evaluate how well the actual answer matches the expected answer in terms of semantic meaning, content accuracy, completeness, and helpfulness to the user.',
    guidelines: [
      { minScore: 90, maxScore: 100, description: 'Excellent match - covers all key points with appropriate tone and complete information' },
      { minScore: 70, maxScore: 89, description: 'Good match - covers most key points with minor gaps or slight tone issues' },
      { minScore: 50, maxScore: 69, description: 'Partial match - covers some key points but missing important information' },
      { minScore: 30, maxScore: 49, description: 'Poor match - misses most key points or provides incorrect information' },
      { minScore: 0, maxScore: 29, description: 'No match - completely irrelevant, contradictory, or unhelpful response' }
    ]
  },
  empathy: {
    context: 'Question: "{question}"\nExpected Answer: "{expected_answer}"\nActual Answer: "{actual_answer}"',
    task: 'Evaluate the empathy level and emotional intelligence demonstrated in the actual response, including understanding of the user\'s situation, appropriate empathetic language, and professional warmth.',
    guidelines: [
      { minScore: 90, maxScore: 100, description: 'Highly empathetic - excellent emotional understanding, warm and caring tone' },
      { minScore: 70, maxScore: 89, description: 'Good empathy - shows understanding with appropriate empathetic language' },
      { minScore: 50, maxScore: 69, description: 'Moderate empathy - some emotional awareness but could be warmer or more understanding' },
      { minScore: 30, maxScore: 49, description: 'Low empathy - minimal emotional understanding or overly cold/clinical tone' },
      { minScore: 0, maxScore: 29, description: 'No empathy - lacks emotional understanding or inappropriate emotional response' }
    ]
  },
  no_match: {
    context: 'Question: "{question}"\nExpected Answer: "{expected_answer}"\nActual Answer: "{actual_answer}"',
    task: 'Evaluate whether the actual response appropriately handles a situation where the system cannot provide the requested information, including clear communication of limitations and helpful alternatives.',
    guidelines: [
      { minScore: 90, maxScore: 100, description: 'Excellent no-match handling - clear, helpful, professional with good alternatives' },
      { minScore: 70, maxScore: 89, description: 'Good no-match handling - clear communication but could offer more helpful alternatives' },
      { minScore: 50, maxScore: 69, description: 'Adequate no-match handling - states limitation but lacks helpfulness or next steps' },
      { minScore: 30, maxScore: 49, description: 'Poor no-match handling - unclear communication or unhelpful response' },
      { minScore: 0, maxScore: 29, description: 'Inappropriate response - attempts to answer when it should decline or provides false information' }
    ]
  }
};

const requiredVariables = ['{question}', '{expected_answer}', '{actual_answer}'];

export const PromptTemplateBuilder: React.FC<PromptTemplateBuilderProps> = ({
  open,
  onClose,
  onSave,
  initialTemplate = '',
  parameterName,
  parameterType
}) => {
  const [context, setContext] = useState('');
  const [task, setTask] = useState('');
  const [guidelines, setGuidelines] = useState<ScoringGuideline[]>([]);
  const [additionalCriteria, setAdditionalCriteria] = useState<string[]>([]);
  const [newCriterion, setNewCriterion] = useState('');
  const [templateMode, setTemplateMode] = useState<'guided' | 'advanced'>('guided');
  const [rawTemplate, setRawTemplate] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState('');

  // Initialize with default template or parse existing template
  useEffect(() => {
    if (initialTemplate) {
      setRawTemplate(initialTemplate);
      setTemplateMode('advanced');
    } else {
      // Load default template based on parameter type
      const defaultTemplate = defaultTemplates[parameterType as keyof typeof defaultTemplates];
      if (defaultTemplate) {
        setContext(defaultTemplate.context);
        setTask(defaultTemplate.task);
        setGuidelines(defaultTemplate.guidelines);
      }
    }
  }, [initialTemplate, parameterType]);

  // Validate template
  useEffect(() => {
    const errors: string[] = [];
    const templateText = templateMode === 'guided' ? generateTemplate() : rawTemplate;
    
    // Check for required variables
    requiredVariables.forEach(variable => {
      if (!templateText.includes(variable)) {
        errors.push(`Missing required variable: ${variable}`);
      }
    });

    // Check for score instruction
    if (!templateText.toLowerCase().includes('score')) {
      errors.push('Template must instruct the LLM to provide a SCORE');
    }

    // Check for reasoning instruction
    if (!templateText.toLowerCase().includes('reasoning')) {
      errors.push('Template must instruct the LLM to provide REASONING');
    }

    // Check for 0-100 range
    if (!templateText.includes('0-100') && !/0\s*[-to]\s*100/.test(templateText)) {
      errors.push('Template must specify 0-100 scoring range');
    }

    // Validate scoring guidelines coverage (guided mode only)
    if (templateMode === 'guided' && guidelines.length > 0) {
      const sortedGuidelines = [...guidelines].sort((a, b) => a.minScore - b.minScore);
      
      if (sortedGuidelines[0]?.minScore !== 0) {
        errors.push('Scoring guidelines must start at 0');
      }
      
      if (sortedGuidelines[sortedGuidelines.length - 1]?.maxScore !== 100) {
        errors.push('Scoring guidelines must end at 100');
      }

      // Check for gaps
      for (let i = 0; i < sortedGuidelines.length - 1; i++) {
        const current = sortedGuidelines[i];
        const next = sortedGuidelines[i + 1];
        if (next.minScore !== current.maxScore + 1) {
          errors.push(`Gap in scoring guidelines between ${current.maxScore} and ${next.minScore}`);
        }
      }
    }

    setValidationErrors(errors);
  }, [context, task, guidelines, additionalCriteria, templateMode, rawTemplate]);

  const generateTemplate = () => {
    const guidelinesText = guidelines
      .sort((a, b) => a.minScore - b.minScore)
      .map(g => g.minScore === g.maxScore 
        ? `- ${g.minScore}: ${g.description}`
        : `- ${g.minScore}-${g.maxScore}: ${g.description}`
      ).join('\n');

    const criteriaText = additionalCriteria.length > 0
      ? `\n**Additional Evaluation Criteria:**\n${additionalCriteria.map(c => `- ${c}`).join('\n')}`
      : '';

    return `You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
${context}

**Evaluation Task:**
${task}

**Scoring Guidelines:**
${guidelinesText}${criteriaText}

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the evaluation]

**Important Instructions:**
- Provide exactly one integer score between 0 and 100
- Include detailed reasoning that explains your scoring decision
- Reference specific aspects of the response that influenced your score
- Be objective and consistent in your evaluation`;
  };

  // Update preview when guided mode changes
  useEffect(() => {
    if (templateMode === 'guided') {
      setPreviewTemplate(generateTemplate());
    } else {
      setPreviewTemplate(rawTemplate);
    }
  }, [context, task, guidelines, additionalCriteria, templateMode, rawTemplate]);

  const handleAddGuideline = () => {
    const newGuideline: ScoringGuideline = {
      minScore: guidelines.length > 0 ? Math.max(...guidelines.map(g => g.maxScore)) + 1 : 0,
      maxScore: 100,
      description: 'Enter description...'
    };
    setGuidelines([...guidelines, newGuideline]);
  };

  const handleUpdateGuideline = (index: number, field: keyof ScoringGuideline, value: any) => {
    const updated = guidelines.map((g, i) => 
      i === index ? { ...g, [field]: value } : g
    );
    setGuidelines(updated);
  };

  const handleDeleteGuideline = (index: number) => {
    setGuidelines(guidelines.filter((_, i) => i !== index));
  };

  const handleAddCriterion = () => {
    if (newCriterion.trim()) {
      setAdditionalCriteria([...additionalCriteria, newCriterion.trim()]);
      setNewCriterion('');
    }
  };

  const handleSave = () => {
    if (validationErrors.length === 0) {
      const finalTemplate = templateMode === 'guided' ? generateTemplate() : rawTemplate;
      onSave(finalTemplate);
      onClose();
    }
  };

  const handleLoadDefault = () => {
    const defaultTemplate = defaultTemplates[parameterType as keyof typeof defaultTemplates];
    if (defaultTemplate) {
      setContext(defaultTemplate.context);
      setTask(defaultTemplate.task);
      setGuidelines(defaultTemplate.guidelines);
      setAdditionalCriteria([]);
      setTemplateMode('guided');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Prompt Template Builder - {parameterName}
          </Typography>
          <Box>
            <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
              <InputLabel>Mode</InputLabel>
              <Select
                value={templateMode}
                onChange={(e) => setTemplateMode(e.target.value as 'guided' | 'advanced')}
                label="Mode"
              >
                <MenuItem value="guided">Guided Builder</MenuItem>
                <MenuItem value="advanced">Advanced Editor</MenuItem>
              </Select>
            </FormControl>
            <Button
              onClick={handleLoadDefault}
              startIcon={<RestartAlt />}
              variant="outlined"
              size="small"
            >
              Load Default
            </Button>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Template Validation Errors:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Required template variables: {requiredVariables.map(v => (
              <Chip key={v} label={v} size="small" sx={{ mx: 0.5 }} />
            ))}
          </Typography>
        </Box>

        {templateMode === 'guided' ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Template Configuration</Typography>
                
                <TextField
                  fullWidth
                  label="Context Description"
                  multiline
                  rows={3}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Describe what information will be provided to the LLM"
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Evaluation Task"
                  multiline
                  rows={3}
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="Describe what the LLM should evaluate"
                  sx={{ mb: 2 }}
                />

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1">
                      Scoring Guidelines ({guidelines.length})
                      <Tooltip title="Define score ranges and criteria">
                        <IconButton size="small"><Help fontSize="small" /></IconButton>
                      </Tooltip>
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      <Button onClick={handleAddGuideline} variant="outlined" size="small" sx={{ mb: 2 }}>
                        Add Guideline
                      </Button>
                      {guidelines.map((guideline, index) => (
                        <Paper key={index} sx={{ p: 2, mb: 1 }}>
                          <Grid container spacing={2} alignItems="center">
                            <Grid item xs={2}>
                              <TextField
                                type="number"
                                label="Min"
                                value={guideline.minScore}
                                onChange={(e) => handleUpdateGuideline(index, 'minScore', parseInt(e.target.value))}
                                inputProps={{ min: 0, max: 100 }}
                              />
                            </Grid>
                            <Grid item xs={2}>
                              <TextField
                                type="number"
                                label="Max"
                                value={guideline.maxScore}
                                onChange={(e) => handleUpdateGuideline(index, 'maxScore', parseInt(e.target.value))}
                                inputProps={{ min: 0, max: 100 }}
                              />
                            </Grid>
                            <Grid item xs={7}>
                              <TextField
                                fullWidth
                                label="Description"
                                value={guideline.description}
                                onChange={(e) => handleUpdateGuideline(index, 'description', e.target.value)}
                              />
                            </Grid>
                            <Grid item xs={1}>
                              <Button
                                onClick={() => handleDeleteGuideline(index)}
                                color="error"
                                size="small"
                              >
                                ×
                              </Button>
                            </Grid>
                          </Grid>
                        </Paper>
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Additional Criteria</Typography>
                  <Box display="flex" gap={1} mb={1}>
                    <TextField
                      fullWidth
                      size="small"
                      value={newCriterion}
                      onChange={(e) => setNewCriterion(e.target.value)}
                      placeholder="Add evaluation criterion"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCriterion()}
                    />
                    <Button onClick={handleAddCriterion} variant="outlined" size="small">
                      Add
                    </Button>
                  </Box>
                  <Box>
                    {additionalCriteria.map((criterion, index) => (
                      <Chip
                        key={index}
                        label={criterion}
                        onDelete={() => setAdditionalCriteria(additionalCriteria.filter((_, i) => i !== index))}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Preview</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={20}
                  value={previewTemplate}
                  InputProps={{ readOnly: true }}
                  variant="outlined"
                  sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                />
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <TextField
            fullWidth
            label="Raw Template"
            multiline
            rows={20}
            value={rawTemplate}
            onChange={(e) => setRawTemplate(e.target.value)}
            sx={{ fontFamily: 'monospace' }}
            placeholder="Enter your custom prompt template with {question}, {expected_answer}, and {actual_answer} variables..."
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={validationErrors.length > 0}
          startIcon={<Save />}
        >
          Save Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromptTemplateBuilder;