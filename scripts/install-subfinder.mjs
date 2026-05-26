#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { execa } from 'execa';

const VERSION = '2.14.0';
const CURL_TIMEOUT_SECONDS = 120;

// SHA-256 of the upstream release zips, keyed by ${goPlatform}_${goArch}.
// Copied from https://github.com/projectdiscovery/subfinder/releases/download/v${VERSION}/subfinder_${VERSION}_checksums.txt
// MUST be refreshed alongside VERSION.
const CHECKSUMS = {
  linux_386:
    'f724575b357370a9700b914965ed5eff73cd80472afb68fa316b46d75045c765',
  linux_amd64:
    '6529294788f56a20ed96a9b70e71f8f3c247f1d6104ba1e2c2e9e58d8a32c6cb',
  linux_arm:
    '6954e933eae0550b122af6561234b65f0cf284f47243961d2a70e97580629617',
  linux_arm64:
    'e3dc19f1e1b1f01840989e5d2501fd59069e3fd6fc2387ca78fbe246ef5e0680',
  macOS_amd64:
    'f419cf27f8d04ec7de967e9661767908caf1905636276c6c05916b19027c1959',
  macOS_arm64:
    '622a711bf0dfd4aab5b0f6f1f5efe0d6d20fb75734f947a34a7f8ef1348f5435',
};

// Linux + macOS only — Vercel runs Amazon Linux and most contributors are on
// macOS. Windows is dropped because the `unzip`/`mv` shell binaries aren't
// guaranteed there, and we'd otherwise have to keep two install paths.
const platformMap = { darwin: 'macOS', linux: 'linux' };
const archMap = { x64: 'amd64', arm64: 'arm64' };

// Fail closed on CI/Vercel; allow local dev to fall back to a user-installed
// subfinder via SUBFINDER_BIN.
const isCI = Boolean(process.env.CI || process.env.VERCEL);
const bail = (message) => {
  console.error(`[install-subfinder] ${message}`);
  process.exit(isCI ? 1 : 0);
};

const goPlatform = platformMap[process.platform];
const goArch = archMap[process.arch];

if (!goPlatform || !goArch) {
  console.warn(
    `[install-subfinder] Unsupported platform ${process.platform}/${process.arch} — skipping (set SUBFINDER_BIN to use a system install)`,
  );
  process.exit(0);
}

const expectedSha = CHECKSUMS[`${goPlatform}_${goArch}`];
if (!expectedSha) {
  bail(
    `No pinned checksum for ${goPlatform}_${goArch} — refusing to install unverified binary`,
  );
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

const url = `https://github.com/projectdiscovery/subfinder/releases/download/v${VERSION}/subfinder_${VERSION}_${goPlatform}_${goArch}.zip`;
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
  if (actualSha !== expectedSha) {
    bail(
      `Checksum mismatch for ${goPlatform}_${goArch}: expected ${expectedSha}, got ${actualSha}`,
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
