/* oxlint-disable react/set-state-in-effect -- loading state follows remote requests */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  customComparison,
  filterReadings,
  monthlyComparison,
  summary,
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
import { ChartControls, defaultAxisSettings, paddedDomain, rangeDates, type AxisSettings } from "../../components/ChartControls";
import { calendarChanges, type ChangePeriod } from "./calendarChanges";
import { Pagination } from "../../components/Pagination";
import { EntrySuccessActions } from "../../components/EntrySuccessActions";
import { validHistoryPage } from "../../lib/pagedHistory";
type Form = {
  id?: string;
  date: string;
  time: string;
  period: "morning" | "evening";
  weight: string;
  notes: string;
};
function ChangeTooltip({point,unit}:{point:ChangePeriod;unit:string}){return <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl"><strong>{point.label}{point.partial?" · Partial":""}</strong><p>Average: {point.average.toFixed(2)} {unit}</p><p>Previous: {point.previousAverage===null?"A previous period is required.":`${point.previousAverage.toFixed(2)} ${unit}`}</p><p>Change: {point.change===null?"—":`${point.change>=0?"+":""}${point.change.toFixed(2)} ${unit}`}</p><p>Percent: {point.percentChange===null?"—":`${point.percentChange>=0?"+":""}${point.percentChange.toFixed(2)}%`}</p><p>Measured days: {point.measuredDays}</p></div>}
const blank = (): Form => ({
  date: localDateKey(new Date().toISOString()),
  time: new Date().toTimeString().slice(0, 5),
  period: "morning",
  weight: "",
  notes: "",
});
const Card = ({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number;
  unit: string;
}) => (
  <div className="surface-card">
    <p className="eyebrow">{label}</p>
    <strong className="mt-1 block text-xl text-ink">
      {value === undefined ? "—" : `${value.toFixed(1)} ${unit}`}
    </strong>
  </div>
);
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
    [historyPage,setHistoryPage]=useState(1),
    [historyItems,setHistoryItems]=useState<WeighIn[]>([]),
    [historyTotal,setHistoryTotal]=useState(0),
    [historyLoading,setHistoryLoading]=useState(false);
  const [weightAxes,setWeightAxes]=useState<AxisSettings>({...defaultAxisSettings,range:"3m"}),[changeAxes,setChangeAxes]=useState(defaultAxisSettings),[changeAggregation,setChangeAggregation]=useState<"weekly"|"monthly">("weekly");
  const load = useCallback(async () => {
    try {
      const from=new Date();if(range==="3m")from.setMonth(from.getMonth()-3);if(range==="6m")from.setMonth(from.getMonth()-6);
      setItems(await loadWeighIns(client,userId,{start:range==="all"?undefined:range==="custom"?start:localDateKey(from.toISOString()),end:range==="custom"?end:undefined,period}));
      setError("");
    } catch (e) {
      console.error("Weight load failed", e);
      setError(
        "Bodyweight data could not load. Check your connection and retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [client, userId, range, start, end, period]);
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
    stats = summary(visible);
  useEffect(()=>{if(loading)return;let active=true;setHistoryLoading(true);getWeightHistoryPage(client,userId,{page:historyPage,period,start:dates.start,end:dates.end}).then(result=>{if(!active)return;const valid=validHistoryPage(result.total);setHistoryTotal(result.total);if(historyPage>valid){setHistoryPage(valid);return}setHistoryItems(result.items)}).catch(()=>{if(active)setError("Bodyweight history could not load.")}).finally(()=>{if(active)setHistoryLoading(false)});return()=>{active=false}},[client,userId,historyPage,period,dates.start,dates.end,loading]);
  const historyResults = {items:historyItems,total:historyTotal,page:historyPage,pages:Math.max(1,Math.ceil(historyTotal/20)),start:historyTotal?(historyPage-1)*20+1:0,end:Math.min(historyPage*20,historyTotal)};
  const axisDates=rangeDates(weightAxes),axisVisible=filterReadings(items,axisDates.start,axisDates.end,period),chart = [...new Set(axisVisible.map((x) => x.measuredAt.slice(0, 10)))]
    .sort()
    .map((date) => ({
      date,
      morning: visible.find(
        (x) => x.measuredAt.slice(0, 10) === date && x.period === "morning",
      )?.weight,
      evening: visible.find(
        (x) => x.measuredAt.slice(0, 10) === date && x.period === "evening",
      )?.weight,
    })),changeReadings=filterReadings(items,rangeDates(changeAxes).start,rangeDates(changeAxes).end,period),weeklyCalendar=calendarChanges(changeReadings,"weekly",period),monthlyCalendar=calendarChanges(changeReadings,"monthly",period),changes=changeAggregation==="weekly"?weeklyCalendar:monthlyCalendar,latestChange=changes.at(-1),latestWeek=weeklyCalendar.at(-1),latestMonth=monthlyCalendar.at(-1),weightDomain=paddedDomain(axisVisible.map(item=>item.weight),weightAxes),absoluteDomain=paddedDomain(changes.flatMap(item=>item.change===null?[]:[item.change]),changeAxes),percentDomain=paddedDomain(changes.flatMap(item=>item.percentChange===null?[]:[item.percentChange]),changeAxes);
  const save = async () => {
    if (!form||saving) return;
    const weight = Number(form.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Weight must be a number greater than zero.");
      return;
    }
    setSaving(true);try {
      const measured = new Date(
        `${form.date}T${form.time || "12:00"}:00`,
      ).toISOString();
      const saved={...form},id=await saveWeighIn(
        client,
        userId,
        {
          measured_at: measured,
          period: form.period,
          weight,
          weight_unit: unit,
          notes: form.notes || null,
        },
        form.id,
      );
      setSuccess({id,form:saved});setForm(null);
      await load();
      onExitCreate(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save weigh-in.");
    }finally{setSaving(false)}
  };
  if (loading) return <div className="surface-card">Loading Bodyweight…</div>;
  if(success&&!form)return <section className="mx-auto max-w-xl"><p className="eyebrow">BODYWEIGHT SAVED</p><h1 className="page-title">Entry saved.</h1><div className="surface-card mt-6"><strong>{success.form.weight} {unit}</strong><p className="mt-2 text-sm text-slate-600">{success.form.period==="morning"?"Morning":"Evening"} · {success.form.date}</p></div><EntrySuccessActions onAnother={()=>{setSuccess(null);setForm(blank())}} onEdit={()=>setForm({...success.form,id:success.id})} onDone={()=>setSuccess(null)}/></section>;
  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">BODYWEIGHT</p>
          <h1 className="page-title">Weight</h1>
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
              Weight ({unit})
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
      <div className="surface-card mt-5 h-80">
        <ChartControls settings={weightAxes} setSettings={setWeightAxes} unit={unit} />
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chart}
            margin={{ top: 10, right: 12, left: -15, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis domain={weightDomain} unit={` ${unit}`} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toFixed(1)} ${unit}`,
                name === "morning" ? "Morning" : "Evening",
              ]}
            />
            <Line
              connectNulls={false}
              type="monotone"
              dataKey="morning"
              name="Morning"
              stroke="#D71920"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
            <Line
              connectNulls={false}
              type="monotone"
              dataKey="evening"
              name="Evening"
              stroke="#111"
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={{ r: 3, fill: "#fff" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <section className="mt-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">CALENDAR COMPARISONS</p><h2 className="font-display text-xl font-bold text-ink">Bodyweight Change</h2></div><Select label="Aggregation" value={changeAggregation} options={[{value:"weekly",label:"Weekly"},{value:"monthly",label:"Monthly"}]} onChange={value=>setChangeAggregation(value as typeof changeAggregation)}/></div>
        <div className="grid gap-3 lg:grid-cols-2"><div className="surface-card"><h3 className="font-display font-bold text-ink">Calendar Week-over-Week</h3><div className="mt-3 grid gap-2 sm:grid-cols-3"><Card label="Latest weekly average" value={latestWeek?.average} unit={unit}/><Card label="Previous-week change" value={latestWeek?.change??undefined} unit={unit}/><Card label="Percent change" value={latestWeek?.percentChange??undefined} unit="%"/></div>{latestWeek?.partial&&<p className="mt-2 text-xs text-slate-500">Current week is partial.</p>}</div><div className="surface-card"><h3 className="font-display font-bold text-ink">Calendar Month-over-Month</h3><div className="mt-3 grid gap-2 sm:grid-cols-3"><Card label="Latest monthly average" value={latestMonth?.average} unit={unit}/><Card label="Previous-month change" value={latestMonth?.change??undefined} unit={unit}/><Card label="Percent change" value={latestMonth?.percentChange??undefined} unit="%"/></div>{latestMonth?.partial&&<p className="mt-2 text-xs text-slate-500">Current month is partial.</p>}</div></div>
        <ChartControls settings={changeAxes} setSettings={setChangeAxes} unit={`${unit} / %`} />
        <div className="grid gap-3 sm:grid-cols-3"><Card label={`Latest ${changeAggregation} average`} value={latestChange?.average} unit={unit}/><Card label="Change from previous" value={latestChange?.change??undefined} unit={unit}/><Card label="Percent change" value={latestChange?.percentChange??undefined} unit="%"/></div>
        <p className="text-xs text-slate-500">Daily readings are averaged once per calendar day. Missing days are ignored. A previous adjacent period is required for change.</p>
        <div className="grid gap-4 lg:grid-cols-2"><div className="surface-card h-80"><h3 className="font-display font-bold text-ink">Absolute Change</h3><ResponsiveContainer width="100%" height="90%"><LineChart data={changes}><CartesianGrid stroke="#ddd"/><XAxis dataKey="label" minTickGap={28}/><YAxis domain={absoluteDomain} unit={` ${unit}`}/><ReferenceLine y={0} stroke="#111" strokeWidth={2}/><Tooltip content={({active,payload})=>active&&payload?.[0]?<ChangeTooltip point={payload[0].payload} unit={unit}/>:null}/><Line dataKey="change" stroke="#d71920" strokeWidth={3} connectNulls={false}/></LineChart></ResponsiveContainer></div><div className="surface-card h-80"><h3 className="font-display font-bold text-ink">Percent Change</h3><ResponsiveContainer width="100%" height="90%"><LineChart data={changes}><CartesianGrid stroke="#ddd"/><XAxis dataKey="label" minTickGap={28}/><YAxis domain={percentDomain} unit="%"/><ReferenceLine y={0} stroke="#111" strokeWidth={2}/><Tooltip content={({active,payload})=>active&&payload?.[0]?<ChangeTooltip point={payload[0].payload} unit={unit}/>:null}/><Line dataKey="percentChange" stroke="#111" strokeWidth={3} connectNulls={false}/></LineChart></ResponsiveContainer></div></div>
      </section>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Latest Morning" value={stats?.latestMorning} unit={unit} />
        <Card label="Latest Evening" value={stats?.latestEvening} unit={unit} />
        <Card label="Average" value={stats?.average} unit={unit} />
        <Card label="Highest" value={stats?.highest} unit={unit} />
        <Card label="Lowest" value={stats?.lowest} unit={unit} />
        <Card label="Range Change" value={stats?.change} unit={unit} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ComparisonCard
          title="Week to week"
          value={weeklyComparison(visible)}
          unit={unit}
        />
        <ComparisonCard
          title="Month to month"
          value={monthlyComparison(visible)}
          unit={unit}
        />
        <ComparisonCard
          title="Selected period"
          value={
            dates.start && dates.end
              ? customComparison(visible, dates.start, dates.end)
              : null
          }
          unit={unit}
        />
      </div>
      <h2 className="mt-8 font-display text-xl font-bold text-ink">
        Recent weigh-ins
      </h2>
      <div className="mt-3 space-y-2">
        {historyLoading ? <div className="empty-card">Loading matching readings…</div> : historyResults.items.map((x) => (
          <div
            className="surface-card flex items-center justify-between"
            key={x.id}
          >
            <div>
              <strong className="text-ink">
                {x.weight} {x.unit}
              </strong>
              <p className="text-xs capitalize text-slate-500">
                {new Date(x.measuredAt).toLocaleString()} · {x.period}
              </p>
              {x.notes && <p className="text-sm text-slate-600">{x.notes}</p>}
            </div>
            <div>
              <button
                className="text-button"
                onClick={() =>
                  setForm({
                    id: x.id,
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
        {!visible.length && (
          <div className="empty-card">No readings in this range.</div>
        )}
      </div><Pagination {...historyResults} onChange={setHistoryPage} /><ConfirmDialog open={!!deleteTarget} title="Delete this weigh-in?" description="This permanently removes the selected bodyweight reading and recalculates graphs and statistics." confirmLabel="Delete Weigh-in" busy={deleting} error={error} onCancel={()=>{setDeleteTarget(null);setError("")}} onConfirm={async()=>{if(!deleteTarget)return;setDeleting(true);try{await deleteWeighIn(client,userId,deleteTarget.id);setDeleteTarget(null);await load()}catch{setError("Could not delete this weigh-in. It is unchanged; try again.")}finally{setDeleting(false)}}}>{deleteTarget&&<><strong>{deleteTarget.weight} {deleteTarget.unit}</strong><p className="capitalize text-slate-500">{new Date(deleteTarget.measuredAt).toLocaleString()} · {deleteTarget.period}</p></>}</ConfirmDialog>
    </section>
  );
}
