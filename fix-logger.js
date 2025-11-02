const fs = require('fs');
let content = fs.readFileSync('./src/routes/sector-routes.ts', 'utf8');

// Fix all broken logger patterns
content = content.replace(/logger\.(error|warn|info)\(([^,]+),\s*\{\s*value:\s*\{\s*([^}]+)\s*\}\s*\}\)/g, 'logger.$1($2, { $3 })');

fs.writeFileSync('./src/routes/sector-routes.ts', content);
console.log('Fixed all logger calls');
