/**
 * Enterprise Private Registry Server
 * Auth-protected MCP registry with license validation
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { validateToken, createUser, authenticateUser, getToken } from './auth.js';
import { search, get, register, list, MCPServer } from '../registry.js';

const PORT = parseInt(process.env.MCP_PORT || '3443');
const ADMIN_EMAIL = process.env.MCP_ADMIN || 'admin@mcp-hub.local';

interface RouteHandler {
  method: string;
  path: RegExp;
  auth: boolean;
  handler: (req: IncomingMessage, res: ServerResponse, email?: string) => Promise<void>;
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  });
  res.end(JSON.stringify(data));
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
  });
}

// ─── Routes ────────────────────────────────────────────

const routes: RouteHandler[] = [
  // Health - no auth
  {
    method: 'GET',
    path: /^\/api\/health$/,
    auth: false,
    handler: async (_, res) => json(res, { status: 'ok', type: 'enterprise' })
  },
  // Login
  {
    method: 'POST',
    path: /^\/api\/auth\/login$/,
    auth: false,
    handler: async (req, res) => {
      const data = JSON.parse(await body(req));
      const token = getToken(data.email, data.password);
      if (!token) return json(res, { error: 'Invalid credentials' }, 401);
      json(res, { token });
    }
  },
  // Register (create enterprise account)
  {
    method: 'POST',
    path: /^\/api\/auth\/register$/,
    auth: false,
    handler: async (req, res) => {
      const data = JSON.parse(await body(req));
      const result = createUser(data.email, data.password, data.plan || 'pro');
      if (!result.success) return json(res, { error: result.error }, 400);
      json(res, { licenseKey: result.licenseKey, message: 'Account created. Save your license key.' });
    }
  },
  // List servers - requires auth
  {
    method: 'GET',
    path: /^\/api\/servers$/,
    auth: true,
    handler: async (req, res, email) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const servers = list().slice(offset, offset + limit);
      json(res, { servers, total: list().length });
    }
  },
  // Search
  {
    method: 'GET',
    path: /^\/api\/search$/,
    auth: true,
    handler: async (req, res, email) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const q = url.searchParams.get('q') || '';
      const results = search({ query: q }).slice(0, 10).slice(0, 10);
      json(res, { results });
    }
  },
  // Get server detail
  {
    method: 'GET',
    path: /^\/api\/servers\/(.+)$/,
    auth: true,
    handler: async (req, res, email) => {
      const name = decodeURIComponent(req.url!.match(/\/api\/servers\/(.+)/)![1]);
      const server = get(name);
      if (!server) return json(res, { error: 'Not found' }, 404);
      json(res, server);
    }
  },
  // Register new server
  {
    method: 'POST',
    path: /^\/api\/servers$/,
    auth: true,
    handler: async (req, res, email) => {
      const data = JSON.parse(await body(req));
      const result = register(data);
      if (!result) return json(res, { error: 'Registration failed' }, 400);
      json(res, { success: true, server: result });
    }
  },
];

// ─── Auth Middleware ────────────────────────────────────

function checkAuth(req: IncomingMessage): string | null {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const result = validateToken(token);
  return result.valid ? (result.email || null) : null;
}

// ─── Server ─────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    });
    return res.end();
  }

  const method = req.method || 'GET';
  const url = req.url || '/';

  // Find matching route
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = url.match(route.path);
    if (!match) continue;

    if (route.auth) {
      const email = checkAuth(req);
      if (!email) return json(res, { error: 'Authentication required' }, 401);
      await route.handler(req, res, email);
    } else {
      await route.handler(req, res);
    }
    return;
  }

  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`MCP Enterprise Registry running on port ${PORT}`);
  console.log(`Auth: POST /api/auth/register  |  POST /api/auth/login`);
  console.log(`API:  GET /api/servers  |  GET /api/search?q=  |  POST /api/servers`);
});
