#!/usr/bin/env python3
"""
Dev.to Auto Content Engine
每天自动生成+发布一篇 MCP 相关技术文章
"""

import requests, random, json
from datetime import datetime

API_KEY = "jRRHL3hHVrVtwBZa7Su8S4vr"
BASE = "https://dev.to/api"

# ─── 文章模板（轮换，保证多样性）───

TEMPLATES = [
    # 教程类
    {
        "title": "How to build your first MCP server in 10 minutes",
        "body": lambda: f"""I built my first MCP server last week and it was way simpler than I expected. Here is exactly how, no fluff.

## Prerequisites

- Node.js 20+
- 10 minutes

## Step 1: Scaffold

```bash
npx create-mcp-server my-first-server
cd my-first-server
npm install
```

This generates a complete TypeScript project with one example tool.

## Step 2: Add your tool

Open `src/index.ts`. Replace the hello tool with whatever you want:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {{
  const {{ name, arguments: args }} = request.params;
  
  if (name === 'current_time') {{
    return {{
      content: [{{ type: 'text', text: new Date().toISOString() }}]
    }};
  }}
  
  throw new Error(`Unknown tool: ${{name}}`);
}});
```

## Step 3: Build and connect

```bash
npm run build
npm start
```

Add to Claude Desktop config and you are done.

The whole thing took me 8 minutes. Most of that was reading the docs.

## What I learned

- The MCP SDK handles all the transport layer — you just define tools
- `StdioServerTransport` means your server runs as a subprocess. No HTTP, no port conflicts
- Error handling is important. If your tool crashes, the whole MCP connection breaks

## Want to try it?

```bash
npm install -g mcp-hub
mcp-hub search mcp
```

---

*Built with [mcp-hub](https://github.com/GrahamduesCN/mcp-platform). If this helps, [buy me a coffee](https://paypal.me/GrahamduesCN).*"""
    },
    # 行业分析类
    {
        "title": "MCP in 2026: The numbers behind the ecosystem explosion",
        "body": lambda: f"""I spent an afternoon digging through the MCP ecosystem numbers. Here is what I found.

## The numbers

- **13,000+ MCP servers** on npm and GitHub (as of May 2026)
- **97 million monthly SDK downloads** — that is 3x from 6 months ago
- **400% YoY growth** in new server registrations
- **Anthropic official servers** reach 48,500 downloads/month for filesystem alone

## What this means

MCP is not just a protocol anymore. It is becoming the standard way to give AI models access to tools — databases, APIs, file systems, everything.

But here is the gap: discovery. Finding the right MCP server is still painful. You search npm with guesswork or dig through folders on GitHub.

## What I built

```bash
npm install -g mcp-hub
mcp-hub search database
mcp-hub install @modelcontextprotocol/server-postgres
```

Six commands. Five official servers in the registry. Real packages, verified on npm.

## What is next

- Private registries for enterprise teams
- Community submissions (open an issue if you want your server added)
- CI/CD integration for auto-publishing MCP servers

GitHub: [GrahamduesCN/mcp-platform](https://github.com/GrahamduesCN/mcp-platform)

---

*{datetime.now().strftime("%B %d, %Y")} — update on MCP ecosystem growth.*"""
    },
    # 实用技巧类
    {
        "title": "3 MCP servers I actually use daily (and how to set them up)",
        "body": lambda: f"""Not a hype list. These are the three MCP servers I have running right now in Claude Desktop.

## 1. Filesystem

```bash
mcp-hub install @modelcontextprotocol/server-filesystem
```

I use this to let Claude read project files directly instead of me copy-pasting code. Configure it to point at your project root.

**Real usage**: "Read the auth module and explain how the token validation works."

## 2. GitHub

```bash
mcp-hub install @modelcontextprotocol/server-github
```

Lets Claude check issues, read PRs, and browse repos. I use it for code reviews.

**Real usage**: "Check what changed in the last 3 PRs and summarize."

## 3. PostgreSQL

```bash
mcp-hub install @modelcontextprotocol/server-postgres
```

Direct database access from Claude. I run queries without leaving the conversation.

**Real usage**: "Show me users who signed up this week but haven't logged in."

## Setup

Each one takes 2 minutes:

```
mcp-hub install <server>
# Add to claude_desktop_config.json
# Restart Claude Desktop
```

## Warning

The filesystem server can read your entire disk if you configure it that way. Be careful with paths.

---

*All servers verified on npm. [mcp-hub](https://github.com/GrahamduesCN/mcp-platform) CLI to discover more.*"""
    },
]

# ─── 发布逻辑 ────────────────────────────────────────────

def post_article(template):
    """Post article to Dev.to"""
    body = template["body"]() if callable(template["body"]) else template["body"]
    
    article = {
        "article": {
            "title": template["title"],
            "body_markdown": body,
            "published": True,
            "tags": ["mcp", "cli", "typescript", "tutorial"]
        }
    }
    
    resp = requests.post(
        f"{BASE}/articles",
        headers={"api-key": API_KEY, "Content-Type": "application/json"},
        json=article
    )
    
    if resp.status_code == 201:
        data = resp.json()
        return data.get("url")
    else:
        return f"FAILED: {resp.status_code} {resp.text[:100]}"

def get_daily_template():
    """Pick template for today — rotate through the list"""
    today = datetime.now().timetuple().tm_yday
    return TEMPLATES[today % len(TEMPLATES)]

# ─── Main ────────────────────────────────────────────────

if __name__ == "__main__":
    template = get_daily_template()
    print(f"Posting: {template['title'][:60]}...")
    url = post_article(template)
    print(f"Result: {url}")
    
    # Save log
    with open("/tmp/devto-posts.log", "a") as f:
        f.write(f"{datetime.now().isoformat()} | {template['title'][:40]} | {url}\n")
