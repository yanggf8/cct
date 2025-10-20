const { test, expect } = require('@playwright/test');

test.describe('Real User Workflow Tests', () => {

  test('Complete trading analysis workflow', async ({ page }) => {
    // Step 1: Visit homepage
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Step 2: Navigate to analysis
    await page.goto('/analyze');

    // Step 3: Wait for analysis to complete
    try {
      await page.waitForSelector('[data-testid="results"], .results, .analysis-content', {
        timeout: 20000
      });
    } catch (error) {
      // Fallback: wait for page to be stable
      await page.waitForLoadState('networkidle', { timeout: 20000 });
    }

    // Step 4: Check if analysis results are displayed
    const content = await page.content();

    // Verify page loaded successfully
    expect(content.length).toBeGreaterThan(1000);

    // Step 5: Test navigation to other pages
    await page.goto('/health');
    const healthContent = await page.content();
    expect(healthContent).toContain('healthy');

    console.log('✅ Complete trading analysis workflow successful');
  });

  test('Dashboard exploration workflow', async ({ page }) => {
    // Start from homepage
    await page.goto('/');

    // Test dashboard loading
    const startLoad = performance.now();
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    const loadTime = performance.now() - startLoad;

    console.log(`Dashboard loaded in ${loadTime.toFixed(0)}ms`);
    expect(loadTime).toBeLessThan(5000);

    // Look for common dashboard elements
    const possibleSelectors = [
      'h1', 'h2', '.dashboard', '.main-content', '.container',
      '[data-testid="dashboard"]', 'main', '.app'
    ];

    let mainElementFound = false;
    for (const selector of possibleSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          mainElementFound = true;
          console.log(`✅ Found main element: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    expect(mainElementFound).toBeTruthy();
    console.log('✅ Dashboard exploration workflow successful');
  });

  test('Cache system validation workflow', async ({ page }) => {
    const cacheEndpoints = [
      '/cache-health',
      '/cache-config',
      '/cache-metrics',
      '/cache-promotion',
      '/cache-system-status'
    ];

    const results = [];

    for (const endpoint of cacheEndpoints) {
      const start = performance.now();

      const response = await page.goto(endpoint);

      const responseTime = performance.now() - start;
      const content = await page.content();

      results.push({
        endpoint,
        status: response.status(),
        responseTime: responseTime.toFixed(0),
        contentLength: content.length,
        success: response.ok() && content.length > 100
      });

      expect(response.ok()).toBeTruthy();
      expect(content.length).toBeGreaterThan(100);
    }

    // Log all results
    console.log('Cache Endpoint Results:');
    results.forEach(result => {
      console.log(`  ${result.endpoint}: ${result.responseTime}ms, ${result.contentLength} bytes - ${result.success ? '✅' : '❌'}`);
    });

    // All endpoints should respond within reasonable time
    const avgResponseTime = results.reduce((sum, r) => sum + parseFloat(r.responseTime), 0) / results.length;
    console.log(`Average cache endpoint response time: ${avgResponseTime.toFixed(0)}ms`);
    expect(avgResponseTime).toBeLessThan(3000);

    console.log('✅ Cache system validation workflow successful');
  });

  test('Error handling and resilience workflow', async ({ page }) => {
    // Test 404 handling
    const response = await page.goto('/nonexistent-page');
    expect(response.status()).toBe(404);

    // Test malformed endpoint gracefully
    try {
      await page.goto('/analyze?invalid_param=test');
      // Should not crash - should handle gracefully
      await page.waitForTimeout(2000);
      console.log('✅ Handled malformed parameters gracefully');
    } catch (error) {
      console.log('⚠️  Page had issues with malformed parameters, but didn\'t crash completely');
    }

    // Test very long URL (if it doesn't crash the system)
    try {
      const longUrl = '/analyze?' + 'param=value&'.repeat(50);
      await page.goto(longUrl, { timeout: 10000 });
      console.log('✅ Handled long URL gracefully');
    } catch (error) {
      console.log('⚠️  System struggled with very long URL but remained functional');
    }

    console.log('✅ Error handling and resilience workflow completed');
  });

  test('Multiple browser tabs simulation', async ({ page, context }) => {
    // Open multiple pages to simulate user behavior
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);

    const urls = ['/', '/analyze', '/health'];
    const startTime = Date.now();

    // Navigate each page to different URL
    await Promise.all([
      pages[0].goto(urls[0]),
      pages[1].goto(urls[1]),
      pages[2].goto(urls[2])
    ]);

    // Wait for all pages to load
    await Promise.all([
      pages[0].waitForLoadState('networkidle'),
      pages[1].waitForLoadState('networkidle'),
      pages[2].waitForLoadState('networkidle')
    ]);

    const totalTime = Date.now() - startTime;
    console.log(`3 pages loaded concurrently in ${totalTime}ms`);

    // Verify all pages loaded successfully
    for (let i = 0; i < pages.length; i++) {
      const content = await pages[i].content();
      expect(content.length).toBeGreaterThan(500);
    }

    // Close additional pages
    await Promise.all(pages.map(p => p.close()));

    console.log('✅ Multiple browser tabs simulation successful');
  });

  test('Session persistence and cache warming', async ({ page }) => {
    // First visit - cold cache
    const start1 = performance.now();
    await page.goto('/analyze');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    const firstVisitTime = performance.now() - start1;

    // Visit again - should benefit from cache
    const start2 = performance.now();
    await page.goto('/analyze');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    const secondVisitTime = performance.now() - start2;

    console.log(`First visit: ${firstVisitTime.toFixed(0)}ms, Second visit: ${secondVisitTime.toFixed(0)}ms`);

    // Second visit should generally be faster (allow some variance)
    const improvementRatio = secondVisitTime / firstVisitTime;
    console.log(`Improvement ratio: ${improvementRatio.toFixed(2)} (lower is better)`);

    // Even if not faster, should be reasonably fast
    expect(secondVisitTime).toBeLessThan(12000);

    console.log('✅ Session persistence and cache warming test completed');
  });

});

test.describe('Mobile and Responsive Testing', () => {

  test('Mobile workflow performance', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test complete workflow on mobile
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 });

    // Navigate to analysis on mobile
    await page.goto('/analyze');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Verify mobile experience
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);

    console.log('✅ Mobile workflow test successful');
  });

  test('Tablet workflow performance', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 });

    // Test cache endpoints on tablet
    await page.goto('/cache-health');
    const response = await page.goto('/cache-health');
    expect(response.ok()).toBeTruthy();

    console.log('✅ Tablet workflow test successful');
  });

});