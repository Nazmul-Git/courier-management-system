// app/api/admin/parcels/route.js
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';
import User from '@/lib/models/User';

// Helper function to verify authentication
async function verifyAuth(request) {
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

// GET /api/admin/parcels - Get all parcels with filtering
export async function GET(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const trackingNumber = searchParams.get('trackingNumber');
    
    let filter = {};

    if (customerId) filter.customer = customerId;
    if (status && status !== 'all') filter.status = status;
    if (trackingNumber) filter.trackingNumber = { $regex: trackingNumber, $options: 'i' };

    const parcels = await Parcel.find(filter)
      .populate('customer', 'name email phone')
      .populate('assignedAgent', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Parcel.countDocuments(filter);

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

    return NextResponse.json({
      parcels: formattedParcels,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error('Error fetching parcels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/parcels - Create parcel or assign agents
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

    const body = await request.json();
    const { action, parcelId, agentId, ...parcelData } = body;

    // Handle agent assignment
    if (action === 'assign-agent') {
      if (!parcelId || !agentId) {
        return NextResponse.json(
          { error: 'Parcel ID and Agent ID are required' },
          { status: 400 }
        );
      }

      const updatedParcel = await Parcel.findByIdAndUpdate(
        parcelId,
        { assignedAgent: agentId, status: 'assigned' },
        { new: true }
      ).populate('customer', 'name email phone')
       .populate('assignedAgent', 'name email phone');

      if (!updatedParcel) {
        return NextResponse.json(
          { error: 'Parcel not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: 'Agent assigned successfully',
        parcel: {
          id: updatedParcel._id.toString(),
          trackingNumber: updatedParcel.trackingNumber,
          status: updatedParcel.status,
          assignedAgent: updatedParcel.assignedAgent ? {
            id: updatedParcel.assignedAgent._id.toString(),
            name: updatedParcel.assignedAgent.name,
            email: updatedParcel.assignedAgent.email,
            phone: updatedParcel.assignedAgent.phone
          } : null
        }
      });
    }

    // Handle auto-assign agents
    if (action === 'assign-agents') {
      const unassignedParcels = await Parcel.find({
        assignedAgent: { $exists: false },
        status: 'pending'
      }).populate('customer', 'name email');

      const availableAgents = await User.find({
        role: 'agent',
        isActive: true
      }).select('name email phone location');

      let assignedCount = 0;
      const results = [];

      for (const parcel of unassignedParcels) {
        if (availableAgents.length > 0) {
          const agent = availableAgents[assignedCount % availableAgents.length];
          parcel.assignedAgent = agent._id;
          parcel.status = 'assigned';
          await parcel.save();
          assignedCount++;
          results.push({
            parcelId: parcel._id,
            trackingNumber: parcel.trackingNumber,
            agentId: agent._id,
            agentName: agent.name
          });
        }
      }

      return NextResponse.json({
        message: `Assigned ${assignedCount} parcels to agents`,
        assignedCount,
        results
      });
    }

    // Handle parcel creation
    if (action === 'create') {
      const trackingNumber = 'TRK' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
      const newParcel = new Parcel({
        ...parcelData,
        trackingNumber,
        status: 'pending'
      });

      await newParcel.save();
      await newParcel.populate('customer', 'name email phone');

      return NextResponse.json({
        message: 'Parcel created successfully',
        parcel: {
          id: newParcel._id.toString(),
          trackingNumber: newParcel.trackingNumber,
          status: newParcel.status,
          customer: newParcel.customer ? {
            id: newParcel.customer._id.toString(),
            name: newParcel.customer.name,
            email: newParcel.customer.email,
            phone: newParcel.customer.phone
          } : null
        }
      }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'Invalid action specified' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in POST request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/parcels - Update parcel
export async function PUT(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id, ...updateData } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Parcel ID is required' },
        { status: 400 }
      );
    }

    const updatedParcel = await Parcel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('customer', 'name email phone')
     .populate('assignedAgent', 'name email phone');

    if (!updatedParcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Parcel updated successfully',
      parcel: {
        id: updatedParcel._id.toString(),
        trackingNumber: updatedParcel.trackingNumber,
        status: updatedParcel.status,
        assignedAgent: updatedParcel.assignedAgent ? {
          id: updatedParcel.assignedAgent._id.toString(),
          name: updatedParcel.assignedAgent.name,
          email: updatedParcel.assignedAgent.email,
          phone: updatedParcel.assignedAgent.phone
        } : null
      }
    });

  } catch (error) {
    console.error('Error updating parcel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/parcels - Delete parcel
export async function DELETE(request) {
  try {
    await dbConnect();
    
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Parcel ID is required' },
        { status: 400 }
      );
    }

    const deletedParcel = await Parcel.findByIdAndDelete(id);

    if (!deletedParcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Parcel deleted successfully',
      parcel: {
        id: deletedParcel._id.toString(),
        trackingNumber: deletedParcel.trackingNumber
      }
    });

  } catch (error) {
    console.error('Error deleting parcel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}