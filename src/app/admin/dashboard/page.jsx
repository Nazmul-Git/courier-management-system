'use client'
import ParcelManagement from '@/components/ParcelManagement';
import ParcelMetrics from '@/components/ParclMetrice';
import ReportGenerator from '@/components/ReportGenerator';
import { useAuth, useAuthActions } from '@/hooks';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalParcels: 0,
    statusMetrics: {},
    dailyParcels: []
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const { token, user, isAdmin } = useAuth();
  const { logout } = useAuthActions()
  const router = useRouter();

  // Check if user is an admin
  useEffect(() => {
    if (!token) {
      router.push('/auth/login');
      return;
    }

    if (!isAdmin) {
      router.push('/unauthorized');
      return;
    }

    fetchMetrics();
  }, [token, isAdmin, router]);

  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/dashboard');

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else if (response.status === 401) {
        router.push('/auth/login');
      } else {
        console.error('Failed to fetch metrics');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMetrics = () => {
    fetchMetrics();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            {user && (
              <p className="text-sm text-gray-600 mt-1">
                Welcome, {user.name} ({user.email})
              </p>
            )}
          </div>
          <div className="flex space-x-4">
            <button
              onClick={logout}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8 overflow-x-auto">
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'dashboard'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'parcels'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            onClick={() => setActiveTab('parcels')}
          >
            Parcel Management
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            onClick={() => setActiveTab('users')}
          >
            User Management
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'reports'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            onClick={() => setActiveTab('reports')}
          >
            Reports & Analytics
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {activeTab === 'dashboard' && (
            <ParcelMetrics
              metrics={metrics}
              onRefresh={refreshMetrics}
              isLoading={isLoading}
            />
          )}
          {activeTab === 'parcels' && <ParcelManagement />}
          {activeTab === 'reports' && <ReportGenerator metrics={metrics} />}

          {/* Placeholder for User Management tab */}
          {activeTab === 'users' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">User Management</h2>
              <p className="text-gray-500">User management interface will be implemented here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;