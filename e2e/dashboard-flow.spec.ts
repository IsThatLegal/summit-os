import { test, expect } from '@playwright/test';

// Helper function to clean up test data
async function cleanupTestData() {
  try {
    const response = await fetch('http://localhost:3000/api/test-cleanup', {
      method: 'DELETE'
    });
    if (!response.ok) {
      console.warn('Failed to cleanup test data:', await response.text());
    }
  } catch (error) {
    console.warn('Error during cleanup:', error);
  }
}

test.describe('Dashboard and Core Functionality', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Dashboard loads and displays key sections', async ({ page }) => {
    await page.goto('/');

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 10000 });

    // Check for key dashboard sections
    await expect(page.getByText('Occupancy Rate')).toBeVisible();
    await expect(page.getByText('Recent Gate Activity')).toBeVisible();
    await expect(page.getByText('Financial Management')).toBeVisible();
    await expect(page.getByText('Unit Management')).toBeVisible();

    // Check for navigation buttons
    await expect(page.getByRole('link', { name: 'Map Creator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync SiteLink' })).toBeVisible();

    console.log('✅ Dashboard test completed successfully!');
  });

  test('Gate simulator accessible and functional', async ({ page }) => {
    await page.goto('/gate-simulator');

    // Wait for gate simulator to load
    await expect(page.getByRole('heading', { name: /Gate Access/i })).toBeVisible({ timeout: 10000 });

    // Check for gate code input
    const gateCodeInput = page.getByLabel(/Gate Access Code/i);
    await expect(gateCodeInput).toBeVisible();

    // Check for open gate button
    const openGateButton = page.getByRole('button', { name: /Open Gate/i });
    await expect(openGateButton).toBeVisible();

    // Try with invalid code
    await gateCodeInput.fill('INVALID123');
    await openGateButton.click();

    // Should show access denied or error
    await expect(page.locator('body')).toContainText(/denied|not found/i, { timeout: 5000 });

    console.log('✅ Gate simulator test completed successfully!');
  });

  test('Dashboard theme toggle works', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 10000 });

    // Find theme toggle button
    const themeButton = page.getByRole('button', { name: /Toggle theme/i });
    await expect(themeButton).toBeVisible();

    // Toggle theme (just verify button is clickable)
    await themeButton.click();

    // Wait a bit for any UI updates
    await page.waitForTimeout(300);

    // Verify the button still exists (not broken after click)
    await expect(themeButton).toBeVisible();

    console.log('✅ Theme toggle test completed!');
  });
});
