// One command for development: the API on :5055 and Vite (with HMR) on :5173.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const children = [
  spawn(process.execPath, [resolve(root, 'apps/server/src/index.js')], {stdio: 'inherit', env: process.env}),
  spawn(process.execPath, [resolve(root, 'apps/web/node_modules/vite/bin/vite.js')], {stdio: 'inherit', cwd: resolve(root, 'apps/web'), env: process.env}),
];
const stop = () => children.forEach(c => c.kill());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
children.forEach(c => c.on('exit', code => { if (code) { stop(); process.exitCode = code; } }));
console.log('Wardrail console  http://127.0.0.1:5173   API  http://127.0.0.1:5055');
