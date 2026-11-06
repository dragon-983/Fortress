import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🏰 Starting FORTRESS Full-Stack Security Wallet Services...');
console.log('📍 Root Directory:', rootDir);

const server = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3005' },
});

const client = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '5177' },
});

const cleanup = () => {
  console.log('\n🛑 Shutting down FORTRESS dev services...');
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
