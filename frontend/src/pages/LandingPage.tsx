import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Paper,
  Stack,
  IconButton,
  Fade,
  Divider,
} from '@mui/material';
import {
  Google as GoogleIcon,
  Psychology as PsychologyIcon,
  Speed as SpeedIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  CloudQueue as CloudIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { apiService } from '../services/api';

interface AuthStatus {
  authenticated: boolean;
  user: string | null;
  role: string | null;
  google_oauth_configured: boolean;
}

const LandingPage: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for OAuth token in URL first
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      // Add a small delay to ensure token is stored before checking status
      setTimeout(() => {
        checkAuthStatus();
      }, 100);
      return;
    }
    
    // Only check auth status if there's no token to process
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const status = await apiService.getAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const response = await apiService.initiateGoogleLogin();
      window.location.href = response.authorization_url;
    } catch (err: any) {
      console.error('Google login failed:', err);
      alert(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <PsychologyIcon sx={{ fontSize: 40, color: '#0066CC' }} />, // blue
      title: 'Response Quality Testing',
      description: 'Test and validate the quality of responses from the Dialogflow CX agent with detailed analysis.'
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 40, color: '#0066CC' }} />,
      title: 'Bulk Question Testing',
      description: 'Run large datasets of questions through the agent simultaneously for comprehensive testing coverage.'
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 40, color: '#0066CC' }} />,
      title: 'Historical Results',
      description: 'View and analyze historical test results to track agent performance improvements over time.'
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40, color: '#0066CC' }} />,
      title: 'Dataset Management',
      description: 'Create, organize, and manage collections of test questions for different scenarios and use cases.'
    },
    {
      icon: <CloudIcon sx={{ fontSize: 40, color: '#0066CC' }} />,
      title: 'Agent Integration',
      description: 'Direct integration with the Dialogflow CX agents for real-time testing and validation.'
    },
    {
      icon: <AutoAwesomeIcon sx={{ fontSize: 40, color: '#0066CC' }} />,
      title: 'Quick Test Interface',
      description: 'Instantly test individual questions against the agent for rapid iteration and debugging.'
    }
  ];

  if (authStatus?.authenticated) {
    // Redirect to dashboard if authenticated
    window.location.href = '/dashboard';
    return null;
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0066CC 0%, #004499 100%)', // blue gradient
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decoration */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(10px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -100,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
        }}
      />

      <Container maxWidth="lg" sx={{ pt: 8, pb: 6, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Fade in timeout={1000}>
          <Box textAlign="center" mb={8}>
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 800,
                color: 'white',
                mb: 2,
                fontSize: { xs: '2.5rem', md: '3.5rem' }
              }}
            >
              Dialogflow Agent Tester
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255, 255, 255, 0.9)',
                mb: 4,
                maxWidth: 700,
                mx: 'auto',
                fontWeight: 300
              }}
            >
              Test response quality from the Dialogflow CX agent, manage question datasets, and analyze historical results
            </Typography>
            
            <Stack direction="row" spacing={1} justifyContent="center" mb={4} flexWrap="wrap" useFlexGap>
              <Chip label="✓ Bulk Testing" variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', fontWeight: 500, mb: 1 }} />
              <Chip label="✓ Dataset Management" variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', fontWeight: 500, mb: 1 }} />
              <Chip label="✓ Historical Analytics" variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', fontWeight: 500, mb: 1 }} />
              <Chip label="✓ Quick Testing" variant="outlined" sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)', fontWeight: 500, mb: 1 }} />
            </Stack>

            {authStatus?.google_oauth_configured ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleLogin}
                disabled={loading}
                sx={{
                  bgcolor: 'white',
                  color: '#0066CC', // blue
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.95)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {loading ? 'Connecting...' : 'Sign in with Google'}
              </Button>
            ) : (
              <Paper sx={{ 
                p: 3, 
                bgcolor: 'rgba(255,255,255,0.95)', 
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 2
              }}>
                <Typography color="#0066CC" variant="h6" gutterBottom fontWeight={600}>
                  🔧 Setup Required
                </Typography>
                <Typography color="#333" variant="body1" sx={{ mb: 2 }}>
                  Google OAuth needs to be configured by your administrator.
                </Typography>
                <Typography color="#666" variant="body2">
                  Please follow the setup guide in <code>GOOGLE_OAUTH_SETUP.md</code> to enable Google authentication.
                </Typography>
              </Paper>
            )}
          </Box>
        </Fade>

        {/* Features Grid */}
        <Fade in timeout={1500}>
          <Grid container spacing={4} sx={{ mt: 8 }}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.98)', // Better opacity for text readability
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 3,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', // Static shadow instead of hover effect
                  }}
                >
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Box mb={2}>
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#1a1a1a' }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#4a4a4a', lineHeight: 1.6 }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Fade>

        {/* Additional Info */}
        <Fade in timeout={2000}>
          <Box textAlign="center" mt={10}>
            <Divider sx={{ bgcolor: 'rgba(255,255,255,0.2)', mb: 6 }} />
            <Typography variant="h4" gutterBottom sx={{ color: 'white', fontWeight: 600 }}>
              Key Benefits
            </Typography>
            <Grid container spacing={4} sx={{ mt: 4 }}>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>Quality Assurance</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Ensure consistent, high-quality responses from your Dialogflow agent across all customer interactions.
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>Efficient Testing</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Test hundreds of questions at once and manage comprehensive datasets for thorough agent validation.
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>Performance Tracking</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Monitor agent improvements over time with detailed historical results and performance metrics.
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
};

export default LandingPage;