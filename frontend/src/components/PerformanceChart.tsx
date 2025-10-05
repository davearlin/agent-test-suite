import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Tooltip as MuiTooltip,
  IconButton,
  useTheme
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import {
  Info as InfoIcon
} from '@mui/icons-material';
import { PerformanceTrend } from '../types';

interface PerformanceChartProps {
  data: PerformanceTrend[];
  title?: string;
  type?: 'line' | 'bar';
  metric?: 'score' | 'count' | 'success_rate';
  height?: number;
  helpText?: string;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  title = "Performance Trends",
  type = 'line',
  metric = 'score',
  height = 300,
  helpText
}) => {
  const theme = useTheme();

  const getMetricKey = () => {
    switch (metric) {
      case 'score':
        return 'average_score';
      case 'count':
        return 'test_count';
      case 'success_rate':
        return 'success_rate';
      default:
        return 'average_score';
    }
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'score':
        return 'Average Score (%)';
      case 'count':
        return 'Test Count';
      case 'success_rate':
        return 'Success Rate (%)';
      default:
        return 'Average Score (%)';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTooltipValue = (value: number) => {
    if (metric === 'count') {
      return `${value} tests`;
    }
    return `${(value ?? 0).toFixed(1)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            p: 2,
            boxShadow: theme.shadows[4]
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {formatDate(label)}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
            {getMetricLabel()}: {formatTooltipValue(payload[0].value)}
          </Typography>
          {payload[0].payload.test_count && metric !== 'count' && (
            <Typography variant="caption" color="text.secondary">
              {payload[0].payload.test_count} tests
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  const chartData = data.map(item => ({
    ...item,
    date: formatDate(item.date)
  }));

  const metricKey = getMetricKey();

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
              <MuiTooltip 
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
              </MuiTooltip>
            )}
          </Box>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            {getMetricLabel()}
          </Typography>
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0, height: `${height}px` }}>
        {chartData.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary'
            }}
          >
            <Typography variant="body2">No trend data available</Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {type === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme.palette.divider}
                />
                <XAxis 
                  dataKey="date" 
                  stroke={theme.palette.text.secondary}
                  fontSize={12}
                />
                <YAxis 
                  stroke={theme.palette.text.secondary}
                  fontSize={12}
                  domain={metric === 'count' ? [0, 'dataMax'] : [0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey={metricKey}
                  stroke={theme.palette.primary.main}
                  strokeWidth={3}
                  dot={{
                    fill: theme.palette.primary.main,
                    strokeWidth: 2,
                    r: 4
                  }}
                  activeDot={{
                    r: 6,
                    fill: theme.palette.primary.light
                  }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme.palette.divider}
                />
                <XAxis 
                  dataKey="date" 
                  stroke={theme.palette.text.secondary}
                  fontSize={12}
                />
                <YAxis 
                  stroke={theme.palette.text.secondary}
                  fontSize={12}
                  domain={metric === 'count' ? [0, 'dataMax'] : [0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={metricKey}
                  fill={theme.palette.primary.main}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;