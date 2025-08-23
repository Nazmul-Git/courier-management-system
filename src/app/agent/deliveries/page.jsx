'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import { useAuth } from '@/hooks';

export default function AgentDashboard() {
  const { token, user, isAgent } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('assigned');
  const [parcels, setParcels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [routeData, setRouteData] = useState(null);

  // Check if user is an agent
  useEffect(() => {
    if (!token) {
      router.push('/auth/login');
      return;
    }
    
    if (!isAgent) {
      router.push('/unauthorized');
      return;
    }
    
    fetchAssignedParcels();
  }, [token, isAgent, router]);

  const fetchAssignedParcels = async () => {
    try {
      setIsLoading(true);
      // Remove Authorization header since we're using cookies
      const response = await fetch('/api/agent/deliveries');
      
      if (response.ok) {
        const data = await response.json();
        setParcels(data.parcels);
      } else if (response.status === 401) {
        // Token expired or invalid
        router.push('/auth/login');
      } else {
        console.error('Failed to fetch parcels');
      }
    } catch (error) {
      console.error('Error fetching parcels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateParcelStatus = async (parcelId, newStatus) => {
    try {
      const response = await fetch('/api/agent/deliveries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // Remove Authorization header since we're using cookies
        },
        body: JSON.stringify({
          parcelId,
          status: newStatus,
        }),
      });

      if (response.ok) {
        // Refresh the parcels list
        fetchAssignedParcels();
        alert('Status updated successfully!');
      } else if (response.status === 401) {
        router.push('/auth/login');
      } else {
        alert('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  const getOptimizedRoute = async () => {
    try {
      // Remove Authorization header since we're using cookies
      const response = await fetch('/api/agent/optimized-route');
      
      if (response.ok) {
        const data = await response.json();
        setRouteData(data);
        setActiveTab('route');
      } else if (response.status === 401) {
        router.push('/auth/login');
      } else {
        alert('Failed to get optimized route');
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      alert('Error fetching optimized route');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'picked_up':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'out_for_delivery':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Delivery Agent Dashboard</title>
        <meta name="description" content="Manage your delivery assignments" />
      </Head>

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Delivery Agent Dashboard</h1>
          <div className="flex space-x-4">
            <button
              onClick={getOptimizedRoute}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Get Optimized Route
            </button>
            <button
              onClick={fetchAssignedParcels}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex border-b border-gray-200">
          <button
            className={`py-4 px-6 font-medium text-sm ${activeTab === 'assigned' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('assigned')}
          >
            Assigned Parcels
          </button>
          <button
            className={`py-4 px-6 font-medium text-sm ${activeTab === 'route' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('route')}
          >
            Delivery Route
          </button>
        </div>

        {activeTab === 'assigned' && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Your Assigned Parcels</h2>
            {parcels.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <p className="text-gray-500">No parcels assigned to you at the moment.</p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {parcels.map((parcel) => (
                    <li key={parcel._id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              #{parcel.trackingNumber}
                            </p>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(parcel.status)}`}>
                              {getStatusText(parcel.status)}
                            </span>
                          </div>
                          <div className="ml-2 flex-shrink-0 flex">
                            <select
                              value={parcel.status}
                              onChange={(e) => updateParcelStatus(parcel._id, e.target.value)}
                              className="ml-2 block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                              <option value="pending">Pending</option>
                              <option value="picked_up">Picked Up</option>
                              <option value="in_transit">In Transit</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              From: {parcel.origin.street}, {parcel.origin.city}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              To: {parcel.destination.street}, {parcel.destination.city}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>
                              Weight: {parcel.weight} kg
                            </p>
                          </div>
                        </div>
                        {parcel.specialInstructions && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">
                              Instructions: {parcel.specialInstructions}
                            </p>
                          </div>
                        )}
                        {parcel.paymentType === 'cod' && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">
                              COD Amount: ৳{parcel.codAmount}
                            </p>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'route' && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Optimized Delivery Route</h2>
            {routeData ? (
              <div className="bg-white shadow rounded-lg p-4">
                <div className="h-96 mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                  {/* Map would be integrated here with Google Maps API */}
                  <div className="text-center">
                    <p className="text-gray-500 mb-2">Google Maps visualization would appear here</p>
                    <p className="text-sm text-gray-400">Using coordinates from parcel destinations</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Route Summary</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Total Distance</p>
                      <p className="font-semibold">{routeData.distance}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Estimated Time</p>
                      <p className="font-semibold">{routeData.duration}</p>
                    </div>
                  </div>
                  <h4 className="font-medium mt-4 mb-2">Delivery Order:</h4>
                  <ol className="list-decimal pl-5 mt-2 space-y-2">
                    {routeData.waypoints.map((waypoint, index) => (
                      <li key={index} className="pb-2 border-b border-gray-100 last:border-b-0">
                        <p className="font-medium">{waypoint.address}</p>
                        <p className="text-sm text-gray-500">Parcel: #{waypoint.trackingNumber}</p>
                        {waypoint.distanceFromPrevious && (
                          <p className="text-sm text-gray-500">{waypoint.distanceFromPrevious} from previous</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <p className="text-gray-500">No route data available. Click "Get Optimized Route" to generate one.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}