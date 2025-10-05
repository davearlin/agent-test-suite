import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  TableSortLabel,
  TablePagination,
  TextField,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchDataset, addQuestion, updateQuestion, deleteQuestion } from '../store/datasetsSlice';

interface Question {
  id: number;
  question_text: string;
  expected_answer: string;
  detect_empathy: boolean;
  no_match: boolean;
  priority: string;
  tags: string[];
  metadata: any;
}

// Component for expandable cell text with truncation
const ExpandableText: React.FC<{ text: string; maxLength?: number }> = ({ text, maxLength = 100 }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!text || text.trim().length === 0) {
    return <Typography variant="body2" color="text.secondary">-</Typography>;
  }
  
  const isLong = text.length > maxLength;
  const displayText = expanded || !isLong ? text : `${text.substring(0, maxLength)}...`;
  
  if (!isLong) {
    return <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{text}</Typography>;
  }
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, maxWidth: 300 }}>
      <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.4 }}>
        {displayText}
      </Typography>
      <Tooltip title={expanded ? "Show less" : "Show more"}>
        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ 
            p: 0.25, 
            minWidth: 'auto',
            color: 'primary.main',
            '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText' }
          }}
        >
          <ExpandMoreIcon 
            sx={{ 
              fontSize: 14,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease-in-out'
            }} 
          />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const ManageQuestionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentDataset, loading, error } = useAppSelector(state => state.datasets);

  // State for delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State for sorting and pagination
  const [orderBy, setOrderBy] = useState<keyof Question>('id');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // State for search/filter
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (id) {
      dispatch(fetchDataset(parseInt(id)));
    }
  }, [dispatch, id]);

  const handleAddQuestion = () => {
    navigate(`/datasets/${id}/questions/add`);
  };

  const handleEditQuestion = (question: Question) => {
    navigate(`/datasets/${id}/questions/${question.id}/edit`);
  };

  const handleDeleteQuestion = (question: Question) => {
    setSelectedQuestion(question);
    setDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (selectedQuestion && id) {
      setIsDeleting(true);
      try {
        await dispatch(deleteQuestion(selectedQuestion.id)).unwrap();
        setDeleteDialog(false);
        setSelectedQuestion(null);
      } catch (error) {
        console.error('Failed to delete question:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleCloseDialog = () => {
    if (!isDeleting) {
      setDeleteDialog(false);
      setSelectedQuestion(null);
    }
  };

  const handleSort = (property: keyof Question) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when searching
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(0);
  };

  const filteredQuestions = React.useMemo(() => {
    if (!currentDataset?.questions) return [];
    
    if (!searchTerm.trim()) return currentDataset.questions;
    
    const searchLower = searchTerm.toLowerCase();
    return currentDataset.questions.filter(question => 
      question.question_text.toLowerCase().includes(searchLower) ||
      question.expected_answer.toLowerCase().includes(searchLower) ||
      question.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
      question.priority.toLowerCase().includes(searchLower)
    );
  }, [currentDataset?.questions, searchTerm]);

  const sortedQuestions = React.useMemo(() => {
    return [...filteredQuestions].sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return order === 'asc' ? -1 : 1;
      if (bValue == null) return order === 'asc' ? 1 : -1;
      
      // Special handling for arrays (tags)
      if (Array.isArray(aValue) && Array.isArray(bValue)) {
        const aStr = aValue.join(', ');
        const bStr = bValue.join(', ');
        if (aStr < bStr) return order === 'asc' ? -1 : 1;
        if (aStr > bStr) return order === 'asc' ? 1 : -1;
        return 0;
      }
      
      if (aValue < bValue) {
        return order === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredQuestions, order, orderBy]);

  const paginatedQuestions = sortedQuestions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!currentDataset) return <Alert severity="error">Dataset not found</Alert>;

  // Main questions management page
  return (
    <Box>
      {/* Header with Back Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/datasets')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Questions for {currentDataset.name}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => navigate(`/datasets/${id}/questions/bulk-add`)}
            startIcon={<UploadIcon />}
          >
            Bulk Add
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddQuestion}
            startIcon={<AddIcon />}
          >
            Add Question
          </Button>
        </Box>
      </Box>

      {/* Search/Filter Box */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search questions, answers, tags, or priority..."
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleClearSearch}
                  edge="end"
                  size="small"
                  aria-label="clear search"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper',
            }
          }}
        />
      </Box>

      {/* Summary Information */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {sortedQuestions.length > 0 ? (
            <>
              Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, sortedQuestions.length)} of {sortedQuestions.length} questions
              {searchTerm && (
                <> (filtered from {currentDataset?.questions?.length || 0} total)</>
              )}
            </>
          ) : searchTerm ? (
            `No questions match "${searchTerm}"`
          ) : (
            'No questions found'
          )}
        </Typography>
        {sortedQuestions.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Sorted by {orderBy === 'question_text' ? 'Question' : 
                     orderBy === 'expected_answer' ? 'Expected Answer' :
                     orderBy === 'priority' ? 'Priority' : 
                     orderBy === 'tags' ? 'Tags' : orderBy} ({order}ending)
          </Typography>
        )}
      </Box>

      {sortedQuestions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm ? 'No Questions Match Your Search' : 'No Questions Yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {searchTerm ? (
              <>
                No questions found matching "{searchTerm}". Try a different search term or{' '}
                <Button variant="text" size="small" onClick={handleClearSearch}>
                  clear the search
                </Button>
                .
              </>
            ) : (
              'Start building your dataset by adding questions.'
            )}
          </Typography>
          {!searchTerm && (
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                onClick={handleAddQuestion}
                startIcon={<AddIcon />}
              >
                Add First Question
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => navigate(`/datasets/${id}/questions/bulk-add`)}
                startIcon={<UploadIcon />}
              >
                Bulk Import
              </Button>
            </Box>
          )}
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'question_text'}
                  direction={orderBy === 'question_text' ? order : 'asc'}
                  onClick={() => handleSort('question_text')}
                >
                  Question
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'expected_answer'}
                  direction={orderBy === 'expected_answer' ? order : 'asc'}
                  onClick={() => handleSort('expected_answer')}
                >
                  Expected Answer
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'tags'}
                  direction={orderBy === 'tags' ? order : 'asc'}
                  onClick={() => handleSort('tags')}
                >
                  Tags
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'priority'}
                  direction={orderBy === 'priority' ? order : 'asc'}
                  onClick={() => handleSort('priority')}
                >
                  Priority
                </TableSortLabel>
              </TableCell>
              <TableCell>Flags</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedQuestions.map((question) => (
              <TableRow key={question.id}>
                <TableCell sx={{ maxWidth: 300, verticalAlign: 'top' }}>
                  <ExpandableText text={question.question_text} maxLength={100} />
                </TableCell>
                <TableCell sx={{ maxWidth: 200, verticalAlign: 'top' }}>
                  <ExpandableText text={question.expected_answer} maxLength={100} />
                </TableCell>
                <TableCell sx={{ maxWidth: 150 }}>
                  {question.tags.map((tag, index) => (
                    <Chip key={index} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={question.priority}
                    color={
                      question.priority === 'high' ? 'error' :
                      question.priority === 'medium' ? 'warning' : 'default'
                    }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {question.detect_empathy && <Chip label="Empathy" size="small" sx={{ mr: 0.5 }} />}
                  {question.no_match && <Chip label="No Match" size="small" />}
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleEditQuestion(question)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteQuestion(question)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={sortedQuestions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
        </>
      )}

      <Dialog 
        open={deleteDialog} 
        onClose={handleCloseDialog}
        disableEscapeKeyDown={isDeleting}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this question?
          </Typography>
          {selectedQuestion && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              "{selectedQuestion.question_text}"
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDialog} 
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            variant="contained" 
            color="error"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : null}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageQuestionsPage;
