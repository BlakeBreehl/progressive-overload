import type { LoadMode, MuscleGroup, TrackingType } from './types'
import { normalizeExerciseName } from './logic'
export type StarterExercise={name:string;groups:MuscleGroup[];tags:string[];compound:boolean;tracking:TrackingType;loadMode?:LoadMode}
const rep=(names:string[],groups:MuscleGroup[],tags:string[]=[],compound=false):StarterExercise[]=>names.map(name=>({name,groups,tags,compound,tracking:'repetitions'}))
export const starterExercises:StarterExercise[]=[
  ...rep(['Bench Press','Chest Press','Machine Chest Press','Lying Chest Press','Cable Fly','Chest Fly','Dumbbell Bench Press','Dumbbell Chest Fly','Push Up','Dip','Weighted Dip'],['Chest'],['Mid Chest','Triceps'],true),
  ...rep(['Incline Bench Press','Incline Chest Press','Dumbbell Incline Bench'],['Chest'],['Upper Chest']),
  ...rep(['Decline Chest Press','Decline Bench Press'],['Chest'],['Lower Chest']),
  ...rep(['Shoulder Press','Machine Shoulder Press','Military Press','Dumbbell Shoulder Press'],['Shoulders'],['Front Delts'],true),
  ...rep(['Lateral Raise','Machine Lateral Raise','Seated Lateral Raise','Dumbbell Lateral Raise'],['Shoulders'],['Side Delts']),
  ...rep(['Rear Delt Fly','Single Rear Delt Fly'],['Shoulders'],['Rear Delts']),
  ...rep(['Dumbbell Front Raise'],['Shoulders'],['Front Delts']),
  ...rep(['Squat','Leg Press','Machine Leg Press','Hack Squat','Pendulum Squat','V Squat','Bulgarian Split Squat','Romanian Deadlift','Hip Lift','Dumbbell Lunge','Dumbbell Split Squat','Dumbbell Romanian Deadlift'],['Legs'],['Quads','Glutes'],true),
  ...rep(['Leg Extension','Single Leg Extension'],['Legs'],['Quads']),
  ...rep(['Hamstring Extension','Seated Leg Curl','Lying Leg Curl','Standing Leg Curl'],['Legs'],['Hamstrings']),
  ...rep(['Calf Raise','Machine Calf Raise','Seated Calf Raise','Incline Calf Raise','Calf Extension','Dumbbell Calf Raise'],['Legs'],['Calves']),
  ...rep(['Hip Thrust','Glute Press','Dumbbell Glute Press'],['Legs'],['Glutes']),
  ...rep(['Hip Abduction'],['Legs'],['Abductors']), ...rep(['Hip Adduction'],['Legs'],['Adductors']),
  {name:'Sled Push',groups:['Legs'],tags:['Quads','Glutes'],compound:true,tracking:'distance'},{name:'Yoke Carry',groups:['Legs'],tags:['Quads','Glutes'],compound:true,tracking:'distance'},
  ...rep(['Row','Machine Row','Low Row','Cable Row','Bent Over Row','Lying Row','Pendlay Row','Lever Row','Reverse Grip Row','Pull Over','Seated Pullover','Machine Pullover','Dumbbell Row','Pull Up','Weighted Pull Up','Chin Up','Weighted Chin Up'],['Back'],['Lats'],true),
  ...rep(['Lat Pull Down','Machine Lat Pulldown','Wide Pulldown','Front Pulldown'],['Back'],['Lats']),
  ...rep(['Shrug','Machine Shrug','Hex Shrug','Dumbbell Shrug'],['Back'],['Traps']),
  ...rep(['Back Extension','Machine Back Extension','Seated Back Extension'],['Back'],['Erectors','Lower Back']),
  ...rep(['Forearm Pull','Seated Forearm Pull','Wrist Curl','Seated Wrist Curl','Dumbbell Wrist Curl','Dumbbell Forearm Curl'],['Arms'],['Forearms']),
  ...rep(['Overhead Extension','Tricep Extension','Tricep Pushdown','Tricep Press','Machine Tricep Press','Skullcrusher','Dumbbell Extension','Dumbbell Skullcrusher'],['Arms'],['Triceps']),
  ...rep(['Cable Curl','Preacher Curl','Machine Preacher Curl','Bar Curl','Banded Bar Curl','Dumbbell Bicep Curl'],['Arms'],['Biceps']),
  ...rep(['Reverse Curl'],['Arms'],['Biceps','Forearms']),
  ...rep(['Torso Rotation','Russian Twist'],['Core'],['Obliques']),
  ...rep(['Weighted Crunch','Machine Crunch','Rope Crunch','Leg Lift','Sit Up','Decline Sit Up'],['Core'],['Abdominals']),
  ...rep(['Deadlift','Hex Lift'],['Back','Legs'],['Erectors','Hamstrings','Glutes'],true),
  ...rep(['Clean and Jerk','Snatch'],['Olympic Lifts'],['Erectors','Traps','Glutes'],true),
]

for (const exercise of starterExercises) if (['Pull Up','Chin Up','Dip','Push Up','Leg Lift'].includes(exercise.name)) exercise.loadMode='reps_only'

export function planStarterSeed(existingNames:string[],installationComplete:boolean){
  if(installationComplete)return []
  const existing=new Set(existingNames.map(normalizeExerciseName))
  return starterExercises.filter(exercise=>!existing.has(normalizeExerciseName(exercise.name)))
}
