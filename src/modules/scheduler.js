/**
 * Cron Scheduler Module
 * Handles all scheduled events (cron triggers)
 */

// Import the main scheduled logic from the original worker
// For now, this is a wrapper - we can refactor the main cron logic later
export async function handleScheduledEvent(controller, env, ctx) {
  // Import the original scheduled function logic
  // This maintains compatibility while we build the modular structure
  
  const scheduledTime = new Date(controller.scheduledTime);
  const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const currentHour = estTime.getHours();
  const currentMinute = estTime.getMinutes();
  
  console.log(`🕐 [MODULAR-CRON] ${estTime.toISOString()} - Cron trigger received (${currentHour}:${currentMinute.toString().padStart(2, '0')})`);
  
  // For now, import the original standalone worker logic
  // TODO: Refactor this into smaller, focused modules
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  
  return originalWorker.scheduled(controller, env, ctx);
}