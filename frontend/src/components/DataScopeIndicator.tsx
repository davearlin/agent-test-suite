import React from 'react';
import {
  Alert,
  Box,
  Chip,
  Typography,
  useTheme
} from '@mui/material';
import {
  AdminPanelSettings,
  Person,
  Group,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

interface DataScopeIndicatorProps {
  userContext: {
    user_role: string;
    data_scope: 'all_users' | 'user_only';
    user_email: string;
    has_admin_access: boolean;
    total_users_in_system: number;
    date_range_days: number;
  };
}

const DataScopeIndicator: React.FC<DataScopeIndicatorProps> = ({ userContext }) => {
  const theme = useTheme();

  const getScopeMessage = () => {
    if (userContext.data_scope === 'all_users') {
      return {
        title: 'System-wide Dashboard',
        message: `Viewing data from all ${userContext.total_users_in_system} users across all Google Cloud projects you have admin access to.`,
        severity: 'info' as const,
        icon: <Group />
      };
    } else {
      return {
        title: 'Personal Dashboard', 
        message: `Viewing only your test data and agents from Google Cloud projects accessible to ${userContext.user_email}.`,
        severity: 'warning' as const,
        icon: <Person />
      };
    }
  };

  const scope = getScopeMessage();

  return (
    <Alert
      severity={scope.severity}
      icon={scope.icon}
      sx={{
        mb: 3,
        '& .MuiAlert-message': {
          width: '100%'
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {scope.title}
          </Typography>
          <Typography variant="body2">
            {scope.message}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            icon={userContext.has_admin_access ? <AdminPanelSettings /> : <Person />}
            label={userContext.user_role.replace('_', ' ').toUpperCase()}
            size="small"
            color={userContext.has_admin_access ? 'primary' : 'default'}
            variant="outlined"
          />
          <Chip
            icon={userContext.data_scope === 'all_users' ? <Visibility /> : <VisibilityOff />}
            label={`${userContext.date_range_days} days`}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>
    </Alert>
  );
};

export default DataScopeIndicator;