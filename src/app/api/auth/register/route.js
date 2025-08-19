import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    await dbConnect();
    
    const { name, email, password, role, phone, address, adminCode } = await request.json();

    console.log('Registration request:', { email, role, adminCode });
    console.log('Admin code from env:', process.env.ADMIN_REGISTRATION_CODE);

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
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

    // Validate admin registration
    if (role === 'admin') {
      // Debug: Check what values we're comparing
      const expectedAdminCode = process.env.ADMIN_REGISTRATION_CODE;
      console.log('Admin code comparison:', {
        expected: expectedAdminCode,
        received: adminCode,
        match: expectedAdminCode === adminCode
      });

      if (!adminCode || adminCode !== expectedAdminCode) {
        return NextResponse.json(
          { error: `Invalid admin registration code. Please use the correct admin code.` },
          { status: 403 }
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      phone: phone || '',
      address: address || ''
    });

    console.log('User created successfully:', { email: user.email, role: user.role });

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}