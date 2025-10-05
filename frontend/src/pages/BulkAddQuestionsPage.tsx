import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  TextField,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchDataset, addQuestion } from '../store/datasetsSlice';
import CSVColumnMapper from '../components/CSVColumnMapper';
import { apiService } from '../services/api';

interface CSVPreview {
  headers: string[];
  sample_rows: Record<string, string>[];
  total_rows: number;
  html_analysis?: Record<string, any> | null;
}

interface ColumnMapping {
  question_column: string;
  answer_column: string;
  empathy_column?: string;
  no_match_column?: string;
  priority_column?: string;
  tags_column?: string;
  metadata_columns: string[];
  strip_html_from_question?: boolean;
  strip_html_from_answer?: boolean;
}

const BulkAddQuestionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentDataset, loading, error } = useAppSelector(state => state.datasets);

  // CSV functionality state
  const [bulkAddMode, setBulkAddMode] = useState<'text' | 'csv'>('text');
  const [bulkText, setBulkText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState(0);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isCsvLoading, setIsCsvLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      dispatch(fetchDataset(parseInt(id)));
    }
  }, [dispatch, id]);

  const handleBackToQuestions = () => {
    navigate(`/datasets/${id}/questions`);
  };

  const handleBackToFileSelection = () => {
    setImportStep(0);
    setCsvPreview(null);
    setColumnMapping(null);
    setImportError(null);
    setImportProgress(null);
  };

  const handleChooseDifferentFile = () => {
    setImportFile(null);
    setCsvPreview(null);
    setColumnMapping(null);
    setImportStep(0);
    setImportError(null);
    setImportProgress(null);
    // Reset the file input element
    const fileInput = document.getElementById('csv-upload-bulk') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleBulkSave = async () => {
    if (!id || !bulkText.trim()) return;

    const lines = bulkText.trim().split('\n');
    const questions = lines.map(line => {
      const parts = line.split('|').map(part => part.trim());
      return {
        question_text: parts[0] || '',
        expected_answer: parts[1] || '',
        detect_empathy: parts[2]?.toLowerCase() === 'true' || false,
        no_match: parts[3]?.toLowerCase() === 'true' || false,
        priority: parts[4] || 'medium',
        tags: parts[5] ? parts[5].split(',').map(tag => tag.trim()) : []
      };
    });

    try {
      for (const questionData of questions) {
        await dispatch(addQuestion({ 
          datasetId: parseInt(id), 
          question_text: questionData.question_text,
          expected_answer: questionData.expected_answer,
          detect_empathy: questionData.detect_empathy,
          no_match: questionData.no_match,
          priority: questionData.priority as 'high' | 'medium' | 'low',
          tags: questionData.tags
        }));
      }
      handleBackToQuestions();
    } catch (error) {
      console.error('Error adding bulk questions:', error);
    }
  };

  const handleFileSelect = (file: File) => {
    setImportFile(file);
    // Reset any previous preview and mapping
    setCsvPreview(null);
    setColumnMapping(null);
  };

  const handleCsvPreview = async (file: File) => {
    if (!file || !id) return;
    
    setIsCsvLoading(true);
    setImportError(null);

    // Check file size before uploading
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setImportError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${maxSize / 1024 / 1024}MB)`);
      setIsCsvLoading(false);
      return;
    }

    try {
      const preview = await apiService.previewCsv(parseInt(id), file);
      setCsvPreview(preview);
      setImportStep(1);
      setImportError(null);
    } catch (error: any) {
      console.error('Error previewing CSV:', error);
      if (error.response?.status === 413) {
        setImportError('File is too large. Please use a smaller file or try splitting your data into multiple files.');
      } else if (error.response?.status === 408 || error.code === 'ECONNABORTED') {
        setImportError('Upload timed out. The file might be too large or your connection is slow. Please try a smaller file.');
      } else {
        setImportError(error.response?.data?.detail || error.message || 'Failed to preview CSV file. Please check the file format and try again.');
      }
    } finally {
      setIsCsvLoading(false);
    }
  };

  const handleColumnMappingChange = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
  };

  const handleImportWithMapping = async () => {
    if (!importFile || !columnMapping || !id) return;


    setIsImporting(true);
    setImportError(null);
    setImportProgress({
      current: 0,
      total: csvPreview?.total_rows || 0,
      status: 'Starting import...'
    });

    let progressInterval: number | null = null;
    
    try {
      
      // Add simulated progress updates for better UX
      const totalRows = csvPreview?.total_rows || 0;
      
      progressInterval = window.setInterval(() => {
        setImportProgress(prev => {
          if (!prev) return null;
          
          // Simulate progress based on file size and typical processing speed
          const estimatedTimeMs = Math.max(2000, totalRows * 10); // Min 2 seconds, ~10ms per row
          const incrementPerSecond = Math.ceil(totalRows / (estimatedTimeMs / 1000));
          const newCurrent = Math.min(prev.current + incrementPerSecond, Math.floor(totalRows * 0.95));
          
          return {
            ...prev,
            current: newCurrent,
            status: newCurrent < totalRows * 0.95 
              ? `Processing questions... (${newCurrent} of ${totalRows})`
              : 'Finalizing import...'
          };
        });
      }, 1000);
      
      const result = await apiService.importCsvWithMapping(parseInt(id), importFile, columnMapping);
      
      // Clear the progress interval
      if (progressInterval !== null) {
        clearInterval(progressInterval);
      }
      
      
      // Check if any questions were actually added
      if (result.questions_added === 0) {
        if (progressInterval !== null) {
          clearInterval(progressInterval);
        }
        setImportError('Import completed but no questions were added. Please check your column mapping and ensure your CSV have valid data in the question and answer columns.');
        setImportProgress(null);
        setIsImporting(false);
        return;
      }
      
      // Show final completion with 100% progress
      setImportProgress({
        current: csvPreview?.total_rows || result.questions_added,
        total: csvPreview?.total_rows || result.questions_added,
        status: `Import completed successfully! Added ${result.questions_added.toLocaleString()} questions.`
      });

      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1500));

      await dispatch(fetchDataset(parseInt(id)));
      handleBackToQuestions();
    } catch (error: any) {
      // Clear the progress interval in case of error
      if (progressInterval !== null) {
        clearInterval(progressInterval);
      }
      console.error('Error importing CSV:', error);
      
      let errorMessage = 'Failed to import CSV file. ';
      
      if (error.response?.status === 413) {
        errorMessage += 'File is too large. Please try splitting your data into multiple smaller files.';
      } else if (error.response?.status === 408 || error.code === 'ECONNABORTED') {
        errorMessage += 'Import timed out. This usually happens with very large files. Please try splitting your data into smaller chunks.';
      } else if (error.response?.data?.detail) {
        errorMessage += error.response.data.detail;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check the file format and try again.';
      }
      
      setImportError(errorMessage);
      setImportProgress(null);
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!currentDataset) return <Alert severity="error">Dataset not found</Alert>;

  return (
    <Box>
      {/* Header with Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBackToQuestions} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          Bulk Add Questions
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        {/* Error Display */}
        {importError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setImportError(null)}>
            {importError}
          </Alert>
        )}

        {/* Import Progress Display */}
        {importProgress && (
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  {importProgress.status}
                </Typography>
              </Box>
              {importProgress.total > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Progress: {importProgress.current.toLocaleString()} of {importProgress.total.toLocaleString()} rows
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  {importProgress.total > 1000 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Large file detected - this may take several minutes to complete
                    </Typography>
                  )}
                </Box>
              )}
            </Alert>
          </Box>
        )}

        {/* Always show import method selection first */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant={bulkAddMode === 'text' ? 'contained' : 'outlined'}
            onClick={() => {
              setBulkAddMode('text');
              setImportStep(0);
              setImportFile(null);
              setCsvPreview(null);
              setColumnMapping(null);
            }}
            sx={{ mr: 1 }}
          >
            Manual Entry
          </Button>
          <Button
            variant={bulkAddMode === 'csv' ? 'contained' : 'outlined'}
            onClick={() => {
              setBulkAddMode('csv');
              setImportStep(0);
            }}
            startIcon={<UploadIcon />}
          >
            Upload CSV File
          </Button>
        </Box>

        {/* Progress Stepper for CSV import - appears after method selection */}
        {bulkAddMode === 'csv' && (
          <Stepper activeStep={importStep} sx={{ mb: 3 }}>
            <Step>
              <StepLabel>Select File</StepLabel>
            </Step>
            <Step>
              <StepLabel>Map Columns</StepLabel>
            </Step>
          </Stepper>
        )}

        {/* Content based on step */}
        {importStep === 0 && (
          <>
            {bulkAddMode === 'text' ? (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Add multiple questions at once. Use the format: Question | Expected Answer | Detect Empathy (true/false) | No Match (true/false) | Priority (low/medium/high) | Tags
                  <br />
                  Example:
                  <br />
                  What are my benefits? | You have health, dental, and vision insurance | false | false | medium | benefits,insurance
                  <br />
                  How do I reset my password? | You can reset your password from the login page | false | false | high | password,login,help
                </Alert>
                <TextField
                  fullWidth
                  multiline
                  rows={10}
                  placeholder="Questions (one per line)&#10;Fields: Question Text | Expected Answer | Detect Empathy (true/false) | No Match (true/false) | Priority (low/medium/high) | Tags (comma-separated)"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button onClick={handleBackToQuestions}>Cancel</Button>
                  <Button 
                    onClick={handleBulkSave} 
                    variant="contained" 
                    disabled={!bulkText.trim()}
                  >
                    Add Questions
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="csv-upload-bulk"
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                <label htmlFor="csv-upload-bulk">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadIcon />}
                    fullWidth
                    sx={{ mb: 2, py: 2 }}
                  >
                    Select CSV File
                  </Button>
                </label>
                {importFile && (
                  <Box sx={{ mb: 2 }}>
                    <Alert severity="success" sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Selected file: {importFile.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Size: {(importFile.size / 1024 / 1024).toFixed(1)}MB
                        {importFile.size > 10 * 1024 * 1024 && ' (Large file - processing may take several minutes)'}
                      </Typography>
                    </Alert>
                    <Button 
                      size="small" 
                      onClick={handleChooseDifferentFile}
                      sx={{ mb: 1 }}
                    >
                      Choose Different File
                    </Button>
                  </Box>
                )}
                {isCsvLoading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <CircularProgress size={20} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Processing CSV file...
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        This may take a moment for large files
                      </Typography>
                    </Box>
                  </Box>
                )}
                {importFile && !isCsvLoading && (
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button onClick={handleBackToQuestions}>Cancel</Button>
                    <Button 
                      onClick={() => handleCsvPreview(importFile)} 
                      variant="contained"
                      disabled={isCsvLoading}
                      startIcon={isCsvLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                    >
                      {isCsvLoading ? 'Processing...' : 'Next: Map Columns'}
                    </Button>
                  </Box>
                )}
              </>
            )}
          </>
        )}

        {importStep === 1 && csvPreview && (
          <CSVColumnMapper
            csvPreview={csvPreview}
            onMappingChange={handleColumnMappingChange}
            onCancel={handleBackToFileSelection}
            onImport={handleImportWithMapping}
            isLoading={isImporting}
          />
        )}
      </Paper>
    </Box>
  );
};

export default BulkAddQuestionsPage;