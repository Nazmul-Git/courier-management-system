// app/api/agents/deliveries/route.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';

// Helper function to verify agent authentication
async function verifyAgentAuth(request) {
  const token = request.cookies.get('auth_token')?.value;
  
  console.log('Auth token from cookies:', token);
  
  if (!token) {
    console.log('No auth token found in cookies');
    return { error: 'Authentication required', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT token:', decoded);
    
    if (decoded.role !== 'agent') {
      console.log('User role is not agent:', decoded.role);
      return { error: 'Access denied. Agent role required.', status: 403 };
    }
    
    return { decoded };
  } catch (error) {
    console.log('JWT verification error:', error.message);
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
    console.log('Database connected successfully');
    
    const authResult = await verifyAgentAuth(request);
    if (authResult.error) {
      console.log('Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const agentId = authResult.decoded.id;
    console.log('Authenticated Agent ID:', agentId);
    console.log('Agent ID type:', typeof agentId);

    // Validate agent ID format
    if (!isValidObjectId(agentId)) {
      console.log('Invalid agent ID format:', agentId);
      return NextResponse.json(
        { error: 'Invalid agent ID format' },
        { status: 400 }
      );
    }

    // Convert to ObjectId for consistent querying
    const agentObjectId = new mongoose.Types.ObjectId(agentId);
    console.log('Converted Agent ObjectId:', agentObjectId);

    // Debug: Check all parcels in system first
    console.log('=== DEBUG: Checking all parcels in system ===');
    const allParcels = await Parcel.find({}).limit(5).lean();
    console.log('Sample parcels in system:', allParcels);

    // Debug: Check parcels with any assigned agent
    console.log('=== DEBUG: Checking parcels with assigned agents ===');
    const parcelsWithAgents = await Parcel.find({ 
      assignedAgent: { $exists: true, $ne: null } 
    }).lean();
    console.log('Parcels with assigned agents:', parcelsWithAgents.length);
    console.log('Sample assigned parcels:', parcelsWithAgents.slice(0, 3));

    // Debug: Check if any parcels are assigned to this specific agent
    console.log('=== DEBUG: Checking parcels assigned to this agent ===');
    const testQuery = { assignedAgent: agentObjectId };
    console.log('Test query:', JSON.stringify(testQuery, null, 2));
    
    const testParcels = await Parcel.find(testQuery).lean();
    console.log('Parcels assigned to this agent (raw):', testParcels.length);
    console.log('Sample parcels for this agent:', testParcels);

    // Get parcels assigned to this agent with status filter
    console.log('=== DEBUG: Final query with status filter ===');
    const query = {
      assignedAgent: agentObjectId,
      status: { $in: ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'] }
    };
    
    console.log('Final query:', JSON.stringify(query, null, 2));
    
    const parcels = await Parcel.find(query)
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email phone')
      .sort({ createdAt: -1 });

    console.log('Raw parcels from DB (after populate):', parcels);
    console.log('Number of parcels found:', parcels.length);

    // If no parcels found, check if it's because of population issues
    if (parcels.length === 0) {
      console.log('=== DEBUG: Trying without population ===');
      const parcelsWithoutPopulation = await Parcel.find(query).lean();
      console.log('Parcels without population:', parcelsWithoutPopulation.length);
      console.log('Sample without population:', parcelsWithoutPopulation);
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
    console.error('Error fetching agent deliveries:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update parcel status (for assigned agent only)
export async function PATCH(request) {
  try {
    console.log('Starting PATCH /api/agents/deliveries');
    
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

    console.log('PATCH request data:', { parcelId, status, notes });

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
      // Handle signature upload (you'd need to implement file handling)
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
    console.error('Error in POST request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Temporary test endpoint for debugging
export async function OPTIONS(request) {
  try {
    console.log('Test endpoint called');
    
    await dbConnect();
    
    // Test database connection
    const testParcels = await Parcel.find({}).limit(3).lean();
    console.log('Test parcels from DB:', testParcels);
    
    // Test agent authentication
    const authResult = await verifyAgentAuth(request);
    console.log('Auth result:', authResult);
    
    return NextResponse.json({
      success: true,
      testParcels: testParcels,
      authResult: authResult,
      message: 'Test endpoint working'
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message 
    }, { status: 500 });
  }
}