import { useDispatch } from 'react-redux';
import { 
  setLoading, 
  loginSuccess, 
  registerSuccess, 
  logout, 
  setError, 
  clearError,
  updateUser 
} from '@/lib/slices/authSlice';

export const useAuthActions = () => {
  const dispatch = useDispatch();

  const actions = {
    login: async (email, password) => {
      dispatch(setLoading(true));
      dispatch(clearError());

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }

        dispatch(loginSuccess({
          user: data.user,
          token: data.token,
        }));

        return data;
      } catch (error) {
        dispatch(setError(error.message));
        throw error;
      }
    },

    register: async (userData) => {
      dispatch(setLoading(true));
      dispatch(clearError());

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Registration failed');
        }

        dispatch(registerSuccess());
        return data;
      } catch (error) {
        dispatch(setError(error.message));
        throw error;
      }
    },

    logout: () => {
      dispatch(logout());
      // Clear cookies if any
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    },

    updateProfile: (userData) => {
      dispatch(updateUser(userData));
    },

    clearError: () => {
      dispatch(clearError());
    },
  };

  return actions;
};