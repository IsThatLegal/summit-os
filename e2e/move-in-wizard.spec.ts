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

  test('Complete move-in wizard - Step 1: Tenant Information', async ({ page }) => {
    const uniqueEmail = `movein_${Math.floor(Math.random() * 10000)}@test.com`;
    const tenantName = 'MoveIn Test User';

    // Navigate to move-in wizard
    await page.goto('/move-in');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Tenant Information' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Step 1 of 4', { exact: true })).toBeVisible();

    // Fill tenant information form with correct labels
    await page.getByLabel('First Name *').fill(tenantName);
    await page.getByLabel('Last Name *').fill('Testerson');
    await page.getByLabel('Email Address *').fill(uniqueEmail);
    await page.getByLabel('Phone Number *').fill('5551234567');
    await page.getByLabel('Date of Birth *').fill('1990-01-01');

    // Fill emergency contact information
    await page.getByLabel('Contact Name *').fill('Jane Doe');
    await page.getByLabel('Contact Phone *').fill('5559876543');
    await page.getByLabel('Relationship *').selectOption('spouse');

    // Wait for button to be enabled (validation happens async)
    const continueButton = page.getByRole('button', { name: 'Continue to Unit Selection' });
    await expect(continueButton).toBeEnabled({ timeout: 10000 });

    // Submit and move to next step
    await continueButton.click();

    // Verify we moved to step 2
    await expect(page.getByText('Step 2 of 4', { exact: true })).toBeVisible({ timeout: 10000 });

    console.log('✅ Move-in wizard Step 1 test completed successfully!');
  });

  test('Move-in wizard validation - Required fields', async ({ page }) => {
    await page.goto('/move-in');

    // Wait for form to load
    await expect(page.getByRole('heading', { name: 'Tenant Information' })).toBeVisible({ timeout: 10000 });

    // Verify button is disabled when form is empty
    const continueButton = page.getByRole('button', { name: 'Continue to Unit Selection' });
    await expect(continueButton).toBeDisabled();

    // Fill only first name
    await page.getByLabel('First Name *').fill('Test');

    // Button should still be disabled
    await expect(continueButton).toBeDisabled();

    // Fill all required fields
    await page.getByLabel('Last Name *').fill('User');
    await page.getByLabel('Email Address *').fill('valid@test.com');
    await page.getByLabel('Phone Number *').fill('5551234567');
    await page.getByLabel('Date of Birth *').fill('1990-01-01');
    await page.getByLabel('Contact Name *').fill('Emergency Contact');
    await page.getByLabel('Contact Phone *').fill('5559876543');
    await page.getByLabel('Relationship *').selectOption('friend');

    // Now button should be enabled (wait for async validation)
    await expect(continueButton).toBeEnabled({ timeout: 10000 });

    console.log('✅ Validation test completed!');
  });

  test('Move-in wizard validation - Invalid email', async ({ page }) => {
    await page.goto('/move-in');

    await expect(page.getByRole('heading', { name: 'Tenant Information' })).toBeVisible({ timeout: 10000 });

    // Fill form with invalid email
    await page.getByLabel('First Name *').fill('Test');
    await page.getByLabel('Last Name *').fill('User');
    await page.getByLabel('Email Address *').fill('invalid-email');
    await page.getByLabel('Phone Number *').fill('5551234567');
    await page.getByLabel('Date of Birth *').fill('1990-01-01');
    await page.getByLabel('Contact Name *').fill('Emergency Contact');
    await page.getByLabel('Contact Phone *').fill('5559876543');
    await page.getByLabel('Relationship *').selectOption('friend');

    // Button should be disabled due to invalid email
    const continueButton = page.getByRole('button', { name: 'Continue to Unit Selection' });
    await expect(continueButton).toBeDisabled();

    // Fix email
    await page.getByLabel('Email Address *').fill('valid@test.com');

    // Button should now be enabled (wait for async validation)
    await expect(continueButton).toBeEnabled({ timeout: 10000 });

    console.log('✅ Email validation test completed!');
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
    await page.getByLabel('Phone Number *').fill('5551234567');
    await page.getByLabel('Date of Birth *').fill(recentDateString);
    await page.getByLabel('Contact Name *').fill('Parent');
    await page.getByLabel('Contact Phone *').fill('5559876543');
    await page.getByLabel('Relationship *').selectOption('parent');

    // Button should be disabled due to age requirement
    const continueButton = page.getByRole('button', { name: 'Continue to Unit Selection' });
    await expect(continueButton).toBeDisabled();

    // Error message should be visible
    await expect(page.getByText('Must be at least 18 years old')).toBeVisible({ timeout: 2000 });

    console.log('✅ Age validation test completed!');
  });
});
