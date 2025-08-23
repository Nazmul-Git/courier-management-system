// pages/api/agent/optimized-route.js
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Get token from cookies using cookie parser
  const authToken = req.cookies.get('auth_token');

  if (!authToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);

    await dbConnect();

    try {
      // Get all undelivered parcels assigned to this agent
      const parcels = await Parcel.find({ 
        assignedAgent: decoded.userId || decoded.id,
        status: { $nin: ['delivered', 'cancelled'] }
      });
      
      if (parcels.length === 0) {
        return res.status(404).json({ message: 'No parcels to deliver' });
      }
      
      // In a real implementation, you would:
      // 1. Extract destination coordinates from parcels
      // 2. Call Google Maps Directions API with waypoints optimization
      // 3. Return the optimized route
      
      // This is a simplified mock response
      const optimizedRoute = calculateOptimizedRoute(parcels);
      
      return res.status(200).json(optimizedRoute);
    } catch (error) {
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
    
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Mock function to simulate Google Maps API route optimization
function calculateOptimizedRoute(parcels) {
  // This is a simplified mock implementation
  // In a real app, you would use the Google Maps Directions API
  
  // Sort parcels by city and zip code for mock optimization
  const sortedParcels = [...parcels].sort((a, b) => {
    if (a.destination.city !== b.destination.city) {
      return a.destination.city.localeCompare(b.destination.city);
    }
    return a.destination.zipCode.localeCompare(b.destination.zipCode);
  });
  
  const waypoints = sortedParcels.map((parcel, index) => ({
    address: `${parcel.destination.street}, ${parcel.destination.city}, ${parcel.destination.zipCode}`,
    trackingNumber: parcel.trackingNumber,
    distanceFromPrevious: index === 0 ? 'Start' : `${(Math.random() * 5 + 1).toFixed(1)} km`
  }));
  
  // Calculate total distance and time based on number of parcels
  const totalDistance = (waypoints.length * 2.5).toFixed(1);
  const totalTime = (waypoints.length * 8);
  
  return {
    distance: `${totalDistance} km`,
    duration: `${Math.floor(totalTime / 60)}h ${totalTime % 60}m`,
    waypoints
  };
}