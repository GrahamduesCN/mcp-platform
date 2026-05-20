#!/usr/bin/env node
"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora = __importStar(require("ora"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const registry_1 = require("./registry");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const INSTALLED_FILE = path.join(os.homedir(), '.mcp', 'installed.json');
/** Read the local installed-servers manifest. */
function readInstalled() {
    if (!fs.existsSync(INSTALLED_FILE))
        return [];
    try {
        return JSON.parse(fs.readFileSync(INSTALLED_FILE, 'utf-8'));
    }
    catch {
        return [];
    }
}
/** Persist an installed server record. */
function saveInstalled(entry) {
    const dir = path.dirname(INSTALLED_FILE);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const all = readInstalled();
    const idx = all.findIndex((s) => s.name === entry.name);
    if (idx >= 0)
        all[idx] = entry;
    else
        all.push(entry);
    fs.writeFileSync(INSTALLED_FILE, JSON.stringify(all, null, 2), 'utf-8');
}
/** Format a single server entry for CLI output. */
function formatServer(server) {
    const lines = [];
    lines.push(chalk_1.default.bold.cyan(server.name) + chalk_1.default.gray(` v${server.version}`));
    lines.push(`  ${server.description}`);
    lines.push(chalk_1.default.gray(`  Author: ${server.author}  |  Downloads: ${server.downloads.toLocaleString()}`));
    if (server.tags.length) {
        lines.push(`  Tags: ${server.tags.map((t) => chalk_1.default.blue(`#${t}`)).join(' ')}`);
    }
    lines.push(chalk_1.default.gray(`  Install: ${server.installCommand}`));
    lines.push(chalk_1.default.underline(server.githubUrl));
    return lines.join('\n');
}
/** Render a compact table row. */
function tableRow(server) {
    const name = chalk_1.default.cyan(server.name.padEnd(40));
    const ver = chalk_1.default.yellow(server.version.padEnd(8));
    const dls = chalk_1.default.green(server.downloads.toLocaleString().padStart(8));
    return `${name} ${ver} ${dls}`;
}
// ---------------------------------------------------------------------------
// Program definition
// ---------------------------------------------------------------------------
const program = new commander_1.Command();
program
    .name('mcp')
    .description('Model Context Protocol Server Manager')
    .version('1.0.0');
// ---- search ----------------------------------------------------------------
program
    .command('search <query>')
    .description('Search the MCP server registry')
    .option('-l, --limit <number>', 'Maximum results', '10')
    .action((query, options) => {
    const spinner = ora.default('Searching registry...').start();
    try {
        const limit = parseInt(options.limit, 10) || 10;
        const results = (0, registry_1.search)({ query, limit });
        spinner.stop();
        if (results.length === 0) {
            console.log(chalk_1.default.yellow(`\n  No MCP servers found for "${query}".`));
            console.log(chalk_1.default.gray('  Try a broader search term or check the spelling.\n'));
            return;
        }
        console.log(chalk_1.default.bold(`\n  ${results.length} result(s) for "${query}":\n`));
        for (const s of results) {
            console.log(formatServer(s));
            console.log('');
        }
    }
    catch (err) {
        spinner.fail(`Search failed: ${err.message}`);
        process.exit(1);
    }
});
// ---- install ---------------------------------------------------------------
program
    .command('install <name>')
    .description('Install an MCP server from the registry')
    .action((name) => {
    const spinner = ora.default(`Installing ${chalk_1.default.cyan(name)}...`).start();
    try {
        const server = (0, registry_1.get)(name);
        if (!server) {
            spinner.fail(`Server "${name}" not found in registry.`);
            console.log(chalk_1.default.gray('  Use "mcp search <query>" to find available servers.'));
            process.exit(1);
        }
        spinner.text = `Running: ${server.installCommand}`;
        (0, child_process_1.execSync)(server.installCommand, { stdio: 'pipe' });
        saveInstalled({
            name: server.name,
            version: server.version,
            installCommand: server.installCommand,
            installedAt: new Date().toISOString(),
        });
        (0, registry_1.incrementDownloads)(server.name);
        spinner.succeed(`Installed ${chalk_1.default.bold(server.name)} v${server.version}`);
        console.log(chalk_1.default.green(`\n  ${server.name} is ready to use!\n`));
    }
    catch (err) {
        spinner.fail(`Installation failed: ${err.message}`);
        console.log(chalk_1.default.gray('  Check your network connection and npm configuration.'));
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
            console.log(chalk_1.default.yellow('\n  No MCP servers installed.'));
            console.log(chalk_1.default.gray('  Use "mcp search <query>" to discover available servers.\n'));
            return;
        }
        console.log(chalk_1.default.bold(`\n  Installed MCP Servers (${installed.length}):\n`));
        const table = installed.map((s) => {
            const name = chalk_1.default.cyan(s.name.padEnd(45));
            const ver = chalk_1.default.yellow(s.version.padEnd(10));
            const date = chalk_1.default.gray(new Date(s.installedAt).toLocaleDateString());
            return `  ${name} ${ver} ${date}`;
        });
        console.log(table.join('\n'));
        console.log('');
    }
    catch (err) {
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
    .action((options) => {
    const spinner = ora.default('Publishing to registry...').start();
    try {
        const tags = options.tags
            ? options.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : [];
        const server = (0, registry_1.register)({
            name: options.name,
            description: options.description,
            version: options.version,
            author: options.author,
            installCommand: options.install || `npm install -g ${options.name}`,
            githubUrl: options.repo || '',
            tags,
        });
        spinner.succeed(`Published ${chalk_1.default.bold(server.name)} v${server.version}`);
        console.log(chalk_1.default.green('\n  Your MCP server is now available in the registry!'));
        console.log(chalk_1.default.gray(`  View details: mcp search ${server.name}\n`));
    }
    catch (err) {
        spinner.fail(`Publish failed: ${err.message}`);
        process.exit(1);
    }
});
// ---- info ------------------------------------------------------------------
program
    .command('info <name>')
    .description('Show detailed information about an MCP server')
    .action((name) => {
    const spinner = ora.default('Fetching server info...').start();
    try {
        const server = (0, registry_1.get)(name);
        spinner.stop();
        if (!server) {
            console.log(chalk_1.default.yellow(`\n  Server "${name}" not found.\n`));
            process.exit(1);
        }
        console.log(chalk_1.default.bold(`\n  Server Details:\n`));
        console.log(formatServer(server));
        console.log(chalk_1.default.gray(`  Created:  ${server.createdAt}`));
        console.log(chalk_1.default.gray(`  Updated:  ${server.updatedAt}`));
        console.log('');
    }
    catch (err) {
        spinner.fail(`Failed: ${err.message}`);
        process.exit(1);
    }
});
// ---- popular ---------------------------------------------------------------
program
    .command('popular')
    .description('Show the most popular MCP servers')
    .option('-n, --number <n>', 'Number of results', '10')
    .action((options) => {
    const spinner = ora.default('Loading popular servers...').start();
    try {
        const n = parseInt(options.number, 10) || 10;
        const results = (0, registry_1.popular)(n);
        spinner.stop();
        console.log(chalk_1.default.bold(`\n  Top ${results.length} MCP Servers:\n`));
        console.log(`  ${chalk_1.default.gray('NAME'.padEnd(40))} ${chalk_1.default.gray('VERSION'.padEnd(8))} ${chalk_1.default.gray('DOWNLOADS')}`);
        console.log(`  ${''.padEnd(40, '-')} ${''.padEnd(8, '-')} ${''.padEnd(8, '-')}`);
        for (const s of results) {
            console.log(`  ${tableRow(s)}`);
        }
        console.log('');
    }
    catch (err) {
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
//# sourceMappingURL=cli.js.map