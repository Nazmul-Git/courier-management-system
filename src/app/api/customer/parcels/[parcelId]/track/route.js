// app/api/customer/parcels/[trackingNumber]/track/route.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';

// Helper function to verify authentication (same as above)
async function verifyAuth(request) {
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'customer') {
      return { error: 'Access denied. Customer role required.', status: 403 };
    }
    
    return { decoded };
  } catch (error) {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

// GET /api/customer/parcels/[trackingNumber]/track - Track a parcel
export async function GET(request, { params }) {
  try {
    await dbConnect();
    
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { trackingNumber } = params;

    // Find parcel and verify ownership
    const parcel = await Parcel.findOne({ 
      trackingNumber, 
      customer: authResult.decoded.id 
    })
    .populate('customer', 'name email phone')
    .populate('assignedAgent', 'name email phone');
    
    if (!parcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      );
    }

    // In a real application, you would fetch real-time tracking data here
    // This is a mock implementation
    const trackingHistory = [
      {
        status: 'pending',
        location: 'Dhaka Warehouse',
        timestamp: parcel.createdAt,
        description: 'Parcel registered in system'
      }
    ];

    if (parcel.status !== 'pending') {
      trackingHistory.push({
        status: 'picked_up',
        location: parcel.origin.city,
        timestamp: new Date(parcel.createdAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
        description: 'Parcel picked up from sender'
      });
    }

    if (['in_transit', 'out_for_delivery', 'delivered'].includes(parcel.status)) {
      trackingHistory.push({
        status: 'in_transit',
        location: 'In Transit',
        timestamp: new Date(parcel.createdAt.getTime() + 4 * 60 * 60 * 1000), // 4 hours later
        description: 'Parcel in transit to destination'
      });
    }

    if (['out_for_delivery', 'delivered'].includes(parcel.status)) {
      trackingHistory.push({
        status: 'out_for_delivery',
        location: parcel.destination.city,
        timestamp: new Date(parcel.createdAt.getTime() + 6 * 60 * 60 * 1000), // 6 hours later
        description: 'Out for delivery'
      });
    }

    if (parcel.status === 'delivered' && parcel.actualDelivery) {
      trackingHistory.push({
        status: 'delivered',
        location: parcel.destination.city,
        timestamp: parcel.actualDelivery,
        description: 'Parcel delivered successfully'
      });
    }

    // Sort tracking history by timestamp
    trackingHistory.sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({
      parcel: {
        id: parcel._id.toString(),
        trackingNumber: parcel.trackingNumber,
        status: parcel.status,
        origin: parcel.origin,
        destination: parcel.destination,
        weight: parcel.weight,
        dimensions: parcel.dimensions,
        paymentType: parcel.paymentType,
        codAmount: parcel.codAmount,
        estimatedDelivery: parcel.estimatedDelivery?.toISOString().split('T')[0],
        actualDelivery: parcel.actualDelivery?.toISOString().split('T')[0],
        createdAt: parcel.createdAt.toISOString(),
        updatedAt: parcel.updatedAt.toISOString(),
        customer: {
          id: parcel.customer._id.toString(),
          name: parcel.customer.name,
          email: parcel.customer.email,
          phone: parcel.customer.phone
        },
        assignedAgent: parcel.assignedAgent ? {
          id: parcel.assignedAgent._id.toString(),
          name: parcel.assignedAgent.name,
          email: parcel.assignedAgent.email,
          phone: parcel.assignedAgent.phone
        } : null
      },
      trackingHistory
    });

  } catch (error) {
    console.error('Error tracking parcel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}