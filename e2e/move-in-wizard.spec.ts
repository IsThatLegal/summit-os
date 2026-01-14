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

test.describe('Move-In Wizard Flow', () => {
  test.beforeAll(async () => {
    // Clean up any existing test data before running tests
    await cleanupTestData();
  });

  test.afterAll(async () => {
    // Clean up test data after all tests in this suite
    await cleanupTestData();
  });

  test('Move-in wizard page loads with Step 1 form', async ({ page }) => {
    await page.goto('/move-in');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Tenant Information' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Step 1 of 4', { exact: true })).toBeVisible();

    // Verify all required form fields are present
    await expect(page.getByLabel('First Name *')).toBeVisible();
    await expect(page.getByLabel('Last Name *')).toBeVisible();
    await expect(page.getByLabel('Email Address *')).toBeVisible();
    await expect(page.getByLabel('Phone Number *')).toBeVisible();
    await expect(page.getByLabel('Date of Birth *')).toBeVisible();
    await expect(page.getByLabel('Contact Name *')).toBeVisible();
    await expect(page.getByLabel('Contact Phone *')).toBeVisible();
    await expect(page.getByLabel('Relationship *')).toBeVisible();

    // Verify continue button exists (should be disabled initially)
    const continueButton = page.getByRole('button', { name: 'Continue to Unit Selection' });
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toBeDisabled();

    console.log('✅ Move-in wizard form load test completed successfully!');
  });

  test('Move-in wizard validation - Age requirement', async ({ page }) => {
    await page.goto('/move-in');

    await expect(page.getByRole('heading', { name: 'Tenant Information' })).toBeVisible({ timeout: 10000 });

    // Try to fill with birth date less than 18 years ago
    const today = new Date();
    const recentDate = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
    const recentDateString = recentDate.toISOString().split('T')[0];

    await page.getByLabel('First Name *').fill('Young');
    await page.getByLabel('Last Name *').fill('Person');
    await page.getByLabel('Email Address *').fill('young@test.com');
    await page.getByLabel('Date of Birth *').fill(recentDateString);

    // Wait a moment for validation
    await page.waitForTimeout(500);

    // Error message should be visible
    await expect(page.getByText('Must be at least 18 years old')).toBeVisible({ timeout: 2000 });

    // Button should remain disabled
    const continueButton = page.getByRole('button', { name: 'Continue to Unit Selection' });
    await expect(continueButton).toBeDisabled();

    console.log('✅ Age validation test completed!');
  });
});
