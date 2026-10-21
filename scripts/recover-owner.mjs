import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=process.env.SIGILANT_DATA_DIR || resolve(root,'.data/sigilant');
const url=process.env.SIGILANT_URL || `http://127.0.0.1:${process.env.PORT || 5055}`;

try {
  const credential=readFileSync(resolve(dataDir,'recovery.key'),'utf8').trim();
  const response=await fetch(new URL('/api/owner/recover',url),{
    method:'POST',
    headers:{authorization:`Bearer ${credential}`},
  });
  const result=await response.json();
  if (!response.ok) throw Error(result.error || `Recovery failed (${response.status})`);
  console.log('Owner key rotated. The previous owner key no longer works.');
  console.log('Save this new key now, then enter it on the Unlock screen:');
  console.log(result.key);
} catch (error) {
  console.error(`Owner recovery failed: ${error.message}`);
  console.error('Run the Sigilant API on this machine and use its data directory. Set SIGILANT_DATA_DIR and SIGILANT_URL if you use custom values.');
  process.exitCode=1;
}
