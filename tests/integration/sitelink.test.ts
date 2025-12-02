import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Mock the SiteLink client for testing
jest.mock('../../lib/sitelink-client', () => ({
  SiteLinkClient: jest.fn().mockImplementation(() => ({
    getUnits: jest.fn().mockResolvedValue([
      {
        UnitID: '1',
        UnitNumber: 'A101',
        Width: 10,
        Length: 10,
        StreetRate: 100.00,
        Status: 'Available'
      }
    ]),
    getTenants: jest.fn().mockResolvedValue([
      {
        TenantID: '1',
        Name: 'Test Tenant',
        Balance: 0,
        GateCode: 'TEST123'
      }
    ]),
    getTransactions: jest.fn().mockResolvedValue([
      {
        TransactionID: '1',
        TenantID: '1',
        Amount: 100.00,
        TransactionDate: '2024-01-01',
        Type: 'Payment'
      }
    ])
  }))
}));

describe('SiteLink Integration - Integration Test', () => {
  test('should handle missing SiteLink configuration gracefully', async () => {
    const { SiteLinkIntegration } = await import('../../lib/sitelink-integration');
    const integration = new SiteLinkIntegration();

    // Should return not configured error when env vars are missing
    const result = await integration.syncUnitsFromSiteLink();
    
    expect(result.synced).toBe(0);
    expect(result.errors).toContain('SiteLink integration not configured');
  });

  test('should check integration availability', async () => {
    const { SiteLinkIntegration } = await import('../../lib/sitelink-integration');
    const integration = new SiteLinkIntegration();

    // Should return false when not configured
    expect(integration.isIntegrationAvailable()).toBe(false);
  });

  test('should handle sync API endpoint without configuration', async () => {
    const response = await fetch('http://localhost:3000/api/sitelink/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync-units' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.synced).toBe(0);
    expect(data.data.errors).toContain('SiteLink integration not configured');
  });

  test('should validate SiteLink connection endpoint', async () => {
    const response = await fetch('http://localhost:3000/api/sitelink/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test-connection' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.message).toContain('SiteLink integration not configured');
  });
});