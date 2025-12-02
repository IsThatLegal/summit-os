import { test, expect } from '@playwright/test';

// Helper function to clean up test data
async function cleanupTestData() {
  try {
    const response = await fetch('http://localhost:3000/api/cleanup/tests', {
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

  test('Complete move-in wizard from start to finish', async ({ page }) => {
    const uniqueEmail = `movein_${Math.floor(Math.random() * 10000)}@test.com`;
    const tenantName = 'MoveIn Test User';
    
    // Navigate to move-in wizard
    await page.goto('/move-in');
    
    // --- Step 1: Tenant Information ---
    await expect(page.getByText('Step 1 of 4: Tenant Information')).toBeVisible({ timeout: 15000 });
    
    // Fill tenant information form
    await page.getByLabel('First Name *').fill(tenantName);
    await page.getByLabel('Last Name *').fill('Testerson');
    await page.getByLabel('Email *').fill(uniqueEmail);
    await page.getByLabel('Phone Number *').fill('555-123-4567');
    await page.getByLabel('Date of Birth *').fill('1990-01-01');
    await page.getByLabel('Emergency Contact Name *').fill('Jane Doe');
    await page.getByLabel('Contact Phone *').fill('555-987-6543');
    await page.getByLabel('Relationship *').selectOption('Spouse');
    
    // Submit and move to next step
    await page.getByRole('button', { name: 'Continue to Unit Selection' }).click();
    
    // --- Step 2: Unit Selection ---
    await expect(page.getByText('Step 2 of 4: Select Unit')).toBeVisible({ timeout: 15000 });
    
    // Wait for units to load
    await page.waitForSelector('[data-testid="unit-grid"]', { timeout: 10000 });
    
    // Select first available unit
    const firstUnit = page.locator('[data-testid="unit-card"]').first();
    await expect(firstUnit).toBeVisible();
    await firstUnit.click();
    
    // Continue to lease configuration
    await page.getByRole('button', { name: 'Continue to Lease Setup' }).click();
    
    // --- Step 3: Lease Configuration ---
    await expect(page.getByText('Step 3 of 4: Configure Lease')).toBeVisible({ timeout: 15000 });
    
    // Configure lease terms
    await page.getByLabel('Lease Term (months)').selectOption('12');
    await page.getByLabel('Auto-renewal').check();
    await page.getByLabel('Climate Control').check();
    
    // Continue to payment
    await page.getByRole('button', { name: 'Continue to Payment' }).click();
    
    // --- Step 4: Payment Processing ---
    await expect(page.getByText('Step 4 of 4: Payment & Activation')).toBeVisible({ timeout: 15000 });
    
    // Verify order summary
    await expect(page.getByText('Order Summary')).toBeVisible();
    await expect(page.locator('[data-testid="unit-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-due"]')).toBeVisible();
    
    // Select payment method
    await page.getByLabel('Credit Card').check();
    await page.getByLabel('Save payment method for future use').check();
    
    // Complete move-in
    await page.getByRole('button', { name: /Complete Move-In/ }).click();
    
    // Verify completion
    await expect(page.getByText('Move-in complete!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Welcome to SummitOS/)).toBeVisible();
    await expect(page.getByText(/Your gate access code is:/)).toBeVisible();
    
    console.log('✅ Move-in wizard test completed successfully!');
  });

  test('Move-in wizard validation and error handling', async ({ page }) => {
    await page.goto('/move-in');
    
    // --- Test Step 1 Validation ---
    await expect(page.getByText('Step 1 of 4: Tenant Information')).toBeVisible();
    
    // Try to proceed without filling required fields
    await page.getByRole('button', { name: 'Continue to Unit Selection' }).click();
    
    // Should show validation errors
    await expect(page.getByText('First name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    
    // Fill with invalid email
    await page.getByLabel('First Name *').fill('Test');
    await page.getByLabel('Email *').fill('invalid-email');
    await page.getByLabel('Phone Number *').fill('555-123-4567');
    
    await page.getByRole('button', { name: 'Continue to Unit Selection' }).click();
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    
    // Fix email and proceed
    await page.getByLabel('Email *').fill('valid@test.com');
    await page.getByRole('button', { name: 'Continue to Unit Selection' }).click();
    
    // --- Test Step 2 Validation ---
    await expect(page.getByText('Step 2 of 4: Select Unit')).toBeVisible();
    
    // Try to proceed without selecting unit
    await page.getByRole('button', { name: 'Continue to Lease Setup' }).click();
    
    // Button should be disabled without unit selection
    const continueButton = page.getByRole('button', { name: 'Continue to Lease Setup' });
    await expect(continueButton).toBeDisabled();
    
    console.log('✅ Validation and error handling test completed!');
  });

  test('Move-in wizard navigation and state persistence', async ({ page }) => {
    await page.goto('/move-in');
    
    // Fill step 1
    await page.getByLabel('First Name *').fill('Navigation Test');
    await page.getByLabel('Last Name *').fill('User');
    await page.getByLabel('Email *').fill('nav@test.com');
    await page.getByLabel('Phone Number *').fill('555-123-4567');
    await page.getByLabel('Date of Birth *').fill('1990-01-01');
    await page.getByLabel('Emergency Contact Name *').fill('Emergency Contact');
    await page.getByLabel('Contact Phone *').fill('555-987-6543');
    await page.getByLabel('Relationship *').selectOption('Friend');
    
    await page.getByRole('button', { name: 'Continue to Unit Selection' }).click();
    
    // Select unit
    const firstUnit = page.locator('[data-testid="unit-card"]').first();
    await firstUnit.click();
    await page.getByRole('button', { name: 'Continue to Lease Setup' }).click();
    
    // --- Test Back Navigation ---
    await expect(page.getByText('Step 3 of 4: Configure Lease')).toBeVisible();
    
    // Go back to unit selection
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Step 2 of 4: Select Unit')).toBeVisible();
    
    // Unit should still be selected
    await expect(firstUnit).toHaveClass(/border-blue-500/);
    
    // Go back to tenant info
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByText('Step 1 of 4: Tenant Information')).toBeVisible();
    
    // Form data should be preserved
    await expect(page.getByLabel('First Name *')).toHaveValue('Navigation Test');
    await expect(page.getByLabel('Email *')).toHaveValue('nav@test.com');
    
    console.log('✅ Navigation and state persistence test completed!');
  });
});