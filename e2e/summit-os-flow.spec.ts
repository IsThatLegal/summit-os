import { test, expect } from '@playwright/test';

test.describe('Core Application Functionality', () => {
  test('Tenant Management and Gate Access', async ({ page }) => {
  const uniqueGateCode = `E2E_${Math.floor(Math.random() * 10000)}`;
  const tenantName = 'E2E Tenant';

  // --- 1. Test: Add a Tenant with Balance (should be locked out) ---
  await page.goto('/');
  await page.getByLabel('First Name').waitFor({ state: 'visible', timeout: 45000 });
  await page.getByLabel('First Name').fill(tenantName);
  await page.getByLabel('Email').fill('e2e@example.com');
  await page.getByLabel('Phone').fill('555-E2E-TEST');
  await page.getByLabel('Gate Code').fill(uniqueGateCode);
  await page.getByLabel('Balance (in dollars)').fill('75');
  await page.getByLabel('Is Locked Out?').uncheck();
  await page.getByRole('button', { name: 'Add Tenant' }).click();

  // Wait for tenant to be added and appear in table
  await page.waitForTimeout(3000);
  
  // Verify tenant appears and is locked out
  const tenantRow = page.locator('table tbody tr').filter({ hasText: tenantName }).first();
  await expect(tenantRow).toBeVisible();
  await expect(tenantRow.getByText('$75.00')).toBeVisible();

  // --- 2. Test: Gate Access Denied for Locked Tenant ---
  await page.goto('/gate-simulator');
  await page.getByLabel('Gate Access Code').waitFor({ state: 'visible', timeout: 45000 });
  await page.getByLabel('Gate Access Code').fill(uniqueGateCode);
  await page.getByRole('button', { name: 'Open Gate' }).click();
  
  // Wait for response and check for access denied
  await page.waitForTimeout(3000);
  const accessResult = page.locator('.bg-red-100, .text-red-700').first();
  await expect(accessResult).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('ACCESS: DENIED')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Reason: Account locked. Please contact management.')).toBeVisible({ timeout: 10000 });

  // --- 3. Test: Add Tenant with Zero Balance (should be granted access) ---
  await page.goto('/');
  await page.getByLabel('First Name').waitFor({ state: 'visible', timeout: 45000 });
  await page.getByLabel('First Name').fill(`${tenantName} Clear`);
  await page.getByLabel('Email').fill('clear@example.com');
  await page.getByLabel('Phone').fill('555-CLEAR');
  await page.getByLabel('Gate Code').fill(`${uniqueGateCode}_CLEAR`);
  await page.getByLabel('Balance (in dollars)').fill('0');
  await page.getByLabel('Is Locked Out?').uncheck();
  await page.getByRole('button', { name: 'Add Tenant' }).click();
  
  // Wait for tenant to be added
  await page.waitForTimeout(3000);

  // Test gate access for tenant with zero balance
  await page.goto('/gate-simulator');
  await page.getByLabel('Gate Access Code').waitFor({ state: 'visible', timeout: 45000 });
  await page.getByLabel('Gate Access Code').fill(`${uniqueGateCode}_CLEAR`);
  await page.getByRole('button', { name: 'Open Gate' }).click();
  await expect(page.getByText('ACCESS: GRANTED')).toBeVisible({ timeout: 15000 });

  console.log('✅ Core functionality test completed successfully!');
  });
});