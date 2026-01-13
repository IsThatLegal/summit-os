/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from '@playwright/test';

// Helper function to clean up test data
async function cleanupTestData() {
  try {
    const response = await fetch('http://localhost:3000/api/cleanup/tests', {
      method: 'DELETE'
    });
    if (!response.ok) {
      console.warn('Failed to cleanup test data:', await response.text());
    } else {
      const result = await response.json();
      console.log(`🧹 Cleaned up ${result.tenantsDeleted} test tenants and ${result.unitsReset} units`);
    }
  } catch (error) {
    console.warn('Error during cleanup:', error);
  }
}

// Extend base test with cleanup hooks
export const test = base.extend({
  // Add cleanup before all tests
  context: async ({ context }, use) => {
    // Clean up before running any tests
    await cleanupTestData();
    await use(context);
  },
});

// Export expect from base
export { expect };

