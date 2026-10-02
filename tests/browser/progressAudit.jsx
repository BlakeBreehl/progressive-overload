// Production Progress and navigation with account-scoped, in-memory fixtures only.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AuthContext} from '../../src/lib/authContext';
import {ProgressFeature} from '../../src/features/progress/ProgressFeature';
import {MobileNavigation} from '../../src/components/MobileNavigation';
import '../../src/index.css';
const checks=[],errors=[],diagnostics=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(pass,name)=>checks.push({pass:!!pass,name});
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const enabled={strength:true,cardio:true,flexibility:true,weight:true};
const dates=Array.from({length:26},(_,i)=>new Date(2026,7,1+i*2,12).toISOString());
const long='A very long exercise and location name '.repeat(6);
const strength=dates.flatMap((performed_at,i)=>['bench','assisted','reps','carry'].map((id,j)=>({id:`${id}-${i}`,exercise_id:id,set_order:1,tracking_type:id==='carry'?'distance':'repetitions',weight:id==='reps'?null:100+i,reps:i%3?6:1,load:id==='carry'?55:null,distance:id==='carry'?100:null,distance_unit:'feet',laps:id==='carry'?2:null,duration_seconds:null,weight_unit:'lb',exercise:{id,name:id==='bench'?long:id,tracking_type:id==='carry'?'distance':'repetitions',load_mode:id==='reps'?'reps_only':'weight_reps',progression_direction:id==='assisted'?'lower_is_better':'higher_is_better',major_muscle_group:['Chest','Back','Arms','Legs'][j]},workout:{id:'w'+i,performed_at,created_at:performed_at,location:{id:'gym',name:long}}})));
const cardio=dates.flatMap((performed_at,i)=>['steps','timed','run'].map(mode=>({id:mode+i,performed_at,created_at:performed_at,tracking_mode:mode==='steps'?'steps':'timed',step_count:mode==='steps'?10000+i:null,duration_seconds:mode==='steps'?null:1800,distance:mode==='steps'?null:3,distance_unit:mode==='steps'?null:'miles',speed:null,incline:null,difficulty:null,activity:{name:mode==='run'?'Running':'Steps'},location:{name:long},location_id:'gym'})));
const flex=dates.flatMap((performed_at,i)=>['time','reps'].map(tracking_type=>({id:tracking_type+i,performed_at,activity_id:tracking_type,activity:{name:tracking_type==='time'?long:'Repetition stretch',tracking_type,areas:[{body_area:long}]},sets:[{duration_seconds:tracking_type==='time'?60:null,reps:tracking_type==='reps'?10:null}]})));
const weights=dates.map((measured_at,i)=>({id:'weight'+i,measured_at,weight:180+i,weight_unit:'lb',period:i%2?'morning':'evening',notes:long}));
const rows={strength_sets:strength,cardio_sessions:cardio,mobility_sessions:flex,weigh_ins:weights};
const client={from(table){let first=0,last=499;const q={select(){return q},eq(){return q},order(){return q},gte(){return q},lte(){return q},ilike(){return q},range(a,b){first=a;last=b;return q},then(resolve,reject){const data=rows[table]??[];return Promise.resolve({data:data.slice(first,last+1),count:data.length,error:null}).then(resolve,reject)}};return q}};
const fit=name=>{
 const width=document.documentElement.clientWidth;
 assert(document.documentElement.scrollWidth<=width,name+' document');
 assert(document.body.scrollWidth<=document.body.clientWidth,name+' body');
 if(document.documentElement.scrollWidth>width||document.body.scrollWidth>document.body.clientWidth)diagnostics.push({name,widths:[document.documentElement.scrollWidth,width,document.body.scrollWidth,document.body.clientWidth],overflow:[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>width&&!n.closest('.overflow-x-auto')).slice(0,12).map(n=>({tag:n.tagName,cls:String(n.className),right:n.getBoundingClientRect().right,text:n.textContent.slice(0,60)}))});
 assert(document.querySelector('.app-frame').getBoundingClientRect().right<=width,name+' shell');
 for(const table of document.querySelectorAll('table')){
  const wrapper=table.closest('.overflow-x-auto');assert(!!wrapper,name+' table has scroll wrapper');
  if(wrapper){assert(wrapper.getBoundingClientRect().right<=width&&wrapper.getBoundingClientRect().left>=0,name+' table wrapper fits');if(table.scrollWidth>wrapper.clientWidth){wrapper.scrollLeft=80;assert(wrapper.scrollLeft>0,name+' table can scroll');wrapper.scrollLeft=0;}}
 }
 if(innerWidth<900){const nav=document.querySelector('.bottom-nav'),r=nav.getBoundingClientRect();assert(r.bottom<=innerHeight+1&&r.top>=0&&r.left>=0&&r.right<=width,name+' bottom nav visible');for(const button of nav.querySelectorAll('button')){const b=button.getBoundingClientRect();assert(b.width>30&&b.height>=44,name+' nav touch target');}}
};
const click=async text=>{const button=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===text);if(!button)throw Error('Missing '+text);button.click();await wait(180)};
async function choose(label,text){
 const control=[...document.querySelectorAll('.custom-select,.combobox-control')].find(n=>n.querySelector('.field-label')?.textContent===label);
 if(!control)throw Error('Missing control '+label);
 const details=control.closest('details');if(details)details.open=true;
 const trigger=control.querySelector('input,button');trigger.scrollIntoView({block:'center'});trigger.click();await wait(60);
 const option=[...document.querySelectorAll('[role=option]')].find(n=>n.querySelector('strong')?.textContent===text);
 if(!option)throw Error('Missing option '+label+': '+text);
 const box=option.closest('.select-menu,.combobox-menu').getBoundingClientRect();assert(box.left>=0&&box.right<=document.documentElement.clientWidth&&box.top>=0&&box.bottom<=innerHeight,label+' portal fits');fit(label+' open');option.click();await wait(180);
}
async function controls(name){
 for(const details of document.querySelectorAll('details.chart-controls'))details.open=true;
 await wait(60);fit(name+' controls expanded');
}
async function dateValue(label,value){const input=[...document.querySelectorAll('label')].find(n=>n.textContent===label)?.querySelector('input');if(!input)throw Error('Missing '+label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));await wait(90);}
async function tooltips(name){
 for(const svg of document.querySelectorAll('.recharts-surface')){
  const rect=svg.getBoundingClientRect();svg.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:rect.right-15,clientY:rect.top+80}));await wait(60);
  for(const tooltip of document.querySelectorAll('.recharts-tooltip-wrapper'))if(getComputedStyle(tooltip).visibility!=='hidden'){const r=tooltip.getBoundingClientRect();assert(r.left>=0&&r.right<=innerWidth,name+' tooltip fits');}
 }
 fit(name+' hover');
}
void(async()=>{
 createRoot(document.getElementById('root')).render(<AuthContext.Provider value={{session:{user:{id:'fixture'}},loading:false,signOut:async()=>{}}}><div className="app-frame"><main className="content"><ProgressFeature client={client} userId="fixture" enabled={enabled} weightUnit="lb"/></main><MobileNavigation enabled={enabled} screen="progress" go={screen=>assert(!!screen,'nav usable')} icon={()=> <svg aria-hidden="true"/>}/></div></AuthContext.Provider>);
 await wait(650);fit('Strength default');
 for(const mode of ['One Rep Max','Rep Weight','All Logged Sets']){await choose('Graph mode',mode);await controls(mode);await tooltips(mode);}
 for(const exercise of ['assisted','reps','carry']){await choose('Exercise',exercise);await controls(exercise);fit(exercise);}
 for(const aggregation of ['Weekly','Monthly']){await choose('Aggregation',aggregation);await tooltips(aggregation);}
 await choose('Time period','Custom Range');await controls('Strength custom dates');
 await click('Cardio');await wait(350);fit('Steps');assert(document.body.textContent.includes('Steps over Time')&&!document.body.textContent.includes('Weekly totals'),'Steps separated from timed totals');
 await controls('Steps');await tooltips('Steps');await choose('Time period','Custom Range');await controls('Steps dates');
 await dateValue('Start date','2027-01-01');assert(document.body.textContent.includes('No manual step counts in these filters.'),'Steps custom dates filter actual records');fit('Steps empty range');await dateValue('Start date','');assert(!document.body.textContent.includes('No manual step counts in these filters.'),'Steps date reset restores measured days');
 await choose('Activity','Steps (Timed)');assert(!document.body.textContent.includes('Steps over Time')&&document.body.textContent.includes('Weekly totals'),'legacy timed Steps retained separately');fit('Legacy Steps timed');
 await choose('Activity','Running');
 for(const metric of ['Duration','Distance','Average speed','Average pace']){await choose('Metric',metric);await controls('Cardio '+metric);await tooltips(metric);}
 await click('Flexibility');await wait(300);await controls('Flexibility');await tooltips('Flexibility');await choose('Stretch',long);fit('Flexibility selected');
 await click('Bodyweight');await wait(450);fit('Bodyweight');await controls('Bodyweight');for(const style of ['Straight','Smooth']){await choose('Line Style',style);await tooltips('Bodyweight '+style);}
 await click('Next');fit('Bodyweight pagination');
 if(innerWidth<900){document.querySelector('.bottom-nav button').click();assert(checks.some(c=>c.name==='nav usable'),'bottom nav click works');}
 assert(errors.length===0,'no runtime errors');
 document.getElementById('result').textContent=JSON.stringify({checks:checks.length,failures:checks.filter(c=>!c.pass),errors,diagnostics});
})().catch(error=>document.getElementById('result').textContent=JSON.stringify({error:String(error),checks:checks.length,failures:checks.filter(c=>!c.pass),errors,body:document.body.innerText,overflow:[...document.querySelectorAll('body *')].filter(n=>n.getBoundingClientRect().right>innerWidth&&!n.closest('.overflow-x-auto')).slice(0,15).map(n=>({tag:n.tagName,cls:String(n.className),right:n.getBoundingClientRect().right})),widths:[document.documentElement.scrollWidth,document.documentElement.clientWidth,document.body.scrollWidth,document.body.clientWidth]}));
