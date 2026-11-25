// Runs the backend (port 3001) and the Vite dev server (port 5173) together.
// Open http://localhost:5173 while developing.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procs = [
  ['server', ['run', 'dev', '--prefix', 'server']],
  ['client', ['run', 'dev', '--prefix', 'client']],
].map(([name, args]) => {
  const p = spawn(npm, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const tag = (chunk) => chunk.toString().split('\n').filter(Boolean).map((l) => `[${name}] ${l}`).join('\n') + '\n';
  p.stdout.on('data', (d) => process.stdout.write(tag(d)));
  p.stderr.on('data', (d) => process.stderr.write(tag(d)));
  p.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
    procs.forEach((q) => q !== p && q.kill());
    process.exit(code ?? 0);
  });
  return p;
});

process.on('SIGINT', () => procs.forEach((p) => p.kill()));
