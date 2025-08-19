'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';

export default function Home() {
  const { isAuthenticated, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user) {
        // Redirect based on role
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
            router.push('/auth/login');
        }
      } else {
        router.push('/auth/login');
      }
    }
  }, [isAuthenticated, user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Courier Management System</h1>
        <p className="text-gray-600">Checking your authentication status...</p>
      </div>
    </div>
  );
}