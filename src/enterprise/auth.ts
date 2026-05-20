/**
 * Enterprise Auth Module for Private Registry
 * bcrypt password + license key validation
 * Zero dependencies beyond Node.js crypto module
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';


// ─── Password Hashing ──────────────────────────────────

/** Simple bcrypt-like hash using built-in crypto (no bcryptjs dependency) */
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(actualSalt + password + 'mcp-hub-salt-v1')
    .digest('hex');
  return { hash, salt: actualSalt };
}

function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

// ─── License Key ───────────────────────────────────────

/**
 * License key format: MCP-XXXX-XXXX-XXXX (generated from email hash)
 * Validates ownership without needing a central license server.
 */
function generateLicenseKey(email: string): string {
  const hash = createHash('sha256').update(email + '-mcp-license-seed').digest('hex');
  const segments = [
    hash.slice(0, 4),
    hash.slice(4, 8),
    hash.slice(8, 12),
  ].map(s => s.toUpperCase());
  return `MCP-${segments.join('-')}`;
}

function validateLicenseKey(email: string, key: string): boolean {
  try {
    const expected = generateLicenseKey(email);
    return timingSafeEqual(
      Buffer.from(expected.replace(/-/g, '')),
      Buffer.from(key.replace(/-/g, ''))
    );
  } catch {
    return false;
  }
}

// ─── User Store ────────────────────────────────────────

interface EnterpriseUser {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  licenseKey: string;
  plan: 'pro' | 'enterprise';
  createdAt: string;
  expiresAt: string;
}

const USERS_FILE = join(__dirname, '..', 'data', 'enterprise-users.json');

function loadUsers(): Record<string, EnterpriseUser> {
  if (!existsSync(USERS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveUsers(users: Record<string, EnterpriseUser>): void {
  const dir = dirname(USERS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = USERS_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf-8');
  require('node:fs').renameSync(tmp, USERS_FILE);
}

// ─── Auth API ──────────────────────────────────────────

export function createUser(email: string, password: string, plan: 'pro' | 'enterprise'): { success: boolean; licenseKey?: string; error?: string } {
  const users = loadUsers();
  
  if (users[email]) {
    return { success: false, error: 'Email already registered' };
  }

  const { hash, salt } = hashPassword(password);
  const licenseKey = generateLicenseKey(email);

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year license

  users[email] = {
    email,
    passwordHash: hash,
    passwordSalt: salt,
    licenseKey,
    plan,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  saveUsers(users);
  return { success: true, licenseKey };
}

export function authenticateUser(email: string, password: string): { success: boolean; user?: EnterpriseUser; error?: string } {
  const users = loadUsers();
  const user = users[email];

  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }

  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    return { success: false, error: 'Invalid credentials' };
  }

  // Check expiration
  if (new Date(user.expiresAt) < new Date()) {
    return { success: false, error: 'License expired. Renew at paypal.me/GrahamduesCN' };
  }

  return { success: true, user };
}

export function verifyLicense(email: string, licenseKey: string): { success: boolean; error?: string } {
  const users = loadUsers();
  const user = users[email];

  if (!user) {
    return { success: false, error: 'No account found' };
  }

  if (!validateLicenseKey(email, licenseKey)) {
    return { success: false, error: 'Invalid license key' };
  }

  return { success: true };
}

export function getToken(email: string, password: string): string | null {
  const result = authenticateUser(email, password);
  if (!result.success) return null;

  // Simple token: base64(email:hash)
  const tokenData = `${email}:${result.user!.licenseKey}:${Date.now() + 86400000}`; // 24h expiry
  return Buffer.from(tokenData).toString('base64');
}

export function validateToken(token: string): { valid: boolean; email?: string; error?: string } {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [email, licenseKey, expiresStr] = decoded.split(':');
    
    if (Date.now() > parseInt(expiresStr)) {
      return { valid: false, error: 'Token expired' };
    }

    const licenseResult = verifyLicense(email, licenseKey);
    if (!licenseResult.success) {
      return { valid: false, error: 'Invalid license' };
    }

    return { valid: true, email };
  } catch {
    return { valid: false, error: 'Invalid token format' };
  }
}
