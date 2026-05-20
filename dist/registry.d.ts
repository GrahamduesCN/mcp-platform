/**
 * MCP Server Registry
 *
 * Core registry module for managing Model Context Protocol (MCP) server
 * packages. Provides registration, search, listing, and popularity-based
 * discovery with JSON file persistence.
 *
 * @module registry
 */
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
/**
 * Register a new MCP server in the registry.
 *
 * @param server - Server metadata (name required, rest optional with defaults).
 * @returns The fully-populated server record as persisted.
 * @throws If a server with the same name already exists.
 */
export declare function register(server: Omit<MCPServer, 'downloads' | 'createdAt' | 'updatedAt'>): MCPServer;
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
export declare function search(options: SearchOptions): MCPServer[];
/**
 * Retrieve a single server by its exact name.
 *
 * @param name - Exact server name.
 * @returns The server record or `null` if not found.
 */
export declare function get(name: string): MCPServer | null;
/**
 * List all registered servers with pagination.
 *
 * @param options - Pagination options (limit, offset).
 * @returns Paginated array of servers.
 */
export declare function list(options?: ListOptions): MCPServer[];
/**
 * Return the most popular servers sorted by download count.
 *
 * @param limit - Maximum number of results (default 10).
 * @returns Top servers by download count.
 */
export declare function popular(limit?: number): MCPServer[];
/**
 * Increment the download count for a given server.
 *
 * @param name - Exact server name.
 * @returns The updated server or `null` if not found.
 */
export declare function incrementDownloads(name: string): MCPServer | null;
/**
 * Return the total number of servers in the registry.
 */
export declare function count(): number;
//# sourceMappingURL=registry.d.ts.map