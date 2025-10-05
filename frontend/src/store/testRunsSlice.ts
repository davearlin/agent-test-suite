import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TestRun, CreateTestRunRequest } from '../types';
import { apiService } from '../services/api';

interface TestRunsState {
  testRuns: TestRun[];
  currentTestRun: TestRun | null;
  loading: boolean;
  error: string | null;
}

const initialState: TestRunsState = {
  testRuns: [],
  currentTestRun: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchTestRuns = createAsyncThunk(
  'testRuns/fetchTestRuns',
  async (params?: { skip?: number; limit?: number; dataset_id?: number; status?: string }) => {
    return await apiService.getTestRuns(params);
  }
);

export const fetchTestRun = createAsyncThunk(
  'testRuns/fetchTestRun',
  async (id: number) => {
    return await apiService.getTestRun(id);
  }
);

export const createTestRun = createAsyncThunk(
  'testRuns/createTestRun',
  async (data: CreateTestRunRequest) => {
    return await apiService.createTestRun(data);
  }
);

export const cancelTestRun = createAsyncThunk(
  'testRuns/cancelTestRun',
  async (id: number) => {
    await apiService.cancelTestRun(id);
    return id;
  }
);

export const deleteTestRun = createAsyncThunk(
  'testRuns/deleteTestRun',
  async (id: number) => {
    await apiService.deleteTestRun(id);
    return id;
  }
);

export const deleteMultipleTestRuns = createAsyncThunk(
  'testRuns/deleteMultipleTestRuns',
  async (ids: number[]) => {
    await Promise.all(ids.map(id => apiService.deleteTestRun(id)));
    return ids;
  }
);

export const fetchRunningTestRunsStatus = createAsyncThunk(
  'testRuns/fetchRunningTestRunsStatus',
  async (runningIds: number[]) => {
    if (runningIds.length === 0) {
      return [];
    }

    try {
      // Fetch running and pending test runs using API service
      const [runningTestRuns, pendingTestRuns] = await Promise.all([
        apiService.getTestRuns({ status: 'running' }),
        apiService.getTestRuns({ status: 'pending' })
      ]);
      
      // Combine and filter to only include the ones we're tracking
      const allTestRuns = [...runningTestRuns, ...pendingTestRuns];
      return allTestRuns.filter((tr: TestRun) => runningIds.includes(tr.id));
    } catch (error) {
      console.error('Error fetching test run status:', error);
      throw error;
    }
  }
);

const testRunsSlice = createSlice({
  name: 'testRuns',
  initialState,
  reducers: {
    clearCurrentTestRun: (state) => {
      state.currentTestRun = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateTestRunProgress: (state, action: PayloadAction<{ id: number; progress: Partial<TestRun> }>) => {
      const { id, progress } = action.payload;
      
      // Update in testRuns list
      const testRunIndex = state.testRuns.findIndex(tr => tr.id === id);
      if (testRunIndex !== -1) {
        state.testRuns[testRunIndex] = { ...state.testRuns[testRunIndex], ...progress };
      }
      
      // Update current test run if it matches
      if (state.currentTestRun?.id === id) {
        state.currentTestRun = { ...state.currentTestRun, ...progress };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch test runs
      .addCase(fetchTestRuns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTestRuns.fulfilled, (state, action: PayloadAction<TestRun[]>) => {
        state.loading = false;
        state.testRuns = action.payload;
      })
      .addCase(fetchTestRuns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch test runs';
      })
      // Fetch single test run
      .addCase(fetchTestRun.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTestRun.fulfilled, (state, action: PayloadAction<TestRun>) => {
        state.loading = false;
        state.currentTestRun = action.payload;
      })
      .addCase(fetchTestRun.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch test run';
      })
      // Create test run
      .addCase(createTestRun.fulfilled, (state, action: PayloadAction<TestRun>) => {
        state.testRuns.unshift(action.payload);
      })
      // Cancel test run
      .addCase(cancelTestRun.fulfilled, (state, action: PayloadAction<number>) => {
        const testRunIndex = state.testRuns.findIndex(tr => tr.id === action.payload);
        if (testRunIndex !== -1) {
          state.testRuns[testRunIndex].status = 'cancelled';
        }
        if (state.currentTestRun?.id === action.payload) {
          state.currentTestRun.status = 'cancelled';
        }
      })
      // Delete test run
      .addCase(deleteTestRun.fulfilled, (state, action: PayloadAction<number>) => {
        const testRunIndex = state.testRuns.findIndex(tr => tr.id === action.payload);
        if (testRunIndex !== -1) {
          state.testRuns.splice(testRunIndex, 1);
        }
        if (state.currentTestRun?.id === action.payload) {
          state.currentTestRun = null;
        }
      })
      // Delete multiple test runs
      .addCase(deleteMultipleTestRuns.fulfilled, (state, action: PayloadAction<number[]>) => {
        const deletedIds = action.payload;
        state.testRuns = state.testRuns.filter(tr => !deletedIds.includes(tr.id));
        if (state.currentTestRun && deletedIds.includes(state.currentTestRun.id)) {
          state.currentTestRun = null;
        }
      })
      // Fetch running test runs status
      .addCase(fetchRunningTestRunsStatus.fulfilled, (state, action: PayloadAction<TestRun[]>) => {
        const updatedTestRuns = action.payload;
        updatedTestRuns.forEach(updatedTestRun => {
          const index = state.testRuns.findIndex(tr => tr.id === updatedTestRun.id);
          if (index !== -1) {
            state.testRuns[index] = updatedTestRun;
          }
          // Also update current test run if it matches
          if (state.currentTestRun?.id === updatedTestRun.id) {
            state.currentTestRun = updatedTestRun;
          }
        });
      });
  },
});

export const { clearCurrentTestRun, clearError, updateTestRunProgress } = testRunsSlice.actions;
export default testRunsSlice.reducer;
