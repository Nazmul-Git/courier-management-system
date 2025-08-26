import { useDispatch } from 'react-redux';
import {
  setLoading,
  loginSuccess,
  registerSuccess,
  logout as logoutAction,
  setError,
  clearError as clearErrorAction,
  updateUser
} from '@/lib/slices/authSlice';


export const useAuthActions = () => {
  const dispatch = useDispatch();

  // Helper function to safely access localStorage
  const safeLocalStorage = {
    getItem: (key) => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    },
    setItem: (key, value) => {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(key);
    }
  };

  const login = async (credentials) => {
    dispatch(setLoading(true));
    dispatch(clearErrorAction());

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      // console.log('data is =',data)

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      dispatch(loginSuccess({
        user: data.user,
        token: data.token,
      }));

      // Store token in localStorage - safely
      if (data.token) {
        safeLocalStorage.setItem('token', data.token);
        safeLocalStorage.setItem('user', JSON.stringify(data.user));
      }

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch(setError(errorMessage));
      throw error;
    }
  };

  const register = async (userData) => {
    dispatch(setLoading(true));
    dispatch(clearErrorAction());

    try {
      console.log('Registration attempt:', userData);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const responseText = await response.text();
      console.log('Registration response status:', response.status);
      console.log('Registration response text:', responseText);

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      console.log('Registration successful data:', data);

      // FIXED: Pass user data and token to registerSuccess
      dispatch(registerSuccess({
        user: data.user, // Make sure your API returns user data
        token: data.token // Make sure your API returns a token
      }));

      // Also store in localStorage
      if (data.token && data.user) {
        safeLocalStorage.setItem('token', data.token);
        safeLocalStorage.setItem('user', JSON.stringify(data.user));
      }

      return data;
    } catch (error) {
      console.error('Registration error details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      dispatch(setError(errorMessage));
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const logout = () => {
    dispatch(logoutAction());
    // Clear localStorage - safely
    safeLocalStorage.removeItem('token');
    safeLocalStorage.removeItem('user');
    // Clear cookies if any
    if (typeof window !== 'undefined') {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  };

  const updateProfile = (userData) => {
    dispatch(updateUser(userData));
    // Update localStorage if needed - safely
    const currentUser = JSON.parse(safeLocalStorage.getItem('user') || '{}');
    safeLocalStorage.setItem('user', JSON.stringify({ ...currentUser, ...userData }));
  };

  const clearError = () => {
    dispatch(clearErrorAction());
  };

  return {
    login,
    register,
    logout,
    updateProfile,
    clearError,
  };
};