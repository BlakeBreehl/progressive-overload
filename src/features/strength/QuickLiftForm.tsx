import { LocationSelect } from "../../components/LocationSelect";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { filterExercises, isRepsOnlyExercise, rankExercises } from "./logic";
import type { Exercise, Location } from "./types";
import { newQuickLiftSet, type QuickLiftDraft, type QuickLiftErrors } from "./quickLog";
import { exerciseLogSubtitle } from "./searchMetadata";

export function QuickLiftForm({
  draft,
  onChange,
  exercises,
  locations,
  unit,
  errors,
  saving,
  onSave,
  onCancel,
  onCreateExercise,
}: {
  draft: QuickLiftDraft;
  onChange: Dispatch<SetStateAction<QuickLiftDraft>>;
  exercises: Exercise[];
  locations: Location[];
  unit: string;
  errors: QuickLiftErrors;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onCreateExercise: (name: string) => void;
}) {
  const [q, setQ] = useState(draft.exercise?.name ?? ""),
    [open, setOpen] = useState(true),
    matches = useMemo(
      () =>
        rankExercises(filterExercises(exercises, { query: q })).slice(0, 10),
      [exercises, q],
    ),
    setValue = (setKey: string|undefined, key: "weight" | "reps", value: string) =>
      onChange(current => ({...current,sets:current.sets.map(set=>set.key===setKey?{...set,[key]:value}:set)}));
  return (
    <section className="mx-auto max-w-xl">
      <p className="eyebrow">STRENGTH ENTRY</p>
      <h1 className="page-title">{draft.id ? "Edit Lift" : "Log Lift"}</h1>
      <div className="mt-6 space-y-4">
        <div className="relative">
          <label className="field-label">
            Exercise
            <input
              autoFocus
              className="field-input"
              value={q}
              placeholder="Search exercises…"
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
                if (draft.exercise && e.target.value !== draft.exercise.name)
                  onChange(current => ({ ...current, exercise: null }));
              }}
            />
          </label>
          {errors.exercise && (
            <p className="mt-1 text-xs text-red">{errors.exercise}</p>
          )}
          {open && q.trim() && q !== draft.exercise?.name && (
            <div className="picker-menu">
              {matches.map((exercise) => (
                <button
                  type="button"
                  className="picker-row"
                  key={exercise.id}
                  onClick={() => {
                    onChange(current => ({
                      ...current,
                      exercise,
                      sets: [newQuickLiftSet()],
                      load: "",
                      distance: "",
                      laps: "1",
                      durationSeconds: "",
                    }));
                    setQ(exercise.name);
                    setOpen(false);
                  }}
                >
                  <span>
                    <strong className="block text-ink">{exercise.name}</strong>
                    <small className="text-slate-500">
                      {exerciseLogSubtitle(exercise, unit)}
                    </small>
                  </span>
                </button>
              ))}
              {!matches.length && (
                <>
                  <p className="p-3 text-sm text-slate-500">
                    No active exercise matches “{q.trim()}”.
                  </p>
                  <button
                    type="button"
                    className="picker-create"
                    onClick={() => onCreateExercise(q.trim())}
                  >
                    Create Exercise
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {draft.exercise?.trackingType === "repetitions" && (
          <div className="space-y-3">
            {draft.sets.map((set, i) => (
              <div className="set-card" key={set.key}>
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-slate-500">
                    Set {i + 1}
                  </strong>
                  {draft.sets.length > 1 && (
                    <button
                      type="button"
                      className="text-button text-red"
                      onClick={() =>
                        onChange(current=>({...current,sets:current.sets.filter(item=>item.key!==set.key)}))
                      }
                    >
                      Remove Set
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {!isRepsOnlyExercise(draft.exercise!) && <label className="field-label">
                    Weight ({unit})
                    <input
                      className="field-input"
                      inputMode="decimal"
                      type="number"
                      min="0"
                      step="any"
                      value={set.weight}
                      onChange={(e) => setValue(set.key, "weight", e.target.value)}
                    />
                  </label>}
                  <label className="field-label">
                    Reps
                    <input
                      className="field-input"
                      inputMode="numeric"
                      type="number"
                      min="1"
                      step="1"
                      value={set.reps}
                      onChange={(e) => setValue(set.key, "reps", e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
            {errors.weight && (
              <p className="text-xs text-red">{errors.weight}</p>
            )}
            {errors.reps && <p className="text-xs text-red">{errors.reps}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  onChange(current=>({...current,sets:[...current.sets,newQuickLiftSet()]}))
                }
              >
                + Add Set
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  onChange(current=>{const last=current.sets.at(-1);return{...current,sets:[...current.sets,newQuickLiftSet(last?.weight??"",last?.reps??"")]}})
                }
              >
                Duplicate Previous Set
              </button>
            </div>
          </div>
        )}
        <label className="field-label">
          Date
          <input
            className="field-input"
            type="date"
            value={draft.date}
            onChange={(e) => onChange(current=>({ ...current, date: e.target.value }))}
          />
        </label>
        <LocationSelect label="Location (optional)" value={draft.locationId??""} options={[{value:"",label:"No location"},...locations.filter(x=>!x.archived).map(x=>({value:x.id,label:`${x.name}${x.isDefault?' (default)':''}`}))]} onChange={value=>onChange(current=>({...current,locationId:value||null}))}/>
        {errors.save && (
          <p role="alert" className="text-sm text-red">
            {errors.save}
          </p>
        )}
        <div className="grid grid-cols-[.8fr_1.2fr] gap-3">
          <button className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={saving || !navigator.onLine}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
