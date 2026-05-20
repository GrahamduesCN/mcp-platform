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
import { search, get, register, list, count, MCPServer, SearchOptions } from './registry';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3456', 10);
const HOST = process.env.HOST || '127.0.0.1';
const API_TOKEN = process.env.MCP_API_TOKEN || 'mcp-dev-token-change-me';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** Content-Type header value for JSON responses. */
const JSON_CONTENT_TYPE: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
};

/** Send a JSON response and end the connection. */
function json(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body, null, process.env.NODE_ENV === 'production' ? 0 : 2);
  res.writeHead(statusCode, JSON_CONTENT_TYPE);
  res.end(payload);
}

/** Send an error JSON response. */
function error(res: http.ServerResponse, statusCode: number, message: string): void {
  json(res, statusCode, { error: { code: statusCode, message } });
}

/** Parse JSON body from an incoming request. Returns a Promise. */
function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Extract the URL pathname and query string from the request. */
function parseUrl(req: http.IncomingMessage): { pathname: string; searchParams: URLSearchParams } {
  const base = `http://${req.headers.host || 'localhost'}`;
  const url = new URL(req.url || '/', base);
  return { pathname: url.pathname, searchParams: url.searchParams };
}

/** Extract Bearer token from Authorization header. */
function extractToken(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

/** Simple CORS headers for development. */
function setCors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** GET /api/servers – list servers with pagination. */
function handleListServers(res: http.ServerResponse, searchParams: URLSearchParams): void {
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const servers = list({ limit: Math.min(limit, 100), offset });
  json(res, 200, { total: count(), limit, offset, servers });
}

/** GET /api/servers/:name – get a single server. */
function handleGetServer(res: http.ServerResponse, name: string): void {
  const server = get(name);
  if (!server) {
    error(res, 404, `Server "${name}" not found`);
    return;
  }
  json(res, 200, server);
}

/** GET /api/search?q=xxx – search the registry. */
function handleSearch(res: http.ServerResponse, searchParams: URLSearchParams): void {
  const query = searchParams.get('q');
  if (!query) {
    error(res, 400, 'Missing required query parameter "q"');
    return;
  }
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const results = search({ query, limit: Math.min(limit, 50) });
  json(res, 200, { query, count: results.length, results });
}

/** POST /api/servers – register a new server (authenticated). */
async function handleRegisterServer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const token = extractToken(req);
  if (!token || token !== API_TOKEN) {
    error(res, 401, 'Unauthorized – valid Bearer token required');
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = (await parseBody(req)) as Record<string, unknown>;
  } catch (err: any) {
    error(res, 400, err.message);
    return;
  }

  if (!body.name || typeof body.name !== 'string') {
    error(res, 400, 'Field "name" is required and must be a string');
    return;
  }

  try {
    const server = register({
      name: body.name as string,
      description: (body.description as string) || '',
      version: (body.version as string) || '0.1.0',
      author: (body.author as string) || 'unknown',
      installCommand: (body.installCommand as string) || `npm install -g ${body.name}`,
      githubUrl: (body.githubUrl as string) || '',
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    });
    json(res, 201, server);
  } catch (err: any) {
    error(res, 409, err.message);
  }
}

/** GET /api/health – simple health check. */
function handleHealth(res: http.ServerResponse): void {
  json(res, 200, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  setCors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { pathname, searchParams } = parseUrl(req);

  // Route: GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    handleHealth(res);
    return;
  }

  // Route: GET /api/search
  if (req.method === 'GET' && pathname === '/api/search') {
    handleSearch(res, searchParams);
    return;
  }

  // Route: GET /api/servers (list)
  if (req.method === 'GET' && pathname === '/api/servers') {
    handleListServers(res, searchParams);
    return;
  }

  // Route: POST /api/servers (register)
  if (req.method === 'POST' && pathname === '/api/servers') {
    await handleRegisterServer(req, res);
    return;
  }

  // Route: GET /api/servers/:name
  const serverMatch = pathname.match(/^\/api\/servers\/(.+)$/);
  if (req.method === 'GET' && serverMatch) {
    const name = decodeURIComponent(serverMatch[1]);
    handleGetServer(res, name);
    return;
  }

  // 404 fallback
  error(res, 404, `Not Found: ${req.method} ${pathname}`);
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${req.method} ${req.url} – ${err.message}`);
    if (!res.headersSent) {
      error(res, 500, 'Internal Server Error');
    }
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  MCP Platform API Server`);
    // eslint-disable-next-line no-console
    console.log(`  http://${HOST}:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`  Health: http://${HOST}:${PORT}/api/health\n`);
  });
}

export { server };
