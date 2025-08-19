import { NextResponse } from 'next/server';

// Simple in-memory rate limiter (consider Redis for production)
const rateLimitMap = new Map();

export default function rateLimit(config) {
  return {
    async check(request, max) {
      const ip = request.ip || request.headers.get('x-forwarded-for') || 'anonymous';
      const now = Date.now();
      const windowStart = now - config.interval;

      // Get current window for this IP
      const requests = rateLimitMap.get(ip) || [];

      // Filter out requests outside current window
      const recentRequests = requests.filter(time => time > windowStart);
      
      if (recentRequests.length >= max) {
        return { status: 429 };
      }

      // Add current request
      recentRequests.push(now);
      rateLimitMap.set(ip, recentRequests);

      // Clean up old entries periodically (in a real app, use a proper cleanup job)
      if (Math.random() < 0.01) { // 1% chance to clean up
        for (const [key, times] of rateLimitMap.entries()) {
          const validTimes = times.filter(time => time > windowStart);
          if (validTimes.length === 0) {
            rateLimitMap.delete(key);
          } else {
            rateLimitMap.set(key, validTimes);
          }
        }
      }

      return { status: 200 };
    }
  };
}