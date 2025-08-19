import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Parcel from '@/lib/models/Parcel';
import User from '@/lib/models/User';

// GET /api/admin/dashboard - Get admin dashboard statistics
export async function GET(request) {
  try {
    await dbConnect();

    // Verify admin role from token
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get dashboard statistics
    const [
      totalParcels,
      pendingParcels,
      inTransitParcels,
      deliveredParcels,
      totalCustomers,
      totalAgents,
      recentParcels,
      revenueData
    ] = await Promise.all([
      Parcel.countDocuments(),
      Parcel.countDocuments({ status: 'pending' }),
      Parcel.countDocuments({ status: 'in_transit' }),
      Parcel.countDocuments({ status: 'delivered' }),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'agent' }),
      Parcel.find().sort({ createdAt: -1 }).limit(10).populate('customer', 'name email'),
      Parcel.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, totalRevenue: { $sum: '$price' } } }
      ])
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalParcels,
          pendingParcels,
          inTransitParcels,
          deliveredParcels,
          deliveryRate: totalParcels > 0 ? (deliveredParcels / totalParcels * 100).toFixed(1) : 0
        },
        users: {
          totalCustomers,
          totalAgents
        },
        revenue: {
          total: totalRevenue,
          codAmount: totalRevenue * 0.6, // Example: 60% COD
          prepaidAmount: totalRevenue * 0.4 // Example: 40% prepaid
        },
        recentActivity: recentParcels
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}