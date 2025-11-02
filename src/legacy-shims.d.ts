// Targeted shims for legacy or Node-only modules to keep CI green while we migrate types
declare module 'express' { const anyExport: any; export = anyExport; }
declare module 'fs' { const anyExport: any; export = anyExport; }
declare module 'path' { const anyExport: any; export = anyExport; }
