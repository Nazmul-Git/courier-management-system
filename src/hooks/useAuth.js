// hooks/useAuth.js
import { useSelector } from 'react-redux';

export const useAuth = () => {
  const auth = useSelector((state) => state.auth);
  
  // Debug: log the entire auth state
  console.log('Auth state in useAuth:', auth);
  
  return {
    user: auth.user,
    token: auth.token, // This should come from Redux state
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    error: auth.error,
    isAdmin: auth.user?.role === 'admin',
    isAgent: auth.user?.role === 'agent',
    isCustomer: auth.user?.role === 'customer',
  };
};