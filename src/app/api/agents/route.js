// app/api/agents/route.js
import { NextResponse } from 'next/server';
import User from '@/lib/models/User';
import dbConnect from '@/lib/db';

export async function GET(request) {
  try {
    await dbConnect();

    // Get query parameters for filtering and pagination
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status'); // active, inactive, etc.

    // Build query for agents
    let query = { role: 'agent' };

    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter if provided
    if (status) {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get agents with pagination
    const agents = await User.find(query)
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await User.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get additional statistics
    const activeAgentsCount = await User.countDocuments({ 
      role: 'agent', 
      isActive: true 
    });

    const inactiveAgentsCount = await User.countDocuments({ 
      role: 'agent', 
      isActive: false 
    });

    return NextResponse.json({
      agents,
      statistics: {
        total: totalCount,
        active: activeAgentsCount,
        inactive: inactiveAgentsCount
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit
      }
    });

  } catch (error) {
    console.error('Agents API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}