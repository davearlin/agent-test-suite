import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Button,
  SelectChangeEvent,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface CSVPreview {
  headers: string[];
  sample_rows: Record<string, string>[];
  total_rows: number;
  html_analysis?: Record<string, any> | null;
}

interface ColumnMapping {
  question_column: string;
  answer_column: string;
  empathy_column?: string;
  no_match_column?: string;
  priority_column?: string;
  tags_column?: string;
  metadata_columns: string[];
  strip_html_from_question?: boolean;
  strip_html_from_answer?: boolean;
}

interface CSVColumnMapperProps {
  csvPreview: CSVPreview;
  onMappingChange: (mapping: ColumnMapping) => void;
  onCancel: () => void;
  onImport: () => void;
  isLoading?: boolean;
}

// Component for expandable cell text with truncation
const ExpandableText: React.FC<{ text: string; maxLength?: number }> = ({ text, maxLength = 80 }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!text || text.trim().length === 0) {
    return <Typography variant="body2" color="text.secondary">-</Typography>;
  }
  
  const isLong = text.length > maxLength;
  const displayText = expanded || !isLong ? text : `${text.substring(0, maxLength)}...`;
  
  if (!isLong) {
    return <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{text}</Typography>;
  }
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, maxWidth: 250 }}>
      <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.4 }}>
        {displayText}
      </Typography>
      <Tooltip title={expanded ? "Show less" : "Show more"}>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ 
            p: 0.25, 
            minWidth: 'auto',
            color: 'primary.main',
            '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' }
          }}
        >
          <ExpandMoreIcon 
            sx={{ 
              fontSize: 14,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease-in-out'
            }} 
          />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const CSVColumnMapper: React.FC<CSVColumnMapperProps> = ({
  csvPreview,
  onMappingChange,
  onCancel,
  onImport,
  isLoading = false,
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>({
    question_column: '',
    answer_column: '',
    empathy_column: '',
    no_match_column: '',
    priority_column: '',
    tags_column: '',
    metadata_columns: [],
    strip_html_from_question: false,
    strip_html_from_answer: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Auto-detect common column mappings and initialize metadata columns
    const newMapping = { ...mapping };
    const headers = csvPreview.headers.map(h => h.toLowerCase());
    
    // Auto-detect question column
    if (!newMapping.question_column) {
      const questionCol = csvPreview.headers.find(h => 
        ['question', 'question_text', 'questions', 'query'].includes(h.toLowerCase())
      );
      if (questionCol) newMapping.question_column = questionCol;
    }
    
    // Auto-detect answer column  
    if (!newMapping.answer_column) {
      const answerCol = csvPreview.headers.find(h => 
        ['answer', 'expected_answer', 'response', 'reply', 'answers'].includes(h.toLowerCase())
      );
      if (answerCol) newMapping.answer_column = answerCol;
    }
    
    // Auto-detect optional columns
    if (!newMapping.empathy_column) {
      const empathyCol = csvPreview.headers.find(h => 
        ['empathy', 'detect_empathy', 'empathy_detection'].includes(h.toLowerCase())
      );
      if (empathyCol) newMapping.empathy_column = empathyCol;
    }
    
    if (!newMapping.no_match_column) {
      const noMatchCol = csvPreview.headers.find(h => 
        ['no_match', 'nomatch', 'no_answer'].includes(h.toLowerCase())
      );
      if (noMatchCol) newMapping.no_match_column = noMatchCol;
    }
    
    if (!newMapping.priority_column) {
      const priorityCol = csvPreview.headers.find(h => 
        ['priority', 'importance', 'level'].includes(h.toLowerCase())
      );
      if (priorityCol) newMapping.priority_column = priorityCol;
    }
    
    if (!newMapping.tags_column) {
      const tagsCol = csvPreview.headers.find(h => 
        ['tags', 'tag', 'categories', 'keywords'].includes(h.toLowerCase())
      );
      if (tagsCol) newMapping.tags_column = tagsCol;
    }
    
    // Set remaining columns as metadata
    const mappedColumns = [
      newMapping.question_column,
      newMapping.answer_column,
      newMapping.empathy_column,
      newMapping.no_match_column,
      newMapping.priority_column,
      newMapping.tags_column
    ].filter(Boolean);
    
    newMapping.metadata_columns = csvPreview.headers.filter(h => !mappedColumns.includes(h));
    
    // Auto-detect HTML stripping recommendations
    if (csvPreview.html_analysis) {
      // Set intelligent defaults for HTML stripping based on analysis
      if (newMapping.question_column && csvPreview.html_analysis[newMapping.question_column]) {
        const analysis = csvPreview.html_analysis[newMapping.question_column];
        // Auto-enable HTML stripping if recommended or if there's significant HTML content
        if (analysis.recommended_action === 'recommend_strip' || analysis.html_percentage > 20) {
          newMapping.strip_html_from_question = true;
        }
      }
      
      if (newMapping.answer_column && csvPreview.html_analysis[newMapping.answer_column]) {
        const analysis = csvPreview.html_analysis[newMapping.answer_column];
        // Auto-enable HTML stripping if recommended or if there's significant HTML content
        if (analysis.recommended_action === 'recommend_strip' || analysis.html_percentage > 20) {
          newMapping.strip_html_from_answer = true;
        }
      }
    }
    
    setMapping(newMapping);
  }, [csvPreview]);

  useEffect(() => {
    onMappingChange(mapping);
    validateMapping();
  }, [mapping, onMappingChange]);

  const validateMapping = () => {
    const newErrors: Record<string, string> = {};

    if (!mapping.question_column) {
      newErrors.question_column = 'Question column is required';
    }

    if (!mapping.answer_column) {
      newErrors.answer_column = 'Answer column is required';
    }

    if (mapping.question_column === mapping.answer_column && mapping.question_column) {
      newErrors.answer_column = 'Answer column must be different from question column';
    }

    setErrors(newErrors);
  };

  const handleColumnChange = (field: keyof ColumnMapping) => (event: SelectChangeEvent) => {
    const value = event.target.value;
    const newMapping = { ...mapping };

    if (field === 'metadata_columns') {
      // This shouldn't happen with current UI, but keeping for completeness
      return;
    }

    (newMapping as any)[field] = value || undefined;

    // Update metadata columns to exclude mapped columns
    const mappedColumns = Object.entries(newMapping)
      .filter(([key, val]) => key !== 'metadata_columns' && val && typeof val === 'string')
      .map(([_, val]) => val as string);

    newMapping.metadata_columns = csvPreview.headers.filter(h => !mappedColumns.includes(h));

    setMapping(newMapping);
  };

  const isValid = !errors.question_column && !errors.answer_column && mapping.question_column && mapping.answer_column;

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      p: 3
    }}>
      {/* Header with Import Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Map CSV Columns
        </Typography>
        <Button 
          onClick={onImport} 
          variant="contained" 
          disabled={!isValid || isLoading}
        >
          {isLoading ? 'Importing...' : 'Import Questions'}
        </Button>
      </Box>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Please select which columns contain your questions and answers. All other columns will be automatically stored as metadata with each question for future reference.
      </Alert>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          File: {csvPreview.headers.length} columns, {csvPreview.total_rows} rows
        </Typography>
      </Box>

      {/* HTML Detection Info - Subtle notification */}
      {csvPreview.html_analysis && Object.keys(csvPreview.html_analysis).length > 0 && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 3, 
            bgcolor: 'grey.900', 
            border: '1px solid',
            borderColor: 'grey.700',
            '& .MuiAlert-message': { color: 'grey.300' },
            '& .MuiAlert-icon': { color: 'info.main' }
          }}
        >
          <Typography variant="body2" sx={{ color: 'grey.300' }}>
            HTML content detected in some columns. Select your Question and Answer columns below to configure HTML removal options.
          </Typography>
        </Alert>
      )}

      {/* Column Mapping Controls */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 3, flexShrink: 0 }}>
        <FormControl error={!!errors.question_column} required>
          <InputLabel>Question Column</InputLabel>
          <Select
            value={mapping.question_column}
            onChange={handleColumnChange('question_column')}
            label="Question Column"
          >
            <MenuItem value="">
              <em>Select column</em>
            </MenuItem>
            {csvPreview.headers.map((header) => (
              <MenuItem key={header} value={header}>
                {header}
              </MenuItem>
            ))}
          </Select>
          {errors.question_column && <FormHelperText>{errors.question_column}</FormHelperText>}
        </FormControl>

        <FormControl error={!!errors.answer_column} required>
          <InputLabel>Answer Column</InputLabel>
          <Select
            value={mapping.answer_column}
            onChange={handleColumnChange('answer_column')}
            label="Answer Column"
          >
            <MenuItem value="">
              <em>Select column</em>
            </MenuItem>
            {csvPreview.headers.map((header) => (
              <MenuItem key={header} value={header}>
                {header}
              </MenuItem>
            ))}
          </Select>
          {errors.answer_column && <FormHelperText>{errors.answer_column}</FormHelperText>}
        </FormControl>

        <FormControl>
          <InputLabel>Priority Column (Optional)</InputLabel>
          <Select
            value={mapping.priority_column || ''}
            onChange={handleColumnChange('priority_column')}
            label="Priority Column (Optional)"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {csvPreview.headers.map((header) => (
              <MenuItem key={header} value={header}>
                {header}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>Tags Column (Optional)</InputLabel>
          <Select
            value={mapping.tags_column || ''}
            onChange={handleColumnChange('tags_column')}
            label="Tags Column (Optional)"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {csvPreview.headers.map((header) => (
              <MenuItem key={header} value={header}>
                {header}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>Empathy Detection Column (Optional)</InputLabel>
          <Select
            value={mapping.empathy_column || ''}
            onChange={handleColumnChange('empathy_column')}
            label="Empathy Detection Column (Optional)"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {csvPreview.headers.map((header) => (
              <MenuItem key={header} value={header}>
                {header}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <InputLabel>No Match Column (Optional)</InputLabel>
          <Select
            value={mapping.no_match_column || ''}
            onChange={handleColumnChange('no_match_column')}
            label="No Match Column (Optional)"
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {csvPreview.headers.map((header) => (
              <MenuItem key={header} value={header}>
                {header}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* HTML Removal Options - Only show for selected Question/Answer columns */}
      {csvPreview.html_analysis && 
       ((mapping.question_column && csvPreview.html_analysis[mapping.question_column]) ||
        (mapping.answer_column && csvPreview.html_analysis[mapping.answer_column])) && (
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          bgcolor: 'grey.900', 
          border: '1px solid',
          borderColor: 'grey.700',
          borderRadius: 1
        }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'grey.300', mb: 2 }}>
            HTML Removal Options
          </Typography>
          
          {mapping.question_column && csvPreview.html_analysis[mapping.question_column] && (
            <Box sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={mapping.strip_html_from_question || false}
                    onChange={(e) => {
                      const newMapping = { ...mapping, strip_html_from_question: e.target.checked };
                      setMapping(newMapping);
                      onMappingChange(newMapping);
                    }}
                    sx={{ color: 'grey.400', '&.Mui-checked': { color: 'primary.main' } }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ color: 'grey.300' }}>
                      Remove HTML from Question Column: "{mapping.question_column}"
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'grey.500' }}>
                      {csvPreview.html_analysis[mapping.question_column].html_percentage}% of rows contain HTML 
                      ({csvPreview.html_analysis[mapping.question_column].rows_with_html} out of {csvPreview.html_analysis[mapping.question_column].sample_size} rows)
                    </Typography>
                    {csvPreview.html_analysis[mapping.question_column].recommended_action === 'recommend_strip' && (
                      <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5 }}>
                        Recommended: This column has significant HTML content
                      </Typography>
                    )}
                  </Box>
                }
                sx={{ alignItems: 'flex-start', width: '100%' }}
              />
            </Box>
          )}
          
          {mapping.answer_column && csvPreview.html_analysis[mapping.answer_column] && (
            <Box sx={{ mb: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={mapping.strip_html_from_answer || false}
                    onChange={(e) => {
                      const newMapping = { ...mapping, strip_html_from_answer: e.target.checked };
                      setMapping(newMapping);
                      onMappingChange(newMapping);
                    }}
                    sx={{ color: 'grey.400', '&.Mui-checked': { color: 'secondary.main' } }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ color: 'grey.300' }}>
                      Remove HTML from Answer Column: "{mapping.answer_column}"
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'grey.500' }}>
                      {csvPreview.html_analysis[mapping.answer_column].html_percentage}% of rows contain HTML 
                      ({csvPreview.html_analysis[mapping.answer_column].rows_with_html} out of {csvPreview.html_analysis[mapping.answer_column].sample_size} rows)
                    </Typography>
                    {csvPreview.html_analysis[mapping.answer_column].recommended_action === 'recommend_strip' && (
                      <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 0.5 }}>
                        Recommended: This column has significant HTML content
                      </Typography>
                    )}
                  </Box>
                }
                sx={{ alignItems: 'flex-start', width: '100%' }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Metadata Columns Display */}
      {mapping.metadata_columns.length > 0 && (
        <Box sx={{ mb: 3, flexShrink: 0 }}>
          <Typography variant="subtitle2" gutterBottom>
            Metadata Columns (will be stored with each question):
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {mapping.metadata_columns.map((column) => (
              <Chip key={column} label={column} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      )}

      {/* Data Preview */}
      <Typography variant="subtitle2" gutterBottom sx={{ flexShrink: 0 }}>
        Data Preview:
      </Typography>
      <TableContainer 
        component={Paper} 
        sx={{ 
          mb: 3, 
          flexGrow: 1,
          maxHeight: '40vh',
          minHeight: 200
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {csvPreview.headers.map((header) => (
                <TableCell 
                  key={header}
                  sx={{ 
                    verticalAlign: 'top',
                    padding: '12px',
                    maxWidth: 250
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {header}
                    </Typography>
                    {header === mapping.question_column && (
                      <Chip label="Question" size="small" color="primary" />
                    )}
                    {header === mapping.answer_column && (
                      <Chip label="Answer" size="small" color="secondary" />
                    )}
                    {header === mapping.priority_column && (
                      <Chip label="Priority" size="small" color="info" />
                    )}
                    {header === mapping.tags_column && (
                      <Chip label="Tags" size="small" color="success" />
                    )}
                    {mapping.metadata_columns.includes(header) && (
                      <Chip label="Metadata" size="small" color="default" />
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {csvPreview.sample_rows.map((row, index) => (
              <TableRow key={index}>
                {csvPreview.headers.map((header) => (
                  <TableCell 
                    key={header} 
                    sx={{ 
                      verticalAlign: 'top',
                      padding: '8px 12px',
                      maxWidth: 250
                    }}
                  >
                    <ExpandableText text={row[header] || ''} maxLength={80} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CSVColumnMapper;