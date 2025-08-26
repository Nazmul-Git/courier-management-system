'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const agentIcon = new L.Icon({
  iconUrl: '/delivery-truck.png', 
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const parcelIcon = new L.Icon({
  iconUrl: '/package.png', 
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25]
});

const MapComponent = ({ origin, destination, agentLocation }) => {
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [map, setMap] = useState(null);

  // Geocode addresses to coordinates
  useEffect(() => {
    const geocodeAddress = async (address) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`
          )}`
        );
        const data = await response.json();
        if (data && data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
        return null;
      } catch (error) {
        console.error('Geocoding error:', error);
        return null;
      }
    };

    const getCoordinates = async () => {
      const originCoords = await geocodeAddress(origin);
      const destinationCoords = await geocodeAddress(destination);
      
      if (originCoords) setOriginCoords(originCoords);
      if (destinationCoords) setDestinationCoords(destinationCoords);
    };

    getCoordinates();
  }, [origin, destination]);

  // Fit map to show all points
  useEffect(() => {
    if (map && (originCoords || destinationCoords || agentLocation)) {
      const points = [];
      if (originCoords) points.push(originCoords);
      if (destinationCoords) points.push(destinationCoords);
      if (agentLocation) points.push([agentLocation.lat, agentLocation.lng]);
      
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [map, originCoords, destinationCoords, agentLocation]);

  return (
    <MapContainer
      center={[39.8283, -98.5795]} 
      zoom={4}
      style={{ height: '100%', width: '100%' }}
      whenCreated={setMap}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {originCoords && (
        <Marker position={originCoords} icon={parcelIcon}>
          <Popup>Pickup Location</Popup>
        </Marker>
      )}
      
      {destinationCoords && (
        <Marker position={destinationCoords} icon={parcelIcon}>
          <Popup>Delivery Location</Popup>
        </Marker>
      )}
      
      {agentLocation && (
        <Marker position={[agentLocation.lat, agentLocation.lng]} icon={agentIcon}>
          <Popup>Delivery Agent</Popup>
        </Marker>
      )}
      
      {originCoords && destinationCoords && (
        <Polyline
          positions={[originCoords, destinationCoords]}
          color="blue"
          weight={3}
          opacity={0.7}
        />
      )}
    </MapContainer>
  );
};

export default MapComponent;