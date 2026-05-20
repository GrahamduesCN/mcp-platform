# MCP Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/modelcontextprotocol/servers)

> **Discover, install, and publish Model Context Protocol (MCP) servers.**
> A lightweight registry and CLI toolkit for the MCP ecosystem.

---

## Features

- **Registry** — Centralized catalog of MCP servers with metadata, tags, and download tracking
- **CLI Tool** — Fast command-line interface for searching, installing, and publishing servers
- **REST API** — Simple HTTP API with built-in authentication for programmatic access
- **JSON Storage** — Zero-database persistence using flat JSON files
- **TypeScript** — Fully typed codebase with comprehensive JSDoc documentation

---

## Quick Start

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x

### Installation

```bash
# Clone the repository
git clone https://github.com/modelcontextprotocol/mcp-platform.git
cd mcp-platform

# Install dependencies and build
npm install
npm run build
```

### Start the API Server

```bash
npm start
# Server listening on http://127.0.0.1:3456
# Health check: http://127.0.0.1:3456/api/health
```

### Use the CLI

```bash
# Link the CLI globally for development
npm link

# Search for MCP servers
mcp search filesystem

# View server details
mcp info @anthropic/mcp-server-filesystem

# Install a server
mcp install @anthropic/mcp-server-filesystem

# List installed servers
mcp list

# Show popular servers
mcp popular

# Publish your own server
mcp publish \
  --name @scope/my-mcp-server \
  --description "My awesome MCP server" \
  --author "Your Name" \
  --tags "utility,automation"
```

---

## CLI Reference

| Command | Description |
|---|---|
| `mcp search <query>` | Search the MCP registry |
| `mcp info <name>` | Show detailed server information |
| `mcp install <name>` | Install a server from the registry |
| `mcp list` | List locally installed servers |
| `mcp popular` | Show the most downloaded servers |
| `mcp publish` | Publish your own MCP server |
| `mcp --help` | Display help information |

### CLI Screenshot

<!--
![MCP CLI Screenshot](docs/screenshot.png)
*Placeholder: Add a terminal screenshot showing `mcp search filesystem` output.*
-->

```
$ mcp search filesystem

  2 result(s) for "filesystem":

  @anthropic/mcp-server-filesystem v0.6.2
    Secure filesystem operations with configurable access controls.
    Author: Anthropic  |  Downloads: 28,750
    Tags: #filesystem #file #io #storage
    Install: npm install -g @anthropic/mcp-server-filesystem
    https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check |
| `GET` | `/api/servers` | No | List all servers (paginated) |
| `GET` | `/api/servers/:name` | No | Get server details |
| `GET` | `/api/search?q=xxx` | No | Search the registry |
| `POST` | `/api/servers` | Bearer token | Register a new server |

### Authentication

Protected endpoints require a `Bearer` token in the `Authorization` header:

```bash
curl -X POST http://127.0.0.1:3456/api/servers \
  -H "Authorization: Bearer $MCP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"@scope/my-server","description":"My server"}'
```

Set the token via environment variable: `MCP_API_TOKEN=your-secret-token`

---

## Project Structure

```
mcp-platform/
├── src/
│   ├── cli.ts          # CLI tool (commander + chalk + ora)
│   ├── registry.ts     # Core registry logic & data persistence
│   └── server.ts       # HTTP API server (pure Node.js)
├── data/
│   └── registry.json   # JSON store (auto-generated)
├── dist/               # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

---

## Built-in Servers

The registry ships with five example MCP servers:

| Server | Category | Downloads |
|---|---|---|
| `@anthropic/mcp-server-filesystem` | File I/O | ~28K |
| `@anthropic/mcp-server-github` | DevTools | ~22K |
| `@anthropic/mcp-server-postgres` | Database | ~15K |
| `@anthropic/mcp-server-slack` | Communication | ~12K |
| `@anthropic/mcp-server-weather` | Utility | ~8K |

---

## Development

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev
```

---

## License

MIT © MCP Platform Team

---

## Sponsor

If this project helps you, consider supporting its development:

[![Sponsor](https://img.shields.io/badge/Sponsor-PayPal-blue.svg)](https://paypal.me/GrahamduesCN)

**[Donate via PayPal](https://paypal.me/GrahamduesCN)**
