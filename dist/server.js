"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const http = __importStar(require("http"));
const registry_1 = require("./registry");
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
const JSON_CONTENT_TYPE = {
    'Content-Type': 'application/json; charset=utf-8',
};
/** Send a JSON response and end the connection. */
function json(res, statusCode, body) {
    const payload = JSON.stringify(body, null, process.env.NODE_ENV === 'production' ? 0 : 2);
    res.writeHead(statusCode, JSON_CONTENT_TYPE);
    res.end(payload);
}
/** Send an error JSON response. */
function error(res, statusCode, message) {
    json(res, statusCode, { error: { code: statusCode, message } });
}
/** Parse JSON body from an incoming request. Returns a Promise. */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (!raw.trim()) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            }
            catch {
                reject(new Error('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}
/** Extract the URL pathname and query string from the request. */
function parseUrl(req) {
    const base = `http://${req.headers.host || 'localhost'}`;
    const url = new URL(req.url || '/', base);
    return { pathname: url.pathname, searchParams: url.searchParams };
}
/** Extract Bearer token from Authorization header. */
function extractToken(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    return auth.slice(7).trim();
}
/** Simple CORS headers for development. */
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
/** GET /api/servers – list servers with pagination. */
function handleListServers(res, searchParams) {
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const servers = (0, registry_1.list)({ limit: Math.min(limit, 100), offset });
    json(res, 200, { total: (0, registry_1.count)(), limit, offset, servers });
}
/** GET /api/servers/:name – get a single server. */
function handleGetServer(res, name) {
    const server = (0, registry_1.get)(name);
    if (!server) {
        error(res, 404, `Server "${name}" not found`);
        return;
    }
    json(res, 200, server);
}
/** GET /api/search?q=xxx – search the registry. */
function handleSearch(res, searchParams) {
    const query = searchParams.get('q');
    if (!query) {
        error(res, 400, 'Missing required query parameter "q"');
        return;
    }
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const results = (0, registry_1.search)({ query, limit: Math.min(limit, 50) });
    json(res, 200, { query, count: results.length, results });
}
/** POST /api/servers – register a new server (authenticated). */
async function handleRegisterServer(req, res) {
    const token = extractToken(req);
    if (!token || token !== API_TOKEN) {
        error(res, 401, 'Unauthorized – valid Bearer token required');
        return;
    }
    let body;
    try {
        body = (await parseBody(req));
    }
    catch (err) {
        error(res, 400, err.message);
        return;
    }
    if (!body.name || typeof body.name !== 'string') {
        error(res, 400, 'Field "name" is required and must be a string');
        return;
    }
    try {
        const server = (0, registry_1.register)({
            name: body.name,
            description: body.description || '',
            version: body.version || '0.1.0',
            author: body.author || 'unknown',
            installCommand: body.installCommand || `npm install -g ${body.name}`,
            githubUrl: body.githubUrl || '',
            tags: Array.isArray(body.tags) ? body.tags : [],
        });
        json(res, 201, server);
    }
    catch (err) {
        error(res, 409, err.message);
    }
}
/** GET /api/health – simple health check. */
function handleHealth(res) {
    json(res, 200, {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------
async function handleRequest(req, res) {
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
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[ERROR] ${req.method} ${req.url} – ${err.message}`);
        if (!res.headersSent) {
            error(res, 500, 'Internal Server Error');
        }
    }
});
exports.server = server;
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
//# sourceMappingURL=server.js.map