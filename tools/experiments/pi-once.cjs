#!/usr/bin/env node
// Keep isolated Pi config + rendered user instructions; remove only raw duplicate.
const {spawn}=require('node:child_process'),path=require('node:path');
const args=process.argv.slice(2),clean=[];
for(let i=0;i<args.length;i++){if(args[i]==='--append-system-prompt'){if(!args[i+1])throw Error('Missing system prompt path');i++;}else clean.push(args[i]);}
const child=spawn(path.join(__dirname,'../pi-rpc-acp/pi-rpc-acp'),clean,{stdio:'inherit',env:process.env});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',(code)=>{process.exitCode=code??1;});
