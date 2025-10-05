import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Dataset, DatasetSummary, CreateDatasetRequest } from '../types';
import { apiService } from '../services/api';

interface DatasetsState {
  datasets: DatasetSummary[];
  currentDataset: Dataset | null;
  loading: boolean;
  error: string | null;
}

const initialState: DatasetsState = {
  datasets: [],
  currentDataset: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchDatasets = createAsyncThunk(
  'datasets/fetchDatasets',
  async (params?: { skip?: number; limit?: number; category?: string }) => {
    return await apiService.getDatasets(params);
  }
);

export const fetchDataset = createAsyncThunk(
  'datasets/fetchDataset',
  async (id: number) => {
    return await apiService.getDataset(id);
  }
);

export const createDataset = createAsyncThunk(
  'datasets/createDataset',
  async (data: CreateDatasetRequest) => {
    const dataset = await apiService.createDataset(data);
    return dataset;
  }
);

export const updateDataset = createAsyncThunk(
  'datasets/updateDataset',
  async ({ id, data }: { id: number; data: Partial<CreateDatasetRequest> }) => {
    return await apiService.updateDataset(id, data);
  }
);

export const deleteDataset = createAsyncThunk(
  'datasets/deleteDataset',
  async (id: number) => {
    await apiService.deleteDataset(id);
    return id;
  }
);

export const addQuestion = createAsyncThunk(
  'datasets/addQuestion',
  async (data: { datasetId: number; question_text: string; expected_answer: string; detect_empathy: boolean; no_match: boolean; priority: 'high' | 'medium' | 'low'; tags: string[] }) => {
    const questionData = {
      question_text: data.question_text,
      expected_answer: data.expected_answer,
      detect_empathy: data.detect_empathy,
      no_match: data.no_match,
      priority: data.priority,
      tags: data.tags,
      metadata: {}
    };
    return await apiService.addQuestion(data.datasetId, questionData);
  }
);

export const updateQuestion = createAsyncThunk(
  'datasets/updateQuestion',
  async (data: { questionId: number; question_text: string; expected_answer: string; detect_empathy: boolean; no_match: boolean; priority: 'high' | 'medium' | 'low'; tags: string[] }) => {
    const questionData = {
      question_text: data.question_text,
      expected_answer: data.expected_answer,
      detect_empathy: data.detect_empathy,
      no_match: data.no_match,
      priority: data.priority,
      tags: data.tags,
      metadata: {}
    };
    return await apiService.updateQuestion(data.questionId, questionData);
  }
);

export const deleteQuestion = createAsyncThunk(
  'datasets/deleteQuestion',
  async (questionId: number) => {
    await apiService.deleteQuestion(questionId);
    return questionId;
  }
);

const datasetsSlice = createSlice({
  name: 'datasets',
  initialState,
  reducers: {
    clearCurrentDataset: (state) => {
      state.currentDataset = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch datasets
      .addCase(fetchDatasets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDatasets.fulfilled, (state, action: PayloadAction<DatasetSummary[]>) => {
        state.loading = false;
        state.datasets = action.payload;
      })
      .addCase(fetchDatasets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch datasets';
      })
      // Fetch single dataset
      .addCase(fetchDataset.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDataset.fulfilled, (state, action: PayloadAction<Dataset>) => {
        state.loading = false;
        state.currentDataset = action.payload;
      })
      .addCase(fetchDataset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch dataset';
      })
      // Create dataset
      .addCase(createDataset.fulfilled, (state, action: PayloadAction<Dataset>) => {
        // Add to datasets list (convert to summary)
        const summary: DatasetSummary = {
          id: action.payload.id,
          name: action.payload.name,
          category: action.payload.category,
          version: action.payload.version,
          question_count: action.payload.questions.length,
          created_at: action.payload.created_at,
          owner_name: '', // Will be filled by proper API call
        };
        state.datasets.unshift(summary);
      })
      // Delete dataset
      .addCase(deleteDataset.fulfilled, (state, action: PayloadAction<number>) => {
        state.datasets = state.datasets.filter(d => d.id !== action.payload);
        if (state.currentDataset?.id === action.payload) {
          state.currentDataset = null;
        }
      })
      // Add question
      .addCase(addQuestion.fulfilled, (state, action) => {
        if (state.currentDataset) {
          state.currentDataset.questions.push(action.payload);
        }
      })
      // Update question
      .addCase(updateQuestion.fulfilled, (state, action) => {
        if (state.currentDataset) {
          const index = state.currentDataset.questions.findIndex(q => q.id === action.payload.id);
          if (index !== -1) {
            state.currentDataset.questions[index] = action.payload;
          }
        }
      })
      // Delete question
      .addCase(deleteQuestion.fulfilled, (state, action: PayloadAction<number>) => {
        if (state.currentDataset) {
          state.currentDataset.questions = state.currentDataset.questions.filter(q => q.id !== action.payload);
        }
      });
  },
});

export const { clearCurrentDataset, clearError } = datasetsSlice.actions;
export default datasetsSlice.reducer;
