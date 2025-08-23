// components/ParcelMetrics.js
'use client'
import React from 'react';

const ParcelMetrics = ({ metrics, onRefresh, isLoading }) => {
  const { totalUsers, totalParcels, statusMetrics, dailyParcels } = metrics;

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    picked_up: 'bg-blue-100 text-blue-800',
    in_transit: 'bg-indigo-100 text-indigo-800',
    out_for_delivery: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  const getStatusText = (status) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded text-sm"
        >
          {isLoading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Customers</dt>
                <dd className="text-3xl font-bold text-gray-900">{totalUsers}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Parcels</dt>
                <dd className="text-3xl font-bold text-gray-900">{totalParcels}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">D</span>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Delivered Today</dt>
                <dd className="text-3xl font-bold text-gray-900">
                  {statusMetrics.delivered || 0}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Status Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Parcel Status Distribution</h3>
          <div className="space-y-3">
            {Object.entries(statusMetrics || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                  {getStatusText(status)}
                </span>
                <span className="text-lg font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Parcels Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Parcels Created (Last 7 Days)</h3>
          <div className="space-y-3">
            {dailyParcels && dailyParcels.length > 0 ? (
              dailyParcels.map((day) => (
                <div key={day._id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{day._id}</span>
                  <span className="text-lg font-semibold text-gray-900">{day.count} parcels</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.href = '/admin/parcels/create'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded text-sm"
          >
            Create New Parcel
          </button>
          <button
            onClick={() => window.location.href = '/admin/users'}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded text-sm"
          >
            Manage Users
          </button>
          <button
            onClick={() => window.location.href = '/admin/reports'}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded text-sm"
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParcelMetrics;