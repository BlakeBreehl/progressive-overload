// Aggregate-only local fixture; the server CSP blocks all nonlocal connections.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {GroupsFeature} from '../../src/features/groups/GroupsFeature';
import '../../src/index.css';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),checks=[];
const assert=(pass,name)=>checks.push({name,pass:Boolean(pass)});
const members=['Charlie','Beta','Alpha'].map(name=>({member_id:name,display_name:name,role:'member',is_self:name==='Alpha',sharing_progress:true}));
const summary={name:'Rank fixtures',through:'2026-09-23T12:00:00Z',members,
 sets:members.map(m=>({member_id:m.member_id,muscle:'Arms',total:10})),
 prs:members.map(m=>({member_id:m.member_id,weight_prs:2,rep_prs:3})),
 cardio:members.map(m=>({member_id:m.member_id,activity:'walking',entries:1,duration_seconds:60,distance_meters:m.member_id==='Charlie'?null:1000,distance_entries:m.member_id==='Charlie'?0:1})),activities:['walking']};
const client={from:()=>({select:()=>({order:async()=>({data:[{id:'group',name:summary.name}],error:null}),eq:()=>({single:async()=>({data:{display_name:'Alpha'},error:null})})})}),rpc:async name=>{if(name!=='private_group_summary')throw Error('Unexpected RPC '+name);return{data:summary,error:null};}};
const root=createRoot(document.getElementById('root'));
const fits=name=>{assert(document.documentElement.scrollWidth<=innerWidth,name+' has no page overflow');assert(!/\d+\s*=\.?/.test(document.body.textContent),name+' has no equal-sign ranks');};
void(async()=>{
 root.render(<div className="app-frame"><main className="content"><GroupsFeature client={client} userId="fixture"/></main></div>);await wait(500);
 for(const [i,name] of ['Alpha','Beta','Charlie'].entries())assert([...document.querySelectorAll('.surface-card span')].filter(n=>n.textContent===`${i+1}. ${name}`).length===4,'ordinal tie rank in sets and all three PR boards: '+name);
 fits('Every Strength leaderboard');
 [...document.querySelectorAll('[role=tab]')].find(n=>n.textContent==='Cardio').click();await wait(100);
 for(const [i,name] of ['Alpha','Beta','Charlie'].entries())assert([...document.querySelectorAll('.surface-card strong')].some(n=>n.textContent===`${i+1}. ${name}`),'Cardio duration ordinal tie rank: '+name);
 fits('Cardio duration');
 const field=[...document.querySelectorAll('.custom-select')].find(n=>n.querySelector('.field-label')?.textContent==='Rank by');field.querySelector('button').click();await wait(30);[...document.querySelectorAll('[role=option]')].find(n=>n.textContent.startsWith('Total distance')).click();await wait(100);
 for(const text of ['1. Alpha','2. Beta','Unranked Charlie'])assert([...document.querySelectorAll('.surface-card strong')].some(n=>n.textContent===text),'Cardio distance rank: '+text);
 fits('Cardio distance');assert(!document.body.textContent.includes('NaN')&&!document.body.textContent.includes('undefined'),'no invalid rendered values');
 document.getElementById('result').textContent=JSON.stringify({checks:checks.length,failures:checks.filter(c=>!c.pass)});
})().catch(error=>{document.getElementById('result').textContent=JSON.stringify({error:String(error),checks:checks.length,failures:checks.filter(c=>!c.pass)});});
