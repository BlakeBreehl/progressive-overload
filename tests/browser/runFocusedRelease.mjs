// Start serveFocusedRelease.mjs first. Uses only an isolated Chrome profile and local fixture.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const folder=await mkdtemp(join(tmpdir(),'po-release-'));
const browser=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--no-sandbox','--disable-gpu','--in-process-gpu','--no-first-run','--disable-background-networking',
 '--remote-debugging-port=0','--user-data-dir='+folder,'about:blank',
],{windowsHide:true,stdio:'ignore'});
let socket;
try{
 let port;
 for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(folder,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await wait(100);}}
 if(!port)throw Error('Chrome did not start');
 const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let sequence=0;const pending=new Map();
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const callback=pending.get(message.id);pending.delete(message.id);if(message.error)callback.reject(message.error);else callback.resolve(message.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 const results=[];
 for(const [width,height] of (process.env.FOCUSED_SINGLE?[[390,844]]:[[320,568],[360,640],[375,667],[375,812],[390,844],[393,852],[412,915],[430,932],[667,375]])){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:5187/__focused-release?width=${width}&height=${height}&snapshot=${process.env.FOCUSED_SNAPSHOT??''}`});
  let result;
  for(let i=0;i<500;i++){
   await wait(100);
   const value=await send('Runtime.evaluate',{expression:'document.getElementById("result")?.textContent',returnByValue:true});
   if(value.result?.value&&value.result.value!=='RUNNING'){result=JSON.parse(value.result.value);break;}
  }
  if(!result)throw Error(`Fixture timed out at ${width}x${height}`);
  if(process.env.FOCUSED_SNAPSHOT){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const path=join(folder,'screen.png');await writeFile(path,Buffer.from(shot.data,'base64'));console.log('Screenshot: '+path);}
  results.push({width,height,...result});console.log(JSON.stringify(results.at(-1)));
  if(result.error||result.failures?.length)process.exitCode=1;
 }
 await writeFile(join(folder,'results.json'),JSON.stringify(results,null,2));console.log('Browser results: '+join(folder,'results.json'));
}finally{socket?.close();browser.kill();}
