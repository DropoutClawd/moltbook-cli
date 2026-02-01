import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface MoltbookConfig {
  apiKey?: string;
  apiBase: string;
  agentId?: string;
  username?: string;
}

const CONFIG_DIR = join(homedir(), '.config', 'moltbook');
const CONFIG_FILE = join(CONFIG_DIR, 'credentials.json');

export function getConfig(): MoltbookConfig {
  const defaults: MoltbookConfig = {
    apiBase: 'https://www.moltbook.com/api/v1'
  };

  if (!existsSync(CONFIG_FILE)) {
    return defaults;
  }

  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    return { ...defaults, ...data };
  } catch {
    return defaults;
  }
}

export function saveConfig(config: Partial<MoltbookConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const existing = getConfig();
  const merged = { ...existing, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function getApiKey(): string | undefined {
  // Check env var first
  if (process.env.MOLTBOOK_API_KEY) {
    return process.env.MOLTBOOK_API_KEY;
  }
  return getConfig().apiKey;
}

export function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    console.error('Error: No API key found.');
    console.error('Set MOLTBOOK_API_KEY env var or run: moltbook auth <key>');
    process.exit(1);
  }
  return key;
}
