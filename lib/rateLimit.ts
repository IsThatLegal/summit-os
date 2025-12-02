import { NextResponse } from 'next/server';

// Simple in-memory rate limiter for development
// In production, use Redis or a proper rate limiting service
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
}

export function createRateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, message = 'Too many requests' } = config;

  return function rateLimit(request: Request): NextResponse | null {
    // Get client identifier (IP address or user ID if authenticated)
    const clientId = getClientIdentifier(request);
    const now = Date.now();

    // Get existing rate limit data
    let rateLimitData = rateLimitStore.get(clientId);

    if (!rateLimitData || now > rateLimitData.resetTime) {
      // Create new rate limit entry
      rateLimitData = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitStore.set(clientId, rateLimitData);
      return null; // Allow request
    }

    // Increment request count
    rateLimitData.count++;

    if (rateLimitData.count > maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        { 
          error: message,
          retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitData.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimitData.resetTime - now) / 1000).toString()
          }
        }
      );
    }

    // Update rate limit data
    rateLimitStore.set(clientId, rateLimitData);

    // Add rate limit headers to response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', (maxRequests - rateLimitData.count).toString());
    response.headers.set('X-RateLimit-Reset', rateLimitData.resetTime.toString());

    return null; // Allow request
  };
}

function getClientIdentifier(request: Request): string {
  // Try to get user ID from authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // In a real implementation, you'd decode the JWT to get user ID
    // For now, use the token as identifier
    return `user:${authHeader.substring(7).substring(0, 20)}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `ip:${ip}`;
}

// Predefined rate limit configurations
export const rateLimits = {
  // Strict rate limiting for sensitive operations
  auth: createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }), // 5 requests per 15 minutes
  payments: createRateLimit({ windowMs: 60 * 1000, maxRequests: 10 }), // 10 requests per minute
  
  // Standard rate limiting for general API
  standard: createRateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 100 }), // 100 requests per 15 minutes
  
  // Lenient rate limiting for gate access (needs to be fast)
  gateAccess: createRateLimit({ windowMs: 60 * 1000, maxRequests: 60 }), // 60 requests per minute
  
  // Very strict for admin operations
  admin: createRateLimit({ windowMs: 60 * 1000, maxRequests: 30 }), // 30 requests per minute
};

// Cleanup function to prevent memory leaks
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}