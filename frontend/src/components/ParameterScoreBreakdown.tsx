import React, { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Divider,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { TestResultParameterScore } from '../types';

interface ParameterScoreBreakdownProps {
  overallScore?: number;
  similarityScore?: number; // Legacy score for backward compatibility
  parameterScores?: TestResultParameterScore[];
  showExpandable?: boolean;
  size?: 'small' | 'medium';
}

const ParameterScoreBreakdown: React.FC<ParameterScoreBreakdownProps> = ({
  overallScore,
  similarityScore,
  parameterScores = [],
  showExpandable = true,
  size = 'small'
}) => {
  const [expanded, setExpanded] = useState(false);

  // Compute overall score from parameter scores if not provided
  const computedOverallScore = React.useMemo(() => {
    if (!parameterScores || parameterScores.length === 0) return undefined;
    
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    parameterScores.forEach(ps => {
      if (ps.score != null && ps.weight_used != null) {
        totalWeightedScore += ps.score * ps.weight_used;
        totalWeight += ps.weight_used;
      }
    });
    
    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : undefined;
  }, [parameterScores]);
  
  // Determine which score to display - priority: parameter-computed > overall > similarity
  const displayScore = computedOverallScore ?? overallScore ?? similarityScore;
  const hasParameterBreakdown = parameterScores && parameterScores.length > 0;
  const isLegacyScore = computedOverallScore === undefined && overallScore === undefined && similarityScore !== undefined;

  // Calculate score color for chips
  const getScoreColor = (score?: number) => {
    if (score === undefined || score === null) return 'default';
    return score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
  };

  // Calculate score color for progress bars
  const getProgressColor = (score: number) => {
    return score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
  };

  // Calculate weighted contribution for each parameter
  const calculateWeightedContribution = (score: number, weight: number) => {
    return (score * weight) / 100;
  };

  if (displayScore === undefined || displayScore === null) {
    return <Typography variant="body2" color="text.secondary">N/A</Typography>;
  }

  const scoreChip = (
    <Chip 
      label={`${displayScore}%`}
      size={size}
      color={getScoreColor(displayScore)}
      icon={isLegacyScore ? <InfoIcon fontSize="small" /> : undefined}
    />
  );

  if (!hasParameterBreakdown || !showExpandable) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {scoreChip}
        {isLegacyScore && (
          <Tooltip title="This score was calculated using the legacy similarity method">
            <Typography variant="caption" color="text.secondary">
              (Legacy)
            </Typography>
          </Tooltip>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {scoreChip}
        <Tooltip title={expanded ? "Hide parameter breakdown" : "Show parameter breakdown"}>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ p: 0.5 }}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        {isLegacyScore && (
          <Tooltip title="This score was calculated using the legacy similarity method">
            <Typography variant="caption" color="text.secondary">
              (Legacy)
            </Typography>
          </Tooltip>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2, mb: 1 }}>
          {isLegacyScore ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              This result was scored using the legacy similarity method. Parameter breakdown is not available.
            </Alert>
          ) : (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Parameter Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parameter</TableCell>
                      <TableCell align="center">Score</TableCell>
                      <TableCell align="center">Weight</TableCell>
                      <TableCell align="center">Contribution</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parameterScores.map((paramScore) => {
                      const contribution = calculateWeightedContribution(paramScore.score, paramScore.weight_used);
                      return (
                        <TableRow key={paramScore.id}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {paramScore.parameter?.name || `Parameter ${paramScore.parameter_id}`}
                              </Typography>
                              {paramScore.parameter?.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {paramScore.parameter.description}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ minWidth: 60 }}>
                              <Typography variant="body2" fontWeight="bold">
                                {paramScore.score}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={paramScore.score}
                                color={getProgressColor(paramScore.score)}
                                sx={{ height: 4, borderRadius: 2 }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">
                              {paramScore.weight_used}%
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="medium">
                              {(contribution ?? 0).toFixed(1)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {/* Calculation Summary */}
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Overall Score = Σ (Parameter Score × Weight / 100)
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    {parameterScores.map((ps, index) => (
                      <span key={ps.id}>
                        {index > 0 && ' + '}
                        {ps.score}% × {ps.weight_used}%
                      </span>
                    ))}
                    {' = '}
                    <strong>{displayScore}%</strong>
                  </Typography>
                </Box>
              </Box>

              {/* Parameter Reasoning */}
              {parameterScores.some(ps => ps.reasoning) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Parameter Reasoning
                  </Typography>
                  {parameterScores
                    .filter(ps => ps.reasoning)
                    .map((paramScore) => (
                      <Box key={paramScore.id} sx={{ mb: 1 }}>
                        <Typography variant="caption" fontWeight="medium" color="text.secondary">
                          {paramScore.parameter?.name || `Parameter ${paramScore.parameter_id}`}:
                        </Typography>
                        <Typography variant="body2" sx={{ ml: 1, fontStyle: 'italic' }}>
                          {paramScore.reasoning}
                        </Typography>
                      </Box>
                    ))}
                </>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default ParameterScoreBreakdown;