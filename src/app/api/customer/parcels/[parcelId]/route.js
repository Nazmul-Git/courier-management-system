// app/api/customer/parcels/[parcelId]/route.js
import dbConnect from "@/lib/db";
import Parcel from "@/lib/models/Parcel";
import { NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Helper function to verify authentication with debugging
async function verifyAuth(request) {
  console.log('=== AUTH VERIFICATION START ===');
  
  // Try to get token from Authorization header first
  const authHeader = request.headers.get('Authorization');
  console.log('Authorization header:', authHeader);
  
  let token = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('Token from Authorization header:', token);
  }
  
  // If not in header, check cookies
  if (!token) {
    token = request.cookies.get('auth_token')?.value;
    console.log('Token from cookies:', token);
  }
  
  if (!token) {
    console.log('No token found anywhere');
    return { error: 'Authentication required', status: 401 };
  }

  try {
    console.log('JWT Secret exists:', !!process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    if (decoded.role !== 'customer') {
      console.log('Role mismatch. Expected customer, got:', decoded.role);
      return { error: 'Access denied. Customer role required.', status: 403 };
    }
    
    console.log('=== AUTH VERIFICATION SUCCESS ===');
    return { decoded };
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return { error: 'Invalid or expired token', status: 401 };
  }
}

// PATCH /api/customer/parcels/[parcelId] - Cancel a parcel
export async function PATCH(request, { params }) {
  try {
    console.log('=== PATCH REQUEST START ===');
    await dbConnect();

    // Verify authentication FIRST
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      console.log('Auth failed:', authResult.error);
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { parcelId } = params;
    console.log('Parcel ID:', parcelId);
    
    // Validate parcelId format
    if (!mongoose.Types.ObjectId.isValid(parcelId)) {
      console.log('Invalid parcel ID format');
      return NextResponse.json(
        { error: 'Invalid parcel ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const updateData = await request.json();
    console.log('Update data:', updateData);
    
    // Validate that only status update to 'cancelled' is allowed
    if (!updateData.status || updateData.status !== 'cancelled') {
      console.log('Invalid status update');
      return NextResponse.json(
        { error: 'Only status update to "cancelled" is allowed' },
        { status: 400 }
      );
    }

    // Find the parcel and verify ownership
    // console.log('Finding parcel for customer:', authResult.decoded.id);
    const parcel = await Parcel.findOne({ 
      _id: parcelId, 
    //   customer: decoded.id
    });
    
    if (!parcel) {
      console.log('Parcel not found or not owned by user');
      return NextResponse.json(
        { error: 'Parcel not found or access denied' },
        { status: 404 }
      );
    }
    
    console.log('Current parcel status:', parcel.status);
    
    // Check if parcel can be cancelled (only pending parcels can be cancelled)
    if (parcel.status !== 'pending') {
      console.log('Cannot cancel - parcel status is not pending');
      return NextResponse.json(
        { 
          error: `Cannot cancel parcel. Current status is "${parcel.status}". Only parcels with "pending" status can be cancelled.` 
        },
        { status: 400 }
      );
    }

    // Update the parcel status to cancelled
    console.log('Updating parcel status to cancelled');
    parcel.status = 'cancelled';
    parcel.cancelledAt = new Date();
    parcel.updatedAt = new Date();
    
    await parcel.save();
    console.log('Parcel updated successfully');
    
    // Return simple success response
    return NextResponse.json(
      { 
        success: true,
        message: 'Parcel cancelled successfully',
        parcelId: parcel._id.toString()
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error cancelling parcel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    
    const authResult = await verifyAuth(request);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = params;

    const deletedParcel = await Parcel.findByIdAndDelete(id);
    console.log('deleted parcel ',deletedParcel)

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