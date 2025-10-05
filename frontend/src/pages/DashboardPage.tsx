import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  TrendingUp,
  Assessment,
  Storage,
  CheckCircle,
  Speed,
  Group,
  FilterList
} from '@mui/icons-material';
import { apiService } from '../services/api';
import {
  DashboardOverview,
  AgentPerformanceMetrics,
  RecentActivityItem,
  PerformanceTrend,
  ParameterPerformance,
  GoogleCloudProject
} from '../types';
import MetricCard from '../components/MetricCard';
import RecentActivityFeed from '../components/RecentActivityFeed';
import PerformanceChart from '../components/PerformanceChart';
import AgentPerformanceBreakdown from '../components/AgentPerformanceBreakdown';
import DataScopeIndicator from '../components/DataScopeIndicator';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      style={{ height: '100%' }}
    >
      {value === index && <Box sx={{ p: 0, height: '100%' }}>{children}</Box>}
    </div>
  );
}

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [availableProjects, setAvailableProjects] = useState<GoogleCloudProject[]>([]);
  
  // Data state
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformanceMetrics[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  const [parameterPerformance, setParameterPerformance] = useState<ParameterPerformance[]>([]);

  // Load available Google Cloud projects for filtering
  const loadAvailableProjects = async () => {
    try {
      const projects = await apiService.getGoogleCloudProjects();
      setAvailableProjects(projects);
    } catch (err) {
      console.error('Failed to load projects:', err);
      // Non-critical error - dashboard can still work without project filtering
    }
  };

  const loadDashboardData = async (projectFilter?: string) => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewData,
        agentsData,
        activityData,
        trendsData,
        parametersData
      ] = await Promise.all([
        apiService.getDashboardOverview(30, projectFilter),
        apiService.getAgentPerformance(10, projectFilter),
        apiService.getRecentActivity(15, projectFilter),
        apiService.getPerformanceTrends(30, projectFilter),
        apiService.getParameterPerformance(30, projectFilter)
      ]);

      setOverview(overviewData);
      setAgentPerformance(agentsData);
      setRecentActivity(activityData);
      setPerformanceTrends(trendsData);
      setParameterPerformance(parametersData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please check your Google Cloud access and try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (event: SelectChangeEvent<string>) => {
    const projectId = event.target.value;
    setSelectedProject(projectId);
    // Reload all dashboard data with the new project filter
    loadDashboardData(projectId || undefined);
  };

  useEffect(() => {
    loadAvailableProjects();
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor your Dialogflow agent performance and testing insights
        </Typography>
      </Box>

      {/* Data Scope Indicator */}
      {overview?.user_context && (
        <DataScopeIndicator userContext={overview.user_context} />
      )}

      {/* Project Filter for Admin Users */}
      {overview?.user_context?.has_admin_access && availableProjects.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="project-filter-label">Filter by Project</InputLabel>
            <Select
              labelId="project-filter-label"
              value={selectedProject}
              label="Filter by Project"
              onChange={handleProjectChange}
              startAdornment={<FilterList sx={{ mr: 1, color: 'text.secondary' }} />}
            >
              <MenuItem value="">
                <em>All Projects</em>
              </MenuItem>
              {availableProjects.map((project) => (
                <MenuItem key={project.project_id} value={project.project_id}>
                  {project.display_name} ({project.project_id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Overview Metrics Cards */}
      {overview && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Total Test Runs"
              value={overview.total_test_runs.toLocaleString()}
              subtitle={`${overview.last_30_days_tests} in last 30 days`}
              helpText="Total number of test runs executed across all time periods. Recent activity shows tests completed in the last 30 days."
              icon={<Assessment />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Agent Performance"
              value={`${(overview.average_agent_score ?? 0).toFixed(1)}%`}
              trend={overview.trending_score_change}
              trendPeriod="prev 30 days"
              helpText="Average score across all completed test runs. Scores are calculated using AI evaluation parameters including accuracy, completeness, and relevance. Trend shows change compared to the previous 30-day period."
              icon={<TrendingUp />}
              color="secondary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Success Rate"
              value={`${(overview.total_success_rate ?? 0).toFixed(1)}%`}
              subtitle="Tests scoring ≥70%"
              helpText="Percentage of completed test runs that achieved an average score of 70 points or higher. This threshold represents the minimum acceptable performance level for agent responses."
              icon={<CheckCircle />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Active Datasets"
              value={overview.active_datasets}
              subtitle={`${overview.total_questions_tested} questions tested`}
              helpText="Number of datasets that have been used in test runs during the selected time period. Total questions shows the volume of individual questions tested across all datasets."
              icon={<Storage />}
              color="warning"
            />
          </Grid>
        </Grid>
      )}

      {/* Tabs for different dashboard views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          aria-label="dashboard tabs"
        >
          <Tab
            icon={<DashboardIcon />}
            label="Overview"
            iconPosition="start"
          />
          <Tab
            icon={<TrendingUp />}
            label="Trends"
            iconPosition="start"
          />
          <Tab
            icon={<Group />}
            label="Agents"
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <TabPanel value={tabValue} index={0}>
        {/* Overview Tab */}
        <Grid container spacing={3} sx={{ height: 'calc(100vh - 350px)' }}>
          <Grid item xs={12} lg={8}>
            <PerformanceChart
              data={performanceTrends}
              title="Performance Trends"
              type="line"
              metric="score"
              height={400}
              helpText="Daily performance trends showing average agent scores over time. Higher scores indicate better agent performance across test runs."
            />
          </Grid>
          <Grid item xs={12} lg={4}>
            <RecentActivityFeed
              activities={recentActivity}
              title="Recent Activity"
              maxItems={10}
              helpText="Chronological list of recently completed test runs showing user, agent, status, and performance scores. Updates in real-time as new tests are executed."
            />
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Trends Tab */}
        <Grid container spacing={3} sx={{ height: 'calc(100vh - 350px)' }}>
          <Grid item xs={12} md={6}>
            <PerformanceChart
              data={performanceTrends}
              title="Average Score Trends"
              type="line"
              metric="score"
              height={350}
              helpText="Daily average scores calculated from AI evaluation parameters including accuracy, completeness, and relevance. Trends help identify performance patterns over time."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <PerformanceChart
              data={performanceTrends}
              title="Test Volume"
              type="bar"
              metric="count"
              height={350}
              helpText="Number of test runs executed per day. Higher volumes indicate increased testing activity and agent usage."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <PerformanceChart
              data={performanceTrends}
              title="Success Rate Trends"
              type="line"
              metric="success_rate"
              height={350}
              helpText="Daily percentage of test runs achieving scores ≥70%. This metric tracks the consistency of agent performance over time."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                height: 350,
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                p: 3,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Parameter Performance
              </Typography>
              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {parameterPerformance.map((param) => (
                  <Box
                    key={param.parameter_name}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1.5,
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {param.parameter_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {param.test_count} evaluations
                      </Typography>
                    </Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: (param.average_score ?? 0) >= 80 
                          ? 'success.main' 
                          : (param.average_score ?? 0) >= 60 
                            ? 'warning.main' 
                            : 'error.main'
                      }}
                    >
                      {(param.average_score ?? 0).toFixed(1)}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Agents Tab */}
        <Grid container spacing={3} sx={{ height: 'calc(100vh - 350px)' }}>
          <Grid item xs={12}>
            <AgentPerformanceBreakdown
              agents={agentPerformance}
              title="Agent Performance Analysis"
              maxAgents={10}
              helpText="Individual Dialogflow agent performance ranked by average score. Success rate shows percentage of test runs scoring ≥70%. Test count indicates total volume of tests executed for each agent."
            />
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default DashboardPage;
