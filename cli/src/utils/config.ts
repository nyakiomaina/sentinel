import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface SentinelConfig {
  keypairPath: string;
}

function configDir(): string {
  return path.join(os.homedir(), ".sentinel");
}

export function configPath(): string {
  return path.join(configDir(), "config.json");
}

export function readConfig(): SentinelConfig | null {
  try {
    const raw = readFileSync(configPath(), "utf8");
    return JSON.parse(raw) as SentinelConfig;
  } catch {
    return null;
  }
}

export function writeConfig(cfg: SentinelConfig): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf8");
}

