import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      auth: authSlice,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST'],
        },
      }),
  });
};