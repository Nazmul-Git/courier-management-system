// app/api/parcels/update/route.ts

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import Parcel from '@/lib/models/Parcel';
import dbConnect from '@/lib/db';

async function verifyAuth(request) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('Missing JWT_SECRET environment variable');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return { error: 'Access denied. Admin role required.', status: 403 };
    }

    return { decoded };
  } catch (err) {
    console.error('Auth error:', err);
    return { error: 'Invalid or expired token', status: 401 };
  }
}

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

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Parcel ID is required' },
        { status: 400 }
      );
    }

    const updatedParcel = await Parcel.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate('customer', 'name email phone')
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
        assignedAgent: updatedParcel.assignedAgent
          ? {
              id: updatedParcel.assignedAgent._id.toString(),
              name: updatedParcel.assignedAgent.name,
              email: updatedParcel.assignedAgent.email,
              phone: updatedParcel.assignedAgent.phone,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error updating parcel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
