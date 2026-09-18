import {safeSupabaseDiagnostic} from "../../lib/supabaseError";
import { displayWeight, normalizeReadings } from "../../lib/weightUnits";
import { bodyweightChart, defaultLineStyle, lineType, type LineStyle } from "./chart";
import { readingChanges } from "./readingChanges";
import { niceAxis } from "../../lib/niceAxis";
/* oxlint-disable react/set-state-in-effect -- loading state follows remote requests */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  Legend,
} from "recharts";
import {
  filterReadings,
  monthlyComparison,
  weeklyComparison,
  type Comparison,
  type Reading,
} from "./logic";
import {
  deleteWeighIn,
  getWeightHistoryPage,
  loadWeighIns,
  saveWeighIn,
  type WeighIn,
} from "./repository";
import { localDateKey } from "../strength/logic";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Select } from "../../components/SelectionControls";
import { ChartControls, defaultAxisSettings, paddedDomain, type AxisSettings } from "../../components/ChartControls";
import { WeeklyChangeTable } from "./WeeklyChangeTable";
import { Pagination } from "../../components/Pagination";
import { EntrySuccessActions } from "../../components/EntrySuccessActions";
import { validHistoryPage } from "../../lib/pagedHistory";
import { TimeXAxis } from "../../components/TimeXAxis";
import { fullLocalDateLabel } from "../../lib/timeAxis";
type Form = {
  id?: string;
  unit?: "lb" | "kg";
  originalMeasuredAt?: string;
  date: string;
  time: string;
  period: "morning" | "evening";
  weight: string;
  notes: string;
};
const blank = (): Form => ({
  date: localDateKey(new Date().toISOString()),
  time: new Date().toTimeString().slice(0, 5),
  period: "morning",
  weight: "",
  notes: "",
});
const ComparisonCard = ({
  title,
  value,
  unit,
}: {
  title: string;
  value: Comparison;
  unit: string;
}) => (
  <div className="surface-card">
    <h3 className="font-bold text-ink">{title}</h3>
    {value ? (
      <>
        <p className="mt-2 text-sm text-slate-600">
          {value.startLabel}: {value.start.toFixed(1)} {unit} → {value.endLabel}
          : {value.end.toFixed(1)} {unit}
        </p>
        <strong className="mt-2 block text-ink">
          {value.difference >= 0 ? "+" : ""}
          {value.difference.toFixed(1)} {unit} (
          {value.percentage >= 0 ? "+" : ""}
          {value.percentage.toFixed(1)}%) · {value.direction}
        </strong>
      </>
    ) : (
      <p className="mt-2 text-sm text-slate-500">
        Not enough comparable readings.
      </p>
    )}
  </div>
);
export function WeightFeature({
  client,
  userId,
  unit,
  create = false,
  onExitCreate = () => {},
}: {
  client: SupabaseClient;
  userId: string;
  unit: "lb" | "kg";
  create?: boolean;
  onExitCreate?: (saved?: boolean) => void;
}) {
  const [style,setStyle]=useState<LineStyle>(defaultLineStyle);
  const graphUnit=unit;
  const [items, setItems] = useState<WeighIn[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [form, setForm] = useState<Form | null>(null),
    [saving,setSaving]=useState(false),[success,setSuccess]=useState<{id:string;form:Form}|null>(null),
    [range, setRange] = useState<"3m" | "6m" | "all" | "custom">("3m"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [period, setPeriod] = useState<"both" | "morning" | "evening">("both"),
    [deleteTarget,setDeleteTarget]=useState<Reading|null>(null),
    [deleting,setDeleting]=useState(false),
    [historySearch,setHistorySearch]=useState(""),
    [historyPage,setHistoryPage]=useState(1),
    [historyItems,setHistoryItems]=useState<WeighIn[]>([]),
    [historyTotal,setHistoryTotal]=useState(0),
    [historyLoading,setHistoryLoading]=useState(false),[revision,setRevision]=useState(0);
  const [weightAxes,setWeightAxes]=useState<AxisSettings>({...defaultAxisSettings,range:"3m"});
  const load = useCallback(async () => {
    try {
      // Chart snapshots include comparison evidence outside the visible history page.
      setItems(await loadWeighIns(client,userId));
      setError("");
    } catch (e) {
      safeSupabaseDiagnostic("Bodyweight","load readings",e);
      setError(
        "Bodyweight data could not load. Check your connection and retry.",
      );
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
  const dates = useMemo(() => {
    const now = new Date(),
      from = new Date(now);
    if (range === "3m") from.setMonth(from.getMonth() - 3);
    if (range === "6m") from.setMonth(from.getMonth() - 6);
    return {
      start:
        range === "all"
          ? ""
          : range === "custom"
            ? start
            : localDateKey(from.toISOString()),
      end: range === "custom" ? end : "",
    };
  }, [range, start, end]);
  const visible = filterReadings(items, dates.start, dates.end, period),
    displayUnit = form?.unit ?? unit;
  useEffect(()=>{if(loading)return;let active=true;setHistoryLoading(true);getWeightHistoryPage(client,userId,{page:historyPage,search:historySearch,period,start:dates.start,end:dates.end}).then(result=>{if(!active)return;const valid=validHistoryPage(result.total);setHistoryTotal(result.total);if(historyPage>valid){setHistoryPage(valid);return}setHistoryItems(result.items)}).catch(()=>{if(active)setError("Bodyweight history could not load.")}).finally(()=>{if(active)setHistoryLoading(false)});return()=>{active=false}},[client,userId,historyPage,historySearch,period,dates.start,dates.end,loading,revision]);
  const weeklyReadings=readingChanges(normalizeReadings([...items,...historyItems],unit));
  const historyResults = {items:historyItems,total:historyTotal,page:historyPage,pages:Math.max(1,Math.ceil(historyTotal/20)),start:historyTotal?(historyPage-1)*20+1:0,end:Math.min(historyPage*20,historyTotal)};
  const axisVisible=normalizeReadings(visible,graphUnit),chart=bodyweightChart(axisVisible),weightDomain=paddedDomain(axisVisible.map(item=>item.weight),weightAxes,5);
  const save = async () => {
    if (!form||saving) return;
    const weight = Number(form.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Weight must be a number greater than zero.");
      return;
    }
    setSaving(true);try {
      const entered = new Date(
        `${form.date}T${form.time || "12:00"}:00`,
      ).toISOString();
      const original=form.originalMeasuredAt;
      const measured=original&&localDateKey(original)===form.date&&new Date(original).toTimeString().slice(0,5)===form.time?original:entered;
      const saved={...form},id=await saveWeighIn(
        client,
        userId,
        {
          measured_at: measured,
          period: form.period,
          weight,
          weight_unit: form.unit ?? unit,
          notes: form.notes || null,
        },
        form.id,
      );
      setSuccess({id,form:saved});setForm(null);
      await load();setRevision(value=>value+1);
      onExitCreate(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save weigh-in.");
    }finally{setSaving(false)}
  };
  if (loading) return <div className="surface-card">Loading Bodyweight…</div>;
  if(success&&!form)return <section className="mx-auto max-w-xl"><p className="eyebrow">BODYWEIGHT SAVED</p><h1 className="page-title">Entry saved.</h1><div className="surface-card mt-6"><strong>{displayWeight(Number(success.form.weight),success.form.unit??unit,unit)} {unit}</strong><p className="mt-2 text-sm text-slate-600">{success.form.period==="morning"?"Morning":"Evening"} · {success.form.date}</p></div><EntrySuccessActions onAnother={()=>{setSuccess(null);setForm(blank())}} onEdit={()=>setForm({...success.form,id:success.id})} onDone={()=>setSuccess(null)}/></section>;
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">BODYWEIGHT</p>
          <h1 className="page-title">Bodyweight</h1>
        </div>
        <button className="primary-button" onClick={() => setForm(blank())}>
          + Add Bodyweight Entry
        </button>
      </div>
      {error && (
        <div className="mt-4 rounded-xl border border-red/20 bg-red/5 p-3 text-sm text-red">
          {error}
          <button className="text-button ml-2" onClick={load}>
            Retry
          </button>
        </div>
      )}
      {form && (
        <div className="surface-card mt-6">
          <h2 className="font-display text-xl font-bold text-ink">
            {form.id ? "Edit" : "Add"} Bodyweight Entry
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Weight ({displayUnit})
              <input
                autoFocus
                className="field-input"
                inputMode="decimal"
                type="number"
                min="0"
                step="any"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </label>
            <Select label="Morning or Evening" value={form.period} options={[{value:"morning",label:"Morning"},{value:"evening",label:"Evening"}]} onChange={value=>setForm({...form,period:value as Form["period"]})}/>
            <label className="field-label">
              Date
              <input
                className="field-input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="field-label">
              Time
              <input
                className="field-input"
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
            <label className="field-label sm:col-span-2">
              Notes
              <textarea
                className="field-input min-h-20 py-2"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            <button disabled={saving||!navigator.onLine} className="primary-button" onClick={save}>
              {saving?"Saving…":"Save Bodyweight Entry"}
            </button>
          </div>
        </div>
      )}
      <div className="mt-7 flex flex-wrap gap-2">
        {(["3m", "6m", "all", "custom"] as const).map((r) => (
          <button
            className={range === r ? "primary-button" : "secondary-button"}
            onClick={() => setRange(r)}
            key={r}
          >
            {
              {
                "3m": "Past 3 Months",
                "6m": "Past 6 Months",
                all: "All Time",
                custom: "Custom",
              }[r]
            }
          </button>
        ))}
        <Select className="min-w-52" label="Reading visibility" value={period} options={[{value:"both",label:"Morning & Evening"},{value:"morning",label:"Morning"},{value:"evening",label:"Evening"}]} onChange={value=>{setPeriod(value as typeof period);setHistoryPage(1)}}/>
      </div>
      {range === "custom" && (
        <div className="mt-3 flex gap-3">
          <label className="field-label">
            Start
            <input
              className="field-input"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field-label">
            End
            <input
              className="field-input"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="surface-card mt-5">
        <ChartControls settings={weightAxes} setSettings={setWeightAxes} unit={graphUnit} showRange={false}><Select label="Line Style" value={style} options={[{value:"straight",label:"Straight"},{value:"smooth",label:"Smooth"}]} onChange={value=>setStyle(value as LineStyle)} /></ChartControls>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chart}
            margin={{ top: 10, right: 12, left: -15, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <TimeXAxis dates={chart.map(point=>point.date)} />
            <Legend />
            <YAxis type="number" ticks={!weightAxes.min&&!weightAxes.max?niceAxis(axisVisible.map(item=>item.weight),5).ticks:undefined} domain={weightDomain} unit={` ${graphUnit}`} tick={{ fontSize: 10 }} />
            <Tooltip
              labelFormatter={label=>fullLocalDateLabel(String(label))}
              formatter={(value, name, entry) => [
                `${(() => {const reading=visible.find(row=>row.id===entry.payload.id);return reading?displayWeight(reading.weight,reading.unit,graphUnit):value;})()} ${graphUnit}`,
                name === "Morning" ? "Morning" : "Evening",
              ]}
            />
            <Line
              connectNulls
              type={lineType(style)}
              dataKey="morning"
              name="Morning"
              stroke="#D71920"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              connectNulls
              type={lineType(style)}
              dataKey="evening"
              name="Evening"
              stroke="#111"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <WeeklyChangeTable key={`${userId}:${period}`} readings={items} unit={unit} period={period}/>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ComparisonCard
          title="Week to week"
          value={weeklyComparison(axisVisible)}
          unit={graphUnit}
        />
        <ComparisonCard
          title="Month to month"
          value={monthlyComparison(axisVisible)}
          unit={graphUnit}
        />
      </div>
      <h2 className="mt-8 font-display text-xl font-bold text-ink">
        Recent weigh-ins
      </h2>
      <label className="field-label mt-3">Search Bodyweight history notes<input type="search" className="field-input" value={historySearch} onChange={event=>{setHistorySearch(event.target.value);setHistoryPage(1);}}/></label>
      <div className="mt-3 space-y-2">
        {historyLoading ? <div className="empty-card">Loading matching readings…</div> : historyResults.items.map((x) => (
          <div
            className="flex items-center justify-between gap-2 border-b border-slate-200 py-2"
            key={x.id}
          >
            <div>
              <strong className="text-ink">
                {displayWeight(x.weight,x.unit,unit)} {unit}
              </strong>
              <p className="text-xs capitalize text-slate-500">
                {new Date(x.measuredAt).toLocaleString()} · {x.period}
              </p>
              <p className="text-xs text-slate-600">{weeklyReadings.get(x.id) ? `Week: ${weeklyReadings.get(x.id)!.absolute>=0?"+":""}${Number(weeklyReadings.get(x.id)!.absolute.toFixed(4))} ${unit} (${weeklyReadings.get(x.id)!.percent>=0?"+":""}${weeklyReadings.get(x.id)!.percent.toFixed(2)}%)` : "Week: insufficient comparable data"}</p>
              {x.notes && <p className="text-sm text-slate-600">{x.notes}</p>}
            </div>
            <div>
              <button
                className="text-button"
                onClick={() =>
                  setForm({
                    id: x.id,
                    unit: x.unit,
                    originalMeasuredAt:x.measuredAt,
                    date: localDateKey(x.measuredAt),
                    time: new Date(x.measuredAt).toTimeString().slice(0, 5),
                    period: x.period,
                    weight: String(x.weight),
                    notes: x.notes ?? "",
                  })
                }
              >
                Edit
              </button>
              <button
                className="text-button text-rose-700"
                onClick={() => {setError("");setDeleteTarget(x)}}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!historyLoading&&!historyTotal && (
          <div className="empty-card">No matching readings in this range.</div>
        )}
      </div><Pagination {...historyResults} onChange={setHistoryPage} /><ConfirmDialog open={!!deleteTarget} title="Delete this weigh-in?" description="This permanently removes the selected bodyweight reading and recalculates graphs and statistics." confirmLabel="Delete Weigh-in" busy={deleting} error={error} onCancel={()=>{setDeleteTarget(null);setError("")}} onConfirm={async()=>{if(!deleteTarget)return;setDeleting(true);try{await deleteWeighIn(client,userId,deleteTarget.id);setDeleteTarget(null);await load();setRevision(value=>value+1)}catch{setError("Could not delete this weigh-in. It is unchanged; try again.")}finally{setDeleting(false)}}}>{deleteTarget&&<><strong>{deleteTarget.weight} {deleteTarget.unit}</strong><p className="capitalize text-slate-500">{new Date(deleteTarget.measuredAt).toLocaleString()} · {deleteTarget.period}</p></>}</ConfirmDialog>
    </section>
  );
}
