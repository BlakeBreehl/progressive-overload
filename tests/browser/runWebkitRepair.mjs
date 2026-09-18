// Install Playwright/WebKit separately; no live account or external requests.
import {pathToFileURL} from 'node:url';
import {writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {webkit}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.FIXTURE_BASE??'http://127.0.0.1:5187';
const browser=await webkit.launch({headless:true});const results=[];const folder=await mkdtemp(join(tmpdir(),'po-webkit-'));
try{for(const [width,height] of (process.env.FOCUSED_SINGLE?[[390,844]]:[[320,568],[360,640],[375,667],[375,812],[390,844],[393,852],[412,915],[430,932],[667,375],[1280,900]])){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+new URL(response.url()).pathname);});await page.goto(base+'/__focused-release?mobile=1');try{await page.waitForFunction(()=>document.getElementById('result')?.textContent!=='RUNNING',{},{timeout:60000});}catch(error){console.log(JSON.stringify({width,height,errors,status:await page.locator('#result').textContent()}));throw error;}
 const result=await page.locator('#result').textContent();const value=JSON.parse(result);const engine=await page.evaluate(()=>({webkitTouch:CSS.supports('-webkit-touch-callout','none'),coarse:matchMedia('(pointer:coarse)').matches}));
 results.push({width,height,...engine,...value});console.log(JSON.stringify(results.at(-1)));if(value.error||value.failures?.length)process.exitCode=1;
 await page.evaluate(()=>{document.getElementById('result').hidden=true;});
 await page.setViewportSize({width:height,height:width});await page.waitForTimeout(250);const rotation=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);if(!rotation){process.exitCode=1;console.log('Orientation overflow',await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>document.documentElement.clientWidth&&!n.closest('.overflow-x-auto')).slice(0,10).map(n=>({tag:n.tagName,cls:n.className,right:n.getBoundingClientRect().right}))));}
 await context.close();
}await writeFile(join(folder,'results.json'),JSON.stringify(results,null,2));console.log('WebKit results: '+folder);}finally{await browser.close();}
