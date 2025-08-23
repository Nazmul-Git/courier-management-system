import { NextResponse } from 'next/server';
import User from '@/lib/models/User';
import Parcel from '@/lib/models/Parcel';
import dbConnect from '@/lib/db';

export async function GET(request) {
  try {
    await dbConnect();

    // Get metrics
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalParcels = await Parcel.countDocuments({});
    
    // Get status metrics directly using aggregation
    const statusMetricsAgg = await Parcel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format status metrics
    const statusMetrics = {};
    const allStatuses = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
    
    // Initialize all statuses with 0
    allStatuses.forEach(status => {
      statusMetrics[status] = 0;
    });
    
    // Update with actual counts
    statusMetricsAgg.forEach(metric => {
      if (metric._id && allStatuses.includes(metric._id)) {
        statusMetrics[metric._id] = metric.count;
      }
    });

    // Get parcels from last 7 days for chart data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0); // Start of day
    
    const dailyParcels = await Parcel.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    return NextResponse.json({
      totalUsers,
      totalParcels,
      statusMetrics,
      dailyParcels
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}