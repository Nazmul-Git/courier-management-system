import { createSlice } from '@reduxjs/toolkit';

const getInitialState = () => {
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
    },
    registerSuccess: (state, action) => {
      // FIXED: Add user data and authentication status
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
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
      }
    },
    initializeAuth: (state) => {
      if (typeof window !== 'undefined') {
        try {
          const token = localStorage.getItem('token');
          const userData = localStorage.getItem('user');
          
          if (token && userData) {
            state.user = JSON.parse(userData);
            state.token = token;
            state.isAuthenticated = true;
          }
        } catch (error) {
          console.error('Error initializing auth from localStorage:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
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
  initializeAuth,
} = authSlice.actions;

export default authSlice.reducer;