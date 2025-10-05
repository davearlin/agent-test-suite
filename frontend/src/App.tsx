import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { store, RootState } from './store';
import { getCurrentUser } from './store/authSlice';
import { useAppDispatch, useAppSelector } from './hooks/redux';

// Components
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import DatasetsPage from './pages/DatasetsPage';
import EditDatasetPage from './pages/EditDatasetPage';
import ManageQuestionsPage from './pages/ManageQuestionsPage';
import EditQuestionPage from './pages/EditQuestionPage';
import BulkAddQuestionsPage from './pages/BulkAddQuestionsPage';
import TestRunsPage from './pages/TestRunsPage';
import CreateTestRunPage from './pages/CreateTestRunPage';
import TestRunDetailPage from './pages/TestRunDetailPage';
import QuickTestPage from './pages/QuickTestPage';
import SessionParametersPage from './pages/SessionParametersPage';
import EvaluationManagementPage from './pages/EvaluationManagementPage';
import EditEvaluationParameterPage from './pages/EditEvaluationParameterPage';

// Dark theme configuration with custom branding
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0066CC', // Primary blue
      light: '#3385D6',
      dark: '#004499',
    },
    secondary: {
      main: '#00A651', // Secondary green accent
      light: '#33B76B',
      dark: '#007538',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    // Inter (open-source) used as default; swap in licensed brand font later if desired
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: 'var(--app-font-stack)',
        },
      },
    },
  },
});

function AppContent() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state: RootState) => state.auth);
  
  // Check for token in localStorage for immediate auth status
  const hasToken = localStorage.getItem('access_token');
  const isUserAuthenticated = isAuthenticated || !!hasToken;

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('access_token');
    if (token && !isAuthenticated) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, isAuthenticated]);

  if (loading) {
    return <div>Loading...</div>; // Replace with proper loading component
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={isUserAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />} 
        />
        <Route
          path="/dashboard"
          element={
            isUserAuthenticated ? (
              <Layout>
                <DashboardPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/datasets"
          element={
            isUserAuthenticated ? (
              <Layout>
                <DatasetsPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/datasets/:id/edit"
          element={
            isUserAuthenticated ? (
              <Layout>
                <EditDatasetPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/datasets/:id/questions"
          element={
            isUserAuthenticated ? (
              <Layout>
                <ManageQuestionsPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/datasets/:datasetId/questions/add"
          element={
            isUserAuthenticated ? (
              <Layout>
                <EditQuestionPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/datasets/:datasetId/questions/:questionId/edit"
          element={
            isUserAuthenticated ? (
              <Layout>
                <EditQuestionPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/datasets/:id/questions/bulk-add"
          element={
            isUserAuthenticated ? (
              <Layout>
                <BulkAddQuestionsPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/test-runs"
          element={
            isUserAuthenticated ? (
              <Layout>
                <TestRunsPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/test-runs/create"
          element={
            isUserAuthenticated ? (
              <Layout>
                <CreateTestRunPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/test-runs/:id"
          element={
            isUserAuthenticated ? (
              <Layout>
                <TestRunDetailPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/quick-test"
          element={
            isUserAuthenticated ? (
              <Layout>
                <QuickTestPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/session-parameters"
          element={
            isUserAuthenticated ? (
              <Layout>
                <SessionParametersPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/evaluation-management"
          element={
            isUserAuthenticated ? (
              <Layout>
                <EvaluationManagementPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/evaluation-management/edit/:id"
          element={
            isUserAuthenticated ? (
              <Layout>
                <EditEvaluationParameterPage />
              </Layout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <AppContent />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
