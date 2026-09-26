import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const backendDir = path.join(rootDir, 'backend');
const viteCli = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const mode = process.argv[2];

if (!['dev', 'preview'].includes(mode)) {
  throw new Error(`Unsupported app mode: ${mode || '(missing)'}`);
}

if (mode === 'preview') {
  const build = spawnSync(process.execPath, [viteCli, 'build'], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const children = new Set();
let stopping = false;

function stopServices(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

const backendArgs = mode === 'dev' ? ['--watch', 'server.js'] : ['server.js'];
const frontendArgs = mode === 'dev' ? [viteCli, '--host', 'localhost'] : [viteCli, 'preview', '--host', 'localhost'];

for (const [name, args, cwd] of [
  ['Food API', backendArgs, backendDir],
  ['Food frontend', frontendArgs, rootDir],
]) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(`${name} failed to start:`, error);
    stopServices(1);
  });
  child.on('close', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} stopped (${signal || `exit ${code}`}); stopping the other service.`);
      stopServices(code ?? 1);
    }
    if (stopping && children.size === 0) {
      process.exit();
    }
  });
}

process.on('SIGINT', () => stopServices(0));
process.on('SIGTERM', () => stopServices(0));
