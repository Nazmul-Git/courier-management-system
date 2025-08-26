// app/api/agents/optimized-route/route.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';

async function verifyAgentAuth(request) {
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'agent') {
      return { error: 'Access denied. Agent role required.', status: 403 };
    }
    
    return { decoded };
  } catch (error) {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

// Simple fallback coordinates based on zip code areas in Dhaka
function getApproximateCoordinates(zipCode) {
  const zipAreas = {
    '1219': { lat: 23.8103, lng: 90.4125 }, // Default Dhaka
    '1200': { lat: 23.7500, lng: 90.4000 }, // Central Dhaka
    '1212': { lat: 23.7800, lng: 90.4200 }, // Eastern Dhaka
    '1216': { lat: 23.7900, lng: 90.3500 }, // Western Dhaka
    '1217': { lat: 23.8300, lng: 90.3700 }, // Northern Dhaka
    '1218': { lat: 23.7700, lng: 90.4300 }, // Southern Dhaka
  };
  
  return zipAreas[zipCode] || zipAreas['1219'];
}

export async function GET(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAgentAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const agentId = authResult.decoded.id;

    // Get parcels that need delivery
    const parcels = await Parcel.find({
      assignedAgent: agentId,
      status: { $in: ['picked_up', 'in_transit', 'out_for_delivery', 'assigned'] }
    })
    .select('trackingNumber destination status origin customer specialInstructions weight dimensions paymentType codAmount')
    .populate('customer', 'name phone email');

    if (parcels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active deliveries for route optimization',
        waypoints: [],
        distance: '0 km',
        duration: '0 min',
        optimized: false,
        parcels: []
      });
    }

    // Get optimized route
    const optimizedRoute = simulateRouteOptimization(parcels);

    return NextResponse.json({
      success: true,
      ...optimizedRoute,
      parcels: parcels.map(parcel => ({
        id: parcel._id.toString(),
        trackingNumber: parcel.trackingNumber,
        status: parcel.status,
        origin: parcel.origin,
        destination: parcel.destination,
        weight: parcel.weight,
        dimensions: parcel.dimensions,
        paymentType: parcel.paymentType,
        codAmount: parcel.codAmount,
        specialInstructions: parcel.specialInstructions,
        customer: parcel.customer
      }))
    });

  } catch (error) {
    console.error('Error generating optimized route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Improved route optimization simulation
function simulateRouteOptimization(parcels) {
  // Use agent's location as origin
  const agentLocation = parcels[0]?.origin || { 
    street: "Starting Point", 
    city: "Dhaka",
    state: "Dhaka",
    zipCode: "1219",
    country: "Bangladesh"
  };

  const agentCoords = getApproximateCoordinates(agentLocation.zipCode);
  const defaultLat = 23.8103;
  const defaultLng = 90.4125;

  const waypoints = [];
  
  // Add origin with coordinates
  waypoints.push({
    address: `${agentLocation.street}, ${agentLocation.city}, ${agentLocation.state}`,
    type: 'origin',
    distanceFromPrevious: '0 km',
    durationFromPrevious: '0 min',
    lat: agentCoords.lat,
    lng: agentCoords.lng,
    trackingNumber: 'ORIGIN',
    status: 'origin'
  });

  // Calculate distances using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  let currentLocation = { 
    lat: agentCoords.lat, 
    lng: agentCoords.lng 
  };
  
  // Create parcels with coordinates
  const parcelsWithCoords = parcels.map(parcel => {
    const destinationCoords = getApproximateCoordinates(parcel.destination.zipCode);
    return {
      ...parcel,
      destinationCoords,
      destinationAddress: `${parcel.destination.street}, ${parcel.destination.city}, ${parcel.destination.state}`
    };
  });

  const remainingParcels = [...parcelsWithCoords];
  let totalDistance = 0;
  let totalDuration = 0;
  let optimized = true;

  // If we only have the origin point, create fallback delivery points
  if (remainingParcels.length === 0) {
    optimized = false;
    parcels.forEach((parcel, index) => {
      // Create approximate coordinates based on index
      const approxLat = defaultLat + (index * 0.01);
      const approxLng = defaultLng + (index * 0.01);
      const distance = index === 0 ? 1.0 : index * 0.5;
      const duration = index === 0 ? 5 : index * 2;
      
      waypoints.push({
        address: `${parcel.destination.street}, ${parcel.destination.city}, ${parcel.destination.state}`,
        trackingNumber: parcel.trackingNumber,
        status: parcel.status,
        customerName: parcel.customer?.name || 'Unknown',
        customerPhone: parcel.customer?.phone || 'N/A',
        distanceFromPrevious: `${distance.toFixed(1)} km`,
        durationFromPrevious: `${duration} min`,
        type: 'delivery',
        lat: approxLat,
        lng: approxLng,
        parcelData: {
          weight: parcel.weight,
          dimensions: parcel.dimensions,
          paymentType: parcel.paymentType,
          codAmount: parcel.codAmount,
          specialInstructions: parcel.specialInstructions
        }
      });

      totalDistance += distance;
      totalDuration += duration;
    });
  } else {
    // Optimize route with actual coordinates
    while (remainingParcels.length > 0) {
      // Find nearest parcel
      let nearestIndex = 0;
      let minDistance = Infinity;

      remainingParcels.forEach((parcel, index) => {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          parcel.destinationCoords.lat,
          parcel.destinationCoords.lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      const nearestParcel = remainingParcels[nearestIndex];
      const duration = Math.round(minDistance * 3); 
      
      waypoints.push({
        address: nearestParcel.destinationAddress,
        trackingNumber: nearestParcel.trackingNumber,
        status: nearestParcel.status,
        customerName: nearestParcel.customer?.name || 'Unknown',
        customerPhone: nearestParcel.customer?.phone || 'N/A',
        distanceFromPrevious: `${minDistance.toFixed(1)} km`,
        durationFromPrevious: `${duration} min`,
        type: 'delivery',
        lat: nearestParcel.destinationCoords.lat,
        lng: nearestParcel.destinationCoords.lng,
        parcelData: {
          weight: nearestParcel.weight,
          dimensions: nearestParcel.dimensions,
          paymentType: nearestParcel.paymentType,
          codAmount: nearestParcel.codAmount,
          specialInstructions: nearestParcel.specialInstructions
        }
      });

      totalDistance += minDistance;
      totalDuration += duration;
      currentLocation = { 
        lat: nearestParcel.destinationCoords.lat, 
        lng: nearestParcel.destinationCoords.lng 
      };
      remainingParcels.splice(nearestIndex, 1);
    }
  }

  return {
    waypoints,
    distance: `${totalDistance.toFixed(1)} km`,
    duration: `${totalDuration} min`,
    optimized,
    summary: optimized 
      ? `Optimized route with ${parcels.length} deliveries` 
      : 'Using approximate coordinates for mapping',
    polyline: waypoints.map(wp => [wp.lat, wp.lng])
  };
}

// POST - Update delivery status
export async function POST(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAgentAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { parcelId, status, notes } = await request.json();

    if (!parcelId || !status) {
      return NextResponse.json(
        { error: 'Parcel ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Update parcel status
    const updateData = { 
      status,
      ...(notes && { deliveryNotes: notes })
    };

    // Add timestamps based on status
    if (status === 'delivered') {
      updateData.actualDelivery = new Date();
    } else if (status === 'picked_up') {
      updateData.pickupDate = new Date();
    }

    const updatedParcel = await Parcel.findByIdAndUpdate(
      parcelId,
      updateData,
      { new: true }
    ).populate('customer', 'name phone email');

    if (!updatedParcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery status updated successfully',
      parcel: {
        id: updatedParcel._id.toString(),
        trackingNumber: updatedParcel.trackingNumber,
        status: updatedParcel.status,
        deliveryNotes: updatedParcel.deliveryNotes,
        actualDelivery: updatedParcel.actualDelivery,
        pickupDate: updatedParcel.pickupDate,
        customer: updatedParcel.customer
      }
    });

  } catch (error) {
    console.error('Error updating delivery status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}