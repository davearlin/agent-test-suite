import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Tooltip,
  IconButton,
  useTheme,
  Divider,
  Grid
} from '@mui/material';
import {
  TrendingUp,
  Schedule,
  Assessment,
  Info as InfoIcon
} from '@mui/icons-material';
import { AgentPerformanceMetrics } from '../types';

interface AgentPerformanceBreakdownProps {
  agents: AgentPerformanceMetrics[];
  title?: string;
  maxAgents?: number;
  helpText?: string;
}

const AgentPerformanceBreakdown: React.FC<AgentPerformanceBreakdownProps> = ({
  agents,
  title = "Agent Performance Breakdown",
  maxAgents = 5,
  helpText
}) => {
  const theme = useTheme();

  const getScoreColor = (score: number) => {
    if (score >= 80) return theme.palette.success.main;
    if (score >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayAgents = agents.slice(0, maxAgents);

  return (
    <Card
      sx={{
        height: '100%',
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            {helpText && (
              <Tooltip 
                title={helpText}
                arrow
                placement="top"
                sx={{ 
                  '& .MuiTooltip-tooltip': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                    fontSize: '0.875rem',
                    maxWidth: 300,
                    lineHeight: 1.4
                  },
                  '& .MuiTooltip-arrow': {
                    color: theme.palette.background.paper,
                    '&::before': {
                      border: `1px solid ${theme.palette.divider}`,
                    }
                  }
                }}
              >
                <IconButton
                  size="small"
                  sx={{ 
                    p: 0.25,
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'primary.main',
                      backgroundColor: 'transparent'
                    }
                  }}
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            Top performing agents by average score
          </Typography>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0, height: 'calc(100% - 88px)', overflow: 'auto' }}>
        {displayAgents.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: 'text.secondary'
            }}
          >
            <Assessment sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">No agent performance data</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {displayAgents.map((agent, index) => (
              <Box key={agent.agent_id || index}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {agent.agent_display_name}
                  </Typography>
                  <Chip
                    label={`${(agent.average_score ?? 0).toFixed(1)}%`}
                    size="small"
                    sx={{
                      bgcolor: getScoreColor(agent.average_score ?? 0),
                      color: 'white',
                      fontWeight: 600
                    }}
                  />
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={agent.average_score}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    mb: 2,
                    bgcolor: theme.palette.grey[800],
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getScoreColor(agent.average_score),
                      borderRadius: 4
                    }
                  }}
                />

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {agent.total_tests}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tests
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                        {(agent.success_rate ?? 0).toFixed(1)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Success Rate
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                        <Schedule sx={{ fontSize: 14 }} />
                        {formatDate(agent.last_test_date)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {Object.keys(agent.parameter_scores).length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Parameter Breakdown:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {Object.entries(agent.parameter_scores).map(([param, score]) => (
                        <Chip
                          key={param}
                          label={`${param}: ${(score ?? 0).toFixed(1)}%`}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.7rem',
                            height: 22,
                            borderColor: getScoreColor(score ?? 0),
                            color: getScoreColor(score ?? 0)
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {index < displayAgents.length - 1 && (
                  <Divider sx={{ mt: 3 }} />
                )}
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentPerformanceBreakdown;