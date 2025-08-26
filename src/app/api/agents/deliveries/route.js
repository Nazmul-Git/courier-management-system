import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';

// Helper function to verify agent authentication
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

// Helper function to validate ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET - Fetch all parcels assigned to the authenticated agent
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

    // Validate agent ID format
    if (!isValidObjectId(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID format' },
        { status: 400 }
      );
    }

    // Convert to ObjectId for consistent querying
    const agentObjectId = new mongoose.Types.ObjectId(agentId);

    // Get parcels assigned to this agent with status filter
    const query = {
      assignedAgent: agentObjectId,
      status: { $in: ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'] }
    };
    
    
    const parcels = await Parcel.find(query)
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email phone')
      .sort({ createdAt: -1 });


    // If no parcels found, check if it's because of population issues
    if (parcels.length === 0) {
      const parcelsWithoutPopulation = await Parcel.find(query).lean();
    }

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
      specialInstructions: parcel.specialInstructions,
      estimatedDelivery: parcel.estimatedDelivery,
      actualDelivery: parcel.actualDelivery,
      pickupDate: parcel.pickupDate,
      deliveryNotes: parcel.deliveryNotes,
      createdAt: parcel.createdAt,
      updatedAt: parcel.updatedAt,
      customer: parcel.customer ? {
        id: parcel.customer._id?.toString(),
        name: parcel.customer.name,
        email: parcel.customer.email,
        phone: parcel.customer.phone
      } : null,
      assignedAgent: parcel.assignedAgent ? {
        id: parcel.assignedAgent._id?.toString(),
        name: parcel.assignedAgent.name,
        email: parcel.assignedAgent.email,
        phone: parcel.assignedAgent.phone
      } : null
    }));

    console.log('Formatted parcels:', formattedParcels);

    return NextResponse.json({
      success: true,
      parcels: formattedParcels,
      debug: {
        agentId: agentId,
        agentObjectId: agentObjectId.toString(),
        totalParcels: formattedParcels.length
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update parcel status (for assigned agent only)
export async function PATCH(request) {
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
    const { parcelId, status, notes } = await request.json();


    if (!parcelId || !status) {
      return NextResponse.json(
        { error: 'Parcel ID and status are required' },
        { status: 400 }
      );
    }

    // Validate ObjectId formats
    if (!isValidObjectId(agentId)) {
      return NextResponse.json(
        { error: 'Invalid agent ID format' },
        { status: 400 }
      );
    }

    if (!isValidObjectId(parcelId)) {
      return NextResponse.json(
        { error: 'Invalid parcel ID format' },
        { status: 400 }
      );
    }

    // Verify the parcel is assigned to this agent
    const parcel = await Parcel.findOne({
      _id: parcelId,
      assignedAgent: agentId
    });

    if (!parcel) {
      console.log('Parcel not found or not assigned to agent:', { parcelId, agentId });
      return NextResponse.json(
        { error: 'Parcel not found or not assigned to you' },
        { status: 404 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData = { status };
    
    // Add timestamps for specific status changes
    if (status === 'delivered') {
      updateData.actualDelivery = new Date();
    } else if (status === 'picked_up') {
      updateData.pickupDate = new Date();
    }
    
    // Add delivery notes if provided
    if (notes) {
      updateData.deliveryNotes = notes;
    }

    console.log('Update data:', updateData);

    // Update the parcel status
    const updatedParcel = await Parcel.findByIdAndUpdate(
      parcelId,
      updateData,
      { new: true }
    ).populate('customer', 'name email phone')
     .populate('assignedAgent', 'name email phone');

    return NextResponse.json({
      success: true,
      message: 'Status updated successfully',
      parcel: {
        id: updatedParcel._id.toString(),
        trackingNumber: updatedParcel.trackingNumber,
        status: updatedParcel.status,
        origin: updatedParcel.origin,
        destination: updatedParcel.destination,
        deliveryNotes: updatedParcel.deliveryNotes,
        actualDelivery: updatedParcel.actualDelivery,
        pickupDate: updatedParcel.pickupDate,
        customer: updatedParcel.customer ? {
          name: updatedParcel.customer.name,
          email: updatedParcel.customer.email,
          phone: updatedParcel.customer.phone
        } : null,
        assignedAgent: updatedParcel.assignedAgent ? {
          name: updatedParcel.assignedAgent.name,
          email: updatedParcel.assignedAgent.email,
          phone: updatedParcel.assignedAgent.phone
        } : null
      }
    });

  } catch (error) {
    console.error('Error updating parcel status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Add delivery notes or additional actions
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

    const agentId = authResult.decoded.id;
    const { parcelId, notes, action } = await request.json();

    if (!parcelId) {
      return NextResponse.json(
        { error: 'Parcel ID is required' },
        { status: 400 }
      );
    }

    // Validate ObjectId formats
    if (!isValidObjectId(agentId) || !isValidObjectId(parcelId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Verify the parcel is assigned to this agent
    const parcel = await Parcel.findOne({
      _id: parcelId,
      assignedAgent: agentId
    });

    if (!parcel) {
      return NextResponse.json(
        { error: 'Parcel not found or not assigned to you' },
        { status: 404 }
      );
    }

    // Handle different actions
    const updateData = {};
    
    if (notes) {
      updateData.deliveryNotes = notes;
    }
    
    if (action === 'add_signature') {
      updateData.hasSignature = true;
    }

    const updatedParcel = await Parcel.findByIdAndUpdate(
      parcelId,
      updateData,
      { new: true }
    ).populate('customer', 'name email phone');

    return NextResponse.json({
      success: true,
      message: 'Operation completed successfully',
      parcel: {
        id: updatedParcel._id.toString(),
        trackingNumber: updatedParcel.trackingNumber,
        deliveryNotes: updatedParcel.deliveryNotes,
        hasSignature: updatedParcel.hasSignature
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

