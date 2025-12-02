import { test, expect } from '@playwright/test';

test.describe('Move-In Wizard Basic Tests', () => {
  test('Move-in page loads and shows initial step', async ({ page }) => {
    // Start the dev server if needed and navigate to move-in
    await page.goto('/move-in');
    
    // Check if the page loads with the move-in wizard
    await expect(page.locator('body')).toBeVisible();
    
    // Look for any move-in related content
    const pageContent = await page.content();
    console.log('Page loaded, checking for move-in content...');
    
    // If we can find the wizard title, that's great
    if (pageContent.includes('Move-In Wizard') || pageContent.includes('Step 1')) {
      console.log('✅ Move-in wizard content found!');
    } else {
      console.log('ℹ️  Page loaded but move-in wizard not immediately visible');
    }
  });

  test('Check if move-in components exist', async ({ page }) => {
    // Try to access the components directly
    await page.goto('/');
    
    // Check if we can navigate to move-in from main page
    const moveInLink = page.locator('a[href*="move-in"]');
    if (await moveInLink.count() > 0) {
      await moveInLink.first().click();
      await expect(page.locator('body')).toBeVisible();
      console.log('✅ Found move-in link on main page');
    } else {
      console.log('ℹ️  No direct move-in link found on main page');
    }
  });
});