import { createSlice } from '@reduxjs/toolkit';

// Helper to check if we're in browser
const isBrowser = typeof window !== 'undefined';

const getInitialState = () => {
  if (isBrowser) {
    try {
      const storedAuth = localStorage.getItem('auth');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        // Verify the token structure (basic check)
        if (parsed.token && parsed.user) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading auth from localStorage:', error);
    }
  }
  
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  };
};

const authSlice = createSlice({
  name: 'auth',
  initialState: getInitialState(),
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;

      if (isBrowser) {
        localStorage.setItem('auth', JSON.stringify(state));
      }
    },
    registerSuccess: (state) => {
      state.loading = false;
      state.error = null;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;

      if (isBrowser) {
        localStorage.removeItem('auth');
        // Also clear any cookies
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateUser: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        if (isBrowser) {
          localStorage.setItem('auth', JSON.stringify(state));
        }
      }
    },
  },
});

export const {
  setLoading,
  loginSuccess,
  registerSuccess,
  logout,
  setError,
  clearError,
  updateUser,
} = authSlice.actions;

export default authSlice.reducer;