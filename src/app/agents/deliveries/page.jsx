'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import { useAuth, useAuthActions } from '@/hooks';
import LeafletRouteMap from '@/components/map/LeafletRouteMap';


export default function AgentDashboard() {
  const { token, user, isAgent } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('assigned');
  const [parcels, setParcels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [trackParcel, setTrackParcel] = useState({});
  const [deliveryNotes, setDeliveryNotes] = useState({});
  const { logout } = useAuthActions();

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

  // Clean up geolocation watcher
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const fetchAssignedParcels = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/agents/deliveries', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setParcels(data.parcels || []);
      } else if (response.status === 401) {
        router.push('/auth/login');
      } else {
        console.error('Failed to fetch parcels:', response.status);
      }
    } catch (error) {
      console.error('Error fetching parcels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOptimizedRoute = async () => {
    try {
      setRouteLoading(true);

      const response = await fetch('/api/agents/optimized-route', {
        credentials: 'include'
      });

      // console.log('Route response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        // console.log('Optimized route data:', data);
        setOptimizedRoute(data);
        setActiveTab('route');
      } else {
        const errorData = await response.json().catch(() => ({}));
        // console.error('Failed to fetch optimized route:', response.status, errorData);
        alert('Failed to generate optimized route');
      }
    } catch (error) {
      // console.error('Error fetching optimized route:', error);
      alert('Error connecting to server');
    } finally {
      setRouteLoading(false);
    }
  };

  const updateParcelStatus = async (parcelId, newStatus) => {
    try {
      const response = await fetch('/api/agents/deliveries', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          parcelId,
          status: newStatus,
          notes: deliveryNotes[parcelId] || ''
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setParcels(prev => prev.map(p =>
          p.id === parcelId ? { ...p, ...data.parcel } : p
        ));
        alert('Status updated successfully!');

        // Refresh route if status changed to delivered
        if (newStatus === 'delivered') {
          fetchOptimizedRoute();
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Failed to update status');
      }
    } catch (error) {
      // console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  const startLocationTracking = () => {
    if (navigator.geolocation) {
      setIsTracking(true);

      // Get current position immediately
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position);
        },
        (error) => {
          // console.error('Error getting location:', error);
          alert('Please enable location services');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );

      // Set up continuous tracking
      const id = navigator.geolocation.watchPosition(
        (position) => {
          updateLocation(position);
        },
        (error) => {
          // console.error('Error tracking location:', error);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );

      setWatchId(id);
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  const updateLocation = (position) => {
    const newLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date().toISOString()
    };
    setCurrentLocation(newLocation);
  };

  const stopLocationTracking = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  };

  const trackParcelOnMap = (parcel) => {
    setActiveTab('route');
    setTrackParcel(parcel);
    setTimeout(() => {
      document.getElementById('delivery-route-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const completeDelivery = async (trackingNumber, notes = '') => {
    try {
      const response = await fetch('/api/agents/optimized-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          trackingNumber,
          status: 'delivered',
          notes
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert('Delivery marked as completed!');
        fetchAssignedParcels(); // Refresh parcels
        fetchOptimizedRoute(); // Refresh route
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Failed to update delivery status');
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('Error completing delivery');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'picked_up': return 'bg-yellow-100 text-yellow-800';
      case 'in_transit': return 'bg-orange-100 text-orange-800';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    return status ? status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') : 'Unknown';
  };

  const getStatusOptions = (currentStatus) => {
    const statusFlow = {
      'pending': ['assigned', 'cancelled'],
      'assigned': ['picked_up', 'cancelled'],
      'picked_up': ['in_transit', 'cancelled'],
      'in_transit': ['out_for_delivery', 'cancelled'],
      'out_for_delivery': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    };
    return statusFlow[currentStatus] || [];
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
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Delivery Agent Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome, {user?.name}</p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={fetchOptimizedRoute}
              disabled={routeLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2 px-4 rounded text-sm"
            >
              {routeLoading ? 'Loading Route...' : 'Get Optimized Route'}
            </button>
            <button
              onClick={logout}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm"
            >
              
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Location Tracking Status */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Live Location Tracking</h3>
              {currentLocation ? (
                <p className="text-sm text-gray-600">
                  📍 Your location: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  {currentLocation.accuracy && ` (±${Math.round(currentLocation.accuracy)}m)`}
                </p>
              ) : (
                <p className="text-sm text-gray-600">Location not available</p>
              )}
            </div>
            {!isTracking ? (
              <button
                onClick={startLocationTracking}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm flex items-center"
              >
                <span>📍 Start Tracking</span>
              </button>
            ) : (
              <button
                onClick={stopLocationTracking}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm flex items-center"
              >
                <span>🛑 Stop Tracking</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{parcels.length}</div>
            <div className="text-sm text-gray-600">Total Parcels</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {parcels.filter(p => p.status === 'picked_up').length}
            </div>
            <div className="text-sm text-gray-600">Picked Up</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-purple-600">
              {parcels.filter(p => p.status === 'out_for_delivery').length}
            </div>
            <div className="text-sm text-gray-600">Out for Delivery</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">
              {parcels.filter(p => p.status === 'delivered').length}
            </div>
            <div className="text-sm text-gray-600">Delivered</div>
          </div>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            className={`py-4 px-6 font-medium text-sm ${activeTab === 'assigned' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('assigned')}
          >
            Assigned Parcels ({parcels.length})
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
                  {parcels.map((parcel) => {
                    const availableStatuses = getStatusOptions(parcel.status);

                    return (
                      <li key={parcel.id} className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              #{parcel.trackingNumber}
                            </p>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(parcel.status)}`}>
                              {getStatusText(parcel.status)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => trackParcelOnMap(parcel)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-1 px-3 rounded text-xs flex items-center"
                            >
                              📍 Track
                            </button>

                            {availableStatuses.length > 0 && (
                              <select
                                onChange={(e) => updateParcelStatus(parcel.id, e.target.value)}
                                className="block pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                              >
                                <option value="">Update status...</option>
                                {availableStatuses.map(status => (
                                  <option key={status} value={status}>
                                    Mark as {getStatusText(status)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              📦 From: {parcel.origin?.street}, {parcel.origin?.city}
                            </p>
                            <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                              🏠 To: {parcel.destination?.street}, {parcel.destination?.city}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>⚖️ Weight: {parcel.weight} kg</p>
                          </div>
                        </div>

                        {parcel.customer && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">
                              👤 Customer: {parcel.customer.name}
                              {parcel.customer.phone && ` (📞 ${parcel.customer.phone})`}
                            </p>
                          </div>
                        )}

                        {parcel.specialInstructions && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">
                              📝 Instructions: {parcel.specialInstructions}
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'route' && (
          <div className="mt-6" id="delivery-route-section">
            <h2 className="text-xl font-semibold mb-4">Optimized Delivery Route</h2>

            {routeLoading ? (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Calculating optimal route...</p>
              </div>
            ) : optimizedRoute ? (
              <>
                <div className="bg-white shadow rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium mb-2">Route Summary</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Total Distance</p>
                      <p className="font-semibold text-lg">{optimizedRoute.distance}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Estimated Time</p>
                      <p className="font-semibold text-lg">{optimizedRoute.duration}</p>
                    </div>
                  </div>
                  {optimizedRoute.summary && (
                    <p className="text-sm text-gray-600">{optimizedRoute.summary}</p>
                  )}
                </div>

                {/* FIXED: Pass correct props to LeafletMap */}
                <LeafletRouteMap
                  trackParcel={trackParcel}
                  optimizedRoute={optimizedRoute}
                  currentLocation={currentLocation}
                  isTracking={isTracking}
                />

                <div className="mt-6 bg-white shadow rounded-lg p-4">
                  <h4 className="font-medium mb-4">Delivery Order:</h4>
                  <ol className="space-y-3">
                    {optimizedRoute.waypoints?.map((waypoint, index) => (
                      <li key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {index + 1}. {waypoint.address}
                            </p>
                            {waypoint.trackingNumber && (
                              <p className="text-sm text-gray-500">
                                Parcel: #{waypoint.trackingNumber}
                              </p>
                            )}
                            {waypoint.distanceFromPrevious && (
                              <p className="text-sm text-gray-500">
                                Distance: {waypoint.distanceFromPrevious}
                              </p>
                            )}
                          </div>
                          {waypoint.type === 'delivery' && (
                            <button
                              onClick={() => completeDelivery(waypoint.trackingNumber, 'Delivered via optimized route')}
                              className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-3 rounded text-xs"
                            >
                              Mark Delivered
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <p className="text-gray-500">No route calculated yet. Click "Get Optimized Route" to generate one.</p>
                <button
                  onClick={fetchOptimizedRoute}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Generate Route Now
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}