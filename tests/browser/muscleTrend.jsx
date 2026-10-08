import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SetsByMuscleGroup} from '../../src/features/strength/SetsByMuscleGroup';
import {YourSets} from '../../src/features/strength/YourSets';
import {StrengthTrendsAnnouncement} from '../../src/components/StrengthTrendsAnnouncement';
import {strengthReleaseKey} from '../../src/lib/strengthTrendsRelease';
import '../../src/index.css';
const now=new Date(2026,9,8,15),rows=[];
for(let month=4;month<=9;month++)for(let i=0;i<40+month-4;i++){const id=`${month}-${i}`,date=`2026-${String(month+1).padStart(2,'0')}-01`;rows.push({id,exercise_id:'Chest',set_order:i+1,tracking_type:'repetitions',weight:100+month-4,reps:5,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{major_muscle_group:'Chest'},workout:{id:date,performed_at:date,created_at:date,location:null}});}
rows.push({...rows[0],id:'attempt',reps:0});rows.push({...rows[0],id:'future',workout:{id:'future',performed_at:'2026-11-01',created_at:'2026-11-01',location:null}});
const width=new URL(location.href).searchParams.get('width')??String(innerWidth),originalPath=location.pathname+location.search;
const initialAccount='fixture-A-'+width;let currentAccount=initialAccount;let rpcCalls=[];
const query={select:()=>query,eq:()=>query,order:()=>query,range:async()=>({data:rows,error:null})};
const client={from:()=>query,auth:{getSession:async()=>({data:{session:{user:{id:currentAccount},access_token:'token_'+currentAccount}},error:null})},rpc:(name,args)=>{let token;const request=Promise.resolve().then(()=>{const account=token.replace('Bearer token_','');rpcCalls.push({name,account,release:args.p_release_id});if(name==='get_release_acknowledgement')return {data:localStorage.getItem('po-fixture-server-'+account)==='synced',error:null};if(localStorage.getItem('po-fixture-save')!=='allow')return {data:null,error:{code:'42501'}};localStorage.setItem('po-fixture-server-'+account,'synced');return {data:null,error:null};});return Object.assign(request,{setHeader:(_name,value)=>{token=value;return request;}});}};
export function Fixture(){const [account,setAccount]=useState(initialAccount);useEffect(()=>{window.setFixtureAccount=next=>{currentAccount=next;setAccount(next);};return()=>{delete window.setFixtureAccount;};},[]);return <main style={{padding:16,maxWidth:1000,margin:'auto'}}><StrengthTrendsAnnouncement client={client} userId={account} ready/><SetsByMuscleGroup rows={rows} location="" now={now}/><YourSets client={client} userId={account}/></main>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),selectOption=async(section,label)=>{section.querySelector('button[aria-haspopup="listbox"]').click();await wait(60);const option=[...document.querySelectorAll('[role="option"]')].find(node=>node.textContent===label);if(!option)throw Error('Missing option '+label);option.click();await wait(120);};
(async()=>{
 await wait(700);const failures=[],stageKey='po-fixture-reloaded-'+width;
 if(!localStorage.getItem(stageKey)){
  const dialog=document.querySelector('[role="alertdialog"]');if(!dialog||!dialog.innerText.includes('Progressive Overload 2.3'))throw Error('New release did not display');
  if(new URL(location.href).searchParams.has('announcement')){const box=dialog.getBoundingClientRect();document.getElementById('result').textContent=JSON.stringify({failures:box.left<0||box.right>innerWidth?['Announcement overflow']:[],announcementPreview:true,width:box.width,height:box.height,buttonCount:dialog.querySelectorAll('button').length});return;}
  localStorage.setItem('po-fixture-save','fail');
  if(dialog.querySelectorAll('button').length!==1)throw Error('Release needs one continue button');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));if(!dialog.contains(document.activeElement))throw Error('Release focus escaped');
  dialog.querySelector('button').click();if(localStorage.getItem(strengthReleaseKey(initialAccount))!=='pending')throw Error('Local fallback was not immediate');
  await wait(100);if(document.querySelector('[role="alertdialog"]'))throw Error('Failed save reopened release');
  localStorage.setItem(stageKey,'yes');location.reload();return;
 }
 if(document.querySelector('[role="alertdialog"]'))failures.push('Release reopened after reload');
 localStorage.setItem('po-fixture-save','allow');window.dispatchEvent(new Event('online'));await wait(200);
 if(localStorage.getItem(strengthReleaseKey(initialAccount))!=='synced'||localStorage.getItem('po-fixture-server-'+initialAccount)!=='synced')failures.push('Pending dismissal did not reconcile');
 window.setFixtureAccount('fixture-B-'+width);await wait(200);if(!document.querySelector('[role="alertdialog"]'))failures.push('Second account did not see release');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(100);if(document.querySelector('[role="alertdialog"]'))failures.push('Escape did not dismiss');
 window.setFixtureAccount(initialAccount);await wait(100);if(document.querySelector('[role="alertdialog"]'))failures.push('Account return reopened release');
 for(const path of ['/auth/confirm','/auth/reset-password']){history.replaceState(null,'',path);window.setFixtureAccount('excluded-'+path+'-'+width);await wait(100);if(document.querySelector('[role="alertdialog"]')||rpcCalls.some(call=>call.account==='excluded-'+path+'-'+width))failures.push('Announcement appeared on auth route');}
 history.replaceState(null,'',originalPath);window.setFixtureAccount(initialAccount);await wait(150);
 const section=document.querySelector('.muscle-trend'),chart=section.querySelector('[data-timeframe]');
 const checkOverflow=()=>{if(document.documentElement.scrollWidth>innerWidth)failures.push('Horizontal overflow');};checkOverflow();
 if(chart.dataset.timeframe!=='six-months'||chart.dataset.periodCount!=='6')failures.push('Wrong default');
 let dots=[...chart.querySelectorAll('.set-trend-dot')];if(dots.length!==42||dots.filter(dot=>dot.dataset.value==='0').length!==36)failures.push('Missing zero-period markers');
 const rect=chart.getBoundingClientRect(),wrapper=chart.querySelector('.recharts-wrapper'),hover=async(dot)=>{wrapper.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:rect.left+Number(dot.getAttribute('cx')),clientY:rect.top+Number(dot.getAttribute('cy'))}));await wait(80);return chart.querySelector('.recharts-tooltip-wrapper')?.innerText??'';};const tooltip=await hover(dots[0]);if(!tooltip.includes('May 2026')||!tooltip.includes('Back: 0 sets'))failures.push('Visible zeros missing from tooltip');
 const monthlyKeys=[...new Set(dots.map(dot=>dot.dataset.period))];if(JSON.stringify(monthlyKeys)!==JSON.stringify(['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']))failures.push('Incorrect monthly keys');
 if([...chart.querySelectorAll('.recharts-line-curve')].some(path=>(path.getAttribute('d').match(/M/g)??[]).length!==1))failures.push('Line breaks across zero periods');
 for(const name of ['Back','Legs','Arms','Shoulders','Core']){[...section.querySelectorAll('.muscle-legend-button')].find(button=>button.textContent===name).click();await wait(40);}
 const olympic=[...section.querySelectorAll('.muscle-legend-button')].find(button=>button.textContent==='Olympic/Other'),beforeZoom=chart.dataset.domain;olympic.click();await wait(100);const afterZoom=chart.dataset.domain;if(Number(afterZoom.split(',')[0])<=0||beforeZoom===afterZoom)failures.push('Hidden zero series prevented zoom');
 const actualTicks=[...chart.querySelectorAll('svg text')].filter(node=>/^\d+$/.test(node.textContent)).map(node=>Number(node.textContent));if(actualTicks.length===0||actualTicks.some(tick=>tick<38))failures.push('Rendered y-axis did not zoom');const filteredTooltip=await hover(chart.querySelector('.set-trend-dot'));if(filteredTooltip.includes('Olympic/Other:')||filteredTooltip.includes('Back:'))failures.push('Hidden groups remain in tooltip');
 if(olympic.getAttribute('aria-pressed')!=='false'||getComputedStyle(olympic.querySelector('span')).backgroundColor!=='rgba(0, 0, 0, 0)'||getComputedStyle(olympic.querySelector('span')).borderColor!=='rgb(8, 145, 178)')failures.push('Hidden legend style is incorrect');
 const chest=[...section.querySelectorAll('.muscle-legend-button')].find(button=>button.textContent==='Chest');chest.click();await wait(50);if(chest.getAttribute('aria-pressed')!=='true'||!section.querySelector('[role="status"]').textContent.includes('at least one'))failures.push('Last visible group was hidden');
 const periods={};for(const [label,count] of [['All Time',6],['Past Year',12],['Past 6 Months',6],['Past 3 Months',3],['Past 6 Weeks',6]]){await selectOption(section,label);const keys=[...chart.querySelectorAll('.set-trend-dot')].map(dot=>dot.dataset.period);periods[label]=keys;if(keys.length!==count||new Set(keys).size!==count)failures.push('Wrong record count for '+label);if(label==='Past 6 Weeks'&&keys.some(key=>new Date(key+'T12:00:00').getDay()!==1))failures.push('Weekly keys are not Mondays');}
 const weeklyZero=[...chart.querySelectorAll('.set-trend-dot')].some(dot=>dot.dataset.value==='0');if(!weeklyZero||Number(chart.dataset.domain.split(',')[0])!==0)failures.push('Visible zero excluded from domain');
 await selectOption(section,'Past 6 Months');olympic.click();await wait(80);checkOverflow();
 const wheel=section.nextElementSibling;await selectOption(wheel,'All Time');const summaries=[...document.querySelectorAll('.compact-pr-summary')],a=summaries[0].getBoundingClientRect(),b=summaries[1].getBoundingClientRect();if(Math.abs(a.top-b.top)>1||a.height>65)failures.push('PR summaries lost compact layout');
 if(getComputedStyle(summaries[0]).backgroundColor!=='rgb(22, 128, 58)'||getComputedStyle(summaries[1]).backgroundColor!=='rgb(219, 234, 254)')failures.push('PR colors changed');
 document.getElementById('result').textContent=JSON.stringify({failures,sourceSets:rows.length,completedSets:255,defaultTimeframe:'Past 6 Months',monthlyKeys,monthlyRecords:6,defaultMarkers:42,zeroMarkers:36,beforeZoom,afterZoom,actualTicks,tooltip,filteredTooltip,periods,announcement:{firstShown:true,dismissedImmediately:true,afterReload:false,reconciled:true,separateAccounts:true,escape:true,authRoutesExcluded:true},summaryHeight:a.height});
})().catch(error=>{document.getElementById('result').textContent=JSON.stringify({error:String(error)});});

