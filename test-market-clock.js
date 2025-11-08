// Test Market Clock Functionality
// Run this in browser console to test the market clock

function testMarketClock() {
    console.log('Testing Market Clock Functionality...');

    // Test if updateMarketClock function exists
    if (typeof updateMarketClock === 'function') {
        console.log('✅ updateMarketClock function exists');

        // Test if elements exist
        const clockElement = document.getElementById('market-clock-time');
        const sessionElement = document.getElementById('market-session');
        const badgeElement = document.getElementById('market-status-badge');

        console.log('Clock element:', clockElement);
        console.log('Session element:', sessionElement);
        console.log('Badge element:', badgeElement);

        if (clockElement && sessionElement && badgeElement) {
            console.log('✅ All market clock elements found');

            // Manually trigger update
            updateMarketClock();

            // Check if time updated
            const currentTime = clockElement.textContent;
            console.log('Current clock time:', currentTime);

            // Test multiple updates
            console.log('Testing clock updates...');
            let testCount = 0;
            const testInterval = setInterval(() => {
                updateMarketClock();
                const newTime = clockElement.textContent;
                console.log('Update', testCount + 1, ':', newTime);
                testCount++;

                if (testCount >= 3) {
                    clearInterval(testInterval);
                    console.log('✅ Market clock test completed');
                }
            }, 1000);

        } else {
            console.error('❌ Market clock elements not found');
        }
    } else {
        console.error('❌ updateMarketClock function not found');
    }
}

// Auto-run test
testMarketClock();