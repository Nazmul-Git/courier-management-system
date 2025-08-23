// app/api/customer/parcels/route.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';

// Helper function to verify authentication
async function verifyAuth(request) {
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'customer' && decoded.role !== 'admin') {
      return { error: 'Access denied. Customer or admin role required.', status: 403 };
    }
    
    return { decoded };
  } catch (error) {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

// Validation function (unchanged)
function validateParcelData(parcelData) {
  const errors = [];
  // ... validation logic remains the same
  return errors;
}

// GET /api/customer/parcels - Get all parcels for the authenticated customer
export async function GET(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      console.log('Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    console.log('Authenticated user:', {
      id: authResult.decoded.id,
      role: authResult.decoded.role,
      email: authResult.decoded.email
    });

    // Add pagination and filtering
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    
    // Build filter based on user role
    let filter = {};
    
    if (authResult.decoded.role === 'customer') {
      // Customer can only see their own parcels
      filter.customer = authResult.decoded.id;
    } else if (authResult.decoded.role === 'admin') {
      // Admin can see all parcels or filter by specific customer
      const customerId = searchParams.get('customerId');
      if (customerId) {
        filter.customer = customerId;
      }
      // If no customerId specified, admin sees all parcels
    }
    
    if (status && status !== 'all') {
      filter.status = status;
    }

    console.log('Database query filter:', filter);

    // Fetch parcels with pagination
    const parcels = await Parcel.find(filter)
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    console.log('Raw parcels from database:', parcels);
    console.log('Number of parcels found:', parcels.length);

    // Get total count for pagination
    const total = await Parcel.countDocuments(filter);
    console.log('Total parcels count:', total);

    // Format the response with null checks
    const formattedParcels = parcels.map(parcel => ({
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
      customer: parcel.customer ? {
        id: parcel.customer._id.toString(),
        name: parcel.customer.name,
        email: parcel.customer.email,
        phone: parcel.customer.phone
      } : null,
      assignedAgent: parcel.assignedAgent ? {
        id: parcel.assignedAgent._id.toString(),
        name: parcel.assignedAgent.name,
        email: parcel.assignedAgent.email,
        phone: parcel.assignedAgent.phone
      } : null
    }));

    console.log('Formatted parcels response:', formattedParcels);

    return NextResponse.json({
      parcels: formattedParcels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching customer parcels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/customer/parcels - Create a new parcel (unchanged)
export async function POST(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Parse request body
    const parcelData = await request.json();

    // Validate the data
    const validationErrors = validateParcelData(parcelData);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // Generate tracking number
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    const trackingNumber = `TRK${timestamp}${random}`;

    // Format dimensions to consistent format
    const formatDimensions = (dimStr) => {
      const dims = dimStr.split(/[x,]/).map(d => parseInt(d.trim()));
      return dims.join('x');
    };

    // Prepare data for database
    const weight = parseFloat(parcelData.weight);
    const codAmount = parcelData.paymentType === 'cod' ? parseFloat(parcelData.codAmount || 0) : 0;

    // Create new parcel
    const newParcel = new Parcel({
      trackingNumber,
      customer: authResult.decoded.id,
      origin: parcelData.origin,
      destination: parcelData.destination,
      weight: weight,
      dimensions: formatDimensions(parcelData.dimensions),
      paymentType: parcelData.paymentType || 'prepaid',
      codAmount: codAmount,
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
          paymentType: newParcel.paymentType,
          codAmount: newParcel.codAmount,
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