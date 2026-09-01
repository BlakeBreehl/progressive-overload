/* oxlint-disable react/set-state-in-effect -- loading state follows remote requests */
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cardioFields,
  durationParts,
  durationToSeconds,
  formatDuration,
  validateCardio,
} from "./logic";
import { DurationWheel } from "./DurationWheel";
import {
  cardioLoadMessage,
  deleteCardioActivity,
  deleteCardioSession,
  getCardioHistoryPage,
  loadCardio,
  saveCardioActivity,
  saveCardioSession,
  type CardioActivity,
  type CardioSession,
} from "./repository";
import type { Location } from "../strength/types";
import { localDateKey, localDateToIso } from "../strength/logic";
import { getLocations } from "../strength/repository";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Combobox, Select } from "../../components/SelectionControls";
import { Pagination } from "../../components/Pagination";
import { EntrySuccessActions } from "../../components/EntrySuccessActions";
import { validHistoryPage } from "../../lib/pagedHistory";
type Form = {
  id?: string;
  activityId: string;
  date: string;
  h: number;
  m: number;
  s: number;
  distance?: number;
  distanceUnit: string;
  speed?: number;
  incline?: number;
  difficulty?: number;
  locationId: string;
  notes: string;
};
const today = () => localDateKey(new Date().toISOString()),
  blank = (locations: Location[]): Form => ({
    activityId: "",
    date: today(),
    h: 0,
    m: 0,
    s: 0,
    distanceUnit: "miles",
    locationId: locations.find((l) => l.isDefault && !l.archived)?.id ?? "",
    notes: "",
  });
export function CardioFeature({
  client,
  userId,
  create = false,
  onExitCreate = () => {},
}: {
  client: SupabaseClient;
  userId: string;
  create?: boolean;
  onExitCreate?: (saved?: boolean) => void;
}) {
  const [locations, setLocations] = useState<Location[]>([]),
    [activities, setActivities] = useState<CardioActivity[]>([]),
    [entries, setEntries] = useState<CardioSession[]>([]),
    [form, setForm] = useState<Form | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [success,setSuccess]=useState<{id:string;form:Form}|null>(null),
    [activityName, setActivityName] = useState(""),
    [editingActivity, setEditingActivity] = useState<CardioActivity | null>(null),
    [deleteEntry, setDeleteEntry] = useState<CardioSession | null>(null),
    [deleteActivity, setDeleteActivity] = useState<CardioActivity | null>(null),
    [historySearch, setHistorySearch] = useState(""),
    [historyLocation, setHistoryLocation] = useState("all"),
    [historyPage, setHistoryPage] = useState(1);
  const [historyTotal,setHistoryTotal]=useState(0),[historyLoading,setHistoryLoading]=useState(false),[debouncedSearch,setDebouncedSearch]=useState("");
  useEffect(()=>{const timer=setTimeout(()=>setDebouncedSearch(historySearch),250);return()=>clearTimeout(timer)},[historySearch]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, locationResult] = await Promise.all([
        loadCardio(client, userId),
        getLocations(client, userId).catch(() => []),
      ]);
      setActivities(data.activities);
      setEntries(data.sessions);
      setLocations(locationResult);
      setError(data.warning);
    } catch (e) {
      setError(cardioLoadMessage(e, navigator.onLine));
    } finally {
      setLoading(false);
    }
  }, [client, userId]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  useEffect(() => {
    if (create)
      queueMicrotask(() => setForm((current) => current ?? blank(locations)));
  }, [create, locations]);
  useEffect(()=>{if(loading)return;let active=true;setHistoryLoading(true);getCardioHistoryPage(client,userId,{page:historyPage,search:debouncedSearch,locationId:historyLocation!=="all"&&historyLocation!=="none"?historyLocation:undefined,noLocation:historyLocation==="none"}).then(result=>{if(!active)return;const valid=validHistoryPage(result.total);setHistoryTotal(result.total);if(historyPage>valid){setHistoryPage(valid);return}setEntries(result.items)}).catch(()=>{if(active)setError("Cardio history could not load.")}).finally(()=>{if(active)setHistoryLoading(false)});return()=>{active=false}},[client,userId,historyPage,debouncedSearch,historyLocation,loading]);
  const edit = (entry: CardioSession) => {
    const p = durationParts(entry.durationSeconds);
    setForm({
      id: entry.id,
      activityId: entry.activityId,
      date: localDateKey(entry.performedAt),
      h: p.hours,
      m: p.minutes,
      s: p.seconds,
      distance: entry.distance,
      distanceUnit: entry.distanceUnit ?? "miles",
      speed: entry.speed,
      incline: entry.incline,
      difficulty: entry.difficulty,
      locationId: entry.locationId ?? "",
      notes: entry.notes ?? "",
    });
  };
  const save = async () => {
    if (!form || saving) return;
    const activity = activities.find((a) => a.id === form.activityId),
      errors = validateCardio({
        activityName: activity?.name ?? "",
        hours: form.h,
        minutes: form.m,
        seconds: form.s,
        distance: form.distance,
        speed: form.speed,
        incline: form.incline,
        difficulty: form.difficulty,
      });
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setSaving(true);
    try {
      const fields = cardioFields(activity!.name);
      const saved={...form},id=await saveCardioSession(
        client,
        userId,
        {
          activity_id: form.activityId,
          performed_at: localDateToIso(form.date),
          duration_seconds: durationToSeconds(form.h, form.m, form.s),
          distance: fields.distance ? (form.distance ?? null) : null,
          distance_unit:
            fields.distance && form.distance !== undefined
              ? form.distanceUnit
              : null,
          speed: fields.speed ? (form.speed ?? null) : null,
          incline: fields.incline ? (form.incline ?? null) : null,
          difficulty: fields.difficulty ? (form.difficulty ?? null) : null,
          location_id: form.locationId || null,
          notes: form.notes || null,
        },
        form.id,
      );
      setSuccess({id,form:saved});setForm(null);
      setError("");
      await load();
      onExitCreate(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Cardio entry could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <div className="surface-card">Loading Cardio…</div>;
  const selected = activities.find((a) => a.id === form?.activityId),
    fields = cardioFields(selected?.name ?? ""),
    historyResults = {items:entries,total:historyTotal,page:historyPage,pages:Math.max(1,Math.ceil(historyTotal/20)),start:historyTotal?(historyPage-1)*20+1:0,end:Math.min(historyPage*20,historyTotal)};
  if(success&&!form){const activity=activities.find(item=>item.id===success.form.activityId);return <section className="mx-auto max-w-xl"><p className="eyebrow">CARDIO SAVED</p><h1 className="page-title">Entry saved.</h1><div className="surface-card mt-6"><strong>{activity?.name??"Cardio"}</strong><p className="mt-2 text-sm text-slate-600">{formatDuration(durationToSeconds(success.form.h,success.form.m,success.form.s))}</p></div><EntrySuccessActions onAnother={()=>{setSuccess(null);setForm(blank(locations))}} onEdit={()=>{setForm({...success.form,id:success.id})}} onDone={()=>setSuccess(null)}/></section>}
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">CARDIO</p>
          <h1 className="page-title">Cardio</h1>
        </div>
        <div className="flex gap-2">
          <button
            className="secondary-button"
            onClick={() =>
              document.getElementById("cardio-management")?.scrollIntoView()
            }
          >
            Manage Activities
          </button>
          <button
            className="primary-button"
            onClick={() => setForm(blank(locations))}
          >
            + Add Cardio Entry
          </button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red/20 bg-red/5 p-3 text-sm text-red"
        >
          {error}
          <button className="text-button ml-2" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {form && (
        <div className="surface-card mt-6">
          <h2 className="font-display text-xl font-bold text-ink">
            {form.id ? "Edit" : "Add"} Cardio Entry
          </h2>
          <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
            <Combobox
              autoFocus
              label="Activity"
              placeholder="Choose activity"
              value={form.activityId}
              options={activities
                .filter((activity) => !activity.archived)
                .map((activity) => ({ value: activity.id, label: activity.name }))}
              onChange={(activityId) => setForm(current=>current?{ ...current, activityId }:current)}
            />
            <DurationWheel
              hours={form.h}
              minutes={form.m}
              seconds={form.s}
              onChange={(p) =>
                setForm(current=>current?{ ...current, h: p.hours, m: p.minutes, s: p.seconds }:current)
              }
            />
            <label className="field-label">
              Date
              <input
                className="field-input"
                type="date"
                value={form.date}
                onChange={(e) => {const date=e.target.value;setForm(current=>current?{ ...current, date }:current)}}
              />
            </label>
            <Select
              label="Location (optional)"
              value={form.locationId}
              options={[
                { value: "", label: "No location" },
                ...locations
                  .filter((location) => !location.archived)
                  .map((location) => ({ value: location.id, label: location.name })),
              ]}
              onChange={(locationId) => setForm(current=>current?{ ...current, locationId }:current)}
            />
            {fields.distance && (
              <>
                <label className="field-label">
                  Distance
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="any"
                    value={form.distance ?? ""}
                    onChange={(e) =>
                      setForm(current=>current?{
                        ...current,
                        distance:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }:current)
                    }
                  />
                </label>
                <Select
                  label="Distance unit"
                  value={form.distanceUnit}
                  options={["meters", "kilometers", "miles", "yards", "feet"].map(
                    (unit) => ({ value: unit, label: unit }),
                  )}
                  onChange={(distanceUnit) => setForm(current=>current?{ ...current, distanceUnit }:current)}
                />
              </>
            )}
            {fields.speed && (
              <label className="field-label">
                Speed
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="any"
                  value={form.speed ?? ""}
                  onChange={(e) =>
                    setForm(current=>current?{
                      ...current,
                      speed:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    }:current)
                  }
                />
              </label>
            )}
            {fields.incline && (
              <label className="field-label">
                Incline
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="any"
                  value={form.incline ?? ""}
                  onChange={(e) =>
                    setForm(current=>current?{
                      ...current,
                      incline:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    }:current)
                  }
                />
              </label>
            )}
            {fields.difficulty && (
              <label className="field-label">
                Difficulty / level (0–10)
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  max="10"
                  step="any"
                  value={form.difficulty ?? ""}
                  onChange={(e) =>
                    setForm(current=>current?{
                      ...current,
                      difficulty:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    }:current)
                  }
                />
              </label>
            )}
            <label className="field-label md:col-span-2">
              Notes (optional)
              <textarea
                className="field-input min-h-20 py-2"
                value={form.notes}
                onChange={(e) => {const notes=e.target.value;setForm(current=>current?{ ...current, notes }:current)}}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="secondary-button"
              onClick={() => {
                setForm(null);
                onExitCreate(false);
              }}
            >
              Cancel
            </button>
            <button
              disabled={saving || !navigator.onLine}
              className="primary-button"
              onClick={save}
            >
              {saving ? "Saving…" : "Save Cardio Entry"}
            </button>
          </div>
        </div>
      )}
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_.65fr]">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">History</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="field-label">Search activity<input className="field-input" value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }} placeholder="Run, cycling…" /></label>
            <Combobox label="Location" value={historyLocation} options={[{ value: "all", label: "All locations" }, { value: "none", label: "No location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]} onChange={(value) => { setHistoryLocation(value); setHistoryPage(1); }} />
          </div>
          <div className="mt-3 space-y-3">
            {historyLoading ? <div className="empty-card">Loading matching Cardio entries…</div> : historyResults.items.map((entry) => (
              <div className="surface-card" key={entry.id}>
                <div className="flex justify-between gap-3">
                  <div>
                    <strong className="text-ink">{entry.activityName}</strong>
                    <p className="text-xs text-slate-500">
                      {new Date(entry.performedAt).toLocaleDateString()} ·{" "}
                      {formatDuration(entry.durationSeconds)} ·{" "}
                      {entry.locationName ?? "No location"}
                    </p>
                  </div>
                  <div>
                    <button className="text-button" onClick={() => edit(entry)}>
                      Edit
                    </button>
                    <button
                      className="text-button text-red"
                      onClick={() => {setError("");setDeleteEntry(entry)}}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {entry.distance !== undefined &&
                    `${entry.distance} ${entry.distanceUnit} `}
                  {entry.speed !== undefined && `· Speed ${entry.speed} `}
                  {entry.incline !== undefined && `· Incline ${entry.incline} `}
                  {entry.difficulty !== undefined &&
                    `· Level ${entry.difficulty}`}
                </p>
                {entry.notes && (
                  <p className="mt-2 text-sm text-slate-600">{entry.notes}</p>
                )}
              </div>
            ))}
            {!historyLoading && !historyTotal && (
              <div className="empty-card">No Cardio entries match these filters.</div>
            )}
          </div>
          <Pagination {...historyResults} onChange={setHistoryPage} />
        </div>
        <div id="cardio-management">
          <div className="flex justify-between">
            <h2 className="font-display text-xl font-bold text-ink">
              Manage Cardio Activities
            </h2>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              aria-label="New cardio activity"
              className="field-input"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="Activity name"
            />
            <button
              className="secondary-button"
              onClick={async () => {
                if (activityName.trim()) {
                  await saveCardioActivity(client, userId, activityName,editingActivity?.id);
                  setActivityName("");
                  setEditingActivity(null);
                  load();
                }
              }}
            >
              Add
            </button>
          </div>
          <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            {activities.map((activity) => (
              <div
                className="flex min-h-14 items-center justify-between gap-2 py-2"
                key={activity.id}
              >
                <span className="text-sm font-bold text-ink">
                  {activity.name}
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label={`Edit ${activity.name}`}
                    title="Edit"
                    onClick={() => {setEditingActivity(activity);setActivityName(activity.name)}}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-button text-red"
                    aria-label={`Delete ${activity.name}`}
                    title="Delete"
                    onClick={() => {setError("");setDeleteActivity(activity)}}
                  >
                    ⌫
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div><ConfirmDialog open={!!deleteEntry} title="Delete this Cardio entry?" description="This permanently removes the selected Cardio entry and refreshes Progress totals." confirmLabel="Delete Entry" busy={saving} error={error} onCancel={()=>{setDeleteEntry(null);setError("")}} onConfirm={async()=>{if(!deleteEntry)return;setSaving(true);try{await deleteCardioSession(client,userId,deleteEntry.id);setDeleteEntry(null);await load()}catch{setError("Could not delete this Cardio entry. It is unchanged; try again.")}finally{setSaving(false)}}}>{deleteEntry&&<><strong>{deleteEntry.activityName}</strong><p>{new Date(deleteEntry.performedAt).toLocaleDateString()} · {formatDuration(deleteEntry.durationSeconds)}</p></>}</ConfirmDialog><ConfirmDialog open={!!deleteActivity} title="Delete this Cardio activity?" description="The activity can only be deleted when no Cardio entries use it." confirmLabel="Delete Activity" busy={saving} error={error} onCancel={()=>{setDeleteActivity(null);setError("")}} onConfirm={async()=>{if(!deleteActivity)return;setSaving(true);try{await deleteCardioActivity(client,userId,deleteActivity.id);setDeleteActivity(null);await load()}catch{setError("This activity is used by existing entries. Delete those entries before deleting the activity.")}finally{setSaving(false)}}}>{deleteActivity&&<strong>{deleteActivity.name}</strong>}</ConfirmDialog>
    </section>
  );
}
