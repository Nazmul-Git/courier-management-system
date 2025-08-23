'use client'
import { useAuth } from '@/hooks';
import React, { useState, useEffect } from 'react';

const ParcelManagement = () => {
  const [parcels, setParcels] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { token, user } = useAuth();
  const [error, setError] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError('');

        const authToken = token || localStorage.getItem('token');

        if (!authToken) {
          setError('Authentication token not found');
          return;
        }

        // Fetch parcels
        const url = `/api/customer/parcels${filterStatus !== 'all' ? `?status=${filterStatus}` : ''}`;
        const parcelsResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!parcelsResponse.ok) {
          const errorData = await parcelsResponse.json();
          throw new Error(errorData.error || 'Failed to fetch parcels');
        }

        const parcelsData = await parcelsResponse.json();
        setParcels(parcelsData.parcels || []);

        // If user is admin, fetch agents for assignment
        if (user?.role === 'admin') {
          const agentsResponse = await fetch('/api/agents', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (agentsResponse.ok) {
            const agentsData = await agentsResponse.json();
            setAgents(agentsData.agents || []);
          }
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token, filterStatus, user?.role]);

  const assignAgent = async (parcelId, agentId) => {
    try {
      setIsAssigning(true);
      setError('');
      const authToken = token || localStorage.getItem('token');

      const response = await fetch(`/api/admin/parcels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          action: 'assign-agents',
          parcelId,
          agentId
        })
      });

      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        if (response.headers.get('content-type')?.includes('text/html')) {
          throw new Error(`Server returned HTML error page. Check if the endpoint exists. Status: ${response.status}`);
        }

        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || `Failed to assign agent. Status: ${response.status}`);
        } catch (e) {
          throw new Error(`Failed to assign agent. Status: ${response.status}, Response: ${responseText}`);
        }
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }

      console.log('API Response:', result);

      // Handle different response structures
      let assignedAgentData = null;

      if (result.parcel) {
        assignedAgentData = result.parcel.assignedAgent;
      } else if (result.assignedAgent) {
        assignedAgentData = result.assignedAgent;
      } else if (result.agent) {
        assignedAgentData = result.agent;
      } else {
        console.warn('Unexpected response format:', result);
        assignedAgentData = result;
      }

      // Update the parcel in the local state
      setParcels(prev =>
        prev.map(p => p.id === parcelId ? {
          ...p,
          assignedAgent: assignedAgentData
        } : p)
      );

      setSelectedParcel(null);
      alert('Agent assigned successfully!');

    } catch (error) {
      console.error('Error assigning agent:', error);
      setError(error.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const deleteParcel = async (parcelId) => {
    try {
      setIsDeleting(true);
      setError('');
      const authToken = token || localStorage.getItem('token');

      const response = await fetch(`/api/admin/parcels`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ id: parcelId })
      });


      const responseText = await response.text();
      console.log('Delete response:', responseText);

      if (!response.ok) {
        if (response.headers.get('content-type')?.includes('text/html')) {
          throw new Error(`Server returned HTML error page. Status: ${response.status}`);
        }

        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.error || `Failed to delete parcel. Status: ${response.status}`);
        } catch (e) {
          throw new Error(`Failed to delete parcel. Status: ${response.status}, Response: ${responseText}`);
        }
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }

      // Remove the parcel from the local state
      setParcels(prev => prev.filter(p => p.id !== parcelId));

      alert('Parcel deleted successfully!');

    } catch (error) {
      console.error('Error deleting parcel:', error);
      setError(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteParcel = (parcel) => {
    if (window.confirm(`Are you sure you want to delete parcel ${parcel.trackingNumber}? This action cannot be undone.`)) {
      deleteParcel(parcel.id);
    }
  };

  const getRecommendedAgents = (parcel) => {
    return agents.filter(agent => agent.isActive);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'out_for_delivery':
        return 'bg-purple-100 text-purple-800';
      case 'picked_up':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    return status ? status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') : 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {user?.role === 'admin' ? 'All Parcels' : 'My Parcels'}
      </h2>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by tracking number..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="picked_up">Picked Up</option>
            <option value="in_transit">In Transit</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Parcels Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tracking #
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origin
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destination
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Agent
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {parcels.filter(parcel =>
                parcel.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
              ).map(parcel => (
                <tr key={parcel.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {parcel.trackingNumber || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    {parcel.origin ? `${parcel.origin.city}, ${parcel.origin.street}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    {parcel.destination ? `${parcel.destination.city}, ${parcel.destination.street}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(parcel.status)}`}>
                      {getStatusText(parcel.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {parcel.assignedAgent?.name ? (
                      <span className="text-green-600 font-medium">{parcel.assignedAgent.name}</span>
                    ) : (
                      <span className="text-red-500 font-medium">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => setSelectedParcel(parcel)}
                      className="text-blue-600 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                    >
                      View Details
                    </button>

                    {user?.role === 'admin' && parcel.status === 'cancelled' && (
                      <button
                        onClick={() => confirmDeleteParcel(parcel)}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? 'Deleting...' : 'Remove Parcel'}
                      </button>
                    )}

                    {user?.role === 'admin' && parcel.status !== 'cancelled' && (
                      <button
                        onClick={() => setSelectedParcel(parcel)}
                        className="text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                      >
                        {parcel.assignedAgent ? 'Reassign' : 'Assign Agent'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {parcels.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No parcels found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'No parcels found'}
            </p>
          </div>
        )}
      </div>

      {/* Assign Agent Modal (Admin Only) */}
      {selectedParcel && user?.role === 'admin' && selectedParcel.status !== 'cancelled' && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedParcel.assignedAgent ? 'Reassign Agent' : 'Assign Agent'}
              </h3>
              <button
                onClick={() => setSelectedParcel(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Tracking: <strong>{selectedParcel.trackingNumber}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Destination: {selectedParcel.destination?.city}, {selectedParcel.destination?.street}
              </p>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select an agent
              </label>

              {agents.length > 0 ? (
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                  onChange={(e) => {
                    if (e.target.value) {
                      assignAgent(selectedParcel.id, e.target.value);
                    }
                  }}
                  disabled={isAssigning}
                  defaultValue=""
                >
                  <option value="" disabled>Select an agent</option>
                  {getRecommendedAgents(selectedParcel).map(agent => (
                    <option key={agent._id} value={agent.id}>
                      {agent.name} - {agent.email}
                      {agent.city && ` - ${agent.city}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500">Loading agents...</p>
              )}

              {isAssigning && (
                <div className="flex items-center text-sm text-blue-600">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Assigning agent...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParcelManagement;