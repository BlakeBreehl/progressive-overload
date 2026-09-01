import type{Exercise}from'./types'
import{isRepsOnlyExercise}from'./logic'
export const exerciseLogSubtitle=(exercise:Exercise,unit:string)=>exercise.trackingType==='distance'?'Distance exercise':isRepsOnlyExercise(exercise)?exercise.lastReps===undefined?'No entries yet':`Rep PR: ${exercise.lastReps} · Last: ${exercise.lastReps} reps`:exercise.prWeight===undefined?'No entries yet':`PR: ${exercise.prWeight} ${unit} · Last: ${exercise.lastWeight} ${unit} × ${exercise.lastReps}`
