import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from '@/lib/rateLimite';

// Rate limiting configuration
const limiter = rateLimit({
  interval: 60 * 1000, 
  uniqueTokenPerInterval: 500, 
});

export async function POST(request) {
  try {
    await dbConnect();
    
    // Apply rate limiting
    const rateLimitResult = await limiter.check(request, 5); 
    if (rateLimitResult.status === 429) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Find user and include necessary fields for authentication
    const user = await User.findOne({ email })
      .select('+password +isActive +loginAttempts +lockUntil +lastLogin');
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const lockTimeLeft = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return NextResponse.json(
        { error: `Account is temporarily locked. Try again in ${lockTimeLeft} minutes.` },
        { status: 423 } 
      );
    }

    // Check if account is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      // Increment login attempts
      await User.findByIdAndUpdate(user._id, {
        $inc: { loginAttempts: 1 },
        $set: { lastFailedAttempt: new Date() }
      });

      // Lock account after 5 failed attempts for 30 minutes
      if (user.loginAttempts + 1 >= 5) {
        await User.findByIdAndUpdate(user._id, {
          lockUntil: Date.now() + 30 * 60 * 1000, 
          loginAttempts: 0
        });
        
        return NextResponse.json(
          { error: 'Too many failed attempts. Account locked for 30 minutes.' },
          { status: 423 }
        );
      }

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Reset login attempts on successful login
    await User.findByIdAndUpdate(user._id, {
      loginAttempts: 0,
      lockUntil: null,
      lastLogin: new Date()
    });

    // Create JWT token with additional security claims
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
        issuer: 'courier-management-system',
        audience: 'courier-management-users'
      }
    );

    // Set HTTP-only cookie for more secure token storage
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profileImage: user.profileImage
      },
      token
    });

    // Set secure HTTP-only cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: Add a GET method to check auth status
export async function GET(request) {
  try {
    await dbConnect();
    
    const token = request.cookies.get('auth_token');
    
    if (!token) {
      return NextResponse.json(
        { isAuthenticated: false },
        { status: 200 }
      );
    }
    
    try {
      const decoded = jwt.verify(token.value, process.env.JWT_SECRET);
      
      // Find user without sensitive data
      const user = await User.findById(decoded.id)
        .select('-password -loginAttempts -lockUntil');
      
      if (!user) {
        return NextResponse.json(
          { isAuthenticated: false },
          { status: 200 }
        );
      }
      
      return NextResponse.json({
        isAuthenticated: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          profileImage: user.profileImage
        }
      });
    } catch (jwtError) {
      
      const response = NextResponse.json(
        { isAuthenticated: false },
        { status: 200 }
      );
      response.cookies.delete('auth_token');
      return response;
    }
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}