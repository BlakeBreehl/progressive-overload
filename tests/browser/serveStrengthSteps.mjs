import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5190,strictPort:true,hmr:false},plugins:[{
 name:'isolated-strength-steps',enforce:'pre',
 load(id){if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase=null;export const isSupabaseConfigured=false;export const initialRecovery=false;';},
 configureServer(server){server.middlewares.use('/__strength-steps',async(request,response)=>{
  const fixture=request.url.includes('progress=1')?'progressAudit':'strengthSteps';
  response.setHeader('Content-Type','text/html');
  response.end(await server.transformIndexHtml('/__strength-steps',`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="connect-src 'self' ws://127.0.0.1:5190"></head><body><pre id="result" hidden>RUNNING</pre><div id="root"></div><script type="module" src="/tests/browser/${fixture}.jsx"></script></body></html>`));
 });}
}]});
await server.listen();console.log('Isolated fixture http://127.0.0.1:5190/__strength-steps');
