import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';

// Helper function to verify admin authentication
async function verifyAdminAuth(request) {
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return { error: 'Access denied. Admin role required.', status: 403 };
    }
    
    return { decoded };
  } catch (error) {
    return { error: 'Invalid or expired token', status: 401 };
  }
}

// GET /api/admin/reports - Generate parcel reports
export async function GET(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAdminAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    // Build filter object
    const filter = {};

    // Date range filter
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    } else if (startDate) {
      filter.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      filter.createdAt = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
    }

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Customer filter
    if (customerId) {
      filter.customer = customerId;
    }

    console.log('Report filter:', filter);

    // Fetch parcels with all necessary data
    const parcels = await Parcel.find(filter)
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email phone')
      .sort({ createdAt: -1 });

    // Format the report data
    const reportData = parcels.map(parcel => ({
      trackingNumber: parcel.trackingNumber,
      customerName: parcel.customer?.name || 'Unknown Customer',
      customerEmail: parcel.customer?.email || '',
      customerPhone: parcel.customer?.phone || '',
      status: parcel.status,
      origin: parcel.origin,
      destination: parcel.destination,
      weight: parcel.weight,
      dimensions: parcel.dimensions,
      paymentType: parcel.paymentType,
      codAmount: parcel.codAmount || 0,
      assignedAgent: parcel.assignedAgent?.name || 'Unassigned',
      estimatedDelivery: parcel.estimatedDelivery,
      actualDelivery: parcel.actualDelivery,
      specialInstructions: parcel.specialInstructions,
      createdAt: parcel.createdAt,
      updatedAt: parcel.updatedAt
    }));

    // Generate summary statistics
    const summary = {
      totalParcels: parcels.length,
      totalCOD: parcels.reduce((sum, parcel) => sum + (parcel.codAmount || 0), 0),
      statusCount: parcels.reduce((acc, parcel) => {
        acc[parcel.status] = (acc[parcel.status] || 0) + 1;
        return acc;
      }, {}),
      paymentTypeCount: parcels.reduce((acc, parcel) => {
        acc[parcel.paymentType] = (acc[parcel.paymentType] || 0) + 1;
        return acc;
      }, {})
    };

    return NextResponse.json({
      success: true,
      report: reportData,
      summary: summary,
      filters: {
        startDate,
        endDate,
        status,
        customerId
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    );
  }
}

// Optional: POST endpoint for more complex report generation
export async function POST(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAdminAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const { 
      startDate, 
      endDate, 
      status, 
      customerId, 
      paymentType,
      includeFields = [] 
    } = body;

    // Build filter object
    const filter = {};

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
      };
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (customerId) {
      filter.customer = customerId;
    }

    if (paymentType && paymentType !== 'all') {
      filter.paymentType = paymentType;
    }

    // Fetch parcels
    const parcels = await Parcel.find(filter)
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email phone')
      .sort({ createdAt: -1 });

    // Format response based on requested fields
    let reportData = parcels.map(parcel => {
      const baseData = {
        trackingNumber: parcel.trackingNumber,
        customerName: parcel.customer?.name || 'Unknown Customer',
        status: parcel.status,
        codAmount: parcel.codAmount || 0,
        createdAt: parcel.createdAt,
        paymentType: parcel.paymentType
      };

      // Add additional fields if requested
      if (includeFields.includes('customerDetails')) {
        baseData.email = parcel.customer?.email || '';
        baseData.phone = parcel.customer?.phone || '';
      }

      if (includeFields.includes('addressDetails')) {
        baseData.origin = parcel.origin;
        baseData.destination = parcel.destination;
      }

      if (includeFields.includes('parcelDetails')) {
        baseData.weight = parcel.weight;
        baseData.dimensions = parcel.dimensions;
      }

      if (includeFields.includes('agentDetails')) {
        baseData.assignedAgent = parcel.assignedAgent?.name || 'Unassigned';
      }

      return baseData;
    });

    return NextResponse.json({
      success: true,
      report: reportData,
      total: parcels.length,
      filters: body
    });

  } catch (error) {
    console.error('Error generating custom report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}