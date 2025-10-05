import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Tooltip,
  IconButton,
  useTheme
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Info as InfoIcon
} from '@mui/icons-material';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendPeriod?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  helpText?: string; // New prop for contextual help
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendPeriod = '30 days',
  color = 'primary',
  icon,
  helpText
}) => {
  const theme = useTheme();

  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <TrendingFlat />;
    return trend > 0 ? <TrendingUp /> : <TrendingDown />;
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return 'default';
    return trend > 0 ? 'success' : 'error';
  };

  const formatTrend = () => {
    if (trend === undefined || trend === null) return null;
    const sign = trend > 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
  };

  return (
    <Card
      sx={{
        height: '100%',
        background: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}
            >
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
                      color: `${color}.main`,
                      backgroundColor: 'transparent'
                    }
                  }}
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {icon && (
            <Box sx={{ color: `${color}.main`, opacity: 0.8 }}>
              {icon}
            </Box>
          )}
        </Box>

        <Typography
          variant="h3"
          component="div"
          sx={{
            fontWeight: 700,
            color: `${color}.main`,
            mb: 1,
            lineHeight: 1.2
          }}
        >
          {value}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subtitle}
          </Typography>
        )}

        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <Chip
              icon={getTrendIcon()}
              label={formatTrend()}
              size="small"
              color={getTrendColor()}
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              vs {trendPeriod}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricCard;