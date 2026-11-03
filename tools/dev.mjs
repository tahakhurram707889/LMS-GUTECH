import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Run this launcher with npm run dev');
const children=['backend','frontend'].map((workspace)=>spawn(process.execPath,[npm,'run','dev','--workspace',workspace],{cwd:root,stdio:'inherit',windowsHide:true}));
let stopping=false;
function stop(code=0){
  if(stopping)return;stopping=true;
  for(const child of children){
    if(!child.pid)continue;
    if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore',windowsHide:true});
    else child.kill('SIGTERM');
  }
  process.exitCode=code;
}
for(const child of children){child.on('error',()=>stop(1));child.on('exit',(code)=>stop(code??0));}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
