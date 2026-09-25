import {AuthContext} from '../../src/lib/authContext';
// Isolated in-memory repositories. No authentication, SQL or remote connections.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {StrengthFeature} from '../../src/features/strength/StrengthFeature';
import {CardioFeature} from '../../src/features/cardio/CardioFeature';
import '../../src/index.css';

const root=createRoot(document.getElementById('root')),checks=[],runtimeErrors=[];
window.addEventListener('error',event=>runtimeErrors.push(event.message));
window.addEventListener('unhandledrejection',event=>runtimeErrors.push(String(event.reason)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(pass,name)=>checks.push({name,pass:Boolean(pass)});
const equal=(a,b,name)=>assert(JSON.stringify(a)===JSON.stringify(b),name);
const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text||node.querySelector("strong")?.textContent===text);
const field=label=>[...document.querySelectorAll('label')].find(node=>node.textContent.trim().startsWith(label))?.querySelector('input,textarea');
const click=async text=>{const node=button(text);if(!node)throw Error('Missing button '+text+' in '+document.body.textContent);node.click();await wait(150);};
async function enter(node,value){if(!node)throw Error('Missing input');const prototype=node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));await wait(40);}
async function chooseExercise(name){await enter(field('Exercise'),name);const option=[...document.querySelectorAll('.picker-row')].find(node=>node.querySelector('strong')?.textContent===name);if(!option)throw Error('Missing exercise '+name);option.click();await wait(80);}
async function chooseActivity(name){await enter(field('Activity'),name);const option=[...document.querySelectorAll('[role=option]')].find(node=>node.querySelector('strong')?.textContent===name);if(!option)throw Error('Missing activity '+name);option.click();await wait(80);}
const render=async element=>{root.render(<AuthContext.Provider value={{session:null,loading:false,signOut:async()=>{}}}><div className="app-frame"><main className="content">{element}</main></div></AuthContext.Provider>);await wait(450);};
const definition=(id,name,tracking_type='repetitions',load_mode='weight_reps',progression_direction='higher_is_better')=>({id,name,tracking_type,load_mode,progression_direction,user_id:'u',major_muscle_group:'Shoulders',is_compound:false,archived:false,created_at:'2020-01-01',updated_at:'2020-01-01'});
const definitions=[definition('shoulder','Shoulder Press'),definition('military','Military Press'),definition('pull','Pull Up','repetitions','reps_only'),definition('chin','Chin Up','repetitions','reps_only'),definition('assist','Assisted Pull Up','repetitions','weight_reps','lower_is_better'),definition('assist-chin','Assisted Chin Up','repetitions','weight_reps','lower_is_better'),definition('sled','Sled Push','distance'),definition('yoke','Yoke Carry','distance')];
const originalWorkout=(exercise=definitions[0],count=3,id='existing')=>({id,performed_at:'2020-02-03T15:23:47.123Z',created_at:'2020-02-04T11:22:33Z',location:null,notes:'Workout note',duration_seconds:1234,sets:Array.from({length:count},(_,i)=>({id:`${id}-set-${i}`,exercise_id:exercise.id,set_order:i+1,tracking_type:exercise.tracking_type,weight_unit:'kg',weight:exercise.tracking_type==='distance'||exercise.load_mode==='reps_only'?null:40+i,reps:exercise.tracking_type==='distance'?null:8+i,load:exercise.tracking_type==='distance'?80+i:null,distance:exercise.tracking_type==='distance'?20+i:null,distance_unit:exercise.tracking_type==='distance'?'yards':null,laps:exercise.tracking_type==='distance'?2+i:null,duration_seconds:23+i,notes:`Set note ${i}`,exercise}))});
let workouts=[],cardio=[],fail=false,calls=[];
const activities=[{id:'run',name:'Running'},{id:'tread',name:'Treadmill'},{id:'stairs',name:'StairMaster'}];
const client={
  async rpc(name,payload){if(name!=='save_strength_workout')return {data:null,error:null};calls.push({kind:'rpc',payload:structuredClone(payload)});if(fail)return {error:new Error('Fixture save failed')};const w=workouts.find(w=>w.id===payload.p_workout.id);if(!w)throw Error('Attempted duplicate workout');Object.assign(w,payload.p_workout);w.sets=payload.p_sets.map(set=>({...w.sets.find(old=>old.id===set.id),...set,exercise:definitions.find(e=>e.id===set.exercise_id)}));return {data:w.id,error:null};},
  from(table){let ids=null,id=null,payload=null,kind=null,start=0,end=499;
    const result=()=>{let data=table==='exercises'?definitions:table==='cardio_activities'?activities:table==='locations'?[{id:'default',name:'Default Gym',is_default:true,archived:false}]:table==='strength_workouts'?workouts:table==='strength_sets'?workouts.flatMap(w=>w.sets.map(set=>({...set,workout:{id:w.id,performed_at:w.performed_at,created_at:w.created_at,location:w.location}}))):table==='cardio_sessions'?cardio:[];if(ids)data=data.filter(row=>ids.includes(row.id));if(id)data=data.filter(row=>row.id===id);return {data:data.slice(start,end+1),count:data.length,error:null};};
    const q={select(){return q},eq(key,value){if(key==='id')id=value;return q},in(_key,value){ids=value;return q},is(){return q},order(){return q},gte(){return q},lte(){return q},ilike(){return q},range(a,b){start=a;end=b;return q},update(row){payload=row;kind='update';return q},insert(row){payload=row;kind='insert';return q},async single(){if(payload){calls.push({kind,id,payload:structuredClone(payload)});if(fail)return {error:new Error('Fixture save failed')};const row=cardio.find(row=>row.id===id);if(!row)throw Error('Attempted duplicate Cardio');Object.assign(row,payload,{activity:activities.find(a=>a.id===payload.activity_id)});return {data:{id},error:null};}return {...result(),data:result().data[0]};},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};return q;
  }
};
let revision=0;
async function strength(exercise=definitions[0],count=3,total=1){workouts=Array.from({length:total},(_,i)=>originalWorkout(exercise,count,i?'older-'+i:'existing'));calls=[];fail=false;await render(<StrengthFeature key={++revision} client={client} userId="u" weightUnit="lb"/>);}
async function openRecent(){document.querySelector('.workout-card')?.click();await wait(100);if(!button('Edit workout')){const candidate=[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Shoulder Press')||node.textContent.includes('Sled Push')||node.textContent.includes('Assisted Pull Up'));if(!candidate)throw Error('Missing recent workout: '+document.body.textContent);candidate.click();await wait(100);}await click('Edit workout');}
const setValues=()=>[...document.querySelectorAll('.set-card')].map(row=>[...row.querySelectorAll('input')].map(input=>input.value));

void(async()=>{
  const resumed = sessionStorage.getItem('entry-edit-refresh');
  if (resumed) {
    sessionStorage.removeItem('entry-edit-refresh');
    const saved=JSON.parse(resumed); workouts=saved.workouts; cardio=saved.cardio; checks.push(...saved.checks);
    if (saved.phase==='strength') {
      await render(<StrengthFeature key={++revision} client={client} userId="u" weightUnit="lb"/>); await openRecent();
      assert(field('Exercise').value==='Shoulder Press' && document.querySelectorAll('.set-card').length===3, 'actual refresh during Strength edit reloads saved identity and all sets');
      assert(calls.length===0, 'Strength refresh never writes or inserts');
      await render(<CardioFeature key={++revision} client={client} userId="u"/>); await click('Edit'); await chooseActivity('Running');
      sessionStorage.setItem('entry-edit-refresh',JSON.stringify({workouts,cardio,checks,phase:'cardio'})); location.reload(); return;
    }
    await render(<CardioFeature key={++revision} client={client} userId="u"/>); await click('Edit');
    assert(field('Activity').placeholder==='StairMaster' && field('Steps').value==='12345', 'actual refresh during Cardio edit reloads saved activity and steps');
    assert(calls.length===0, 'Cardio refresh never writes or inserts');
    assert(runtimeErrors.length===0, 'no errors after page refresh');
    document.getElementById('result').textContent=JSON.stringify({checks:checks.length,failures:checks.filter(c=>!c.pass)}); return;
  }

  await strength();await openRecent();const originalValues=setValues(),rows=[...document.querySelectorAll('.set-card')],date=field('Date').value;
  await chooseExercise('Military Press');equal(setValues(),originalValues,'three sets retain every visible value');assert(rows.every((row,i)=>row===document.querySelectorAll('.set-card')[i]),'compatible change preserves DOM row identity');assert(field('Date').value===date&&field('Workout notes').value==='Workout note','date and notes retained');assert(!location.pathname.includes('/strength/new'),'edit does not navigate to new route');
  await chooseExercise('Shoulder Press');await chooseExercise('Military Press');equal(setValues(),originalValues,'rapid changes preserve all sets');
  fail=true;await click('Save changes');equal(setValues(),originalValues,'Strength failed save retains edited form');assert(field('Exercise').value==='Military Press','failed save retains selection');fail=false;await click('Save changes');assert(calls.every(call=>call.payload.p_workout.id==='existing'),'all saves update existing workout');assert(workouts.length===1&&workouts[0].sets.length===3,'no duplicate workout or collapsed sets');assert(workouts[0].performed_at==='2020-02-03T15:23:47.123Z'&&workouts[0].created_at==='2020-02-04T11:22:33Z','Strength timestamps preserved');assert(workouts[0].location_id===null,'No location survives despite configured default');
  await click('Edit workout');await chooseExercise('Pull Up');assert(!!document.querySelector('[role=alertdialog]'),'incompatible change opens styled dialog');equal(setValues(),originalValues,'no values cleared before confirmation');await click('Cancel');assert(field('Exercise').value==='Military Press','cancel restores original selected exercise');equal(setValues(),originalValues,'cancel preserves every set');
  await chooseExercise('Pull Up');await click('Change Exercise');assert(!field('Weight ('),'confirmed reps-only change removes weight inputs');assert(document.querySelectorAll('.set-card').length===3,'confirmed conversion keeps all sets');await chooseExercise('Chin Up');assert(!document.querySelector('[role=alertdialog]'),'reps-only to reps-only is uninterrupted');await click('Cancel');assert(calls.length===2,'form Cancel does not save');
  await strength(definitions[4],1);await openRecent();const assistance=setValues();await chooseExercise('Assisted Chin Up');equal(setValues(),assistance,'single assisted set retains assistance and reps');await chooseExercise('Military Press');assert(document.querySelector('[role=alertdialog]')?.textContent.includes('lifted weight'),'assistance meaning change explains interpretation');await click('Cancel');await click('Save changes');assert(workouts[0].sets[0].id==='existing-set-0','single set retains ID');
  await strength(definitions[6],3);await openRecent();const distanceValues=setValues();await chooseExercise('Yoke Carry');equal(setValues(),distanceValues,'distance change retains load distance unit laps duration notes');await click('Save changes');assert(workouts[0].sets.length===3&&workouts[0].sets.every(s=>s.distance_unit==='yards'),'all distance rows serialized');
  await strength(definitions[0],3,21);await click('Strength History');const next=button('Next');if(!next)throw Error('Missing pagination next: '+document.body.textContent);next.click();await wait(200);const historyEntry=[...document.querySelectorAll('button')].find(node=>node.textContent.includes('Shoulder Press'));historyEntry.click();await wait(100);await click('Edit workout');await chooseExercise('Military Press');await click('Save changes');assert(calls.at(-1).payload.p_workout.id==='older-20','older paginated workout updates its own ID');assert(workouts.filter(w=>w.sets[0].exercise_id==='military').length===1,'other workouts remain unchanged');
  // Component remount models a refreshed page: uncommitted edits are discarded, saved data rehydrates.
  await render(<StrengthFeature key={++revision} client={client} userId="u" weightUnit="lb"/>);await openRecent();await chooseExercise('Military Press');await render(<StrengthFeature key={++revision} client={client} userId="u" weightUnit="lb"/>);await openRecent();assert(field('Exercise').value==='Shoulder Press','refresh rehydrates persisted Strength selection without inserting');await click('Cancel');
  cardio=[{id:'cardio-existing',activity_id:'run',activity:{name:'Running'},performed_at:'2020-02-03T15:23:47.123Z',created_at:'2020-02-04T11:22:33Z',duration_seconds:3723,step_count:12345,distance:3.4,distance_unit:'miles',speed:5.6,laps:4,incline:2,difficulty:7,notes:'Cardio note',location_id:null,location:null}];calls=[];
  await render(<CardioFeature key={++revision} client={client} userId="u"/>);await click('Edit');await chooseActivity('Treadmill');await chooseActivity('StairMaster');assert(field('Speed').value==='5.6'&&field('Incline').value==='2'&&field('Distance').value==='3.4','uncommon populated metrics remain visible and editable');assert(field('Steps').value==='12345'&&field('Recorded laps').value==='4','activity change preserves steps and recorded laps');
  history.pushState(null,'','#same-screen-back');
  const popped=new Promise(resolve=>window.addEventListener('popstate',resolve,{once:true})); history.back(); await popped; await wait(80);
  assert(field('Steps').value==='12345' && calls.length===0, 'browser Back on same screen does not erase or save the edit');
  const cardioValues=[...document.querySelectorAll('.surface-card input,.surface-card textarea')].map(node=>node.value);fail=true;await click('Save Cardio Entry');equal([...document.querySelectorAll('.surface-card input,.surface-card textarea')].map(node=>node.value),cardioValues,'failed Cardio save retains complete form');fail=false;await click('Save Cardio Entry');assert(calls.every(call=>call.kind==='update'&&call.id==='cardio-existing'),'Cardio uses update with original ID');assert(cardio.length===1,'no duplicate Cardio');equal([cardio[0].step_count,cardio[0].distance,cardio[0].speed,cardio[0].incline,cardio[0].difficulty,cardio[0].laps],[12345,3.4,5.6,2,7,4],'hidden-by-default metrics all serialize');assert(cardio[0].performed_at==='2020-02-03T15:23:47.123Z'&&cardio[0].created_at==='2020-02-04T11:22:33Z','Cardio timestamps retained');
  await click('Done / View History');await click('Edit');await chooseActivity('Running');await click('Cancel');assert(cardio[0].activity_id==='stairs','Cardio Cancel leaves saved activity unchanged');await render(<CardioFeature key={++revision} client={client} userId="u"/>);await click('Edit');assert(field('Activity').placeholder==='StairMaster'&&field('Steps').value==='12345','Cardio refresh reloads persisted values');
  cardio.push(...Array.from({length:20},(_,i)=>({...structuredClone(cardio[0]),id:'cardio-older-'+i,activity_id:'run',activity:{name:'Running'}})));
  await render(<CardioFeature key={++revision} client={client} userId="u"/>); await click('Next'); await click('Edit');
  await chooseActivity('Treadmill'); await chooseActivity('Running'); await chooseActivity('StairMaster'); await click('Save Cardio Entry');
  assert(calls.at(-1).id==='cardio-older-19' && cardio.length===21, 'paginated Cardio edit updates only the existing older row without duplication');
  assert(cardio.filter(row=>row.activity_id==='stairs').length===2 && cardio.every(row=>row.step_count===12345), 'rapid activity changes leave other Cardio records and all steps unchanged');
  [...document.querySelectorAll('button')].find(node=>node.textContent.trim().endsWith('Edit Entry')).click(); await wait(80);
  await enter(field('Date'),'2020-02-05'); await click('Save Cardio Entry'); const revisedTime=cardio.at(-1).performed_at;
  await wait(1100); [...document.querySelectorAll('button')].find(node=>node.textContent.trim().endsWith('Edit Entry')).click(); await wait(80);
  await chooseActivity('Treadmill'); await click('Save Cardio Entry');
  assert(cardio.at(-1).performed_at===revisedTime, 'success-screen re-edit retains the just-saved performance time after an intentional date change');
  assert(!document.querySelector('select'),'no native select introduced');assert(runtimeErrors.length===0,'no uncaught browser errors: '+runtimeErrors.join('; '));assert(document.documentElement.scrollWidth<=innerWidth,'form fits viewport');
  await render(<StrengthFeature key={++revision} client={client} userId="u" weightUnit="lb"/>); await openRecent(); await chooseExercise('Military Press');
  sessionStorage.setItem('entry-edit-refresh',JSON.stringify({workouts,cardio,checks,phase:'strength'})); location.reload();
})().catch(error=>{document.getElementById('result').textContent=JSON.stringify({error:String(error),checks:checks.length,failures:checks.filter(c=>!c.pass),runtimeErrors});});
