#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const VERSION = '2.14.0';

const platformMap = { darwin: 'macOS', linux: 'linux', win32: 'windows' };
const archMap = { x64: 'amd64', arm64: 'arm64' };

const goPlatform = platformMap[process.platform];
const goArch = archMap[process.arch];

if (!goPlatform || !goArch) {
  console.warn(
    `[install-subfinder] Unsupported platform ${process.platform}/${process.arch} — skipping`,
  );
  process.exit(0);
}

const binName = process.platform === 'win32' ? 'subfinder.exe' : 'subfinder';
const binDir = path.join(process.cwd(), 'bin');
const binPath = path.join(binDir, binName);

if (existsSync(binPath)) {
  console.info(`[install-subfinder] Already installed at ${binPath}`);
  process.exit(0);
}

mkdirSync(binDir, { recursive: true });

const url = `https://github.com/projectdiscovery/subfinder/releases/download/v${VERSION}/subfinder_${VERSION}_${goPlatform}_${goArch}.zip`;
const workDir = path.join(tmpdir(), `subfinder-install-${process.pid}`);
const zipPath = path.join(workDir, 'subfinder.zip');

mkdirSync(workDir, { recursive: true });

try {
  console.info(`[install-subfinder] Downloading ${url}`);
  execSync(`curl -fsSL -o "${zipPath}" "${url}"`, { stdio: 'inherit' });

  execSync(`unzip -o -j "${zipPath}" -d "${workDir}"`, { stdio: 'inherit' });

  execSync(`mv "${path.join(workDir, binName)}" "${binPath}"`, {
    stdio: 'inherit',
  });
  chmodSync(binPath, 0o755);

  console.info(`[install-subfinder] Installed to ${binPath}`);
} catch (error) {
  console.error(
    `[install-subfinder] Failed: ${error instanceof Error ? error.message : error}`,
  );
  // Do not fail the install — local dev can override with SUBFINDER_BIN.
  process.exit(0);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
