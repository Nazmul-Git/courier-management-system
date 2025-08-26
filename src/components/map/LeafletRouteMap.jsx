// app/components/LeafletRouteMap.jsx
'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import RoutingMachine from '@/components/map/RoutingMachine';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const createCustomIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const originIcon = createCustomIcon('green');
const deliveryIcon = createCustomIcon('blue');
const currentIcon = createCustomIcon('red');

// Known locations in Dhaka for better accuracy
const KNOWN_DHAKA_LOCATIONS = {
  'banasree': { lat: 23.7741, lng: 90.4277 },
  'gulshan': { lat: 23.7940, lng: 90.4150 },
  'dhanmondi': { lat: 23.7465, lng: 90.3760 },
  'uttara': { lat: 23.8759, lng: 90.3795 },
  'mirpur': { lat: 23.8223, lng: 90.3654 },
  'motijheel': { lat: 23.7341, lng: 90.4129 },
  'farmgate': { lat: 23.7550, lng: 90.3850 },
  'mohakhali': { lat: 23.7791, lng: 90.4054 }
};

export default function LeafletRouteMap({ trackParcel, optimizedRoute, currentLocation, isTracking }) {
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routingInfo, setRoutingInfo] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  useEffect(() => {
    if (optimizedRoute && optimizedRoute.waypoints && optimizedRoute.waypoints.length > 0 &&
      optimizedRoute.distance !== "0 km" && optimizedRoute.duration !== "0 min") {
      setRouteData(optimizedRoute);
    } else if (trackParcel) {
      createBasicRouteFromParcel();
    } else {
      if (!routeData || routeData.distance === "0 km") {
        fetchRouteData();
      }
    }
  }, [optimizedRoute, trackParcel]);

  // Improved geocoding function with better address parsing
  const mockGeocodeAddress = async (addressObj) => {
    try {
      const { street, city, state, zipCode, country } = addressObj;
      
      // Create a searchable address string
      const addressString = `${street} ${city} ${state} ${zipCode}`.toLowerCase();
      
      // Check for known locations first
      for (const [key, coords] of Object.entries(KNOWN_DHAKA_LOCATIONS)) {
        if (addressString.includes(key)) {
          // Add some randomness based on street details for variety
          const streetHash = street.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const latVariation = (streetHash % 100) / 10000;
          const lngVariation = (streetHash % 100) / 10000;
          
          return {
            lat: coords.lat + latVariation,
            lng: coords.lng + lngVariation
          };
        }
      }

      // Fallback: Use Dhaka center coordinates with variation based on address
      const hash = addressString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Use more realistic coordinates around Dhaka
      const baseLat = 23.8103;
      const baseLng = 90.4125;
      
      // Add variation but keep within reasonable Dhaka bounds
      const lat = baseLat + ((hash % 200) - 100) / 1000; // ±0.1 degree variation
      const lng = baseLng + ((hash % 200) - 100) / 1000; // ±0.1 degree variation
      
      return { lat, lng };
    } catch (error) {
      console.error('Geocoding error:', error);
      // Return default Dhaka coordinates
      return { lat: 23.8103, lng: 90.4125 };
    }
  };

  const createBasicRouteFromParcel = async () => {
    if (!trackParcel) return;

    try {
      setLoading(true);
      
      // Geocode origin and destination addresses
      const [originCoords, destinationCoords] = await Promise.all([
        mockGeocodeAddress(trackParcel.origin),
        mockGeocodeAddress(trackParcel.destination)
      ]);

      console.log('Origin coords:', originCoords);
      console.log('Destination coords:', destinationCoords);

      // Create delivery point
      const deliveryPoint = {
        lat: destinationCoords.lat,
        lng: destinationCoords.lng,
        address: `${trackParcel.destination.street}, ${trackParcel.destination.city}, ${trackParcel.destination.state} ${trackParcel.destination.zipCode}`,
        trackingNumber: trackParcel.trackingNumber,
        parcelId: trackParcel.id
      };

      // Create origin point
      const originPoint = {
        lat: originCoords.lat,
        lng: originCoords.lng,
        address: `${trackParcel.origin.street}, ${trackParcel.origin.city}, ${trackParcel.origin.state} ${trackParcel.origin.zipCode}`,
        isOrigin: true
      };

      setRouteData({
        waypoints: [originPoint, deliveryPoint],
        distance: "Calculating...",
        duration: "Calculating...",
        parcels: [trackParcel]
      });

    } catch (error) {
      console.error('Error creating route:', error);
      setError('Failed to create route from parcel data');
      
      // Fallback: Use known Dhaka coordinates
      const deliveryPoint = {
        lat: 23.8103 + 0.02,
        lng: 90.4125 + 0.02,
        address: `${trackParcel.destination.street}, ${trackParcel.destination.city}`,
        trackingNumber: trackParcel.trackingNumber,
        parcelId: trackParcel.id
      };

      const originPoint = {
        lat: 23.7741, // Banasree coordinates
        lng: 90.4277,
        address: `${trackParcel.origin.street}, ${trackParcel.origin.city}`,
        isOrigin: true
      };

      setRouteData({
        waypoints: [originPoint, deliveryPoint],
        distance: "Approximate route",
        duration: "Unknown",
        parcels: [trackParcel]
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRouteData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agents/optimized-route');
      const data = await response.json();

      if (data.success && data.waypoints && data.waypoints.length > 0) {
        setRouteData(data);
      } else {
        if (trackParcel) {
          createBasicRouteFromParcel();
        } else {
          setError(data.error || 'No valid route data available');
        }
      }
    } catch (err) {
      if (trackParcel) {
        createBasicRouteFromParcel();
      } else {
        setError('Error fetching route data');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryStatus = async (parcelId, status, notes = '') => {
    try {
      const response = await fetch('/api/agents/update-parcel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parcelId, status, notes }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the route data
        if (trackParcel) {
          createBasicRouteFromParcel();
        } else {
          fetchRouteData();
        }
        return true;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      return false;
    }
  };

  const handleRouteFound = (routeInfo) => {
    setRoutingInfo(routeInfo);
    
    // Store route coordinates for the polyline
    if (routeInfo.coordinates) {
      setRouteCoordinates(routeInfo.coordinates);
    }
    
    // Update route data with calculated distance and duration
    if (routeData && !routeInfo.error) {
      setRouteData(prev => ({
        ...prev,
        distance: routeInfo.totalDistance,
        duration: routeInfo.totalTime
      }));
    }
  };

  const getParcelById = (parcelId) => {
    if (!trackParcel) return null;
    return trackParcel.id === parcelId ? trackParcel : null;
  };

  const getParcelByTrackingNumber = (trackingNumber) => {
    if (!trackParcel) return null;
    return trackParcel.trackingNumber === trackingNumber ? trackParcel : null;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg text-gray-600">Loading route data...</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg text-red-600">Error: {error}</div>
      <button
        onClick={fetchRouteData}
        className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Retry
      </button>
    </div>
  );

  const hasValidRouteData = routeData && routeData.waypoints && routeData.waypoints.length > 0;

  if (!hasValidRouteData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">No active deliveries found</div>
        <button
          onClick={fetchRouteData}
          className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  const routingWaypoints = routeData.waypoints.map(waypoint => 
    L.latLng(waypoint.lat, waypoint.lng)
  );

  const center = routeData.waypoints[0] || { lat: 23.8103, lng: 90.4125 };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Route Summary */}
      <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500 mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">Delivery Route Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Distance</p>
            <p className="text-lg font-bold text-gray-800">
              {routingInfo?.totalDistance || routeData.distance || "Calculating..."}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Estimated Duration</p>
            <p className="text-lg font-bold text-gray-800">
              {routingInfo?.totalTime || routeData.duration || "Calculating..."}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Deliveries</p>
            <p className="text-lg font-bold text-gray-800">{routeData.waypoints.length - 1}</p>
          </div>
        </div>
        {routingInfo?.error && (
          <div className="mt-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 text-sm">
            Routing service: {routingInfo.error}. Showing approximate route.
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-96 w-full rounded-lg shadow-md mb-6 overflow-hidden">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={12}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Manual markers with custom popups */}
          {routeData.waypoints.map((waypoint, index) => {
            const parcel = waypoint.parcelId ? getParcelById(waypoint.parcelId) :
              waypoint.trackingNumber ? getParcelByTrackingNumber(waypoint.trackingNumber) : null;
            const customerName = trackParcel?.customer?.name || 'Unknown';
            const customerPhone = trackParcel?.customer?.phone || 'N/A';

            return (
              <Marker
                key={index}
                position={[waypoint.lat, waypoint.lng]}
                icon={index === 0 ? originIcon : deliveryIcon}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h4 className="font-semibold text-gray-800 mb-2">
                      {index === 0 ? 'Starting Point' : `Delivery #${index}`}
                    </h4>
                    <p className="text-sm text-gray-600"><strong>Address:</strong> {waypoint.address}</p>
                    {waypoint.trackingNumber && (
                      <p className="text-sm text-gray-600"><strong>Tracking:</strong> {waypoint.trackingNumber}</p>
                    )}
                    <p className="text-sm text-gray-600"><strong>Customer:</strong> {customerName}</p>
                    <p className="text-sm text-gray-600"><strong>Phone:</strong> {customerPhone}</p>
                    {waypoint.distanceFromPrevious && (
                      <p className="text-sm text-gray-600"><strong>Distance:</strong> {waypoint.distanceFromPrevious}</p>
                    )}
                    {index > 0 && parcel && (
                      <button
                        onClick={() => updateDeliveryStatus(
                          parcel.id,
                          'delivered'
                        )}
                        className="mt-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Mark as Delivered
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Current location marker */}
          {currentLocation && currentLocation.lat && currentLocation.lng && (
            <Marker
              position={[currentLocation.lat, currentLocation.lng]}
              icon={currentIcon}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-semibold text-gray-800 mb-2">Your Current Location</h4>
                  <p className="text-sm text-gray-600">Lat: {currentLocation.lat.toFixed(4)}</p>
                  <p className="text-sm text-gray-600">Lng: {currentLocation.lng.toFixed(4)}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Fallback route line if routing machine fails or no coordinates */}
          {routeCoordinates.length === 0 && (
            <Polyline
              positions={routeData.waypoints.map(wp => [wp.lat, wp.lng])}
              color="#0066ff"
              weight={4}
              opacity={0.7}
            />
          )}

          {/* Use your existing RoutingMachine component */}
          {routingWaypoints.length > 1 && (
            <RoutingMachine
              waypoints={routingWaypoints}
              onRouteFound={handleRouteFound}
            />
          )}
        </MapContainer>
      </div>

      {/* Delivery List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Delivery Schedule</h3>
        <div className="space-y-4">
          {routeData.waypoints.slice(1).map((waypoint, index) => {
            const parcel = waypoint.parcelId ? getParcelById(waypoint.parcelId) :
              waypoint.trackingNumber ? getParcelByTrackingNumber(waypoint.trackingNumber) : null;
            const customerName = trackParcel?.customer?.name || 'Unknown';
            const customerPhone = trackParcel?.customer?.phone || 'N/A';
            const parcelStatus = trackParcel?.status || 'Pending';

            return (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-2">Stop #{index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Customer:</strong> {customerName}</p>
                    <p><strong>Phone:</strong> {customerPhone}</p>
                    <p><strong>Address:</strong> {waypoint.address}</p>
                    <p><strong>Tracking:</strong> {trackParcel.trackingNumber}</p>
                  </div>
                  <div>
                    <p><strong>Distance:</strong> {waypoint.distanceFromPrevious || "Calculating..."}</p>
                    <p><strong>Time:</strong> {waypoint.durationFromPrevious || "Calculating..."}</p>
                    <p><strong>Status:</strong> <span className="capitalize">{parcelStatus.replace(/_/g, ' ')}</span></p>
                    {parcel?.specialInstructions && (
                      <p><strong>Instructions:</strong> {parcel.specialInstructions}</p>
                    )}
                  </div>
                </div>
                {parcel && (
                  <button
                    onClick={() => updateDeliveryStatus(parcel.id, 'delivered')}
                    className="mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                  >
                    Mark as Delivered
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}