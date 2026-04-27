#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const envFile = fs.existsSync(path.join(repoRoot, ".env"))
  ? path.join(repoRoot, ".env")
  : path.join(repoRoot, ".env.example");
const loadedEnv = fs.existsSync(envFile) ? parseEnvFile(fs.readFileSync(envFile, "utf8")) : {};
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/run-with-root-env.cjs <command> [...args]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  env: {
    ...loadedEnv,
    ...process.env
  },
  shell: process.platform === "win32",
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);

function parseEnvFile(value) {
  const env = {};

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let parsedValue = line.slice(separatorIndex + 1).trim();

    if (
      (parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
      (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
    ) {
      parsedValue = parsedValue.slice(1, -1);
    }

    env[key] = parsedValue;
  }

  return env;
}
