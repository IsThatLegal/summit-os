import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  createTestUnit,
  deleteTestUnit,
  cleanupAllTestData,
  generateTestId,
} from '../helpers/testUtils';

const API_PORT = process.env.API_PORT || 3000;
const API_URL = `http://localhost:${API_PORT}/api/units`;

describe('Unit Management API - Integration Tests', () => {
  beforeAll(async () => {
    await cleanupAllTestData();
  });

  afterAll(async () => {
    // Don't call cleanupAllTestData() here as it interferes with other running tests
    // Cleanup will happen in beforeAll of next test run
  });

  describe('GET /api/units - List Units', () => {
    test('should return array of units', async () => {
      const response = await fetch(API_URL);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should return units with correct structure', async () => {
      // Create a test unit first
      const unit = await createTestUnit();

      const response = await fetch(API_URL);
      const data = await response.json();

      const testUnit = data.find((u: any) => u.id === unit.id);
      expect(testUnit).toBeDefined();
      expect(testUnit).toHaveProperty('unitNumber');
      expect(testUnit).toHaveProperty('size');
      expect(testUnit).toHaveProperty('status');

      // Cleanup
      await deleteTestUnit(unit.id);
    });
  });

  describe('POST /api/units - Create Unit', () => {
    test('should create a new unit with valid data', async () => {
      const testId = generateTestId();
      const unitData = {
        unit_number: `UNIT_${testId}`,
        size: '10x10',
        monthly_price: 10000, // $100 in cents
        status: 'available',
        door_type: 'roll-up',
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unitData),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.unit_number).toBe(unitData.unit_number);

      // Cleanup
      await deleteTestUnit(data.id);
    });

    test('should reject unit creation with missing required fields', async () => {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: 'TEST',
          // Missing other required fields
        }),
      });

      expect(response.status).toBe(400);
    });

    test('should reject invalid door_type', async () => {
      const testId = generateTestId();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: `UNIT_${testId}`,
          size: '10x10',
          monthly_price: 10000,
          status: 'available',
          door_type: 'invalid_type',
        }),
      });

      expect(response.status).toBe(400);
    });

    test('should reject invalid status', async () => {
      const testId = generateTestId();
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number: `UNIT_${testId}`,
          size: '10x10',
          monthly_price: 10000,
          status: 'invalid_status',
          door_type: 'roll-up',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/units/:id - Update Unit', () => {
    test('should update unit status', async () => {
      const unit = await createTestUnit({ status: 'available' });

      const response = await fetch(`${API_URL}/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'occupied',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('occupied');

      // Cleanup
      await deleteTestUnit(unit.id);
    });

    test('should update unit price', async () => {
      const unit = await createTestUnit({ monthly_price: 10000 });

      const response = await fetch(`${API_URL}/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_price: 15000, // $150
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.monthly_price).toBe(15000);

      // Cleanup
      await deleteTestUnit(unit.id);
    });

    test('should return 404 for non-existent unit', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await fetch(`${API_URL}/${fakeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'occupied',
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Unit Business Logic', () => {
    test('should store monthly price in cents', async () => {
      const unit = await createTestUnit({ monthly_price: 12345 }); // $123.45

      expect(unit.monthly_price).toBe(12345);

      // Cleanup
      await deleteTestUnit(unit.id);
    });

    test('should support different door types', async () => {
      const rollUpUnit = await createTestUnit({ door_type: 'roll-up' });
      const swingUnit = await createTestUnit({ door_type: 'swing' });

      expect(rollUpUnit.door_type).toBe('roll-up');
      expect(swingUnit.door_type).toBe('swing');

      // Cleanup
      await deleteTestUnit(rollUpUnit.id);
      await deleteTestUnit(swingUnit.id);
    });

    test('should support all status values', async () => {
      const statuses = ['available', 'occupied', 'maintenance'];

      for (const status of statuses) {
        const unit = await createTestUnit({ status });
        expect(unit.status).toBe(status);
        await deleteTestUnit(unit.id);
      }
    });
  });
});
