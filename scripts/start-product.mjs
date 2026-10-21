import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const children=[
  spawn(process.execPath,[resolve(root,'apps/api/src/guard-server.js')],{stdio:'inherit',env:process.env}),
  spawn(process.execPath,[resolve(root,'apps/web/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173'],{stdio:'inherit',cwd:resolve(root,'apps/web'),env:process.env}),
];
function stop(){for(const child of children)child.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
for(const child of children)child.on('exit',(code)=>{if(code&&code!==0){stop();process.exitCode=code;}});
console.log('Auctent web: http://127.0.0.1:5173  ·  API: http://127.0.0.1:5055');
