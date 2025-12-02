import { chromium, FullConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from .env.local file at the root of the project
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function globalSetup() {
  console.log('🚀 Starting E2E tests - cleaning up any existing test data...');
  
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

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.close();
  await browser.close();
}

async function globalTeardown() {
  console.log('🏁 E2E tests completed - final cleanup...');
  
  try {
    const response = await fetch('http://localhost:3000/api/cleanup/tests', {
      method: 'DELETE'
    });
    if (!response.ok) {
      console.warn('Failed to cleanup test data:', await response.text());
    } else {
      const result = await response.json();
      console.log(`🧹 Final cleanup: ${result.tenantsDeleted} test tenants and ${result.unitsReset} units`);
    }
  } catch (error) {
    console.warn('Error during final cleanup:', error);
  }
}

export default globalSetup;