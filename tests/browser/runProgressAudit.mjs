// Uses temporary Playwright installation; does not change project dependencies.
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
const {chromium,webkit}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const results=[];
const sizes=process.env.QA_SINGLE?[[320,568]]:[[320,568],[375,812],[390,844],[393,852],[430,932],[768,1024],[1280,900]];
for(const engine of process.env.QA_SINGLE?['chromium']:process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit']){
 const browser=await (engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true}));
 try{for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<900,hasTouch:width<900,timezoneId:'America/New_York'});
  await context.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5190/')?route.continue():route.abort());
  const page=await context.newPage();const runtime=[];page.on('pageerror',e=>runtime.push(e.message));
  for(const fixture of process.env.QA_SINGLE?['progress']:['progress','entries']){
   await page.goto('http://127.0.0.1:5190/__strength-steps'+(fixture==='progress'?'?progress=1':''));
   await page.waitForFunction(()=>document.getElementById('result')?.textContent!=='RUNNING',null,{timeout:60000});
   const result=JSON.parse(await page.locator('#result').textContent());
   results.push({engine,fixture,width,height,...result,runtime:[...runtime]});
   console.log(JSON.stringify(results.at(-1)));
   if(result.error||result.failures?.length||runtime.length)process.exitCode=1;
  }
  await context.close();
 }}finally{await browser.close();}
 if(!process.env.QA_SINGLE)await writeFile(`docs/progress-audit-${engine}-results.json`,JSON.stringify(results.filter(result=>result.engine===engine),null,2)+'\n');
}
await writeFile(process.env.QA_SINGLE?'.browser-progress-smoke.json':'docs/progress-audit-browser-results.json',JSON.stringify(results,null,2)+'\n');
