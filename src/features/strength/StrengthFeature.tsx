import { changeExercise, exerciseChangeWarning, workoutEditDraft } from './exerciseChange';
import { displayWeight, type WeightUnit } from "../../lib/weightUnits";
import { YourSets } from "./YourSets";
import { LocationSelect } from "../../components/LocationSelect";
import { loadStrengthProgressRows, strengthPrEvidence } from "../progress/repository";
/* oxlint-disable react/set-state-in-effect -- loading state follows remote requests */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  detectRepetitionPrs,
  filterExercises,
  groupDailyStrength,
  isDuplicateExerciseName,
  isRepsOnlyExercise,
  localDateKey,
  rankExercises,
  validateWorkout,
} from "./logic";
import {
  deleteUnusedExercise,
  deleteWorkout,
  getExercises,
  getStrengthHistoryPage,
  getLocations,
  getWorkouts,
  getWorkoutById,
  saveExercise,
  saveWorkout,
  strengthLoadMessage,
  type ExerciseInput,
} from "./repository";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Combobox, Select } from "../../components/SelectionControls";
import { Pagination } from "../../components/Pagination";
import { validHistoryPage } from "../../lib/pagedHistory";
import {
  muscleGroups,
  muscleTags,
  type DistanceUnit,
  type Exercise,
  type Location,
  type StrengthSet,
  type Workout,
  type WorkoutDraft,
  type WorkoutExercise,
} from "./types";
import { QuickLiftForm } from "./QuickLiftForm";
import { WorkoutCard } from "./WorkoutCard";
import {
  newQuickLift,
  quickLiftToWorkout,
  validateQuickLift,
  type QuickLiftDraft,
  type QuickLiftErrors,
} from "./quickLog";

type View =
  | "hub"
  | "quick"
  | "quick-success"
  | "form"
  | "history"
  | "exercises"
  | "detail";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () => crypto.randomUUID();
const emptySet = (exercise: Exercise): StrengthSet =>
  exercise.trackingType === "repetitions"
    ? {
        exerciseId: exercise.id,
        clientKey:uid(),
        setOrder: 1,
        trackingType: "repetitions",
        loadMode: exercise.loadMode,
        progressionDirection: exercise.progressionDirection,
        weight: isRepsOnlyExercise(exercise) ? undefined : 0,
        reps: 0,
      }
    : {
        exerciseId: exercise.id,
        clientKey:uid(),
        setOrder: 1,
        trackingType: "distance",
        load: 0,
        distance: 0,
        distanceUnit: "meters",
        laps: 1,
      };
const formatDuration = (seconds?: number | null) =>
  seconds == null
    ? ""
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${seconds % 60 || ""}`.trim()
      : `${seconds}s`;

function Status({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (loading)
    return (
      <div className="surface-card text-sm text-slate-400">
        Loading strength data…
      </div>
    );
  if (error)
    return (
      <div className="surface-card">
        <p className="text-sm text-rose-300">{error}</p>
        <button className="secondary-button mt-3" onClick={retry}>
          Try again
        </button>
      </div>
    );
  return null;
}
function PrBadges({ kinds }: { kinds: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {kinds.includes("first") && (
        <span className="pr-first">First Entry</span>
      )}
      {kinds.includes("weight") && <span className="pr-weight">Weight PR</span>}
      {kinds.includes("reps") && <span className="pr-reps">Rep PR</span>}
    </span>
  );
}
function SetText({ set, unit }: { set: StrengthSet; unit: string }) {
  return set.trackingType === "repetitions" ? (
    <>
      {set.weight === undefined ? `${set.reps} reps` : `${displayWeight(set.weight,set.weightUnit??"lb",unit as WeightUnit)} ${unit}${set.progressionDirection === "lower_is_better" ? " assistance" : ""} × ${set.reps}`}
    </>
  ) : (
    <>
      {displayWeight(set.load??0,set.weightUnit??"lb",unit as WeightUnit)} {unit} load · {set.distance} {set.distanceUnit} × {set.laps}{" "}
      lap{set.laps === 1 ? "" : "s"}
      {set.durationSeconds != null
        ? ` · ${formatDuration(set.durationSeconds)}`
        : ""}
    </>
  );
}

function ExercisePicker({
  exercises,
  value,
  onPick,
  onCreate,
}: {
  exercises: Exercise[];
  value: Exercise | null;
  onPick: (e: Exercise) => void;
  onCreate: (name: string) => void;
}) {
  const [q, setQ] = useState<string | null>(null);
  const [pending, setPending] = useState<Exercise | null>(null);
  const query = q ?? value?.name ?? "";
  const ref = useRef<HTMLInputElement>(null);
  const matches = rankExercises(filterExercises(exercises, { query })).slice(
    0,
    8,
  );
  return (
    <div className="relative">
      <label className="field-label">
        Exercise
        <input
          ref={ref}
          className="field-input"
          value={query}
          placeholder="Search exercises…"
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => value && setQ("")}
        />
      </label>
      {query.trim() && query !== value?.name && (
        <div className="picker-menu">
          {matches.map((e) => (
            <button
              key={e.id}
              className="picker-row"
              onClick={() => {
                if (exerciseChangeWarning(value, e)) setPending(e);
                else { onPick(e); setQ(null); }
              }}
            >
              <span className="min-w-0">
                <strong className="block truncate text-ink">{e.name}</strong>
                <small>
                  {e.majorMuscleGroups.join(", ")} ·{" "}
                  {e.trackingType === "repetitions"
                    ? "Repetitions"
                    : "Distance"}
                </small>
              </span>
              {e.isCompound && <span className="tag">Compound</span>}
            </button>
          ))}
          {!matches.length && (
            <p className="p-3 text-sm text-slate-500">
              No active exercises match “{query.trim()}”.
            </p>
          )}
          <button className="picker-create" onClick={() => onCreate(query.trim())}>
            + Create new exercise{query.trim() ? ` “${query.trim()}”` : ""}
          </button>
        </div>
      )}
      <ConfirmDialog open={!!pending} title="Change exercise?" description={pending ? exerciseChangeWarning(value, pending) : ""} confirmLabel="Change Exercise" onCancel={() => { setPending(null); setQ(null); }} onConfirm={() => { if (pending) onPick(pending); setPending(null); setQ(null); }} />
    </div>
  );
}

function SetRow({
  set,
  index,
  unit,
  onChange,
  onRemove,
  onDuplicate,
}: {
  set: StrengthSet;
  index: number;
  unit: string;
  onChange: (update:(set:StrengthSet)=>StrengthSet) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const number = (key: keyof StrengthSet, value: string) =>
    onChange(current=>({ ...current, [key]: value === "" ? undefined : Number(value) }));
  return (
    <div className="set-card">
      <div className="flex items-center justify-between">
        <strong className="text-xs text-slate-400">SET {index + 1}</strong>
        <div className="flex gap-2">
          <button className="text-button" onClick={onDuplicate}>
            Duplicate
          </button>
          <button className="text-button text-rose-300" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {set.trackingType === "repetitions" ? (
          <>
            {set.loadMode !== "reps_only" && <label className="field-label">
              {set.progressionDirection === "lower_is_better" ? "Assistance" : "Weight"} ({unit})
              <input
                className="field-input"
                inputMode="decimal"
                type="number"
                min="0"
                step="any"
                value={set.weight ?? ""}
                onChange={(e) => number("weight", e.target.value)}
              />
            </label>}
            <label className="field-label">
              Reps
              <input
                className="field-input"
                inputMode="numeric"
                type="number"
                min="0"
                step="1"
                value={set.reps ?? ""}
                onChange={(e) => number("reps", e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className="field-label">
              Load ({unit})
              <input
                className="field-input"
                inputMode="decimal"
                type="number"
                min="0"
                step="any"
                value={set.load ?? ""}
                onChange={(e) => number("load", e.target.value)}
              />
            </label>
            <label className="field-label">
              Distance / lap
              <input
                className="field-input"
                inputMode="decimal"
                type="number"
                min="0"
                step="any"
                value={set.distance ?? ""}
                onChange={(e) => number("distance", e.target.value)}
              />
            </label>
            <Select
              label="Unit"
              value={set.distanceUnit ?? "meters"}
              options={["meters", "kilometers", "miles", "yards", "feet"].map(
                (unit) => ({ value: unit, label: unit }),
              )}
              onChange={(distanceUnit) =>
                onChange(current=>({ ...current, distanceUnit: distanceUnit as DistanceUnit }))
              }
            />
            <label className="field-label">
              Laps
              <input
                className="field-input"
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={set.laps ?? ""}
                onChange={(e) => number("laps", e.target.value)}
              />
            </label>
            <label className="field-label col-span-2">
              Duration (seconds, optional)
              <input
                className="field-input"
                inputMode="numeric"
                type="number"
                min="0"
                value={set.durationSeconds ?? ""}
                onChange={(e) => number("durationSeconds", e.target.value)}
              />
            </label>
          </>
        )}
        {set.trackingType === "repetitions" && <>
          {set.load !== undefined && <label className="field-label">Recorded load ({unit})<input className="field-input" type="number" min="0" step="any" value={set.load} onChange={event => number("load", event.target.value)} /></label>}
          {set.durationSeconds !== undefined && <label className="field-label">Duration (seconds, optional)<input className="field-input" type="number" min="0" step="any" value={set.durationSeconds} onChange={event => number("durationSeconds", event.target.value)} /></label>}
        </>}
        <label className="field-label col-span-2">
          Set notes (optional)
          <input
            className="field-input"
            value={set.notes ?? ""}
            onChange={(e) => {const notes=e.target.value;onChange(current=>({ ...current, notes }))}}
          />
        </label>
      </div>
    </div>
  );
}

function WorkoutForm({
  draft,
  setDraft,
  exercises,
  locations,
  unit,
  saving,
  errors,
  onSave,
  onCancel,
  onCreateExercise,
}: {
  draft: WorkoutDraft;
  setDraft: Dispatch<SetStateAction<WorkoutDraft>>;
  exercises: Exercise[];
  locations: Location[];
  unit: string;
  saving: boolean;
  errors: string[];
  onSave: () => void;
  onCancel: () => void;
  onCreateExercise: (name: string) => void;
}) {
  const addBlock = () =>
    setDraft(current=>({...current,exercises:[...current.exercises,{key:uid(),exercise:null,sets:[]}]}));
  const updateBlock = (key:string,update:(block:WorkoutExercise)=>WorkoutExercise)=>setDraft(current=>({...current,exercises:current.exercises.map(block=>block.key===key?update(block):block)}));
  return (
    <section>
      <p className="eyebrow">STRENGTH</p>
      <h1 className="page-title">
        {draft.id ? "Edit workout" : "Add Strength Workout"}
      </h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Date
          <input
            className="field-input"
            type="date"
            value={draft.date}
            onChange={(e) => {const date=e.target.value;setDraft(current=>({ ...current, date }))}}
          />
        </label>
        <LocationSelect
          label="Location"
          value={draft.locationId ?? ""}
          options={[
            { value: "", label: "No location" },
            ...locations
              .filter((location) => !location.archived)
              .map((location) => ({
                value: location.id,
                label: `${location.name}${location.isDefault ? " (default)" : ""}`,
              })),
          ]}
          onChange={(locationId) =>
            setDraft(current=>({ ...current, locationId: locationId || null }))
          }
        />
      </div>
      <label className="field-label mt-4">
        Workout notes (optional)
        <textarea
          className="field-input min-h-20 py-3"
          value={draft.notes}
          onChange={(e) => {const notes=e.target.value;setDraft(current=>({ ...current, notes }))}}
        />
      </label>
      <label className="field-label mt-4 max-w-xs">
        Workout duration (minutes, optional)
        <input
          className="field-input"
          inputMode="numeric"
          type="number"
          min="0"
          step="1"
          value={
            draft.durationSeconds === undefined
              ? ""
              : draft.durationSeconds / 60
          }
          onChange={(e) =>
            setDraft(current=>({
              ...current,
              durationSeconds:
                e.target.value === "" ? undefined : Number(e.target.value) * 60,
            }))
          }
        />
      </label>
      <div className="mt-6 space-y-4">
        {draft.exercises.map((block) => (
          <div className="surface-card" key={block.key}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <ExercisePicker
                  exercises={exercises.filter((e) => !e.archived)}
                  value={block.exercise}
                  onCreate={onCreateExercise}
                  onPick={(exercise) =>
                    updateBlock(block.key, current => current.exercise ? changeExercise(current, exercise) : { ...current, exercise, sets: [emptySet(exercise)] })
                  }
                />
              </div>
              <button
                aria-label="Remove exercise"
                className="icon-button mt-5 text-rose-300"
                onClick={() =>
                  setDraft(current=>({...current,exercises:current.exercises.filter(item=>item.key!==block.key)}))
                }
              >
                ×
              </button>
            </div>
            {block.exercise && (
              <div className="mt-4 space-y-3">
                {block.sets.map((set, si) => (
                  <SetRow
                    key={set.id ?? set.clientKey ?? si}
                    set={set}
                    index={si}
                    unit={set.weightUnit??(draft.id?"lb":unit)}
                    onChange={(update) =>
                      updateBlock(block.key, block=>({
                        ...block,
                        sets: block.sets.map(s => ((s.id ?? s.clientKey) === (set.id ?? set.clientKey) ? update(s) : s)),
                      }))
                    }
                    onRemove={() =>
                      updateBlock(block.key, block=>({
                        ...block,
                        sets: block.sets.filter(s => (s.id ?? s.clientKey) !== (set.id ?? set.clientKey)),
                      }))
                    }
                    onDuplicate={() =>
                      updateBlock(block.key, current => ({ ...current, sets: current.sets.flatMap(row =>
                        (row.id ?? row.clientKey) === (set.id ?? set.clientKey)
                          ? [row, { ...row, id: undefined, clientKey: uid() }] : [row]) }))
                    }
                  />
                ))}
                <button
                  className="secondary-button w-full"
                  onClick={() =>
                    updateBlock(block.key, block=>({
                      ...block,
                      sets: [
                        ...block.sets,
                        {
                          ...emptySet(block.exercise!),
                          setOrder: block.sets.length + 1,
                        },
                      ],
                    }))
                  }
                >
                  + Add Set
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="secondary-button mt-4 w-full" onClick={addBlock}>
        + Add Another Exercise
      </button>
      {errors.length > 0 && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-4"
        >
          <strong className="text-sm text-rose-200">
            Fix these before saving:
          </strong>
          <ul className="mt-2 list-disc pl-5 text-xs leading-relaxed text-rose-200/80">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}{" "}
      {!navigator.onLine && (
        <p className="mt-4 rounded-xl bg-amber-300/10 p-3 text-xs text-amber-200">
          You’re offline. Your form remains here, but saving requires a
          connection.
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button className="secondary-button flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button
          disabled={saving || !navigator.onLine}
          className="primary-button flex-[2]"
          onClick={onSave}
        >
          {saving ? "Saving…" : draft.id ? "Save changes" : "Save workout"}
        </button>
      </div>
    </section>
  );
}

function ExerciseLibrary({
  client,
  exercises,
  userId,
  reload,
  onCreate,
}: {
  client: SupabaseClient;
  exercises: Exercise[];
  userId: string;
  reload: () => void;
  onCreate: (name?: string) => void;
}) {
  const [q, setQ] = useState(""),
    [group, setGroup] = useState(""),
    [muscle, setMuscle] = useState(""),
    [compound, setCompound] = useState(false),
    [editing, setEditing] = useState<Exercise | null>(null),
    [deleteTarget,setDeleteTarget]=useState<Exercise|null>(null),
    [deleteError,setDeleteError]=useState(""),
    [deleting,setDeleting]=useState(false);
  const list = rankExercises(
    filterExercises(exercises, {
      query: q,
      group,
      muscle,
      compoundOnly: compound,
      includeArchived: true,
    }),
  );
  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">STRENGTH</p>
          <h1 className="page-title">Exercise Library</h1>
        </div>
        <button className="primary-button" onClick={() => onCreate()}>
          + New
        </button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label">
          Search
          <input
            className="field-input"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Exercise name"
          />
        </label>
        <Select
          label="Major group"
          value={group}
          options={[
            { value: "", label: "All groups" },
            ...muscleGroups.map((value) => ({ value, label: value })),
          ]}
          onChange={setGroup}
        />
        <Select
          label="Detailed muscle"
          value={muscle}
          options={[
            { value: "", label: "All muscles" },
            ...muscleTags.map((value) => ({ value, label: value })),
          ]}
          onChange={setMuscle}
        />
        <label className="check-label self-end pb-3">
          <input
            type="checkbox"
            checked={compound}
            onChange={(event) => setCompound(event.target.checked)}
          />{" "}
          Compound only
        </label>
      </div>
      <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
        {list.map((exercise) => (
          <div
            className="flex min-h-16 items-center gap-3 py-2"
            key={exercise.id}
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-bold leading-tight text-ink">
                {exercise.name}
              </h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                {exercise.muscleTags.join(", ") ||
                  exercise.majorMuscleGroups.join(", ")}
              </p>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-500">
                <span>
                  {exercise.usageCount === 0
                    ? "No sets"
                    : `${exercise.usageCount} set${exercise.usageCount === 1 ? "" : "s"}`}
                </span>
                {exercise.trackingType === "distance" && (
                  <span className="tag">Distance</span>
                )}
                {exercise.isCompound && <span className="tag">Compound</span>}
              </div>
            </div>
            <button
              className="icon-button"
              aria-label={`Edit ${exercise.name}`}
              title="Edit"
              onClick={() => setEditing(exercise)}
            >
              ✎
            </button>
            <button
              className="icon-button text-red"
              aria-label={`Delete ${exercise.name}`}
              title="Delete"
              onClick={() => {setDeleteError("");setDeleteTarget(exercise)}}
            >
              ⌫
            </button>
          </div>
        ))}
        {!list.length && (
          <div className="empty-card">
            <p className="text-slate-400">No exercises match these filters.</p>
            <button className="primary-button mt-4" onClick={() => onCreate(q)}>
              Create new exercise
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog open={!!deleteTarget} title="Delete this exercise?" description="An exercise can only be deleted when no Strength entries use it." confirmLabel="Delete Exercise" busy={deleting} error={deleteError} onCancel={()=>{setDeleteTarget(null);setDeleteError("")}} onConfirm={async()=>{if(!deleteTarget)return;setDeleting(true);try{await deleteUnusedExercise(client,deleteTarget.userId,deleteTarget.id);setDeleteTarget(null);reload()}catch{setDeleteError("This exercise is used by existing entries. Delete those entries before deleting the exercise.")}finally{setDeleting(false)}}}>{deleteTarget&&<strong>{deleteTarget.name}</strong>}</ConfirmDialog>{editing && (
        <ExerciseEditor
          client={client}
          exercise={editing}
          userId={userId}
          all={exercises}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </section>
  );
}
function ExerciseEditor({
  client,
  exercise,
  userId,
  all,
  close,
  saved,
  initialName = "",
}: {
  client: SupabaseClient;
  exercise?: Exercise;
  userId: string;
  all: Exercise[];
  close: () => void;
  saved: () => void;
  initialName?: string;
}) {
  const [input, setInput] = useState<ExerciseInput>({
      name: exercise?.name ?? initialName,
      trackingType: exercise?.trackingType ?? "repetitions",
      loadMode: exercise?.loadMode ?? "weight_reps",
      progressionDirection: exercise?.progressionDirection ?? "higher_is_better",
      majorMuscleGroups: exercise?.majorMuscleGroups ?? ["Legs"],
      muscleTags: exercise?.muscleTags ?? [],
      isCompound: exercise?.isCompound ?? false,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmMode, setConfirmMode] = useState(false);
  const submit = async (confirmed = false) => {
    if (!input.name.trim()) {
      setError("Exercise name is required.");
      return;
    }
    if (!input.majorMuscleGroups.length) {
      setError("Choose at least one major muscle group.");
      return;
    }
    if (!input.muscleTags.length) {
      setError("Choose at least one detailed muscle.");
      return;
    }
    if (isDuplicateExerciseName(input.name, all, exercise?.id)) {
      setError("An exercise with this name already exists.");
      return;
    }
    const originalMode = exercise?.trackingType === "distance" ? "distance" : exercise?.loadMode ?? "weight_reps",
      nextMode = input.trackingType === "distance" ? "distance" : input.loadMode;
    if (!confirmed && exercise && exercise.usageCount > 0 && originalMode !== nextMode) {
      setConfirmMode(true);
      return;
    }
    setBusy(true);
    try {
      await saveExercise(client, userId, input, exercise?.id);
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save exercise.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={exercise ? "Edit exercise" : "Create exercise"}
    >
      <div className="sheet max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">
            {exercise ? "Edit exercise" : "Create exercise"}
          </h2>
          <button className="icon-button" onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="field-label">
            Exercise name
            <input
              autoFocus
              className="field-input"
              value={input.name}
              onChange={(e) => setInput({ ...input, name: e.target.value })}
            />
          </label>
          <Select
            label="Logging behavior"
            value={input.trackingType === "distance" ? "distance" : input.loadMode}
            options={[
              { value: "weight_reps", label: "Weight + Reps", description: "Record a load and whole-number reps." },
              { value: "reps_only", label: "Reps Only", description: "Record whole-number reps without weight." },
              { value: "distance", label: "Distance/Laps", description: "Record load, distance, laps, and optional duration." },
            ]}
            onChange={(mode) =>
              setInput({
                ...input,
                trackingType: mode === "distance" ? "distance" : "repetitions",
                loadMode: mode === "reps_only" ? "reps_only" : "weight_reps",
                progressionDirection: mode === "weight_reps" ? input.progressionDirection : "higher_is_better",
              })
            }
          />
          {input.trackingType==='repetitions'&&input.loadMode==='weight_reps'&&<Select label="Progression" value={input.progressionDirection??'higher_is_better'} options={[{value:'higher_is_better',label:'More weight is progress'},{value:'lower_is_better',label:'Less assistance is progress'}]} onChange={value=>setInput({...input,progressionDirection:value as ExerciseInput['progressionDirection']})}/>}
          <fieldset>
            <legend className="field-label">Major muscle groups</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {muscleGroups.map((group) => (
                <label
                  className="check-label rounded-lg bg-white/[.03] p-2"
                  key={group}
                >
                  <input
                    type="checkbox"
                    checked={input.majorMuscleGroups.includes(group)}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        majorMuscleGroups: e.target.checked
                          ? [...input.majorMuscleGroups, group]
                          : input.majorMuscleGroups.filter((g) => g !== group),
                      })
                    }
                  />
                  {group}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">Detailed muscles</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {muscleTags.map((tag) => (
                <label
                  className="check-label rounded-lg bg-white/[.03] p-2"
                  key={tag}
                >
                  <input
                    type="checkbox"
                    checked={input.muscleTags.includes(tag)}
                    onChange={(e) =>
                      setInput({
                        ...input,
                        muscleTags: e.target.checked
                          ? [...input.muscleTags, tag]
                          : input.muscleTags.filter((t) => t !== tag),
                      })
                    }
                  />
                  {tag}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="check-label">
            <input
              type="checkbox"
              checked={input.isCompound}
              onChange={(e) =>
                setInput({ ...input, isCompound: e.target.checked })
              }
            />{" "}
            Compound exercise
          </label>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button
            disabled={busy}
            className="primary-button w-full"
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : "Save exercise"}
          </button>
        </div>
        <ConfirmDialog open={confirmMode} title="Change logging behavior?" description="This changes future logging and future edits only. Existing historical sets and recorded values will not be rewritten." confirmLabel="Change Behavior" busy={busy} error={error} onCancel={() => setConfirmMode(false)} onConfirm={async () => { setConfirmMode(false); await submit(true); }} />
      </div>
    </div>
  );
}

function HistoryList({
  workouts,
  unit,
  prs,
  open,
  add,
  remove,
}: {
  workouts: Workout[];
  unit: string;
  prs: Map<string, string[]>;
  open: (workout: Workout) => void;
  add: () => void;
  remove: (workout: Workout) => Promise<void>;
}) {
  const [target, setTarget] = useState<{
      workout: Workout;
      name: string;
      date: string;
      result: string;
      sets: number;
      location?: string;
    } | null>(null),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState(""),
    groups = groupDailyStrength(workouts);
  if (!groups.length)
    return (
      <div className="empty-card">
        <p className="text-slate-400">No lifts in this date range.</p>
        <button className="primary-button mt-4" onClick={add}>
          Log Lift
        </button>
      </div>
    );
  return (
    <div>
      <div className="divide-y divide-slate-200 border-y border-slate-200">
        {groups.map((group) => {
          const workout = workouts.find(
              (item) => item.id === group.workouts[0],
            )!,
            result =
              group.sets.length === 1
                ? group.sets[0].trackingType === "repetitions"
                  ? group.sets[0].weight===undefined?`${group.sets[0].reps} reps`:`${displayWeight(group.sets[0].weight,group.sets[0].weightUnit??"lb",unit as WeightUnit)} ${unit}${group.sets[0].exercise.progressionDirection === "lower_is_better" ? " assistance" : ""} × ${group.sets[0].reps}`
                  : `${group.sets[0].distance} ${group.sets[0].distanceUnit}`
                : `${group.sets.length} sets`,
            displayDate = new Date(`${group.date}T12:00:00`).toLocaleDateString(
              undefined,
              { year: "numeric", month: "long", day: "numeric" },
            );
          return (
            <div
              className="flex items-center gap-3 py-3"
              key={`${workout.id}-${group.exerciseId}`}
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => open(workout)}
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <strong className="text-ink">{group.exerciseName}</strong>
                  <span className="text-xs text-slate-500">{displayDate}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {group.sets.length === 1 ? (
                    <SetText set={group.sets[0]} unit={unit} />
                  ) : (
                    result
                  )}
                </p>
                {group.sets.length > 1 && (
                  <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {group.sets.map((set, index) => (
                      <div key={set.id ?? index}>
                        Set {index + 1}: <SetText set={set} unit={unit} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {group.locationName ?? "No location"}
                  </span>
                  {group.sets.map((set, index) => (
                    <PrBadges
                      key={set.id ?? index}
                      kinds={prs.get(set.id!) ?? []}
                    />
                  ))}
                </div>
              </button>
              <button
                className="icon-button"
                aria-label={`Edit ${group.exerciseName} entry`}
                onClick={() => open(workout)}
              >
                ✎
              </button>
              <button
                disabled={deleting}
                className="icon-button text-red"
                aria-label={`Delete ${group.exerciseName} entry`}
                onClick={() => {
                  setError("");
                  setTarget({
                    workout,
                    name: group.exerciseName,
                    date: displayDate,
                    result,
                    sets: group.sets.length,
                    location: group.locationName ?? undefined,
                  });
                }}
              >
                ⌫
              </button>
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        open={!!target}
        title="Delete this entry?"
        description="This will permanently remove this Strength entry and recalculate your history, PRs, and Progress statistics."
        confirmLabel="Delete Entry"
        busy={deleting}
        error={error}
        onCancel={() => {
          setTarget(null);
          setError("");
        }}
        onConfirm={async () => {
          if (!target) return;
          setDeleting(true);
          setError("");
          try {
            await remove(target.workout);
            setTarget(null);
          } catch {
            setError(
              `Could not delete ${target.name}. The entry is unchanged; check your connection and retry.`,
            );
          } finally {
            setDeleting(false);
          }
        }}
      >
        {target && (
          <div className="space-y-1">
            <strong className="block text-base">{target.name}</strong>
            <span className="block text-slate-500">{target.date}</span>
            <span className="block">{target.result}</span>
            {target.sets > 1 && (
              <span className="block text-slate-500">{target.sets} sets</span>
            )}
            {target.location && (
              <span className="block text-slate-500">{target.location}</span>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

export function StrengthFeature({
  client,
  userId,
  weightUnit,
  create = false,
  onExitCreate = () => {},
}: {
  client: SupabaseClient;
  userId: string;
  weightUnit: "lb" | "kg";
  create?: boolean;
  onExitCreate?: (saved?: boolean) => void;
}) {
  const [view, setView] = useState<View>("hub"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [exercises, setExercises] = useState<Exercise[]>([]),
    [locations, setLocations] = useState<Location[]>([]),
    [workouts, setWorkouts] = useState<Workout[]>([]),
    [draft, setDraft] = useState<WorkoutDraft>({
      date: today(),
      locationId: null,
      notes: "",
      exercises: [],
    }),
    [formErrors, setFormErrors] = useState<string[]>([]),
    [quickDraft, setQuickDraft] = useState<QuickLiftDraft>(() =>
      newQuickLift([],undefined,undefined,weightUnit),
    ),
    [quickErrors, setQuickErrors] = useState<QuickLiftErrors>({}),
    [saving, setSaving] = useState(false),
    [selected, setSelected] = useState<Workout | null>(null),
    [editor, setEditor] = useState<{ name: string } | null>(null),
    [successId, setSuccessId] = useState<string | null>(null),
    [savedWorkout,setSavedWorkout]=useState<Workout|null>(null),
    [days, setDays] = useState(0),
    [historySearch, setHistorySearch] = useState(""),
    [historyLocation, setHistoryLocation] = useState("all"),
    [historyPage, setHistoryPage] = useState(1);
  const [historyItems,setHistoryItems]=useState<Workout[]>([]),[historyTotal,setHistoryTotal]=useState(0),[historyLoading,setHistoryLoading]=useState(false),[debouncedHistorySearch,setDebouncedHistorySearch]=useState("");
  useEffect(()=>{const timer=setTimeout(()=>setDebouncedHistorySearch(historySearch),250);return()=>clearTimeout(timer)},[historySearch]);
  const [evidence,setEvidence]=useState<ReturnType<typeof strengthPrEvidence>>([]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setExercises(await getExercises(client, userId));
      setEvidence(strengthPrEvidence(await loadStrengthProgressRows(client,userId)));
      const [l, w] = await Promise.allSettled([
        getLocations(client, userId),
        getWorkouts(client, userId),
      ]);
      if (l.status === "fulfilled") setLocations(l.value);
      else void l.reason;
      if (w.status === "fulfilled") setWorkouts(w.value);
      else void w.reason;
      if ([l, w].some((result) => result.status === "rejected"))
        setError(
          "Exercises loaded, but some history or location details are temporarily unavailable.",
        );
    } catch (e) {
      setError(strengthLoadMessage(e));
    } finally {
      setLoading(false);
    }
  }, [client, userId]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  useEffect(()=>{if(loading)return;let active=true;setHistoryLoading(true);getStrengthHistoryPage(client,userId,{page:historyPage,search:debouncedHistorySearch,locationId:historyLocation!=="all"&&historyLocation!=="none"?historyLocation:undefined,noLocation:historyLocation==="none",start:days?localDateKey(new Date(Date.now()-days*86400000).toISOString()):undefined}).then(result=>{if(!active)return;const valid=validHistoryPage(result.total);setHistoryTotal(result.total);if(historyPage>valid){setHistoryPage(valid);return}setHistoryItems(result.items)}).catch(()=>{if(active)setError("Strength history could not load.")}).finally(()=>{if(active)setHistoryLoading(false)});return()=>{active=false}},[client,userId,historyPage,debouncedHistorySearch,historyLocation,days,loading]);
  const prMap = useMemo(
    () =>
      new Map(detectRepetitionPrs(evidence).map((p) => [p.setKey, p.kinds])),
    [evidence],
  );
  const historyResults = {items:historyItems,total:historyTotal,page:historyPage,pages:Math.max(1,Math.ceil(historyTotal/20)),start:historyTotal?(historyPage-1)*20+1:0,end:Math.min(historyPage*20,historyTotal)};
  const recentIds = new Set(
    workouts.slice(0, 3).flatMap((w) => w.sets.map((s) => s.id!)),
  );
  const recentPrs = [...prMap.entries()].filter(
    ([id, k]) =>
      recentIds.has(id) && (k.includes("weight") || k.includes("reps")),
  ).length;
  const openQuick = (date?: string, locationId?: string | null) => {
    setQuickDraft(newQuickLift(locations, date, locationId,weightUnit));
    setQuickErrors({});
    setSuccessId(null);
    setView("quick");
  };
  const startNew = () => openQuick();
  useEffect(() => {
    if (create)
      queueMicrotask(() => {
        setQuickDraft(newQuickLift(locations,undefined,undefined,weightUnit));
        setQuickErrors({});
        setSuccessId(null);
        setView("quick");
      });
  }, [create, locations,weightUnit]);
  const edit = (w: Workout) => {
    setDraft(workoutEditDraft(w));
    setView("form");
  };
  const submitQuick = async () => {
    const errors = validateQuickLift(quickDraft);
    setQuickErrors(errors);
    if (Object.keys(errors).length || saving) return;
    setSaving(true);
    try {
      const id = await saveWorkout(
        client,
        userId,
        quickLiftToWorkout(quickDraft),
      );
      setSuccessId(id);
      setSavedWorkout(await getWorkoutById(client,userId,id).catch(()=>null));
      await load();
      setSelected(null);
      setView("quick-success");
      onExitCreate(true);
    } catch (e) {
      setQuickErrors({
        save:
          e instanceof Error
            ? e.message
            : "Could not save the lift. Your entries are still here.",
      });
    } finally {
      setSaving(false);
    }
  };
  const submit = async () => {
    const errors = validateWorkout(draft);
    setFormErrors(errors);
    if (errors.length || saving) return;
    setSaving(true);
    try {
      const id = await saveWorkout(client, userId, {...draft,exercises:draft.exercises.map(block=>({...block,sets:block.sets.map(set=>({...set,weightUnit:set.weightUnit??(draft.id?"lb":weightUnit)}))}))});
      setSuccessId(id);
      setSavedWorkout(await getWorkoutById(client,userId,id).catch(()=>null));
      await load();
      setSelected(null);
      setView("detail");
      if (create) onExitCreate(true);
    } catch (e) {
      setFormErrors([
        e instanceof Error
          ? e.message
          : "Could not save the workout. Your form is still here.",
      ]);
    } finally {
      setSaving(false);
    }
  };
  if (loading || (error && !exercises.length))
    return <Status loading={loading} error={error} retry={load} />;
  if (editor)
    return (
      <ExerciseEditor
        client={client}
        userId={userId}
        all={exercises}
        initialName={editor.name}
        close={() => setEditor(null)}
        saved={() => {
          setEditor(null);
          load();
        }}
      />
    );
  if (view === "quick")
    return (
      <QuickLiftForm
        draft={quickDraft}
        onChange={setQuickDraft}
        exercises={exercises}
        locations={locations}
        unit={quickDraft.weightUnit??weightUnit}
        saving={saving}
        errors={quickErrors}
        onSave={submitQuick}
        onCancel={() => {
          setView("hub");
          onExitCreate(false);
        }}
        onCreateExercise={(name) => setEditor({ name })}
      />
    );
  if (view === "quick-success") {
    const w = savedWorkout?.id===successId?savedWorkout:workouts.find((x) => x.id === successId),
      set = w?.sets[0];
    return (
      <section className="mx-auto max-w-xl">
        <p className="eyebrow">LIFT SAVED</p>
        <h1 className="page-title">Nice work.</h1>
        <div className="surface-card mt-6">
          {set && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-ink">
                    {set.exercise.name}
                  </h2>
                  <p className="mt-2 text-lg text-slate-700">
                    <SetText set={set} unit={weightUnit} />
                  </p>
                </div>
                <PrBadges kinds={prMap.get(set.id!) ?? []} />
              </div>
              <p className="mt-4 text-sm text-slate-500">
                {new Date(w!.performedAt).toLocaleDateString()}
                {w!.location ? ` · ${w!.location.name}` : ""}
              </p>
            </>
          )}
        </div>
        <div className="mt-5 grid gap-3">
          <button
            className="primary-button"
            onClick={() => openQuick(quickDraft.date, quickDraft.locationId)}
          >
            Log Another Exercise
          </button>
          <button
            className="secondary-button"
            disabled={!w}
            onClick={() => w&&edit(w)}
          >
            <span aria-hidden="true">✎</span> Edit Entry
          </button>
          <button className="text-button py-3" onClick={() => setView("history")}>
            Done / View History
          </button>
        </div>
      </section>
    );
  }
  if (view === "form")
    return (
      <WorkoutForm
        draft={draft}
        setDraft={setDraft}
        exercises={exercises}
        locations={locations}
        unit={weightUnit}
        saving={saving}
        errors={formErrors}
        onSave={submit}
        onCancel={() => {
          setView("hub");
          onExitCreate(false);
        }}
        onCreateExercise={(name) => setEditor({ name })}
      />
    );
  if (view === "exercises")
    return (
      <>
        <button className="text-button mb-4" onClick={() => setView("hub")}>
          ← Strength home
        </button>
        <ExerciseLibrary
          client={client}
          userId={userId}
          exercises={exercises}
          reload={load}
          onCreate={(name) => setEditor({ name: name ?? "" })}
        />
      </>
    );
  if (view === "history")
    return (
      <section>
        <button className="text-button mb-4" onClick={() => setView("hub")}>
          ← Strength home
        </button>
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">ACTUAL PERFORMANCE</p>
            <h1 className="page-title">Strength History</h1>
          </div>
          <Select
            label="History date range"
            className="w-auto"
            value={String(days)}
            options={[
              { value: "0", label: "All Time" },
              { value: "30", label: "Past month" },
              { value: "90", label: "Past 3 months" },
              { value: "365", label: "Past year" },
              { value: "36500", label: "All time" },
            ]}
            onChange={(value) => { setDays(Number(value)); setHistoryPage(1); }}
          />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="field-label">Search exercise<input className="field-input" value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }} placeholder="Bench Press" /></label>
          <Combobox label="Location" value={historyLocation} options={[{ value: "all", label: "All locations" }, { value: "none", label: "No location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]} onChange={(value) => { setHistoryLocation(value); setHistoryPage(1); }} />
        </div>
        <div className="mt-6">
          {historyLoading ? <div className="empty-card">Loading matching Strength entries…</div> : <HistoryList
            workouts={historyResults.items}
            unit={weightUnit}
            prs={prMap}
            open={(w) => {
              setSelected(w);
              setView("detail");
            }}
            add={startNew}
            remove={async (workout) => {
              await deleteWorkout(client, userId, workout.id);
              await load();
              if (selected?.id === workout.id) setSelected(null);
            }}
          />}
          <Pagination {...historyResults} onChange={setHistoryPage} />
        </div>
      </section>
    );
  if (view === "detail") {
    const w = selected ?? (savedWorkout?.id===successId?savedWorkout:workouts.find((x) => x.id === successId));
    if (!w) {
      setView("history");
      return null;
    }
    return (
      <section>
        <button className="text-button mb-4" onClick={() => setView("history")}>
          ← History
        </button>
        {successId === w.id && (
          <div className="mb-4 rounded-xl border border-red/20 bg-red/[.07] p-4">
            <strong className="text-red">Workout saved</strong>
            <p className="text-xs text-slate-400">
              All exercises and sets were saved successfully.
            </p>
          </div>
        )}
        <h1 className="page-title">Workout details</h1>
        <div className="mt-5">
          <WorkoutCard
            workout={w}
            unit={weightUnit}
            prs={prMap}
            onOpen={() => {}}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="primary-button" onClick={() => edit(w)}>
            Edit workout
          </button>
          <button className="secondary-button" onClick={startNew}>
            Add another
          </button>
          <button className="secondary-button text-red" onClick={()=>setView("history")}>Delete from Strength History</button>
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">TRAINING MODULE</p>
          <h1 className="page-title">Strength</h1>
        </div>
        <button className="primary-button" onClick={startNew}>
          + Log Lift
        </button>
      </div>
      <YourSets client={client} userId={userId} />
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <button
          className="module-card min-h-32 text-left"
          onClick={() => setView("exercises")}
        >
          <strong className="text-ink">Exercise Library</strong>
          <p className="mt-2 text-xs text-slate-500">
            {exercises.length} exercises
          </p>
        </button>
        <button
          className="module-card min-h-32 text-left"
          onClick={() => setView("history")}
        >
          <strong className="text-ink">Strength History</strong>
          <p className="mt-2 text-xs text-slate-500">
            All-time history and actual PRs
          </p>
        </button>
      </div>
      <div className="mt-8 flex justify-between">
        <div>
          <p className="eyebrow">RECENT LIFTS</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink">
            Your latest lifts
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          {recentPrs} recent PR marks
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {workouts.slice(0, 3).map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            unit={weightUnit}
            prs={prMap}
            onOpen={() => {
              setSelected(w);
              setView("detail");
            }}
          />
        ))}
        {!workouts.length && (
          <div className="empty-card">
            <h3 className="font-display text-xl font-bold text-ink">
              Your first set starts here
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Choose an exercise, log a lift, and build a history from actual
              performance.
            </p>
            <button className="primary-button mt-5" onClick={startNew}>
              Log your first lift
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
