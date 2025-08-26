'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import { useAuth } from '@/hooks/useAuth';
import { useAuthActions } from '@/hooks/useAuthActions';
import LeafletRouteMap from '@/components/map/LeafletRouteMap';


const CustomerParcelsPage = () => {
  const [activeTab, setActiveTab] = useState('book');
  const [parcels, setParcels] = useState([]);
  const [trackingData, setTrackingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const { user, isAuthenticated, isCustomer, token } = useAuth();
  const { logout } = useAuthActions();

  // console.log(user,isAuthenticated,isCustomer, token)
  // Form states
  const [pickupAddress, setPickupAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [parcelDetails, setParcelDetails] = useState({
    type: 'document',
    weight: '',
    dimensions: {
      length: '',
      width: '',
      height: ''
    },
    paymentType: 'prepaid',
    codAmount: ''
  });

  // Redirect if not authenticated or not a customer
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    } else if (!isCustomer) {
      if (user?.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (user?.role === 'agent') {
        router.push('/agents/deliveries');
      }
    }
  }, [isAuthenticated, isCustomer, user?.role, router]);

  useEffect(() => {
    if (activeTab === 'history' && isCustomer) {
      loadParcels();
    }
  }, [activeTab, isCustomer]);

  const loadParcels = async () => {
    if (!isCustomer) return;

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/customer/parcels', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setParcels(data.parcels || []);
      } else if (response.status === 401) {
        // Token expired or invalid
        logout();
        router.push('/auth/login');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch parcels');
      }
    } catch (error) {
      console.error('Error fetching parcels:', error);
      setError('Failed to load parcels. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookParcel = async (e) => {
    e.preventDefault();
    if (!isCustomer) return;

    setIsLoading(true);
    setError('');

    const requestData = {
      origin: pickupAddress,
      destination: deliveryAddress,
      type: parcelDetails.type,
      weight: parseFloat(parcelDetails.weight),
      dimensions: `${parcelDetails.dimensions.length}x${parcelDetails.dimensions.width}x${parcelDetails.dimensions.height}`,
      paymentType: parcelDetails.paymentType,
      codAmount: parcelDetails.paymentType === 'cod' ? parseFloat(parcelDetails.codAmount) : 0
    };

    try {
      const response = await fetch('/api/customer/parcels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const data = await response.json();
        alert('Parcel booked successfully! Tracking #: ' + data.parcel.trackingNumber);

        // Reset form
        setPickupAddress({ street: '', city: '', state: '', zipCode: '' });
        setDeliveryAddress({ street: '', city: '', state: '', zipCode: '' });
        setParcelDetails({
          type: 'document',
          weight: '',
          dimensions: { length: '', width: '', height: '' },
          paymentType: 'prepaid',
          codAmount: ''
        });

        // Switch to history tab and reload parcels
        setActiveTab('history');
        loadParcels();
      } else if (response.status === 401) {
        logout();
        router.push('/auth/login');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to book parcel. Please try again.');
        if (errorData.details) {
          alert('Validation errors:\n' + errorData.details.join('\n'));
        }
      }
    } catch (error) {
      console.error('Error booking parcel:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelParcel = async (parcelId) => {
    if (!confirm('Are you sure you want to cancel this parcel?')) return;

    // Use token from Redux state instead of localStorage
    if (!token) {
      console.error('No authentication token found');
      alert('Your session has expired. Please login again.');
      logout();
      router.push('/auth/login');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log(user, token)
      const response = await fetch(`/api/customer/parcels/${parcelId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (response.ok) {
        alert('Parcel cancelled successfully!');
        loadParcels();
      } else if (response.status === 401) {
        logout();
        router.push('/auth/login');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to cancel parcel');
      }
    } catch (error) {
      console.error('Error cancelling parcel:', error);
      setError('Failed to cancel parcel. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackParcel = (trackingNumber) => {
    const parcelToTrack = parcels.find(p => p.trackingNumber === trackingNumber);
    console.log(parcelToTrack);
    if (parcelToTrack) {
      setTrackingData(parcelToTrack);
      setActiveTab('track');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'picked_up': return 'bg-blue-100 text-blue-800';
      case 'in_transit': return 'bg-indigo-100 text-indigo-800';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    return status.replace('_', ' ').toUpperCase();
  };

  // Show loading while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Show unauthorized if not a customer
  if (!isCustomer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Parcel Delivery - Customer Dashboard</title>
        <meta name="description" content="Manage your parcel deliveries" />
      </Head>

      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Parcel Delivery System</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">Welcome, {user?.name || 'Customer'}</span>
            <button
              onClick={handleLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('book')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'book' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              Book Parcel
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              My Parcels
            </button>
            <button
              onClick={() => setActiveTab('track')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'track' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              Track Parcel
            </button>
          </nav>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {!isLoading && activeTab === 'book' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Book a New Parcel</h2>
            <form onSubmit={handleBookParcel}>
              <div className="grid grid-cols-1 gap-6 mb-6">
                {/* Pickup Address */}
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">Pickup Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pickup-street" className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        id="pickup-street"
                        required
                        value={pickupAddress.street}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, street: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="pickup-city" className="block text-sm font-medium text-gray-700 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        id="pickup-city"
                        required
                        value={pickupAddress.city}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="pickup-state" className="block text-sm font-medium text-gray-700 mb-1">
                        State *
                      </label>
                      <input
                        type="text"
                        id="pickup-state"
                        required
                        value={pickupAddress.state}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="pickup-zip" className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code *
                      </label>
                      <input
                        type="text"
                        id="pickup-zip"
                        required
                        value={pickupAddress.zipCode}
                        onChange={(e) => setPickupAddress({ ...pickupAddress, zipCode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">Delivery Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="delivery-street" className="block text-sm font-medium text-gray-700 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        id="delivery-street"
                        required
                        value={deliveryAddress.street}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, street: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="delivery-city" className="block text-sm font-medium text-gray-700 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        id="delivery-city"
                        required
                        value={deliveryAddress.city}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="delivery-state" className="block text-sm font-medium text-gray-700 mb-1">
                        State *
                      </label>
                      <input
                        type="text"
                        id="delivery-state"
                        required
                        value={deliveryAddress.state}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="delivery-zip" className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code *
                      </label>
                      <input
                        type="text"
                        id="delivery-zip"
                        required
                        value={deliveryAddress.zipCode}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, zipCode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Parcel Details */}
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">Parcel Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="parcel-type" className="block text-sm font-medium text-gray-700 mb-1">
                        Parcel Type
                      </label>
                      <select
                        id="parcel-type"
                        value={parcelDetails.type}
                        onChange={(e) => setParcelDetails({ ...parcelDetails, type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="document">Document</option>
                        <option value="package">Package</option>
                        <option value="fragile">Fragile</option>
                        <option value="perishable">Perishable</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                        Weight (kg) *
                      </label>
                      <input
                        type="number"
                        id="weight"
                        required
                        min="0.1"
                        step="0.1"
                        max="100"
                        value={parcelDetails.weight}
                        onChange={(e) => setParcelDetails({ ...parcelDetails, weight: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="length" className="block text-sm font-medium text-gray-700 mb-1">
                        Length (cm) *
                      </label>
                      <input
                        type="number"
                        id="length"
                        required
                        min="1"
                        value={parcelDetails.dimensions.length}
                        onChange={(e) => setParcelDetails({
                          ...parcelDetails,
                          dimensions: { ...parcelDetails.dimensions, length: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="width" className="block text-sm font-medium text-gray-700 mb-1">
                        Width (cm) *
                      </label>
                      <input
                        type="number"
                        id="width"
                        required
                        min="1"
                        value={parcelDetails.dimensions.width}
                        onChange={(e) => setParcelDetails({
                          ...parcelDetails,
                          dimensions: { ...parcelDetails.dimensions, width: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">
                        Height (cm) *
                      </label>
                      <input
                        type="number"
                        id="height"
                        required
                        min="1"
                        value={parcelDetails.dimensions.height}
                        onChange={(e) => setParcelDetails({
                          ...parcelDetails,
                          dimensions: { ...parcelDetails.dimensions, height: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">Payment Method</h3>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="prepaid"
                        checked={parcelDetails.paymentType === 'prepaid'}
                        onChange={() => setParcelDetails({ ...parcelDetails, paymentType: 'prepaid' })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2">Prepaid</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="paymentType"
                        value="cod"
                        checked={parcelDetails.paymentType === 'cod'}
                        onChange={() => setParcelDetails({ ...parcelDetails, paymentType: 'cod' })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2">Cash on Delivery</span>
                    </label>
                  </div>

                  {parcelDetails.paymentType === 'cod' && (
                    <div className="mt-3">
                      <label htmlFor="cod-amount" className="block text-sm font-medium text-gray-700 mb-1">
                        COD Amount *
                      </label>
                      <input
                        type="number"
                        id="cod-amount"
                        required
                        min="1"
                        value={parcelDetails.codAmount}
                        onChange={(e) => setParcelDetails({ ...parcelDetails, codAmount: e.target.value })}
                        className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Booking...' : 'Book Parcel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {!isLoading && activeTab === 'history' && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">My Parcels</h2>
              <button
                onClick={loadParcels}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm"
              >
                Refresh
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {parcels.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500">You haven't booked any parcels yet.</p>
                </div>
              ) : (
                parcels.map((parcel) => (
                  <div key={parcel.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-md font-medium text-gray-900">
                          Tracking #: {parcel.trackingNumber}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          From: {parcel.origin.city}, {parcel.origin.state} → To: {parcel.destination.city}, {parcel.destination.state}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Weight: {parcel.weight} kg | Dimensions: {parcel.dimensions}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Booked on: {formatDate(parcel.createdAt)}
                        </p>
                        {parcel.estimatedDelivery && (
                          <p className="text-sm text-blue-600 mt-1">
                            Estimated Delivery: {formatDate(parcel.estimatedDelivery)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(parcel.status)}`}>
                          {getStatusText(parcel.status)}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleTrackParcel(parcel.trackingNumber)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Track
                          </button>
                          {parcel.status === 'pending' && (
                            <button
                              onClick={() => handleCancelParcel(parcel.id)}
                              className="text-red-600 hover:text-red-900 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!isLoading && activeTab === 'track' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Track Your Parcel</h2>

            {!trackingData ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Select a parcel from your history to track or enter a tracking number.</p>
              </div>
            ) : (
              <div>
                <div className="bg-gray-50 p-4 rounded-md mb-6">
                  <h3 className="text-md font-medium text-gray-900 mb-2">Parcel Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Tracking Number</p>
                      <p className="font-medium">{trackingData.trackingNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Status</p>
                      <p className="font-medium">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(trackingData.status)}`}>
                          {getStatusText(trackingData.status)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Estimated Delivery</p>
                      <p className="font-medium">
                        {formatDate(trackingData.estimatedDelivery)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Last Updated</p>
                      <p className="font-medium">{formatDate(trackingData.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Map visualization */}
                <div className="mb-6">
                  <h3 className="text-md font-medium text-gray-900 mb-4">Delivery Route</h3>
                  <LeafletRouteMap
                    trackParcel={trackingData}
                    currentLocation={null} // You can pass real current location if available
                    isTracking={true}
                  />
                </div>

                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-4">Parcel Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600">Origin</p>
                      <p className="font-medium">
                        {trackingData.origin.street}, {trackingData.origin.city}, {trackingData.origin.state} {trackingData.origin.zipCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Destination</p>
                      <p className="font-medium">
                        {trackingData.destination.street}, {trackingData.destination.city}, {trackingData.destination.state} {trackingData.destination.zipCode}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Weight & Dimensions</p>
                      <p className="font-medium">
                        {trackingData.weight} kg, {trackingData.dimensions}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Payment Type</p>
                      <p className="font-medium capitalize">
                        {trackingData.paymentType} {trackingData.paymentType === 'cod' && `($${trackingData.codAmount})`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerParcelsPage;