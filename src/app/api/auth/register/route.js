import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

export async function POST(request) {
  try {
    await dbConnect();
    
    const { 
      name, 
      email, 
      password, 
      confirmPassword,
      role, 
      phone, 
      street,
      city,
      state,
      zipCode,
      country,
      vehicleType,
      licensePlate,
      adminCode 
    } = await request.json();

    console.log('Registration request:', { email, role });

    // Validate required fields
    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Name, email, password, and confirmation are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate phone format if provided
    if (phone && role !== 'admin') {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        return NextResponse.json(
          { error: 'Please enter a valid phone number' },
          { status: 400 }
        );
      }
    }

    // Validate admin registration
    if (role === 'admin') {
      const expectedAdminCode = process.env.ADMIN_REGISTRATION_CODE;
      
      if (!adminCode || adminCode !== expectedAdminCode) {
        return NextResponse.json(
          { error: 'Invalid admin registration code' },
          { status: 403 }
        );
      }
    }

    // Validate required fields based on role
    if (role === 'agent') {
      if (!vehicleType) {
        return NextResponse.json(
          { error: 'Vehicle type is required for delivery agents' },
          { status: 400 }
        );
      }
    }

    if (role !== 'admin' && role !== 'customer') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Phone number is required' },
          { status: 400 }
        );
      }
      
      if (!street || !city || !state || !zipCode) {
        return NextResponse.json(
          { error: 'Complete address information is required' },
          { status: 400 }
        );
      }
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }

    // Prepare user data based on role
    const userData = {
      name,
      email,
      password,
      role,
      phone: role !== 'admin' ? phone : undefined,
      address: role !== 'admin' && role !== 'customer' ? {
        street,
        city,
        state,
        zipCode,
        country: country || 'Bangladesh'
      } : undefined
    };

    // Add role-specific data
    if (role === 'agent') {
      userData.agentInfo = {
        vehicleType,
        licensePlate: licensePlate || ''
      };
    }

    const user = await User.create(userData);

    console.log('User created successfully:', { 
      email: user.email, 
      role: user.role,
      id: user._id 
    });

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}