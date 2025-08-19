// app/api/customer/parcels/route.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';
import User from '@/lib/models/User';

// GET /api/customer/parcels - Get all parcels for the authenticated customer
export async function GET(request) {
  try {
    await dbConnect();
    
    // Get and verify the authentication token
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify the user is a customer
    if (decoded.role !== 'customer') {
      return NextResponse.json(
        { error: 'Access denied. Customer role required.' },
        { status: 403 }
      );
    }

    // Fetch the customer's parcels from the database
    const parcels = await Parcel.find({ customer: decoded.id })
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email phone')
      .sort({ createdAt: -1 }); // Most recent first

    // Format the response
    const formattedParcels = parcels.map(parcel => ({
      id: parcel._id.toString(),
      trackingNumber: parcel.trackingNumber,
      status: parcel.status,
      origin: parcel.origin,
      destination: parcel.destination,
      weight: parcel.weight,
      dimensions: parcel.dimensions,
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
    }));

    return NextResponse.json(formattedParcels);

  } catch (error) {
    console.error('Error fetching customer parcels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/customer/parcels - Create a new parcel
export async function POST(request) {
  try {
    await dbConnect();
    
    // Get and verify the authentication token
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify the user is a customer
    if (decoded.role !== 'customer') {
      return NextResponse.json(
        { error: 'Access denied. Customer role required.' },
        { status: 403 }
      );
    }

    // Parse request body
    const parcelData = await request.json();

    // Validate required fields
    const requiredFields = ['origin', 'destination', 'weight', 'dimensions'];
    const missingFields = requiredFields.filter(field => !parcelData[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate tracking number (you might want a more robust system)
    const trackingNumber = 'TRK' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();

    // Create new parcel
    const newParcel = new Parcel({
      trackingNumber,
      customer: decoded.id,
      origin: parcelData.origin,
      destination: parcelData.destination,
      weight: parcelData.weight,
      dimensions: parcelData.dimensions,
      status: 'pending',
      specialInstructions: parcelData.specialInstructions || '',
      estimatedDelivery: parcelData.estimatedDelivery || null
    });

    await newParcel.save();

    // Populate the saved parcel
    await newParcel.populate('customer', 'name email phone');

    return NextResponse.json(
      {
        message: 'Parcel created successfully',
        parcel: {
          id: newParcel._id.toString(),
          trackingNumber: newParcel.trackingNumber,
          status: newParcel.status,
          origin: newParcel.origin,
          destination: newParcel.destination,
          weight: newParcel.weight,
          dimensions: newParcel.dimensions,
          estimatedDelivery: newParcel.estimatedDelivery,
          createdAt: newParcel.createdAt,
          customer: {
            id: newParcel.customer._id.toString(),
            name: newParcel.customer.name,
            email: newParcel.customer.email,
            phone: newParcel.customer.phone
          }
        }
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating parcel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}