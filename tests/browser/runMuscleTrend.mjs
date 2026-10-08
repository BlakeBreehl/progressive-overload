// Isolated chart fixture runner with software screenshots at each viewport.
process.env.FOCUSED_SNAPSHOT??='muscle-trend';
process.env.REQUIRED_WIDTHS??='1';
// Start serveMuscleTrend.mjs first. Uses only an isolated Chrome profile and local fixture.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const folder=await mkdtemp(join(tmpdir(),'po-muscle-trend-'));
const browser=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--no-sandbox','--disable-gpu','--window-size=1400,2000','--run-all-compositor-stages-before-draw','--no-first-run','--disable-background-networking',
 '--disable-background-timer-throttling','--disable-renderer-backgrounding',
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
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const callback=pending.get(message.id);pending.delete(message.id);if(!callback)return;if(message.error)callback.reject(message.error);else callback.resolve(message.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser command timed out: '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
 await send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await send('Emulation.setTimezoneOverride',{timezoneId:process.env.QA_TIMEZONE??'America/New_York'});
 const results=[];
 const modes=process.env.BROWSER_MODE?[process.env.BROWSER_MODE]:process.env.MOBILE_MATRIX?['android-browser','android-standalone','ios-browser-emulated','ios-standalone-emulated']:['chromium'];
 for(const mode of modes){
 await send('Emulation.setTouchEmulationEnabled',{enabled:true});
 if(mode.startsWith('ios'))await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',platform:'iPhone'});
 else await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',platform:'Android'});
 await send('Emulation.setEmulatedMedia',{features:[{name:'display-mode',value:mode.includes('standalone')?'standalone':'browser'}]});
 for(const [width,height] of (process.env.FOCUSED_WIDTH?[[Number(process.env.FOCUSED_WIDTH),Number(process.env.FOCUSED_HEIGHT??844)]]:process.env.DESKTOP_ONLY?[[768,1024],[1280,900]]:process.env.FOCUSED_SINGLE?[[390,844]]:process.env.REQUIRED_WIDTHS?[[320,568],[375,812],[390,844],[430,932],[768,1024],[1280,900]]:[[320,568],[360,640],[375,667],[375,812],[390,844],[393,852],[412,915],[430,932],[667,375]])){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
  if(width>=900)await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',platform:'Windows'});
  const fixtureUrl=new URL(process.env.FIXTURE_URL??'http://127.0.0.1:5192/__muscle-trend');fixtureUrl.searchParams.set('width',String(width));fixtureUrl.searchParams.set('height',String(height));
  await send('Page.navigate',{url:fixtureUrl.href});
  let result;
  for(let i=0;i<Number(process.env.FIXTURE_POLLS??500);i++){
   await wait(100);
   const value=await send('Runtime.evaluate',{expression:'document.getElementById("result")?.textContent',returnByValue:true});
   if(value.result?.value&&value.result.value!=='RUNNING'){result=JSON.parse(value.result.value);break;}
  }
  if(!result){const diagnostic=await send("Runtime.evaluate",{expression:"document.body.innerText",returnByValue:true});throw Error(`Fixture timed out at ${width}x${height}: ${diagnostic.result?.value}`);}
  if(!result.announcementPreview){
   await send('Runtime.evaluate',{expression:"[...document.querySelectorAll('.muscle-legend-button')].find(button=>button.textContent==='Back').focus()"});
   const enter=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait(80);};
   await enter();const shown=await send('Runtime.evaluate',{expression:"[...document.querySelectorAll('.muscle-legend-button')].find(button=>button.textContent==='Back').getAttribute('aria-pressed')",returnByValue:true});await enter();
   const hidden=await send('Runtime.evaluate',{expression:"[...document.querySelectorAll('.muscle-legend-button')].find(button=>button.textContent==='Back').getAttribute('aria-pressed')",returnByValue:true});result.keyboardStates=[shown.result?.value,hidden.result?.value];result.keyboardLegend=shown.result?.value==='true'&&hidden.result?.value==='false';if(!result.keyboardLegend)result.failures.push('Keyboard legend toggle failed');
  }
  if(process.env.FOCUSED_SNAPSHOT){await send('Runtime.evaluate',{expression:"document.body.style.transform='translateZ(0)'"});await wait(300);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const path=join(folder,`screen-${width}.png`);await writeFile(path,Buffer.from(shot.data,'base64'));console.log('Screenshot: '+path);}
  results.push({mode,width,height,...result});console.log(JSON.stringify(results.at(-1)));
  if(result.error||result.failures?.length)process.exitCode=1;
 }
 }
 await writeFile(join(folder,'results.json'),JSON.stringify(results,null,2));console.log('Browser results: '+join(folder,'results.json'));
}finally{socket?.close();browser.kill();}
