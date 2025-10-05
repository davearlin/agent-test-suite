import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  Chip,
  Box,
  Typography,
  Tooltip,
  IconButton,
  useTheme,
  Avatar
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  Error,
  Cancel,
  Schedule,
  Info as InfoIcon
} from '@mui/icons-material';
import { RecentActivityItem } from '../types';

interface RecentActivityFeedProps {
  activities: RecentActivityItem[];
  title?: string;
  maxItems?: number;
  helpText?: string;
}

const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  title = "Recent Activity",
  maxItems = 10,
  helpText
}) => {
  const theme = useTheme();

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'running':
        return <PlayArrow color="primary" />;
      case 'failed':
        return <Error color="error" />;
      case 'cancelled':
        return <Cancel color="warning" />;
      default:
        return <Schedule color="action" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'running':
        return 'primary';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'default';
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    }
  };

  const displayActivities = activities.slice(0, maxItems);

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
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0, height: 'calc(100% - 72px)', overflow: 'auto' }}>
        {displayActivities.length === 0 ? (
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
            <Schedule sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">No recent activity</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {displayActivities.map((activity) => (
              <ListItem
                key={`${activity.type}-${activity.id}`}
                sx={{
                  px: 0,
                  py: 1.5,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  '&:last-child': { borderBottom: 'none' }
                }}
              >
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    mr: 2,
                    bgcolor: 'transparent',
                    border: `2px solid ${theme.palette.divider}`
                  }}
                >
                  {getStatusIcon(activity.status)}
                </Avatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {activity.name}
                      </Typography>
                      <Chip
                        label={activity.status}
                        size="small"
                        color={getStatusColor(activity.status) as any}
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {activity.agent_name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(activity.created_at)}
                        </Typography>
                        {activity.created_by_name && (
                          <Typography variant="caption" color="text.secondary">
                            by {activity.created_by_name}
                          </Typography>
                        )}
                        {activity.score !== undefined && activity.score !== null && (
                          <Chip
                            label={`${activity.score.toFixed(1)}%`}
                            size="small"
                            color={getScoreColor(activity.score) as any}
                            sx={{ fontSize: '0.7rem', height: 18 }}
                          />
                        )}
                        {activity.duration_minutes && (
                          <Typography variant="caption" color="text.secondary">
                            {(activity.duration_minutes ?? 0).toFixed(1)}m
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityFeed;