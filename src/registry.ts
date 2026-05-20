/**
 * MCP Server Registry
 *
 * Core registry module for managing Model Context Protocol (MCP) server
 * packages. Provides registration, search, listing, and popularity-based
 * discovery with JSON file persistence.
 *
 * @module registry
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Represents a single MCP server entry in the registry. */
export interface MCPServer {
  /** Unique identifier / package name (e.g. "@anthropic/mcp-server-filesystem") */
  name: string;
  /** Human-readable one-line description */
  description: string;
  /** Current semantic version */
  version: string;
  /** Author/organization name */
  author: string;
  /** Shell command to install the server */
  installCommand: string;
  /** Link to the source repository */
  githubUrl: string;
  /** Categorisation / search tags */
  tags: string[];
  /** Lifetime download count */
  downloads: number;
  /** ISO-8601 timestamp of first registration */
  createdAt: string;
  /** ISO-8601 timestamp of last update */
  updatedAt: string;
}

/** Query options for searching the registry. */
export interface SearchOptions {
  /** Free-text search across name, description, and tags */
  query: string;
  /** Maximum number of results (default 20) */
  limit?: number;
}

/** Query options for listing servers. */
export interface ListOptions {
  /** Maximum number of results (default 50) */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}

/** Shape of the on-disk JSON store. */
interface RegistryData {
  servers: MCPServer[];
}

// ---------------------------------------------------------------------------
// Built-in seed data
// ---------------------------------------------------------------------------

const SEED_SERVERS: MCPServer[] = [
  {
    name: '@anthropic/mcp-server-filesystem',
    description:
      'Secure filesystem operations with configurable access controls. Read, write, and manage files through MCP.',
    version: '0.6.2',
    author: 'Anthropic',
    installCommand: 'npm install -g @anthropic/mcp-server-filesystem',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    tags: ['filesystem', 'file', 'io', 'storage'],
    downloads: 28750,
    createdAt: '2024-11-25T00:00:00.000Z',
    updatedAt: '2025-05-10T00:00:00.000Z',
  },
  {
    name: '@anthropic/mcp-server-github',
    description:
      'GitHub API integration for repository management, issues, pull requests, and code search.',
    version: '0.5.0',
    author: 'Anthropic',
    installCommand: 'npm install -g @anthropic/mcp-server-github',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    tags: ['github', 'git', 'repository', 'issues', 'pr', 'devtools'],
    downloads: 22300,
    createdAt: '2024-11-25T00:00:00.000Z',
    updatedAt: '2025-04-22T00:00:00.000Z',
  },
  {
    name: '@anthropic/mcp-server-postgres',
    description:
      'PostgreSQL database integration with query execution, schema inspection, and connection pooling.',
    version: '0.4.1',
    author: 'Anthropic',
    installCommand: 'npm install -g @anthropic/mcp-server-postgres',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    tags: ['postgres', 'database', 'sql', 'data', 'infrastructure'],
    downloads: 15900,
    createdAt: '2024-12-10T00:00:00.000Z',
    updatedAt: '2025-03-15T00:00:00.000Z',
  },
  {
    name: '@anthropic/mcp-server-slack',
    description:
      'Slack workspace integration for messaging, channel management, and real-time notifications.',
    version: '0.3.0',
    author: 'Anthropic',
    installCommand: 'npm install -g @anthropic/mcp-server-slack',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    tags: ['slack', 'messaging', 'communication', 'notification', 'collaboration'],
    downloads: 12450,
    createdAt: '2024-12-20T00:00:00.000Z',
    updatedAt: '2025-05-01T00:00:00.000Z',
  },
  {
    name: '@anthropic/mcp-server-weather',
    description:
      'Real-time weather data and forecasts using OpenWeatherMap API integration.',
    version: '0.2.0',
    author: 'Anthropic',
    installCommand: 'npm install -g @anthropic/mcp-server-weather',
    githubUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/weather',
    tags: ['weather', 'forecast', 'api', 'utility'],
    downloads: 8970,
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-04-10T00:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute the absolute path to the JSON store. */
function dataFilePath(): string {
  return path.resolve(__dirname, '..', 'data', 'registry.json');
}

/** Ensure the data directory exists. */
function ensureDataDir(): void {
  const dir = path.dirname(dataFilePath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Read the full registry from disk, seeding on first run. */
function readRegistry(): MCPServer[] {
  const fp = dataFilePath();
  if (!fs.existsSync(fp)) {
    ensureDataDir();
    writeRegistryFile(SEED_SERVERS);
    return deepClone(SEED_SERVERS);
  }
  const raw = fs.readFileSync(fp, 'utf-8');
  const data: RegistryData = JSON.parse(raw);
  return Array.isArray(data.servers) ? data.servers : [];
}

/** Persist the server list atomically. */
function writeRegistryFile(servers: MCPServer[]): void {
  ensureDataDir();
  const tmp = dataFilePath() + '.tmp';
  const target = dataFilePath();
  try {
    fs.writeFileSync(tmp, JSON.stringify({ servers }, null, 2), 'utf-8');
    fs.renameSync(tmp, target);
  } catch (err) {
    throw new Error(`无法写入注册表 ${target}: ${err instanceof Error ? err.message : err}`);
  }
}

/** Deep-clone to avoid accidental mutations from callers. */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a new MCP server in the registry.
 *
 * @param server - Server metadata (name required, rest optional with defaults).
 * @returns The fully-populated server record as persisted.
 * @throws If a server with the same name already exists.
 */
export function register(server: Omit<MCPServer, 'downloads' | 'createdAt' | 'updatedAt'>): MCPServer {
  if (!server.name || typeof server.name !== 'string') {
    throw new Error('Server name is required.');
  }

  const all = readRegistry();

  if (all.some((s) => s.name === server.name)) {
    throw new Error(`Server "${server.name}" is already registered.`);
  }

  const now = new Date().toISOString();
  const entry: MCPServer = {
    name: server.name,
    description: server.description || '',
    version: server.version || '0.1.0',
    author: server.author || 'unknown',
    installCommand: server.installCommand || `npm install -g ${server.name}`,
    githubUrl: server.githubUrl || '',
    tags: server.tags || [],
    downloads: 0,
    createdAt: now,
    updatedAt: now,
  };

  all.push(entry);
  writeRegistryFile(all);
  return deepClone(entry);
}

/**
 * Search the registry for servers matching a free-text query.
 *
 * Matching is case-insensitive and performed against name, description, and
 * tags. Results are sorted by relevance (name match > description match >
 * tag match) and then by download count descending.
 *
 * @param options - Search query and optional limit.
 * @returns Array of matching servers.
 */
export function search(options: SearchOptions): MCPServer[] {
  const q = options.query.toLowerCase().trim();
  const limit = options.limit ?? 20;

  if (!q) {
    return [];
  }

  const all = readRegistry();

  const scored = all
    .map((s) => {
      let score = 0;
      if (s.name.toLowerCase().includes(q)) score += 100;
      if (s.description.toLowerCase().includes(q)) score += 50;
      if (s.tags.some((t) => t.toLowerCase().includes(q))) score += 30;
      return { server: s, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.server.downloads - a.server.downloads;
    });

  return scored.slice(0, limit).map((item) => deepClone(item.server));
}

/**
 * Retrieve a single server by its exact name.
 *
 * @param name - Exact server name.
 * @returns The server record or `null` if not found.
 */
export function get(name: string): MCPServer | null {
  const all = readRegistry();
  const found = all.find((s) => s.name === name);
  return found ? deepClone(found) : null;
}

/**
 * List all registered servers with pagination.
 *
 * @param options - Pagination options (limit, offset).
 * @returns Paginated array of servers.
 */
export function list(options: ListOptions = {}): MCPServer[] {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const all = readRegistry();
  return all.slice(offset, offset + limit).map(deepClone);
}

/**
 * Return the most popular servers sorted by download count.
 *
 * @param limit - Maximum number of results (default 10).
 * @returns Top servers by download count.
 */
export function popular(limit: number = 10): MCPServer[] {
  const all = readRegistry();
  return all
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, limit)
    .map(deepClone);
}

/**
 * Increment the download count for a given server.
 *
 * @param name - Exact server name.
 * @returns The updated server or `null` if not found.
 */
export function incrementDownloads(name: string): MCPServer | null {
  const all = readRegistry();
  const idx = all.findIndex((s) => s.name === name);
  if (idx === -1) return null;
  all[idx].downloads += 1;
  all[idx].updatedAt = new Date().toISOString();
  writeRegistryFile(all);
  return deepClone(all[idx]);
}

/**
 * Return the total number of servers in the registry.
 */
export function count(): number {
  return readRegistry().length;
}
