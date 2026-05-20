#!/usr/bin/env node

/**
 * MCP CLI - Command-line interface for discovering and managing MCP servers.
 *
 * Usage:
 *   mcp search <query>    Search the registry
 *   mcp install <name>    Install an MCP server
 *   mcp list              List installed servers
 *   mcp publish           Publish your own MCP server
 *
 * @module cli
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  search,
  get,
  register,
  list as listRegistry,
  popular,
  incrementDownloads,
  MCPServer,
} from './registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INSTALLED_FILE = path.join(os.homedir(), '.mcp', 'installed.json');

interface InstalledServer {
  name: string;
  version: string;
  installCommand: string;
  installedAt: string;
}

/** Read the local installed-servers manifest. */
function readInstalled(): InstalledServer[] {
  if (!fs.existsSync(INSTALLED_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(INSTALLED_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

/** Persist an installed server record. */
function saveInstalled(entry: InstalledServer): void {
  const dir = path.dirname(INSTALLED_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const all = readInstalled();
  const idx = all.findIndex((s) => s.name === entry.name);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  fs.writeFileSync(INSTALLED_FILE, JSON.stringify(all, null, 2), 'utf-8');
}

/** Format a single server entry for CLI output. */
function formatServer(server: MCPServer): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan(server.name) + chalk.gray(` v${server.version}`));
  lines.push(`  ${server.description}`);
  lines.push(
    chalk.gray(`  Author: ${server.author}  |  Downloads: ${server.downloads.toLocaleString()}`),
  );
  if (server.tags.length) {
    lines.push(
      `  Tags: ${server.tags.map((t) => chalk.blue(`#${t}`)).join(' ')}`,
    );
  }
  lines.push(chalk.gray(`  Install: ${server.installCommand}`));
  lines.push(chalk.underline(server.githubUrl));
  return lines.join('\n');
}

/** Render a compact table row. */
function tableRow(server: MCPServer): string {
  const name = chalk.cyan(server.name.padEnd(40));
  const ver = chalk.yellow(server.version.padEnd(8));
  const dls = chalk.green(server.downloads.toLocaleString().padStart(8));
  return `${name} ${ver} ${dls}`;
}

// ---------------------------------------------------------------------------
// Program definition
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('mcp')
  .description('Model Context Protocol Server Manager')
  .version('1.0.0');

// ---- search ----------------------------------------------------------------

program
  .command('search <query>')
  .description('Search the MCP server registry')
  .option('-l, --limit <number>', 'Maximum results', '10')
  .action((query: string, options: { limit: string }) => {
    const spinner = ora.default('Searching registry...').start();
    try {
      const limit = parseInt(options.limit, 10) || 10;
      const results = search({ query, limit });

      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow(`\n  No MCP servers found for "${query}".`));
        console.log(chalk.gray('  Try a broader search term or check the spelling.\n'));
        return;
      }

      console.log(chalk.bold(`\n  ${results.length} result(s) for "${query}":\n`));
      for (const s of results) {
        console.log(formatServer(s));
        console.log('');
      }
    } catch (err: any) {
      spinner.fail(`Search failed: ${err.message}`);
      process.exit(1);
    }
  });

// ---- install ---------------------------------------------------------------

program
  .command('install <name>')
  .description('Install an MCP server from the registry')
  .action((name: string) => {
    const spinner = ora.default(`Installing ${chalk.cyan(name)}...`).start();

    try {
      const server = get(name);
      if (!server) {
        spinner.fail(`Server "${name}" not found in registry.`);
        console.log(chalk.gray('  Use "mcp search <query>" to find available servers.'));
        process.exit(1);
      }

      spinner.text = `Running: ${server.installCommand}`;
      execSync(server.installCommand, { stdio: 'pipe' });

      saveInstalled({
        name: server.name,
        version: server.version,
        installCommand: server.installCommand,
        installedAt: new Date().toISOString(),
      });

      incrementDownloads(server.name);

      spinner.succeed(`Installed ${chalk.bold(server.name)} v${server.version}`);
      console.log(chalk.green(`\n  ${server.name} is ready to use!\n`));
    } catch (err: any) {
      spinner.fail(`Installation failed: ${err.message}`);
      console.log(chalk.gray('  Check your network connection and npm configuration.'));
      process.exit(1);
    }
  });

// ---- list ------------------------------------------------------------------

program
  .command('list')
  .description('List locally installed MCP servers')
  .action(() => {
    const spinner = ora.default('Loading installed servers...').start();

    try {
      const installed = readInstalled();
      spinner.stop();

      if (installed.length === 0) {
        console.log(chalk.yellow('\n  No MCP servers installed.'));
        console.log(
          chalk.gray('  Use "mcp search <query>" to discover available servers.\n'),
        );
        return;
      }

      console.log(chalk.bold(`\n  Installed MCP Servers (${installed.length}):\n`));

      const table = installed.map((s) => {
        const name = chalk.cyan(s.name.padEnd(45));
        const ver = chalk.yellow(s.version.padEnd(10));
        const date = chalk.gray(new Date(s.installedAt).toLocaleDateString());
        return `  ${name} ${ver} ${date}`;
      });

      console.log(table.join('\n'));
      console.log('');
    } catch (err: any) {
      spinner.fail(`Failed to read installed servers: ${err.message}`);
      process.exit(1);
    }
  });

// ---- publish ---------------------------------------------------------------

program
  .command('publish')
  .description('Publish your MCP server to the registry')
  .requiredOption('-n, --name <name>', 'Package name (e.g. @scope/mcp-server-mine)')
  .requiredOption('-d, --description <text>', 'Short description')
  .option('-v, --version <ver>', 'Semantic version', '0.1.0')
  .option('-a, --author <name>', 'Author name', os.userInfo().username || 'unknown')
  .option('-i, --install <cmd>', 'Install command')
  .option('-r, --repo <url>', 'GitHub repository URL')
  .option('-t, --tags <list>', 'Comma-separated tags', '')
  .action((options: Record<string, string>) => {
    const spinner = ora.default('Publishing to registry...').start();

    try {
      const tags = options.tags
        ? options.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const server = register({
        name: options.name,
        description: options.description,
        version: options.version,
        author: options.author,
        installCommand: options.install || `npm install -g ${options.name}`,
        githubUrl: options.repo || '',
        tags,
      });

      spinner.succeed(`Published ${chalk.bold(server.name)} v${server.version}`);
      console.log(chalk.green('\n  Your MCP server is now available in the registry!'));
      console.log(chalk.gray(`  View details: mcp search ${server.name}\n`));
    } catch (err: any) {
      spinner.fail(`Publish failed: ${err.message}`);
      process.exit(1);
    }
  });

// ---- info ------------------------------------------------------------------

program
  .command('info <name>')
  .description('Show detailed information about an MCP server')
  .action((name: string) => {
    const spinner = ora.default('Fetching server info...').start();
    try {
      const server = get(name);
      spinner.stop();

      if (!server) {
        console.log(chalk.yellow(`\n  Server "${name}" not found.\n`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n  Server Details:\n`));
      console.log(formatServer(server));
      console.log(chalk.gray(`  Created:  ${server.createdAt}`));
      console.log(chalk.gray(`  Updated:  ${server.updatedAt}`));
      console.log('');
    } catch (err: any) {
      spinner.fail(`Failed: ${err.message}`);
      process.exit(1);
    }
  });

// ---- popular ---------------------------------------------------------------

program
  .command('popular')
  .description('Show the most popular MCP servers')
  .option('-n, --number <n>', 'Number of results', '10')
  .action((options: { number: string }) => {
    const spinner = ora.default('Loading popular servers...').start();
    try {
      const n = parseInt(options.number, 10) || 10;
      const results = popular(n);
      spinner.stop();

      console.log(chalk.bold(`\n  Top ${results.length} MCP Servers:\n`));
      console.log(`  ${chalk.gray('NAME'.padEnd(40))} ${chalk.gray('VERSION'.padEnd(8))} ${chalk.gray('DOWNLOADS')}`);
      console.log(`  ${''.padEnd(40, '-')} ${''.padEnd(8, '-')} ${''.padEnd(8, '-')}`);

      for (const s of results) {
        console.log(`  ${tableRow(s)}`);
      }
      console.log('');
    } catch (err: any) {
      spinner.fail(`Failed: ${err.message}`);
      process.exit(1);
    }
  });

// ---- parse -----------------------------------------------------------------

program.parse(process.argv);

// Show help if no command given
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
