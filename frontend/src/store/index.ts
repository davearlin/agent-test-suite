import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authSlice';
import datasetsSlice from './datasetsSlice';
import testRunsSlice from './testRunsSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    datasets: datasetsSlice,
    testRuns: testRunsSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
