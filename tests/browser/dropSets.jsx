/* oxlint-disable react/globals, react/only-export-components -- Standalone browser fixture observes controlled state for assertions. */
import React,{useState} from 'react';
import {AuthContext} from '../../src/lib/authContext';
import {createRoot} from 'react-dom/client';
import {StrengthFeature,WorkoutForm,DropSetHistory} from '../../src/features/strength/StrengthFeature';
import {StrengthProgress} from '../../src/features/progress/ProgressFeature';
import {workoutEditDraft} from '../../src/features/strength/exerciseChange';
import {saveWorkout} from '../../src/features/strength/repository';
import '../../src/index.css';
const exercise={id:'bench',userId:'fixture',name:'Bench Press',trackingType:'repetitions',loadMode:'weight_reps',progressionDirection:'higher_is_better',majorMuscleGroups:['Chest'],muscleTags:[],isCompound:true,archived:false,createdAt:'',updatedAt:'',usageCount:0,lastUsedAt:null};
const exercises=[exercise,{...exercise,id:'compatible',name:'Incline Bench Press'},{...exercise,id:'reps',name:'Push Up',loadMode:'reps_only'},{...exercise,id:'assisted',name:'Assisted Pull Up',progressionDirection:'lower_is_better'},{...exercise,id:'distance',name:'Farmer Carry',trackingType:'distance'}];
const initial={date:'2026-11-13',locationId:null,notes:'Shared notes',exercises:[{key:'block',exercise,sets:[{clientKey:'main',exerciseId:exercise.id,setOrder:1,trackingType:'repetitions',loadMode:'weight_reps',weight:225,reps:8}]}]};
let latest,saved,fail=true;
function Fixture(){const [draft,setDraft]=useState(structuredClone(initial)),[errors,setErrors]=useState([]);latest=draft;return <WorkoutForm draft={draft} setDraft={setDraft} exercises={exercises} locations={[]} unit="lb" saving={false} errors={errors} onCancel={()=>{}} onCreateExercise={()=>{}} onSave={async()=>{try{await saveWorkout({rpc:async(_name,payload)=>{saved=payload;return fail?{error:Error('Save failed; retry'),data:null}:{error:null,data:'fixture'}}},'fixture',draft);setErrors([])}catch{setErrors(['Save failed; retry'])}}}/>}
const root=createRoot(document.getElementById('root')),failures=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms)),check=(ok,label)=>{if(!ok)failures.push(label)};
const render=async element=>{root.render(<AuthContext.Provider value={{session:null,loading:false,signOut:async()=>{}}}><div className="app-frame"><main className="content">{element}</main></div></AuthContext.Provider>);await wait(300)};
const click=async(text,scope=document)=>{const b=[...scope.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/^[\u29c9\u2212]\s*/, '')===text);if(!b)throw Error('Missing button '+text);b.click();await wait(60)};
const setInput=(node,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}))};
const drops=()=>[...document.querySelectorAll('.drop-set-row')];
const typeDrop=async(index,weight,reps)=>{const inputs=drops()[index].querySelectorAll('input');setInput(inputs[0],weight);setInput(inputs[1],reps);await wait(60)};
const overflow=label=>check(document.documentElement.scrollWidth<=innerWidth,label+' no page overflow');
(async()=>{try{
 await render(<Fixture/>);check(!document.body.textContent.includes('Main Set'),'ordinary appearance');
 document.querySelector('[data-add-drop]').focus();window.__keyboardAction='Enter';
 for(let i=0;i<100&&window.__keyboardAction;i++)await wait(50);
 await wait(80);check(!window.__keyboardAction,'native keyboard activation');check(drops().length===1&&document.body.textContent.includes('Main Set'),'add one');check([...drops()[0].querySelectorAll('input')].every(n=>n.value===''),'blank fields');check(document.activeElement===drops()[0].querySelector('input'),'add focus');
 await typeDrop(0,'185','10');await click('Add Drop Set');await typeDrop(1,'135','12');check(drops().length===2,'add multiple');overflow('nested form');
 for(const b of document.querySelectorAll('.set-action')){const r=b.getBoundingClientRect();check(r.width>=44&&r.height>=44,'accessible action target');check(r.left>=0&&r.right<=innerWidth,'action fits viewport')}
 check(drops()[1].getAttribute('aria-label')==='Drop Set 2','ordered screen reader group');
 await click('Duplicate',drops()[0]);check(drops().length===3&&latest.exercises[0].sets[0].dropSets[1].weight===185,'duplicate drop');check(document.activeElement===drops()[1].querySelector('input'),'duplicate focus follows new row');
 const inputs=drops()[2].querySelectorAll('input');for(const value of ['1','13','130','135'])setInput(inputs[0],value);setInput(inputs[1],'14');
 await click('Remove',drops()[0]);check(drops().length===2,'remove renumbers');check(latest.exercises[0].sets[0].dropSets[1].weight===135&&latest.exercises[0].sets[0].dropSets[1].reps===14,'rapid edits stay in surviving row');
 check(drops()[1].textContent.includes('Drop Set 2'),'sequential renumber');await click('Save workout');check(document.body.textContent.includes('Save failed; retry')&&drops().length===2,'failed save retains nested form');check(saved.p_sets[0].drop_sets.length===2,'atomic nested payload');
 fail=false;await click('Save workout');check(!document.body.textContent.includes('Save failed; retry'),'retry success');
 const main=document.querySelector('.set-card');await click('Duplicate',main);check(latest.exercises[0].sets.length===2&&latest.exercises[0].sets[1].dropSets.length===2,'duplicate complete main group');
 const identities=latest.exercises[0].sets.flatMap(s=>[s.clientKey,...s.dropSets.map(d=>d.clientKey)]);check(new Set(identities).size===identities.length,'fresh stable IDs');
 await click('Remove',document.querySelectorAll('.set-card')[1]);
 await click('Remove',drops()[0]);await click('Remove',drops()[0]);check(!document.body.textContent.includes('Main Set')&&drops().length===0,'final removal restores ordinary appearance');check(document.activeElement?.textContent==='Add Drop Set','remove focus predictable');
 // Reopen an existing nested workout through the production edit adapter.
 const original={id:'w',performedAt:'2026-11-13T12:00:00Z',location:null,notes:'shared',durationSeconds:null,sets:[{...initial.exercises[0].sets[0],id:'stored-main',exercise,dropSets:[{id:'stored-drop',clientKey:'stored-drop',exerciseId:'bench',setOrder:1,trackingType:'repetitions',weight:185,reps:0}]}]};
 function EditFixture(){const [draft,setDraft]=useState(workoutEditDraft(original));latest=draft;return <WorkoutForm draft={draft} setDraft={setDraft} exercises={exercises} locations={[]} unit="lb" saving={false} errors={[]} onSave={()=>{}} onCancel={()=>{}} onCreateExercise={()=>{}}/>}
 await render(<EditFixture/>);check(drops()[0].querySelectorAll('input')[1].value==='0','edit restores zero attempt');
 const pick=async name=>{const input=document.querySelector('input[placeholder^="Search exercises"]');setInput(input,name);await wait(80);document.querySelector('[role=option]').click();await wait(80)};
 await pick('Incline');check(latest.exercises[0].sets[0].dropSets[0].weight===185,'compatible exercise preserves drops');
 await pick('Push Up');await click('Change Exercise');check(drops()[0].querySelectorAll('input').length===1,'reps only drops');check(latest.exercises[0].sets[0].dropSets[0].reps===0,'reps preserved');
 await pick('Assisted');check(document.body.textContent.includes('Assistance'),'assisted inputs');await pick('Farmer');check(document.querySelector('[role=alertdialog]')?.textContent.includes('nested drop sets'),'incompatible dialog names removed drops');await click('Change Exercise');check(drops().length===0&&!document.body.textContent.includes('Add Drop Set'),'distance excludes drops');overflow('distance form');
 await render(<DropSetHistory set={original.sets[0]} unit="lb" prs={new Map()}/>);check(document.body.textContent.includes('Drop Set 1')&&document.body.textContent.includes('Attempt'),'nested attempt history');overflow('history');
 const row={id:'m',exercise_id:'bench',set_order:1,tracking_type:'repetitions',weight:225,reps:8,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,exercise:{...exercise,major_muscle_group:'Chest'},workout:{id:'w',performed_at:'2026-11-13T12:00:00Z',created_at:'2026-11-13T12:00:00Z',location:null},drop_sets:[{id:'d',drop_order:1,weight:185,reps:10}]};
 await render(<StrengthProgress rows={[row]} unit="lb"/>);overflow('progress');
 check(!document.querySelector('select'),'no native select');

 // Exercise the production feature's create/failure/success/Edit Entry/history lifecycle.
 const definition={id:'bench',user_id:'fixture',name:'Bench Press',tracking_type:'repetitions',load_mode:'weight_reps',progression_direction:'higher_is_better',major_muscle_group:'Chest',is_compound:true,archived:false,created_at:'2026-01-01',updated_at:'2026-01-01'};
 const baseline={id:'baseline',performed_at:'2026-01-01T12:00:00Z',created_at:'2026-01-01T12:00:00Z',notes:null,duration_seconds:null,location:null,sets:[{id:'baseline-main',exercise_id:'bench',set_order:1,tracking_type:'repetitions',weight:50,weight_unit:'lb',reps:5,load:null,distance:null,distance_unit:null,laps:null,duration_seconds:null,notes:null,exercise:definition,drop_sets:[]}]};
 let persisted=null,featureFailure=true,serial=0;
 const featureClient={from(table){let start=0,end=499,single=false;const result=()=>{const workouts=[...(persisted?[persisted]:[]),baseline];let data=table==='exercises'?[definition]:table==='strength_workouts'?workouts:table==='strength_sets'?workouts.flatMap(w=>w.sets.map(set=>({...set,workout:{id:w.id,performed_at:w.performed_at,created_at:w.created_at,location:null}}))):[];data=data.slice(start,end+1);return {data:single?data[0]:data,count:workouts.length,error:null}};const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,gte:()=>q,lte:()=>q,ilike:()=>q,is:()=>q,range:(a,b)=>{start=a;end=b;return q},single:()=>{single=true;return q},then:(a,b)=>wait(10).then(result).then(a,b)};return q},rpc:async(name,payload)=>{if(name!=='save_strength_workout')throw Error('Unexpected RPC');if(featureFailure)return {data:null,error:Error('Fixture failed save')};const id=payload.p_workout.id??'feature-workout';persisted={...payload.p_workout,id,created_at:'2026-11-13T12:00:00Z',location:null,sets:payload.p_sets.map(set=>({...set,id:set.id??'main-'+(++serial),exercise:definition,drop_sets:(set.drop_sets??[]).map(drop=>({...drop,id:drop.id??'drop-'+(++serial)}))}))};return {data:id,error:null}}};
 await render(<StrengthFeature client={featureClient} userId="fixture" weightUnit="lb" create/>);
 const featureInput=document.querySelector('input[placeholder^="Search exercises"]');setInput(featureInput,'Bench');await wait(80);document.querySelector('[role=option]').click();await wait(80);
 const mainInputs=document.querySelector('.set-card').querySelectorAll('input');setInput(mainInputs[0],'100');setInput(mainInputs[1],'8');await click('Add Drop Set');await typeDrop(0,'50','10');
 await click('Save workout');check(document.body.textContent.includes('Fixture failed save')&&drops()[0].querySelectorAll('input')[1].value==='10','production failed save retains children');
 featureFailure=false;await click('Save workout');await wait(250);check(document.body.textContent.includes('Lift Logged')&&document.body.textContent.includes('Drop Set 1'),'production success displays complete group');
 const originalIds=persisted.sets.flatMap(set=>[set.id,...set.drop_sets.map(d=>d.id)]);
 await click('Edit Entry');check(drops()[0].querySelectorAll('input')[0].value==='50'&&drops()[0].querySelectorAll('input')[1].value==='10','success Edit Entry restores actual saved drops');
 await typeDrop(0,'50','12');await click('Save changes');await wait(200);check(JSON.stringify(persisted.sets.flatMap(set=>[set.id,...set.drop_sets.map(d=>d.id)]))===JSON.stringify(originalIds),'production edit preserves main and child IDs');
 await click('View Strength History');await wait(200);check(document.body.textContent.includes('Drop Set 1')&&document.body.textContent.includes('12'),'production history restores nested performances');overflow('production history');
 const editHistory=document.querySelector('[aria-label="Edit Bench Press entry"]');editHistory.click();await wait(100);await click('Edit workout');check(drops()[0].querySelectorAll('input')[1].value==='12','history edit restores nested values');
 await click('Save changes');await wait(150);await click('Done / Return to Strength');await wait(150);check(document.body.textContent.includes('2 recent PR marks'),'recent PR summary includes qualifying drop PR');
 await render(<EditFixture/>);overflow('restored nested editor');
 document.getElementById('result').textContent=JSON.stringify({failures,checks:'nested create/edit/duplicate/remove/failure/typing/focus/history/progress',width:innerWidth});
}catch(error){document.getElementById('result').textContent=JSON.stringify({error:String(error),stack:error.stack,failures})}})();
