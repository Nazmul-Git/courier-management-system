'use client'
import React, { useEffect, useRef, useState } from 'react';

const Map = ({ pickup, delivery, onClose }) => {
  const mapRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    // Initialize Google Maps
    const initMap = () => {
      try {
        setIsLoading(true);
        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 10,
          center: { lat: 0, lng: 0 }, // Default center
          styles: [
            {
              "featureType": "administrative",
              "elementType": "labels.text.fill",
              "stylers": [{"color": "#444444"}]
            },
            {
              "featureType": "landscape",
              "elementType": "all",
              "stylers": [{"color": "#f2f2f2"}]
            },
            {
              "featureType": "poi",
              "elementType": "all",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "road",
              "elementType": "all",
              "stylers": [{"saturation": -100}, {"lightness": 45}]
            },
            {
              "featureType": "road.highway",
              "elementType": "all",
              "stylers": [{"visibility": "simplified"}]
            },
            {
              "featureType": "road.arterial",
              "elementType": "labels.icon",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "transit",
              "elementType": "all",
              "stylers": [{"visibility": "off"}]
            },
            {
              "featureType": "water",
              "elementType": "all",
              "stylers": [{"color": "#d4e4f3"}, {"visibility": "on"}]
            }
          ]
        });

        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer();
        directionsRenderer.setMap(map);

        // Add markers for pickup and delivery
        const pickupMarker = new window.google.maps.Marker({
          position: null, // Will be set after geocoding
          map: map,
          title: 'Pickup Location',
          icon: {
            url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0VGNDgzMSI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDIgMC04LTMuNTgtOC04czMuNTgtOCA4LTggOCAzLjU4IDggOC0zLjU4IDgtOCA4eiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9IiNFRjQ4MzEiLz48L3N2Zz4=',
            scaledSize: new window.google.maps.Size(32, 32),
            origin: new window.google.maps.Point(0, 0),
            anchor: new window.google.maps.Point(16, 16)
          }
        });

        const deliveryMarker = new window.google.maps.Marker({
          position: null, // Will be set after geocoding
          map: map,
          title: 'Delivery Location',
          icon: {
            url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzEwQjE0NyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDIgMC04LTMuNTgtOC04czMuNTgtOCA4LTggOCAzLjU4IDggOC0zLjU4IDgtOCA4eiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9IiMxMEIxNDciLz48L3N2Zz4=',
            scaledSize: new window.google.maps.Size(32, 32),
            origin: new window.google.maps.Point(0, 0),
            anchor: new window.google.maps.Point(16, 16)
          }
        });

        // Geocode addresses to get coordinates
        const geocoder = new window.google.maps.Geocoder();

        const geocodeAddress = (address, marker) => {
          return new Promise((resolve) => {
            geocoder.geocode({ address }, (results, status) => {
              if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location;
                marker.setPosition(location);
                resolve(location);
              } else {
                console.error(`Geocode was not successful for the following reason: ${status}`);
                resolve(null);
              }
            });
          });
        };

        // Geocode both addresses
        Promise.all([
          geocodeAddress(pickup, pickupMarker),
          geocodeAddress(delivery, deliveryMarker)
        ]).then(([pickupLoc, deliveryLoc]) => {
          if (pickupLoc && deliveryLoc) {
            // Calculate route
            directionsService.route(
              {
                origin: pickupLoc,
                destination: deliveryLoc,
                travelMode: window.google.maps.TravelMode.DRIVING
              },
              (result, status) => {
                if (status === window.google.maps.DirectionsStatus.OK) {
                  directionsRenderer.setDirections(result);
                  
                  // Adjust map bounds to show both markers
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend(pickupLoc);
                  bounds.extend(deliveryLoc);
                  map.fitBounds(bounds);
                } else {
                  console.error(`Error fetching directions: ${status}`);
                  setMapError('Could not calculate route. Showing locations instead.');
                  
                  // Still show the markers even if route fails
                  const bounds = new window.google.maps.LatLngBounds();
                  bounds.extend(pickupLoc);
                  bounds.extend(deliveryLoc);
                  map.fitBounds(bounds);
                }
                setIsLoading(false);
              }
            );
          } else {
            setIsLoading(false);
            setMapError('Could not find one or both addresses.');
          }
        });
      } catch (error) {
        console.error('Error initializing map:', error);
        setIsLoading(false);
        setMapError('Failed to load map. Please try again later.');
      }
    };

    // Load Google Maps script if not already loaded
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      script.onerror = () => {
        setIsLoading(false);
        setMapError('Failed to load Google Maps. Please check your API key.');
      };
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, [pickup, delivery]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800">Delivery Route</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
            aria-label="Close map"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
              <span className="text-sm font-medium text-gray-700">Pickup:</span>
              <span className="text-sm text-gray-600 ml-1">{pickup}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-600 mr-2"></div>
              <span className="text-sm font-medium text-gray-700">Delivery:</span>
              <span className="text-sm text-gray-600 ml-1">{delivery}</span>
            </div>
          </div>
        </div>
        
        <div className="relative h-96 w-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading map...</p>
              </div>
            </div>
          )}
          
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10">
              <div className="text-center p-4">
                <svg className="h-12 w-12 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="mt-2 text-gray-800 font-medium">{mapError}</p>
              </div>
            </div>
          )}
          
          <div ref={mapRef} className="h-full w-full"></div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Map;