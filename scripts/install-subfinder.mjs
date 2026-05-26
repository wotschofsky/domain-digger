#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { execa } from 'execa';

const VERSION = '2.14.0';
const CURL_TIMEOUT_SECONDS = 120;

// Unix-only — Vercel deploys to Linux and macOS covers local dev. Windows
// contributors should run via WSL or point SUBFINDER_BIN at a system install.
// SHA-256 values come from subfinder's published checksums.txt and MUST be
// refreshed alongside VERSION.
const TARGETS = {
  linux_x64: {
    asset: 'linux_amd64',
    sha: '6529294788f56a20ed96a9b70e71f8f3c247f1d6104ba1e2c2e9e58d8a32c6cb',
  },
  linux_arm64: {
    asset: 'linux_arm64',
    sha: 'e3dc19f1e1b1f01840989e5d2501fd59069e3fd6fc2387ca78fbe246ef5e0680',
  },
  darwin_x64: {
    asset: 'macOS_amd64',
    sha: 'f419cf27f8d04ec7de967e9661767908caf1905636276c6c05916b19027c1959',
  },
  darwin_arm64: {
    asset: 'macOS_arm64',
    sha: '622a711bf0dfd4aab5b0f6f1f5efe0d6d20fb75734f947a34a7f8ef1348f5435',
  },
};

const isCI = Boolean(process.env.CI || process.env.VERCEL);
const bail = (message) => {
  console.error(`[install-subfinder] ${message}`);
  process.exit(isCI ? 1 : 0);
};

const target = TARGETS[`${process.platform}_${process.arch}`];
if (!target) {
  console.warn(
    `[install-subfinder] Unsupported platform ${process.platform}/${process.arch} — skipping (Unix only; set SUBFINDER_BIN to use a system install)`,
  );
  process.exit(0);
}

const binDir = path.join(process.cwd(), 'bin');
const binPath = path.join(binDir, 'subfinder');

if (existsSync(binPath)) {
  try {
    const { all = '' } = await execa(binPath, ['-version'], { all: true });
    if (all.includes(`Current Version: v${VERSION}`)) {
      console.info(
        `[install-subfinder] Already installed at ${binPath} (v${VERSION})`,
      );
      process.exit(0);
    }
    console.info(
      `[install-subfinder] Existing binary at ${binPath} is not v${VERSION}, replacing`,
    );
  } catch {
    console.info(
      `[install-subfinder] Existing binary at ${binPath} did not respond to -version, replacing`,
    );
  }
  rmSync(binPath, { force: true });
}

mkdirSync(binDir, { recursive: true });

const url = `https://github.com/projectdiscovery/subfinder/releases/download/v${VERSION}/subfinder_${VERSION}_${target.asset}.zip`;
const workDir = path.join(tmpdir(), `subfinder-install-${process.pid}`);
const zipPath = path.join(workDir, 'subfinder.zip');

mkdirSync(workDir, { recursive: true });

try {
  console.info(`[install-subfinder] Downloading ${url}`);
  await execa(
    'curl',
    ['-fsSL', '--max-time', String(CURL_TIMEOUT_SECONDS), '-o', zipPath, url],
    { stdio: 'inherit' },
  );

  const actualSha = createHash('sha256')
    .update(readFileSync(zipPath))
    .digest('hex');
  if (actualSha !== target.sha) {
    bail(
      `Checksum mismatch for ${target.asset}: expected ${target.sha}, got ${actualSha}`,
    );
  }
  console.info(`[install-subfinder] Checksum verified (sha256 ${actualSha})`);

  await execa('unzip', ['-o', '-j', zipPath, '-d', workDir], {
    stdio: 'inherit',
  });

  await execa('mv', [path.join(workDir, 'subfinder'), binPath], {
    stdio: 'inherit',
  });
  chmodSync(binPath, 0o755);

  console.info(`[install-subfinder] Installed to ${binPath} (v${VERSION})`);
} catch (error) {
  bail(`Failed: ${error instanceof Error ? error.message : error}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
