import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { cleanupAllTestData } from '../helpers/testUtils';

const API_URL = 'http://localhost:3000/api/auth/login';

describe('Authentication API - Integration Tests', () => {
  beforeAll(async () => {
    await cleanupAllTestData();
  });

  afterAll(async () => {
    // Don't call cleanupAllTestData() here as it interferes with other running tests
    // Cleanup will happen in beforeAll of next test run
  });

  test('should reject login with missing credentials', async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  test('should reject login with invalid email format', async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'somepassword',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  test('should reject login with short password', async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: '12345',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  test('should reject login with non-existent user', async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'ValidPassword123!',
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('should have proper security headers', async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Password123!',
      }),
    });

    // Check for security headers
    expect(response.headers.get('Strict-Transport-Security')).toBeDefined();
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
