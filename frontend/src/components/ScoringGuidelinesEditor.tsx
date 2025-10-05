import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

interface ScoreRange {
  id: string;
  minScore: number;
  maxScore: number;
  description: string;
}

interface ScoringGuidelinesEditorProps {
  value: string;
  onChange: (guidelines: string) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  parameterName?: string;
}

const ScoringGuidelinesEditor: React.FC<ScoringGuidelinesEditorProps> = ({
  value,
  onChange,
  onValidationChange,
  parameterName = 'New Parameter',
}) => {
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const isInitialLoad = useRef(true);
  const isUpdatingFromProps = useRef(false);

  // Initialize with default ranges or parse existing value
  useEffect(() => {
    // Skip if we're in the middle of updating from user interaction
    if (isUpdatingFromProps.current) {
      return;
    }

    if (value.trim()) {
      // Try to parse existing guidelines
      const parsed = parseGuidelinesText(value);
      if (parsed.length > 0) {
        isUpdatingFromProps.current = true;
        setScoreRanges(parsed);
        isInitialLoad.current = false;
        // Reset flag after state update
        setTimeout(() => {
          isUpdatingFromProps.current = false;
        }, 0);
        return;
      }
    }

    // Default to complete 5 ranges covering 0-100 only on initial load
    if (isInitialLoad.current) {
      const defaultRanges = [
        { id: '1', minScore: 90, maxScore: 100, description: 'Excellent - meets all criteria perfectly' },
        { id: '2', minScore: 70, maxScore: 89, description: 'Good - meets most criteria with minor issues' },
        { id: '3', minScore: 50, maxScore: 69, description: 'Average - meets some criteria but has gaps' },
        { id: '4', minScore: 30, maxScore: 49, description: 'Poor - meets few criteria, significant issues' },
        { id: '5', minScore: 0, maxScore: 29, description: 'Very Poor - fails to meet criteria' },
      ];
      isUpdatingFromProps.current = true;
      setScoreRanges(defaultRanges);
      isInitialLoad.current = false;
      // Immediately notify parent of default content
      const defaultText = formatScoreRangesToText(defaultRanges);
      onChange(defaultText);
      // Reset flag after state update
      setTimeout(() => {
        isUpdatingFromProps.current = false;
      }, 0);
    }
  }, [value]);

  // Convert score ranges to text format whenever they change from user interaction
  useEffect(() => {
    if (!isInitialLoad.current && !isUpdatingFromProps.current) {
      const guidelinesText = formatScoreRangesToText(scoreRanges);
      onChange(guidelinesText);
    }
  }, [scoreRanges, onChange]);

  const parseGuidelinesText = (text: string): ScoreRange[] => {
    // Handle both Windows (\r\n) and Unix (\n) line endings
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const ranges: ScoreRange[] = [];
    
    lines.forEach((line, index) => {
      // Clean the line of any remaining carriage returns and whitespace
      const cleanLine = line.replace(/\r/g, '').trim();
      
      // More flexible regex to handle various formats
      const match = cleanLine.match(/^[\s\-\*]*(\d+)[\s\-]+(\d+):\s*(.+)$/);
      if (match) {
        const [, minStr, maxStr, description] = match;
        ranges.push({
          id: `parsed-${index}`,
          minScore: parseInt(minStr),
          maxScore: parseInt(maxStr),
          description: description.trim(),
        });
      }
    });
    
    return ranges.sort((a, b) => b.minScore - a.minScore); // Sort by score descending
  };

  const formatScoreRangesToText = (ranges: ScoreRange[]): string => {
    return ranges
      .sort((a, b) => b.minScore - a.minScore) // Sort by score descending
      .map(range => `- ${range.minScore}-${range.maxScore}: ${range.description}`)
      .join('\n');
  };

  const validateRanges = (): string[] => {
    const newErrors: string[] = [];
    
    if (scoreRanges.length === 0) {
      newErrors.push('At least one score range is required');
      return newErrors;
    }

    // Check for invalid ranges first
    scoreRanges.forEach((range, index) => {
      if (range.minScore < 0 || range.maxScore > 100) {
        newErrors.push(`Range ${index + 1}: Scores must be between 0 and 100`);
      }
      if (range.minScore >= range.maxScore) {
        newErrors.push(`Range ${index + 1}: Minimum score must be less than maximum score`);
      }
      if (!range.description.trim()) {
        newErrors.push(`Range ${index + 1}: Description is required`);
      } else if (range.description.trim().length < 10) {
        newErrors.push(`Range ${index + 1}: Description must be at least 10 characters`);
      }
    });

    // Sort ranges by minScore for overlap and gap checking
    const sortedRanges = [...scoreRanges].sort((a, b) => a.minScore - b.minScore);
    
    // Check for overlapping ranges
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      const current = sortedRanges[i];
      const next = sortedRanges[i + 1];
      
      // Check for overlap: current max overlaps with next min
      if (current.maxScore >= next.minScore) {
        newErrors.push(`Score ranges overlap: ${current.minScore}-${current.maxScore} overlaps with ${next.minScore}-${next.maxScore}`);
      }
    }

    // Check for gaps in coverage
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      const current = sortedRanges[i];
      const next = sortedRanges[i + 1];
      
      // Check for gap: current max + 1 should equal next min
      if (current.maxScore + 1 < next.minScore) {
        const gapStart = current.maxScore + 1;
        const gapEnd = next.minScore - 1;
        newErrors.push(`Gap in coverage: scores ${gapStart}-${gapEnd} are not covered by any range`);
      }
    }

    // Check if 0 and 100 are covered
    const minCovered = Math.min(...sortedRanges.map(r => r.minScore));
    const maxCovered = Math.max(...sortedRanges.map(r => r.maxScore));
    
    if (minCovered > 0) {
      newErrors.push(`Scores 0-${minCovered - 1} are not covered by any range`);
    }
    
    if (maxCovered < 100) {
      newErrors.push(`Scores ${maxCovered + 1}-100 are not covered by any range`);
    }

    return newErrors;
  };

  const calculateCoverage = (ranges: ScoreRange[]): number => {
    const covered = new Set<number>();
    ranges.forEach(range => {
      for (let i = range.minScore; i <= range.maxScore; i++) {
        covered.add(i);
      }
    });
    return (covered.size / 101) * 100; // 0-100 is 101 numbers
  };

  const addRange = () => {
    const newId = Date.now().toString();
    const existingScores = scoreRanges.flatMap(r => [r.minScore, r.maxScore]);
    const maxExisting = Math.max(...existingScores, -1);
    const minExisting = Math.min(...existingScores, 101);
    
    // Try to find a gap to place the new range
    let newMin = Math.max(0, maxExisting + 1);
    let newMax = Math.min(100, newMin + 9);
    
    // If no room above, try below
    if (newMax > 100) {
      newMax = Math.max(0, minExisting - 1);
      newMin = Math.max(0, newMax - 9);
    }

    const newRange: ScoreRange = {
      id: newId,
      minScore: newMin,
      maxScore: newMax,
      description: 'Enter description for this score range',
    };

    setScoreRanges([...scoreRanges, newRange]);
  };

  const removeRange = (id: string) => {
    setScoreRanges(scoreRanges.filter(range => range.id !== id));
  };

  const updateRange = (id: string, updates: Partial<ScoreRange>) => {
    setScoreRanges(scoreRanges.map(range => 
      range.id === id ? { ...range, ...updates } : range
    ));
  };

  // Validate on changes
  useEffect(() => {
    const validationErrors = validateRanges();
    setErrors(validationErrors);
    
    // Notify parent of validation state
    if (onValidationChange) {
      onValidationChange(validationErrors.length === 0, validationErrors);
    }
  }, [scoreRanges, onValidationChange]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Scoring Guidelines
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Define score ranges (0-100) with clear criteria for each range
          </Typography>
        </Box>
        <Button
          startIcon={<AddIcon />}
          onClick={addRange}
          variant="contained"
          sx={{
            backgroundColor: '#1976d2',
            '&:hover': {
              backgroundColor: '#1565c0',
            }
          }}
        >
          Add Range
        </Button>
      </Box>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {scoreRanges
          .sort((a, b) => b.minScore - a.minScore) // Display in descending order
          .map((range, index) => (
          <Paper 
            key={range.id} 
            variant="outlined" 
            sx={{ 
              p: 3,
              backgroundColor: '#1e1e1e',
              border: '1px solid #333333',
              borderRadius: 2,
              '&:hover': {
                border: '1px solid #444444',
              }
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              {/* Score Range Inputs */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                gap: 1,
                minWidth: '120px',
                flexShrink: 0
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  backgroundColor: '#2d2d2d',
                  border: '1px solid #404040',
                  borderRadius: 1,
                  px: 2,
                  py: 1.5,
                }}>
                  <TextField
                    value={range.minScore}
                    onChange={(e) => updateRange(range.id, { 
                      minScore: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                    })}
                    type="number"
                    variant="standard"
                    inputProps={{ 
                      min: 0, 
                      max: 100,
                      step: 1,
                      style: { 
                        textAlign: 'center',
                        width: '40px',
                        color: '#ffffff',
                        fontSize: '1.1rem',
                        fontWeight: 'bold'
                      }
                    }}
                    InputProps={{
                      disableUnderline: true,
                    }}
                    sx={{
                      '& .MuiInput-input': {
                        color: '#ffffff',
                        textAlign: 'center',
                      }
                    }}
                  />
                  <Typography variant="body1" sx={{ color: '#cccccc', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    -
                  </Typography>
                  <TextField
                    value={range.maxScore}
                    onChange={(e) => updateRange(range.id, { 
                      maxScore: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                    })}
                    type="number"
                    variant="standard"
                    inputProps={{ 
                      min: 0, 
                      max: 100,
                      step: 1,
                      style: { 
                        textAlign: 'center',
                        width: '40px',
                        color: '#ffffff',
                        fontSize: '1.1rem',
                        fontWeight: 'bold'
                      }
                    }}
                    InputProps={{
                      disableUnderline: true,
                    }}
                    sx={{
                      '& .MuiInput-input': {
                        color: '#ffffff',
                        textAlign: 'center',
                      }
                    }}
                  />
                </Box>
                
                {/* Range Badge - moved below inputs */}
                <Box sx={{
                  backgroundColor: index === 0 ? '#1b5e20' : 
                                  index === 1 ? '#2e7d32' :
                                  index === 2 ? '#ed6c02' :
                                  index === 3 ? '#d32f2f' : '#424242',
                  color: 'white',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  {range.maxScore - range.minScore + 1} pts
                </Box>
              </Box>

              {/* Description */}
              <TextField
                value={range.description}
                onChange={(e) => updateRange(range.id, { description: e.target.value })}
                placeholder="Describe what this score range represents"
                fullWidth
                multiline
                maxRows={3}
                variant="outlined"
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2d2d2d',
                    '& fieldset': {
                      borderColor: '#404040',
                    },
                    '&:hover fieldset': {
                      borderColor: '#555555',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1976d2',
                    },
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#ffffff',
                  },
                  '& .MuiInputLabel-root': {
                    color: '#cccccc',
                  },
                }}
              />

              {/* Delete Button */}
              <Button
                onClick={() => removeRange(range.id)}
                disabled={scoreRanges.length <= 1}
                variant="outlined"
                color="error"
                size="small"
                sx={{ 
                  minWidth: '40px',
                  width: '40px',
                  height: '40px',
                  alignSelf: 'center',
                  flexShrink: 0,
                  '&.Mui-disabled': {
                    opacity: 0.3,
                  }
                }}
              >
                <DeleteIcon fontSize="small" />
              </Button>
            </Box>
          </Paper>
        ))}
      </Box>

      <Box sx={{ 
        mt: 3, 
        p: 2, 
        backgroundColor: '#1e1e1e',
        border: '1px solid #333333',
        borderRadius: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="body2" color="text.secondary">
          Total Coverage: <strong>{Math.round(calculateCoverage(scoreRanges))}%</strong> of 0-100 scale
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {scoreRanges.length} range{scoreRanges.length !== 1 ? 's' : ''} defined
        </Typography>
      </Box>
    </Box>
  );
};

export default ScoringGuidelinesEditor;