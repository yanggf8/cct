#!/usr/bin/env node

const fs = require('fs');

// Fix sector-routes.ts logger issues
function fixSectorRoutes() {
  const file = './src/routes/sector-routes.ts';
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix logger calls with non-object second parameter
  content = content.replace(/logger\.(info|warn|error)\(([^,]+),\s*([^{][^)]*)\)/g, 
    'logger.$1($2, { value: $3 })');
  
  fs.writeFileSync(file, content);
  console.log('Fixed sector-routes.ts logger calls');
}

// Add DurableObjectStub type
function fixDurableObjectTypes() {
  const file = './src/types.ts';
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('DurableObjectStub')) {
    content = content.replace('interface DurableObjectNamespace', 
      `interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
  }
  
  interface DurableObjectNamespace`);
    
    fs.writeFileSync(file, content);
    console.log('Added DurableObjectStub type');
  }
}

// Fix circuit breaker config
function fixCircuitBreaker() {
  const file = './src/modules/circuit-breaker.ts';
  let content = fs.readFileSync(file, 'utf8');
  
  // Add trackResults property to configs
  content = content.replace(/failureThreshold: \d+,\s*successThreshold: \d+,\s*openTimeout: \d+,\s*halfOpenTimeout: \d+,\s*halfOpenMaxCalls: \d+,\s*resetTimeout: \d+/g, 
    '$&,\n    trackResults: true');
  
  fs.writeFileSync(file, content);
  console.log('Fixed circuit breaker configs');
}

console.log('Fixing sector cache TypeScript issues...');
fixSectorRoutes();
fixDurableObjectTypes();
fixCircuitBreaker();
console.log('Sector cache TypeScript fixes completed');
