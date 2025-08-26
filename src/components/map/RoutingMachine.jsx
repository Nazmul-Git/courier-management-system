// components/map/RoutingMachine.jsx
'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

export default function RoutingMachine({ waypoints, onRouteFound }) {
  const map = useMap();
  const routingControlRef = useRef(null);
  const polylineRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Validate waypoints
    if (!waypoints || waypoints.length < 2 || !waypoints.every(wp => wp && typeof wp.lat === 'number' && typeof wp.lng === 'number')) {
      // Clean up if waypoints are insufficient or invalid
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current);
        } catch (error) {
          console.warn('Error removing routing control:', error);
        }
        routingControlRef.current = null;
      }
      if (polylineRef.current) {
        try {
          map.removeLayer(polylineRef.current);
        } catch (error) {
          console.warn('Error removing polyline:', error);
        }
        polylineRef.current = null;
      }
      return;
    }

    // Convert waypoints to LatLng objects
    const formattedWaypoints = waypoints.map(wp => L.latLng(wp.lat, wp.lng));

    // Skip if waypoints haven't changed meaningfully
    if (isInitializedRef.current && routingControlRef.current) {
      try {
        const currentWaypoints = routingControlRef.current.getWaypoints();
        if (currentWaypoints && waypoints.length === currentWaypoints.length) {
          const hasChanged = formattedWaypoints.some((newWp, i) => {
            const currentWp = currentWaypoints[i].latLng || currentWaypoints[i];
            return newWp.lat !== currentWp.lat || newWp.lng !== currentWp.lng;
          });
          if (!hasChanged) return;
        }
      } catch (error) {
        console.warn('Error comparing waypoints:', error);
      }
    }

    let routingControl = null;

    try {
      // Check if Leaflet Routing Machine is loaded
      if (typeof L.Routing?.control !== 'function') {
        console.error('Leaflet Routing Machine is not properly loaded');
        onRouteFound?.({ error: 'Routing service not available' });
        return;
      }

      // Clean up any existing routing control
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current);
        } catch (error) {
          console.warn('Error removing previous routing control:', error);
        }
        routingControlRef.current = null;
      }

      // Clean up any existing polyline
      if (polylineRef.current) {
        try {
          map.removeLayer(polylineRef.current);
        } catch (error) {
          console.warn('Error removing previous polyline:', error);
        }
        polylineRef.current = null;
      }

      // Configure OSRM router
      const router = L.Routing.osrmv1({
        profile: 'driving',
        timeout: 30000,
        serviceUrl: 'https://router.project-osrm.org/route/v1'
      });

      // Create routing control
      routingControl = L.Routing.control({
        waypoints: formattedWaypoints,
        router: router,
        lineOptions: {
          styles: [{ color: '#0066ff', weight: 4, opacity: 0.7 }],
          addWaypoints: false,
          extendToWaypoints: false,
          missingRouteTolerance: 0
        },
        createMarker: () => null,
        show: false,
        routeWhileDragging: false,
        addWaypoints: false,
        fitSelectedRoutes: false,
        showAlternatives: false
      });

      // Store the routing control instance
      routingControlRef.current = routingControl;
      isInitializedRef.current = true;

      // Handle route found
      routingControl.on('routesfound', function (e) {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const route = routes[0];
          
          // Remove existing polyline
          if (polylineRef.current) {
            try {
              map.removeLayer(polylineRef.current);
            } catch (error) {
              console.warn('Error removing existing polyline:', error);
            }
          }
          
          // Draw the route
          const polyline = L.polyline(route.coordinates, {
            color: '#0066ff',
            weight: 4,
            opacity: 0.7,
            smoothFactor: 1
          }).addTo(map);
          
          polylineRef.current = polyline;
          
          // Fit map to route bounds with padding
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

          onRouteFound?.({
            totalDistance: (route.summary.totalDistance / 1000).toFixed(1) + ' km',
            totalTime: Math.round(route.summary.totalTime / 60) + ' min',
            coordinates: route.coordinates,
            error: null
          });
        }
      });

      // Handle route error
      routingControl.on('routingerror', function (e) {
        console.error('Routing error:', e.error);
        onRouteFound?.({
          error: e.error?.message || 'Failed to calculate route',
          totalDistance: 'N/A',
          totalTime: 'N/A',
          coordinates: []
        });
      });

      // Add to map
      routingControl.addTo(map);
      
      // Hide the routing control container
      setTimeout(() => {
        try {
          const container = routingControl.getContainer();
          if (container) {
            container.style.display = 'none';
          }
        } catch (error) {
          console.warn('Error hiding routing container:', error);
        }
      }, 100);

    } catch (error) {
      console.error('Failed to initialize routing machine:', error);
      onRouteFound?.({
        error: error.message,
        totalDistance: 'N/A',
        totalTime: 'N/A',
        coordinates: []
      });
    }
  }, [map, waypoints, onRouteFound]);

  return null;
}