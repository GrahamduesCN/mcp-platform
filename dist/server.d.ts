/**
 * MCP Platform HTTP API Server
 *
 * Lightweight REST API built with the Node.js built-in `http` module.
 * Provides endpoints for discovering, searching, and registering MCP servers.
 *
 * Endpoints:
 *   GET  /api/servers         – List all servers (with ?limit & ?offset)
 *   GET  /api/servers/:name   – Get a single server by name
 *   GET  /api/search?q=xxx    – Search the registry
 *   POST /api/servers         – Register a new server (requires Bearer token)
 *   GET  /api/health          – Health check
 *
 * @module server
 */
import * as http from 'http';
declare const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
export { server };
//# sourceMappingURL=server.d.ts.map