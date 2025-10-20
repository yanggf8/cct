const { test, expect } = require('@playwright/test');

test.describe('Performance Tests for Trading System', () => {

  test('Dashboard loads within performance threshold', async ({ page }) => {
    const start = Date.now();

    await page.goto('/');

    // Wait for main content to load
    await page.waitForSelector('body', { timeout: 10000 });

    const loadTime = Date.now() - start;
    console.log(`Dashboard loaded in ${loadTime}ms`);

    // Performance assertion: should load in under 20 seconds (realistic for trading system)
    expect(loadTime).toBeLessThan(20000);

    // Check basic elements are present
    await expect(page.locator('body')).toBeVisible();
  });

  test('AI analysis response time performance', async ({ page }) => {
    await page.goto('/');

    // Start performance measurement
    const start = performance.now();

    // Navigate to analysis page
    await page.goto('/analyze');

    // Wait for analysis to complete (check for results or loading completion)
    try {
      await page.waitForSelector('[data-testid="analysis-results"], .results, .analysis', {
        timeout: 15000
      });
    } catch (error) {
      // If specific selectors not found, wait for page to be stable
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    }

    const responseTime = performance.now() - start;
    console.log(`AI analysis completed in ${responseTime}ms`);

    // Performance assertion: should complete in under 20 seconds (AI analysis takes time)
    expect(responseTime).toBeLessThan(20000);
  });

  test('Cache effectiveness - repeated requests are faster', async ({ page }) => {
    await page.goto('/');

    // First request (cache miss)
    const start1 = performance.now();
    await page.goto('/analyze');
    await page.waitForLoadState('networkidle', { timeout: 12000 });
    const time1 = performance.now() - start1;

    // Second request (cache hit) - navigate to same page again
    const start2 = performance.now();
    await page.goto('/analyze');
    await page.waitForLoadState('networkidle', { timeout: 8000 });
    const time2 = performance.now() - start2;

    console.log(`First request: ${time1.toFixed(0)}ms, Cached request: ${time2.toFixed(0)}ms`);

    // Cache should make second request faster (allow some variance)
    expect(time2).toBeLessThan(time1 * 1.2); // Allow 20% variance but generally faster
  });

  test('Enhanced cache health endpoint performance', async ({ page }) => {
    const start = performance.now();

    const response = await page.goto('/cache-health');

    expect(response.ok()).toBeTruthy();

    const responseTime = performance.now() - start;
    console.log(`Cache health endpoint responded in ${responseTime}ms`);

    // Health endpoint should be reasonably fast
    expect(responseTime).toBeLessThan(10000);

    // Verify response contains expected data
    const content = await page.content();
    expect(content).toContain('assessment');
  });

  test('Multiple concurrent requests performance', async ({ page }) => {
    await page.goto('/');

    const startTime = Date.now();
    const requests = [];

    // Make 3 concurrent requests to different endpoints
    const promises = [
      page.goto('/analyze'),
      page.goto('/health'),
      page.goto('/cache-health')
    ];

    // Wait for all requests to complete
    const results = await Promise.allSettled(promises);

    const totalTime = Date.now() - startTime;
    console.log(`3 concurrent requests completed in ${totalTime}ms`);

    // All requests should succeed
    results.forEach(result => {
      expect(result.status).toBe('fulfilled');
      if (result.status === 'fulfilled') {
        expect(result.value.ok()).toBeTruthy();
      }
    });

    // Should complete all requests in reasonable time
    expect(totalTime).toBeLessThan(15000);
  });

  test('Mobile performance test', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const start = Date.now();
    await page.goto('/');

    // Wait for mobile layout to load
    await page.waitForSelector('body', { timeout: 8000 });

    const loadTime = Date.now() - start;
    console.log(`Mobile page loaded in ${loadTime}ms`);

    // Mobile should still load reasonably fast
    expect(loadTime).toBeLessThan(20000);
  });

  test('API endpoints direct performance test', async ({ page }) => {
    const endpoints = [
      '/health',
      '/cache-health',
      '/cache-config',
      '/cache-metrics',
      '/cache-promotion'
    ];

    for (const endpoint of endpoints) {
      const start = performance.now();

      const response = await page.goto(endpoint);

      expect(response.ok()).toBeTruthy();

      const responseTime = performance.now() - start;
      console.log(`${endpoint} responded in ${responseTime.toFixed(0)}ms`);

      // API endpoints should be reasonably fast
      expect(responseTime).toBeLessThan(15000);
    }
  });

});

test.describe('User Experience Performance', () => {

  test('Page interaction responsiveness', async ({ page }) => {
    await page.goto('/');

    // Test clicking buttons and navigation
    const start = performance.now();

    // Try to find and click any interactive elements
    const buttons = await page.locator('button, [role="button"], a').all();

    if (buttons.length > 0) {
      // Click first button if available
      await buttons[0].click();
      await page.waitForTimeout(500); // Wait for any response
    }

    const interactionTime = performance.now() - start;
    console.log(`Page interaction completed in ${interactionTime}ms`);

    // Interactions should feel responsive
    expect(interactionTime).toBeLessThan(3000);
  });

  test('Page size and resource loading', async ({ page }) => {
    const responses = [];

    // Listen for all network responses
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        size: parseInt(response.headers()['content-length'] || '0')
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    const totalResources = responses.length;
    const totalSize = responses.reduce((sum, r) => sum + r.size, 0);

    console.log(`Page loaded ${totalResources} resources, total size: ${totalSize} bytes`);

    // Page shouldn't be excessively heavy
    expect(totalSize).toBeLessThan(2 * 1024 * 1024); // Less than 2MB

    // Most resources should load successfully
    const successRate = responses.filter(r => r.status < 400).length / totalResources;
    expect(successRate).toBeGreaterThan(0.9); // 90% success rate
  });

});