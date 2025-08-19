'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useAuthActions } from '@/hooks';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isAuthenticated, user, loading, error } = useAuth(); // Added user here
  const { login, clearError } = useAuthActions();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      switch(user.role) {
        case 'admin':
          router.push('/admin/dashboard');
          break;
        case 'agent':
          router.push('/agent/deliveries');
          break;
        case 'customer':
          router.push('/customer/parcels');
          break;
        default:
          router.push('/');
      }
    }
  }, [isAuthenticated, user, router]); // Added user to dependencies

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = await login(email, password);
      
      // Redirect based on role
      switch(data.user.role) {
        case 'admin':
          router.push('/admin/dashboard');
          break;
        case 'agent':
          router.push('/agent/deliveries');
          break;
        case 'customer':
          router.push('/customer/parcels');
          break;
        default:
          router.push('/');
      }
    } catch (error) {
      // Error is already handled by the action
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center">Sign in to your account</h2>
        
        {error && (
          <div className="p-3 text-red-600 bg-red-100 rounded-md">
            {error}
            <button
              onClick={clearError}
              className="float-right text-red-800 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="text-center text-sm">
          Don't have an account?{' '}
          <Link href="/auth/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}