/* oxlint-disable react/set-state-in-effect -- loading state follows remote requests */
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDuration } from "../cardio/logic";
import { bodyAreas, filterFlexibilityActivities } from "./logic";
import {
  deleteFlexActivity,
  deleteFlexEntry,
  flexibilityLoadMessage,
  getFlexHistoryPage,
  loadFlexibility,
  saveFlexActivity,
  saveFlexEntry,
  type FlexActivity,
  type FlexEntry,
  type FlexSet,
  type FlexTracking,
} from "./repository";
import { localDateKey, localDateToIso } from "../strength/logic";
import { StretchDurationWheel as DurationWheel } from "./StretchDurationWheel";
import {
  stretchDurationParts,
  stretchDurationSeconds,
  validStretchDuration,
} from "./stretchDuration";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  Combobox,
  MultiSelect,
  Select,
} from "../../components/SelectionControls";
import { Pagination } from "../../components/Pagination";
import { EntrySuccessActions } from "../../components/EntrySuccessActions";
type Form = {
  id?: string;
  activityId: string;
  date: string;
  sets: FlexSet[];
  notes: string;
};
const blank = (): Form => ({
  activityId: "",
  date: localDateKey(new Date().toISOString()),
  sets: [{ setOrder: 1, durationSeconds: 30 }],
  notes: "",
});
const durationParts = (value: number) => ({
    hours: 0,
    ...stretchDurationParts(value),
  }),
  durationToSeconds = (_: number, minutes: number, seconds: number) =>
    stretchDurationSeconds(minutes, seconds);
const nextSet = (type: FlexTracking, index: number): FlexSet =>
  type === "time"
    ? { setOrder: index, durationSeconds: 30 }
    : { setOrder: index, reps: 1 };
export function FlexibilityFeature({
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
  const [activities, setActivities] = useState<FlexActivity[]>([]),
    [entries, setEntries] = useState<FlexEntry[]>([]),
    [form, setForm] = useState<Form | null>(null),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [success,setSuccess]=useState<{id:string;form:Form}|null>(null),
    [error, setError] = useState(""),
    [editor, setEditor] = useState<FlexActivity | null | undefined>(),
    [name, setName] = useState(""),
    [tracking, setTracking] = useState<FlexTracking>("time"),
    [areas, setAreas] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [area, setArea] = useState(""),
    [deleteEntry,setDeleteEntry]=useState<FlexEntry|null>(null),
    [deleteActivity,setDeleteActivity]=useState<FlexActivity|null>(null),
    [historySearch,setHistorySearch]=useState(""),
    [historyArea,setHistoryArea]=useState(""),
    [historyTracking,setHistoryTracking]=useState("all"),
    [historyPage,setHistoryPage]=useState(1);
  const [historyTotal,setHistoryTotal]=useState(0),[historyLoading,setHistoryLoading]=useState(false),[debouncedHistorySearch,setDebouncedHistorySearch]=useState("");
  useEffect(()=>{const timer=setTimeout(()=>setDebouncedHistorySearch(historySearch),250);return()=>clearTimeout(timer)},[historySearch]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadFlexibility(client, userId);
      setActivities(data.activities);
      setEntries(data.entries);
      setError(data.warning);
    } catch (e) {
      setError(flexibilityLoadMessage(e, navigator.onLine));
    } finally {
      setLoading(false);
    }
  }, [client, userId]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  useEffect(() => {
    if (create) queueMicrotask(() => setForm((current) => current ?? blank()));
  }, [create]);
  useEffect(()=>{if(loading)return;let active=true;setHistoryLoading(true);getFlexHistoryPage(client,userId,{page:historyPage,search:debouncedHistorySearch,bodyArea:historyArea||undefined,trackingType:historyTracking==="all"?undefined:historyTracking}).then(result=>{if(!active)return;setEntries(result.items);setHistoryTotal(result.total)}).catch(()=>{if(active)setError("Stretch history could not load.")}).finally(()=>{if(active)setHistoryLoading(false)});return()=>{active=false}},[client,userId,historyPage,debouncedHistorySearch,historyArea,historyTracking,loading]);
  const selected = activities.find((a) => a.id === form?.activityId);
  const choose = (activityId: string) => {
    const activity = activities.find((a) => a.id === activityId);
    setForm(current=>current?{
        ...current,
        activityId,
        sets: [nextSet(activity?.trackingType ?? "time", 1)],
      }:current);
  };
  const updateSet = (index: number, value: FlexSet) =>
    setForm(current=>current?{...current,sets:current.sets.map((s,i)=>i===index?value:s)}:current);
  const removeSet = (index: number) =>
    setForm(current=>current&&current.sets.length>1?{
      ...current,
      sets: current.sets
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, setOrder: i + 1 })),
    }:current);
  const duplicate = (index: number) =>
    setForm(current=>current?{
      ...current,
      sets: [
        ...current.sets.slice(0, index + 1),
        { ...current.sets[index], id: undefined },
        ...current.sets.slice(index + 1),
      ].map((s, i) => ({ ...s, setOrder: i + 1 })),
    }:current);
  const save = async () => {
    if (!form || !selected || saving) return;
    const invalid = form.sets.some((s) =>
      selected.trackingType === "time"
        ? !validStretchDuration(Number(s.durationSeconds))
        : !Number.isInteger(s.reps) || Number(s.reps) < 1,
    );
    if (invalid) {
      setError(
        selected.trackingType === "time"
          ? "Each Time set must be between 00:01 and 99:59."
          : "Every Rep set needs a positive whole-number value.",
      );
      return;
    }
    setSaving(true);
    try {
      const saved={...form,sets:form.sets.map(set=>({...set}))},id=await saveFlexEntry(
        client,
        {
          id: form.id,
          activityId: form.activityId,
          performedAt: localDateToIso(form.date),
          notes: form.notes,
        },
        selected.trackingType,
        form.sets,
      );
      setSuccess({id,form:saved});setForm(null);
      setError("");
      await load();
      onExitCreate(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Stretch entry could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  const editEntry = (entry: FlexEntry) =>
    setForm({
      id: entry.id,
      activityId: entry.activityId,
      date: localDateKey(entry.performedAt),
      sets: entry.sets,
      notes: entry.notes ?? "",
    });
  const openEditor = (activity?: FlexActivity) => {
    setEditor(activity ?? null);
    setName(activity?.name ?? "");
    setTracking(activity?.trackingType ?? "time");
    setAreas(activity?.areas ?? []);
  };
  if (loading) return <div className="surface-card">Loading Flexibility…</div>;
  const visible = filterFlexibilityActivities(activities, query, area),
    historyResults = {items:entries,total:historyTotal,page:historyPage,pages:Math.max(1,Math.ceil(historyTotal/20)),start:historyTotal?(historyPage-1)*20+1:0,end:Math.min(historyPage*20,historyTotal)};
  if(success&&!form){const activity=activities.find(item=>item.id===success.form.activityId);return <section className="mx-auto max-w-xl"><p className="eyebrow">STRETCH SAVED</p><h1 className="page-title">Entry saved.</h1><div className="surface-card mt-6"><strong>{activity?.name??"Stretch"}</strong><p className="mt-2 text-sm text-slate-600">{success.form.sets.length} set{success.form.sets.length===1?"":"s"}</p></div><EntrySuccessActions onAnother={()=>{setSuccess(null);setForm(blank())}} onEdit={()=>setForm({...success.form,id:success.id,sets:success.form.sets.map(set=>({...set}))})} onDone={()=>setSuccess(null)}/></section>}
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">FLEXIBILITY</p>
          <h1 className="page-title">Flexibility</h1>
        </div>
        <div className="flex gap-2">
          <button
            className="secondary-button"
            onClick={() =>
              document.getElementById("stretch-management")?.scrollIntoView()
            }
          >
            Manage Stretches
          </button>
          <button className="primary-button" onClick={() => setForm(blank())}>
            + Add Stretch Entry
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
            {form.id ? "Edit" : "Add"} Stretch Entry
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Combobox
              autoFocus
              label="Stretch"
              placeholder="Choose stretch"
              value={form.activityId}
              options={activities
                .filter((activity) => !activity.archived)
                .map((activity) => ({
                  value: activity.id,
                  label: activity.name,
                  description: activity.trackingType === "time" ? "Time" : "Reps",
                }))}
              onChange={choose}
            />
            <label className="field-label">
              Date
              <input
                className="field-input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
          </div>
          {selected && (
            <div className="mt-5 space-y-3">
              {form.sets.map((set, index) => (
                <div className="set-card" key={set.id ?? index}>
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-ink">
                      Set {index + 1}
                    </strong>
                    <div>
                      <button
                        className="text-button"
                        onClick={() => duplicate(index)}
                      >
                        Duplicate Set
                      </button>
                      {form.sets.length > 1 && (
                        <button
                          className="text-button text-red"
                          onClick={() => removeSet(index)}
                        >
                          Remove Set
                        </button>
                      )}
                    </div>
                  </div>
                  {selected.trackingType === "time" ? (
                    (() => {
                      const p = durationParts(set.durationSeconds ?? 0);
                      return (
                        <div className="mt-2 max-w-sm">
                          <DurationWheel
                            compact
                            label={`Set ${index + 1} duration`}
                            minutes={p.minutes}
                            seconds={p.seconds}
                            onChange={(v) =>
                              updateSet(index, {
                                ...set,
                                durationSeconds: durationToSeconds(
                                  v.hours,
                                  v.minutes,
                                  v.seconds,
                                ),
                              })
                            }
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <label className="field-label mt-3 max-w-xs">
                      Reps
                      <input
                        className="field-input"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={set.reps ?? ""}
                        onChange={(e) =>
                          updateSet(index, {
                            ...set,
                            reps:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
              <button
                className="secondary-button"
                onClick={() =>
                  setForm({
                    ...form,
                    sets: [
                      ...form.sets,
                      nextSet(selected.trackingType, form.sets.length + 1),
                    ],
                  })
                }
              >
                + Add Set
              </button>
            </div>
          )}
          <label className="field-label mt-4">
            Notes (optional)
            <textarea
              className="field-input min-h-20 py-2"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
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
              disabled={saving || !selected || !navigator.onLine}
              className="primary-button"
              onClick={save}
            >
              {saving ? "Saving…" : "Save Stretch Entry"}
            </button>
          </div>
        </div>
      )}
      {editor !== undefined && (
        <div className="modal-backdrop">
          <div className="sheet">
            <h2 className="font-display text-xl font-bold text-ink">
              {editor ? "Edit" : "Create"} Stretch
            </h2>
            <label className="field-label mt-4">
              Name
              <input
                autoFocus
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="mt-3">
              <Select
                label="Tracking type"
                value={tracking}
                options={[
                  { value: "time", label: "Time" },
                  { value: "reps", label: "Reps" },
                ]}
                onChange={(value) => setTracking(value as FlexTracking)}
              />
            </div>
            <div className="mt-4">
              <MultiSelect
                label="Muscles and body areas"
                values={areas}
                options={bodyAreas.map((bodyArea) => ({
                  value: bodyArea,
                  label: bodyArea,
                }))}
                onChange={setAreas}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="secondary-button"
                onClick={() => setEditor(undefined)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={!name.trim() || !areas.length}
                onClick={async () => {
                  await saveFlexActivity(
                    client,
                    name,
                    tracking,
                    areas,
                    editor?.id,
                  );
                  setEditor(undefined);
                  load();
                }}
              >
                Save Stretch
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_.7fr]">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">History</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="field-label">Search stretch<input className="field-input" value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }} placeholder="Hamstring…" /></label>
            <Combobox label="Body area" value={historyArea} options={[{ value: "", label: "All body areas" }, ...bodyAreas.map((value) => ({ value, label: value }))]} onChange={(value) => { setHistoryArea(value); setHistoryPage(1); }} />
            <Select label="Tracking" value={historyTracking} options={[{ value: "all", label: "Time & Reps" }, { value: "time", label: "Time" }, { value: "reps", label: "Reps" }]} onChange={(value) => { setHistoryTracking(value); setHistoryPage(1); }} />
          </div>
          <div className="mt-3 space-y-3">
            {historyLoading ? <div className="empty-card">Loading matching Stretch entries…</div> : historyResults.items.map((entry) => {
              const total =
                entry.trackingType === "time"
                  ? entry.sets.reduce((n, s) => n + (s.durationSeconds ?? 0), 0)
                  : entry.sets.reduce((n, s) => n + (s.reps ?? 0), 0);
              return (
                <div className="surface-card" key={entry.id}>
                  <div className="flex justify-between gap-2">
                    <div>
                      <strong className="text-ink">{entry.activityName}</strong>
                      <p className="text-xs text-slate-500">
                        {new Date(entry.performedAt).toLocaleDateString()} ·{" "}
                        {entry.sets.length} set
                        {entry.sets.length === 1 ? "" : "s"} ·{" "}
                        {entry.trackingType === "time"
                          ? `${formatDuration(total)} total`
                          : `${total} total reps`}
                      </p>
                    </div>
                    <div>
                      <button
                        className="text-button"
                        onClick={() => editEntry(entry)}
                      >
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
                  <ol className="mt-2 text-xs text-slate-600">
                    {entry.sets.map((s) => (
                      <li key={s.id ?? s.setOrder}>
                        Set {s.setOrder}:{" "}
                        {entry.trackingType === "time"
                          ? formatDuration(s.durationSeconds ?? 0)
                          : `${s.reps} reps`}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-slate-500">
                    {entry.areas.join(", ")}
                  </p>
                </div>
              );
            })}
            {!historyLoading && !historyTotal && (
              <div className="empty-card">No Stretch entries match these filters.</div>
            )}
          </div>
          <Pagination {...historyResults} onChange={setHistoryPage} />
        </div>
        <div id="stretch-management">
          <div className="flex justify-between">
            <h2 className="font-display text-xl font-bold text-ink">
              Manage Stretches
            </h2>
            <button className="secondary-button" onClick={() => openEditor()}>
              + New
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            <input
              aria-label="Search stretches"
              className="field-input"
              placeholder="Search 25 starter stretches"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              label="Filter body area"
              value={area}
              options={[
                { value: "", label: "All body areas" },
                ...bodyAreas.map((bodyArea) => ({
                  value: bodyArea,
                  label: bodyArea,
                })),
              ]}
              onChange={setArea}
            />
          </div>
          <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            {visible.map((activity) => (
              <div
                className="flex min-h-16 items-center gap-2 py-2"
                key={activity.id}
              >
                <div className="min-w-0 flex-1">
                  <strong className="text-sm text-ink">{activity.name}</strong>
                  <p className="text-xs text-slate-500">
                    {activity.trackingType === "time" ? "Time" : "Reps"} ·{" "}
                    {activity.areas.join(", ")}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Edit ${activity.name}`}
                  title="Edit"
                  onClick={() => openEditor(activity)}
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
            ))}
          </div>
        </div>
      </div><ConfirmDialog open={!!deleteEntry} title="Delete this Stretch entry?" description="This permanently removes the selected Stretch entry and refreshes Progress." confirmLabel="Delete Entry" busy={saving} error={error} onCancel={()=>{setDeleteEntry(null);setError("")}} onConfirm={async()=>{if(!deleteEntry)return;setSaving(true);try{await deleteFlexEntry(client,userId,deleteEntry.id);setDeleteEntry(null);await load()}catch{setError("Could not delete this Stretch entry. It is unchanged; try again.")}finally{setSaving(false)}}}>{deleteEntry&&<><strong>{deleteEntry.activityName}</strong><p>{new Date(deleteEntry.performedAt).toLocaleDateString()} · {deleteEntry.sets.length} set{deleteEntry.sets.length===1?'':'s'}</p></>}</ConfirmDialog><ConfirmDialog open={!!deleteActivity} title="Delete this Stretch?" description="A Stretch can only be deleted when no saved entries use it." confirmLabel="Delete Stretch" busy={saving} error={error} onCancel={()=>{setDeleteActivity(null);setError("")}} onConfirm={async()=>{if(!deleteActivity)return;setSaving(true);try{await deleteFlexActivity(client,userId,deleteActivity.id);setDeleteActivity(null);await load()}catch{setError("This Stretch is used by existing entries. Delete those entries before deleting the Stretch.")}finally{setSaving(false)}}}>{deleteActivity&&<strong>{deleteActivity.name}</strong>}</ConfirmDialog>
    </section>
  );
}
