import {StepsProgress} from '../cardio/StepsProgress';
import {SetsByMuscleGroup} from "../strength/SetsByMuscleGroup";
import {distanceMiles} from "../../lib/distanceUnits";
import {orderPerformed} from "../../lib/performedOrder";
import {StrengthPointMarker} from './StrengthPointMarker';
import {exerciseTableRows,defaultExerciseSort,type ExerciseSort} from './exerciseSort';
import {Pagination} from '../../components/Pagination';
import {lineType,defaultLineStyle,type LineStyle} from '../weight/chart';
import { comparisonWeight, convertWeight, displayWeight, type WeightUnit } from "../../lib/weightUnits";
import { strengthModePoints, isAssistedProgress, strengthModes, selectedStrengthMode, type ModeSelection, type StrengthMode } from "./strengthModes";
import { formatMetric, metricAxis } from "../../lib/metricTicks";
import { detectRepetitionPrs, localDateKey } from "../strength/logic";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { ModuleKey, ModuleState } from "../../domain/modules";
import { dataLoadMessage, relationObject } from "../../lib/supabaseError";
import { WeightFeature } from "../weight/WeightFeature";
import { Combobox, Select } from "../../components/SelectionControls";
import { ChartControls, defaultAxisSettings, paddedDomain, rangeDates } from "../../components/ChartControls";
import { chronological } from "../../lib/history";
import {
  aggregateCardio,
  bestSet,
  normalizeDistance,
  runningMetrics,
  type StrengthPoint,
} from "./logic";
import { defaultStrengthExercise } from "./defaultExercise";
import { loadCardioProgressRows, loadStrengthProgressRows, strengthPrEvidence, strengthExerciseUsage, type StrengthProgressRow } from "./repository";
import { TimeXAxis } from "../../components/TimeXAxis";
import { fullLocalDateLabel } from "../../lib/timeAxis";

type StrengthRow = StrengthProgressRow;
type HistoricalRow = {
  exercise_id: string;
  period_type: "monthly" | "yearly";
  period_start: string;
  weight: number | null;
  reps: number | null;
  exercise: unknown;
};
type CardioRow = {
  id: string;
  performed_at: string;
  created_at?: string;
  duration_seconds: number;
  step_count?:number|null;
  distance: number | null;
  distance_unit: string | null;
  speed: number | null;
  incline: number | null;
  difficulty: number | null;
  activity: unknown;
  location: unknown;
  location_id: string | null;
};
type FlexRow = {
  id: string;
  performed_at: string;
  activity_id: string;
  activity: unknown;
  sets: unknown;
};
type ProgressRows = StrengthRow[] | CardioRow[] | FlexRow[];
type LoadState = { key: string; data: ProgressRows; error: string };

const date = (iso: string) => iso.length===10?iso:localDateKey(iso);
const within = (value: string, start: string, end: string) =>
  (!start || value >= start) && (!end || value <= end);
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

type ParsedStrength = StrengthPoint & {
  id?:string;
  achievement?: string;
  repsOnly?: boolean;
  weightLabel?:string;
  distanceLabel?:string;
  exerciseId: string;
  exerciseName: string;
  locationId: string;
  source: "dated" | "monthly" | "yearly";
  periodLabel: string;
};
function parseStrength(
  rows: StrengthRow[],
  historical: HistoricalRow[] = [], unit:WeightUnit="lb",
): ParsedStrength[] {
  const badges=new Map(detectRepetitionPrs(strengthPrEvidence(rows)).map(pr=>[pr.setKey,pr.kinds[0]]));
  const dated = rows.flatMap((row) => {
    const exercise = relationObject<{ id: string; name: string; progression_direction?:string }>(
        row.exercise,
        "progress.strength.exercise",
      ),
      workout = relationObject<{
        performed_at: string;
        location: { id: string; name: string } | null;
      }>(row.workout, "progress.strength.workout");
    if (!exercise || !workout || !Number.isFinite(Date.parse(workout.performed_at)))
      return [];
    if(exercise.progression_direction==='lower_is_better'&&row.weight==null)return [];
    const distance=row.tracking_type==='distance',rawDistance=row.distance??row.laps??row.duration_seconds;
    if(distance?(rawDistance==null||!Number.isFinite(rawDistance)||rawDistance<0):(row.reps==null||!Number.isInteger(row.reps)||row.reps<1||row.weight!=null&&(!Number.isFinite(row.weight)||row.weight<0)))return [];
    const distanceResult=distance?Number(rawDistance):0;
    const day = date(workout.performed_at);
    return [
      {
        id:row.id,
        progressionDirection:exercise.progression_direction,
        date: day,
        weight: distance?distanceResult:convertWeight(Number(row.weight),(row as StrengthRow).weight_unit??"lb",unit),
        comparisonWeight:distance?(row.distance!=null?normalizeDistance(distanceResult,row.distance_unit??'meters','meters'):distanceResult):comparisonWeight(Number(row.weight),row.weight_unit??"lb"),
        weightLabel:displayWeight(Number(row.weight),(row as StrengthRow).weight_unit??"lb",unit),
        distanceLabel:distance?`${distanceResult} ${row.distance!=null?row.distance_unit??'distance':row.laps!=null?'laps':'seconds'}`:undefined,
        repsOnly: row.weight == null,
        achievement: row.id ? badges.get(row.id) : undefined,
        reps: Number(row.reps),
        location: workout.location?.name ?? null,
        locationId: workout.location?.id ?? "",
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        source: "dated" as const,
        periodLabel: day,
      },
    ];
  });
  const summaries = historical.flatMap((row) => {
    const exercise = relationObject<{ id: string; name: string; progression_direction?:string }>(
      row.exercise,
      "progress.strength.historical.exercise",
    );
    if (!exercise || row.weight == null || row.reps == null) return [];
    const period =
      row.period_type === "yearly"
        ? row.period_start.slice(0, 4)
        : row.period_start.slice(0, 7);
    return [
      {
        date: row.period_start,
        weight: Number(row.weight),
        reps: Number(row.reps),
        location: null,
        locationId: "",
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        source: row.period_type,
        periodLabel: period,
      },
    ];
  });
  return chronological([...dated, ...summaries], (point) => point.date);
}

export function StrengthTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { date?:string;exercise?:string;reps?: number|null; location?: string;displayUnit?:string;repsOnly?:boolean;displayValue?:string };
  }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
       <strong>{payload[0].payload.date?fullLocalDateLabel(payload[0].payload.date):label?fullLocalDateLabel(label):""}</strong>
       <p>{payload[0].payload.exercise}</p>
      {payload.map((item) => (
        <p key={item.name}>
          {item.name}: {item.payload.displayValue??item.value} {item.payload.displayUnit??unit}
          {item.payload.reps != null && !item.payload.repsOnly ? ` × ${item.payload.reps} reps` : ""}
          {item.payload.location ? ` · ${item.payload.location}` : ""}
        </p>
      ))}
    </div>
  );
}

function StrengthTable({
  title,
  periods,
  exercises,
  points,
  yearly,
  unit,
}: {
  title: string;
  periods: string[];
  exercises: Array<[string, string]>;
  points: ParsedStrength[];
  yearly?: boolean;
  unit:string;
}) {
  const [value,setValue]=useState(""),[sort,setSort]=useState<ExerciseSort>(defaultExerciseSort),[page,setPage]=useState(1);
  const result=exerciseTableRows(exercises,points,{periods,yearly,search:value,sort,page}),shown=result.items;
  return (
    <div className="surface-card overflow-x-auto" role="region" aria-label={`${title}; scroll horizontally for all columns`} tabIndex={0}>
      <div className="sticky left-0 flex flex-wrap items-center justify-between gap-2 bg-white">
        <h3 className="font-display font-bold text-ink">{title}</h3>
        <input
          aria-label={`Filter ${title} exercises`}
          className="field-input max-w-64"
          placeholder="Filter exercises"
          value={value}
          onChange={(event) => {setValue(event.target.value);setPage(1);}}
        />
      </div>
      <Select label="Sort exercises" value={sort} options={[{value:"sets",label:"Most Sets"},{value:"alphabetical",label:"Alphabetical"}]} onChange={value=>{setSort(value as ExerciseSort);setPage(1);}}/>
      <p className="mt-2 text-xs text-slate-600">Green = Weight PR &middot; Blue = Rep PR</p>
      <table className="progress-table mt-3">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white">Exercise</th>
            {periods.map((period) => (
              <th key={period}>{period}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(({id,name,count}) => (
            <tr key={id}>
              <th className="sticky left-0 z-10 bg-white">{name}<span className="block text-xs font-normal">{count} sets</span></th>
              {periods.map((period) => {
                const candidate = bestSet(
                  result.points.filter(
                    (point) =>
                      point.exerciseId === id &&
                      (yearly
                        ? point.periodLabel.slice(0, 4)
                        : point.periodLabel.slice(0, 7)) === period &&
                      (yearly || point.source !== "yearly"),
                  ),
                ) as ParsedStrength | undefined;
                return (
                  <td
                    key={period}
                    style={{backgroundColor:candidate?.achievement==="weight"?"#dcfce7":candidate?.achievement==="reps"?"#dbeafe":undefined,color:"#111"}}
                    title={
                      candidate
                        ? candidate.source === "dated"
                          ? `Dated entry: ${candidate.date}`
                          : `Imported ${candidate.source} summary: ${candidate.periodLabel}`
                        : undefined
                    }
                  >
                    {candidate ? (
                      <>
                        {candidate.distanceLabel??(candidate.repsOnly ? `${candidate.reps} reps` : `${candidate.weightLabel??String(candidate.weight)} ${unit}${candidate.progressionDirection==='lower_is_better'?' assistance':''} × ${candidate.reps}`)}
                        {candidate.achievement && <span className="sr-only">{candidate.achievement === "weight" ? "Weight PR" : candidate.achievement === "reps" ? "Rep PR" : "First Entry"}</span>}
                        {candidate.source !== "dated" && (
                          <span className="block text-[10px] text-slate-500">
                            Historical summary
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination {...result} label={`${title} exercise pages`} onChange={setPage}/>
    </div>
  );
}

export function StrengthProgress({
  rows,
  unit,
}: {
  rows: StrengthRow[];
  unit: string;
}) {
  const [modeSelection,setModeSelection]=useState<ModeSelection>(null),[lineStyle,setLineStyle]=useState<LineStyle>(defaultLineStyle),[activeSet,setActiveSet]=useState<string|null>(null);
  const usage = strengthExerciseUsage(rows),
    points = parseStrength(rows,[],unit as WeightUnit),
    exercises = [
      ...new Map(
        usage.map((point) => [point.exerciseId, point.exerciseName]),
      ).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1])),
    [selected, setSelected] = useState<string | null>(null),
    [axes, setAxes] = useState(defaultAxisSettings),
    [location, setLocation] = useState("");
  const automatic=defaultStrengthExercise(usage),axisDates=rangeDates(axes),exercise = selected ?? automatic?.id ?? "",
    tablePoints=points.filter(point=>within(point.date,axisDates.start,axisDates.end)&&(!location||(location==="__none__"?!point.locationId:point.locationId===location))),
    selectedUsage=usage.filter(point=>point.exerciseId===exercise),
    isDistance=selectedUsage[0]?.trackingType==="distance",
    distancePoints=usage.filter(point=>point.exerciseId===exercise&&point.distance!=null&&within(point.date,axisDates.start,axisDates.end)&&(!location||(location==="__none__"?!point.locationId:point.locationId===location))),
    locations = [
      ...new Map(
        usage.filter((point) => point.locationId).map((point) => [point.locationId, point.location!]),
      ).entries(),
    ],
    repsOnly=!isDistance&&!rows.some(row=>row.exercise_id===exercise&&row.weight!=null&&Number.isFinite(row.weight)&&row.weight>=0),
    assisted=isAssistedProgress(rows,exercise),
    requestedMode=selectedStrengthMode(modeSelection,rows,exercise),
    effectiveMode=assisted&&requestedMode==='one'?'repWeight':requestedMode,
    chart=strengthModePoints(rows,exercise,effectiveMode,{start:axisDates.start,end:axisDates.end,location,unit:unit as WeightUnit}),
    activePoint=chart.find(point=>point.id===activeSet),
    chartUnit=isDistance?(distancePoints[0]?.distanceUnit??"distance"):repsOnly?"reps":unit,
    metric=isDistance?'distance' as const:repsOnly?'reps' as const:'weight' as const,
    values=chart.map(point=>point.result),
    strengthDomain=paddedDomain(values,axes,metric==='weight'?5:metric==='reps'?1:0),
    lineLabel=isDistance?'Distance':repsOnly?'Reps':effectiveMode==='one'?'One Rep Max':effectiveMode==='repWeight'?(assisted?'Assistance Progress':'Rep Weight'):'Logged Sets',
    months = Array.from({ length: 12 }, (_, index) => {
      const value = new Date();
      value.setDate(1);
      value.setMonth(value.getMonth() - 11 + index);
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    }),
    years = [...new Set(points.map((point) => point.date.slice(0, 4)))].sort();
  if(!automatic)return <div className="empty-card"><strong className="text-ink">No Strength progress yet</strong><p className="mt-1 text-sm text-slate-500">Log your first lift to start an exercise Progress graph.</p></div>;
  const exerciseName=exercises.find(([id])=>id===exercise)?.[1]??automatic.name;
  return (
    <div className="space-y-5">
      <div className="primary-filters grid gap-3 lg:grid-cols-4">
        <Combobox
          label="Exercise"
          value={exercise}
          options={exercises.map(([id, name]) => ({ value: id, label: name }))}
          onChange={(value)=>{setSelected(value);setModeSelection(null);}}
        />
        <Combobox
          label="Location"
          value={location}
          options={[
            { value: "", label: "All locations" },
            { value: "__none__", label: "No location" },
            ...locations.map(([id, name]) => ({ value: id, label: name })),
          ]}
          onChange={setLocation}
        />
        <Select label="Graph mode" value={effectiveMode} options={strengthModes.filter(option=>!assisted||option.value!=='one').map(option=>({...option,label:assisted&&option.value==='repWeight'?'Assistance Progress':option.label,disabled:(isDistance||repsOnly)&&option.value!=='all'}))} onChange={value=>setModeSelection({exerciseId:exercise,mode:value as StrengthMode})} />
        <div className="lg:col-span-2"><ChartControls settings={axes} setSettings={setAxes} unit={chartUnit}><Select label="Line Style" value={lineStyle} options={[{value:"straight",label:"Straight"},{value:"smooth",label:"Smooth"}]} onChange={value=>setLineStyle(value as LineStyle)}/></ChartControls></div>

      </div>
      <div className="surface-card">
        <h2 className="font-display text-lg font-bold text-ink">
          {exerciseName} Progress
        </h2>
        {effectiveMode==='repWeight'&&<p className="mt-1 text-xs text-slate-500">{assisted?'Less assistance is progress · 4+ reps':'Best weight · 4+ reps'}</p>}
        <div className="mt-3 h-80">
          {chart.length ? (
            <ResponsiveContainer minWidth={0}>
              <LineChart data={chart}>
                <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" />
                <TimeXAxis dates={chart.map(point=>point.date)} values={chart.map(point=>point.id)} dataKey="id" />
                <YAxis ticks={!axes.min&&!axes.max?metricAxis(values,metric).ticks:undefined} tickFormatter={value=>formatMetric(Number(value),metric)} allowDecimals={chartUnit!=="reps"} domain={strengthDomain} unit={` ${chartUnit}`} />
                <Tooltip active={!!activePoint} content={()=><StrengthTooltip active={!!activePoint} unit={chartUnit} payload={activePoint?[{name:lineLabel,value:activePoint.result,payload:activePoint}]:[]}/>} />
                <Legend />
                <Line
                  dataKey="result"
                  name={lineLabel}
                  dot={<StrengthPointMarker unit={chartUnit} onActivate={setActiveSet}/>} activeDot={{r:6}} isAnimationActive={false} type={lineType(lineStyle)}
                  stroke="#d71920"
                  strokeWidth={1.5}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-card">{effectiveMode==="one"?"No valid recorded sets of exactly 1 rep match these date and location filters.":effectiveMode==="repWeight"?"No valid weighted sets of 4 or more reps match these date and location filters.":<>No {exerciseName} entries in this date range or location with valid recorded values.</>}</div>
          )}
        </div>
      </div>
      {activePoint&&<div role="status" aria-live="polite"><StrengthTooltip active unit={chartUnit} payload={[{name:lineLabel,value:activePoint.result,payload:activePoint}]}/><button className="text-button" onClick={()=>setActiveSet(null)}>Close set details</button></div>}
      <SetsByMuscleGroup rows={rows} start={axisDates.start} end={axisDates.end} location={location}/>
      <StrengthTable
        unit={unit}
        title="Monthly — last 12 calendar months"
        periods={months}
        exercises={exercises}
        points={tablePoints}
      />
      <StrengthTable
        unit={unit}
        title="Yearly"
        periods={years}
        exercises={exercises}
        points={tablePoints}
        yearly
      />
    </div>
  );
}

type CardioPoint = {
  id:string;
  performed_at:string;
  created_at?:string;
  date: string;
  name: string;
    location?: string;
  locationId: string;
  duration: number;
  steps?:number;
  distance?: number;
  unit?: string;
  speed?: number;
  pace?: number;
  incline?: number;
  difficulty?: number;
};
export function CardioProgress({ rows }: { rows: CardioRow[] }) {
  const [metric,setMetric]=useState<"duration"|"distance"|"speed"|"pace"|"steps">("duration");
  const points: CardioPoint[] = rows.map((row) => {
      const name =
          relationObject<{ name: string }>(
            row.activity,
            "progress.cardio.activity",
          )?.name ?? "Activity",
        location = relationObject<{ name: string }>(
          row.location,
          "progress.cardio.location",
        )?.name,
        metrics = runningMetrics(
          row.distance ?? undefined,
          row.distance_unit ?? undefined,
          row.duration_seconds,
        );
      return {
        id:row.id,performed_at:row.performed_at,created_at:row.created_at,
        date: date(row.performed_at),
        name,
        location,
        locationId: row.location_id ?? "",
        duration: row.duration_seconds,
        steps:row.step_count??undefined,
        distance: distanceMiles(row.distance,row.distance_unit) ?? undefined,
        unit: "mi",
        speed: metrics?.speedMph ?? row.speed ?? undefined,
        pace: metrics?.paceSecondsPerMile,
        incline: row.incline ?? undefined,
        difficulty: row.difficulty ?? undefined,
      };
    }),
    names = [...new Set(points.map((point) => point.name))].sort(),
    [selected, setSelected] = useState(""),
    [axes, setAxes] = useState(defaultAxisSettings),
    [location, setLocation] = useState(""),
    cardioDates=rangeDates(axes),activity = selected || names[0] || "",
    locations = [...new Map(points.filter((point) => point.locationId).map((point) => [point.locationId, point.location!])).entries()],
    visible = orderPerformed(points.filter(
      (point) => point.name === activity && within(point.date, cardioDates.start, cardioDates.end) && (!location || (location === "__none__" ? !point.locationId : point.locationId === location)),
    )),
    chart = visible.map((point) => ({
      ...point,
      durationMinutes: point.duration / 60,
      paceMinutes: point.pace ? point.pace / 60 : undefined,
    })),
    weekly = aggregateCardio(visible, "week"),
    monthly = aggregateCardio(visible, "month"),metricValues=chart.flatMap(point=>point[metric]===undefined?[]:[point[metric]!]),cardioDomain=paddedDomain(metricValues,axes);
  const table = (title: string, items: ReturnType<typeof aggregateCardio>) => (
    <div className="surface-card overflow-x-auto" role="region" aria-label={`${title}; scroll horizontally for all columns`} tabIndex={0}>
      <h3 className="font-display font-bold text-ink">{title}</h3>
      <table className="progress-table mt-3">
        <thead>
          <tr>
            <th>Period</th>
            <th>Entries</th>
            <th>Duration</th>
            <th>Distance</th>
            <th>Avg speed</th>
            <th>Avg pace</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.period}>
              <th>{item.period}</th>
              <td>{item.entries}</td>
              <td>{duration(item.durationSeconds)}</td>
              <td>{item.distance.toFixed(2)}</td>
              <td>{item.averageSpeed?.toFixed(2) ?? "—"}</td>
              <td>
                {item.averagePace
                  ? duration(Math.round(item.averagePace))
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-4">
        <Combobox
          label="Activity"
          value={activity}
          options={names.map((name) => ({ value: name, label: name }))}
          onChange={setSelected}
        />
        <Combobox label="Metric" value={metric} options={[{value:"duration",label:"Duration"},{value:"distance",label:"Distance"},{value:"speed",label:"Average speed"},{value:"pace",label:"Average pace"},{value:"steps",label:"Steps"}]} onChange={value=>setMetric(value as typeof metric)} />
        <div className="lg:col-span-2"><ChartControls settings={axes} setSettings={setAxes} unit={metric==="steps"?"steps":metric==="duration"?"seconds":metric==="pace"?"seconds/mile":metric==="speed"?"mph":"miles"}/></div>
        <Combobox label="Location" value={location} options={[{ value: "", label: "All locations" }, { value: "__none__", label: "No location" }, ...locations.map(([id, name]) => ({ value: id, label: name }))]} onChange={setLocation} />
      </div>
      {metric==="steps"?<StepsProgress entries={visible} axes={axes}/>:<div className="surface-card">
        <h2 className="font-display text-lg font-bold text-ink">
          {activity} Progress
        </h2>
        <div className="mt-3 h-80">
          {chart.length ? (
            <ResponsiveContainer minWidth={0}>
              <LineChart data={chart}>
                <CartesianGrid stroke="#e5e5e5" />
                <TimeXAxis dates={chart.map(point=>point.date)} />
                <YAxis domain={cardioDomain} ticks={!axes.min&&!axes.max?metricAxis(metricValues,metric).ticks:undefined} tickFormatter={value=>formatMetric(Number(value),metric)} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
                        <strong>
                          {activity} · {fullLocalDateLabel(String(label))}
                        </strong>
                        <p>Performed: {payload[0].payload.performed_at.length>10?new Date(payload[0].payload.performed_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}):"Date only"}</p><p>Duration: {duration(payload[0].payload.duration)}</p>
                        {payload[0].payload.distance != null && (
                          <p>
                            Distance: {payload[0].payload.distance.toFixed(2)}{" "}
                            {payload[0].payload.unit}
                          </p>
                        )}
                        {payload[0].payload.speed != null && (
                          <p>Speed: {payload[0].payload.speed.toFixed(2)}</p>
                        )}
                        {payload[0].payload.pace != null && (
                          <p>
                            Pace:{" "}
                            {duration(Math.round(payload[0].payload.pace))}
                          </p>
                        )}
                        {payload[0].payload.incline != null && (
                          <p>Incline: {payload[0].payload.incline}</p>
                        )}
                        {payload[0].payload.difficulty != null && (
                          <p>Difficulty: {payload[0].payload.difficulty}</p>
                        )}
                        {payload[0].payload.location && (
                          <p>Location: {payload[0].payload.location}</p>
                        )}
                      </div>
                    ) : null
                  }
                />
                <Legend />
                <Line dataKey={metric} name={metric==="pace"?"Average pace (min/mile)":metric==="speed"?"Average speed (mph)":metric==="distance"?"Distance (miles)":"Duration"} stroke="#d71920" strokeWidth={1.5} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-card">No matching Cardio entries.</div>
          )}
        </div>
      </div>
      }
      {table("Weekly totals", weekly)}
      {table("Monthly totals", monthly)}
    </div>
  );
}

export function FlexProgress({ rows }: { rows: FlexRow[] }) {
  const [timeAxes, setTimeAxes] = useState(defaultAxisSettings),
    [repAxes, setRepAxes] = useState(defaultAxisSettings),
    [stretch, setStretch] = useState(""),
    [body, setBody] = useState("");
  const parsed = orderPerformed(rows).map((row) => {
      const activity = relationObject<{
          name: string;
          tracking_type: "time" | "reps";
          areas: { body_area: string }[];
        }>(row.activity, "progress.flex.activity"),
        sets = Array.isArray(row.sets)
          ? (row.sets as {
              duration_seconds: number | null;
              reps: number | null;
            }[])
          : [];
      return {
        date: date(row.performed_at),
        name: activity?.name ?? "Stretch",
        tracking: activity?.tracking_type ?? "time",
        areas: (activity?.areas ?? []).map((value) => value.body_area),
        sets: sets.length,
        time: sets.reduce(
          (sum, value) => sum + (value.duration_seconds ?? 0),
          0,
        ),
        reps: sets.reduce((sum, value) => sum + (value.reps ?? 0), 0),
      };
    }),
    names = [...new Set(parsed.map((value) => value.name))].sort(),
    bodies = [...new Set(parsed.flatMap((value) => value.areas))].sort(),
    flexDates=rangeDates(timeAxes),repDates=rangeDates(repAxes),visible = chronological(parsed.filter(
      (value) =>
        within(value.date, flexDates.start, flexDates.end) &&
        (!stretch || value.name === stretch) &&
        (!body || value.areas.includes(body)),
    ), (value) => value.date),
    timed = visible.filter((value) => value.tracking === "time"),
    repBased = chronological(parsed.filter((value)=>within(value.date,repDates.start,repDates.end)&&(!stretch||value.name===stretch)&&(!body||value.areas.includes(body))&&value.tracking==="reps"),(value)=>value.date);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-2"><ChartControls settings={timeAxes} setSettings={setTimeAxes} unit="seconds"/></div>
        <Combobox
          label="Stretch"
          value={stretch}
          options={[
            { value: "", label: "All stretches" },
            ...names.map((name) => ({ value: name, label: name })),
          ]}
          onChange={setStretch}
        />
        <Combobox
          label="Body area"
          value={body}
          options={[
            { value: "", label: "All body areas" },
            ...bodies.map((name) => ({ value: name, label: name })),
          ]}
          onChange={setBody}
        />
      </div>
      {[
        ["Time stretches", timed, "time"],
        ["Rep stretches", repBased, "reps"],
      ].map(([title, items, kind]) => (
        <div className="surface-card" key={title as string}>
          <h2 className="font-display text-lg font-bold text-ink">
            {title as string}
          </h2>
          {kind === "reps" && <ChartControls settings={repAxes} setSettings={setRepAxes} unit="reps"/>}
          <div className="mt-3 h-64">
            {(items as typeof visible).length ? (
              <ResponsiveContainer minWidth={0}>
                <LineChart data={items as typeof visible}>
                  <CartesianGrid stroke="#e5e5e5" />
                  <TimeXAxis dates={(items as typeof visible).map(item=>item.date)} />
                  <YAxis tickFormatter={value=>formatMetric(Number(value),kind==="time"?"duration":"reps")} allowDecimals={kind!=="reps"} domain={paddedDomain((items as typeof visible).map(item=>kind==="time"?item.time:item.reps),kind==="time"?timeAxes:repAxes)} />
                  <Tooltip labelFormatter={label=>fullLocalDateLabel(String(label))}/>
                  <Legend />
                  <Line
                    dataKey={kind === "time" ? "time" : "reps"}
                    name={
                      kind === "time"
                        ? "Total duration (seconds)"
                        : "Total reps"
                    }
                    stroke="#d71920"
                    strokeWidth={3}
                  />
                  <YAxis yAxisId="sets" orientation="right" width={30} allowDecimals={false} /><Line yAxisId="sets" dataKey="sets" name="Sets" stroke="#111" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-card">
                No matching {kind as string} Stretch entries.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressFeature({
  client,
  userId,
  enabled,
  weightUnit,
}: {
  client: SupabaseClient;
  userId: string;
  enabled: ModuleState;
  weightUnit: "lb" | "kg";
}) {
  const tabs = (Object.keys(enabled) as ModuleKey[]).filter(
      (key) => enabled[key],
    ),
    [choice, setChoice] = useState<ModuleKey>(tabs[0] ?? "strength"),
    selected = tabs.includes(choice) ? choice : tabs[0],
    [state, setState] = useState<LoadState>({ key: "", data: [], error: "" }),
    [attempt,setAttempt]=useState(0),
    key = `${userId}:${selected}`,
    loading = selected !== "weight" && state.key !== key;
  useEffect(() => {
    if (!selected || selected === "weight") return;
    let active = true;
    if(selected==="strength"||selected==="cardio"){
      const request=selected==='strength'?loadStrengthProgressRows(client,userId):loadCardioProgressRows(client,userId);
      request.then(data=>{if(active)setState({key,data,error:""})}).catch(error=>{if(active)setState({key,data:[],error:dataLoadMessage('Progress',error)})});
      return()=>{active=false};
    }
    const query =
      client
              .from("mobility_sessions")
              .select(
                "id,performed_at,created_at,activity_id,activity:mobility_activities!mobility_activity_owned_fk(name,tracking_type,areas:mobility_activity_area_assignments!mobility_area_owned_fk(body_area)),sets:mobility_sets!mobility_sets_session_owned_fk(duration_seconds,reps)",
              )
              .eq("user_id", userId);
    query.then((result) => {
      if (!active) return;
      setState({
        key,
        data: (result.data ?? []) as ProgressRows,
        error: result.error
          ? dataLoadMessage('Progress',result.error)
          : "",
      });
    });
    return () => {
      active = false;
    };
  }, [client, userId, selected, key,attempt]);
  if (!tabs.length)
    return <div className="empty-card">Enable a module to view Progress.</div>;
  return (
    <section>
      <p className="eyebrow">STATISTICS CENTER</p>
      <h1 className="page-title">Progress</h1>
      <div className="progress-tabs mt-5 flex gap-2">
        {tabs.map((tab) => (
          <button
            className={selected === tab ? "primary-button" : "secondary-button"}
            key={tab}
            onClick={() => setChoice(tab)}
          >
            {tab === "weight" ? "Bodyweight" : tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {loading ? (
          <div className="surface-card">Loading Progress…</div>
        ) : state.error ? (
          <div className="surface-card text-red" role="alert">{state.error}<button className="secondary-button mt-3" onClick={()=>{setState({key:'',data:[],error:''});setAttempt(value=>value+1);}}>Retry</button></div>
        ) : selected === "weight" ? (
          <WeightFeature client={client} userId={userId} unit={weightUnit} />
        ) : selected === "strength" ? (
          <StrengthProgress
            rows={state.data as StrengthRow[]}
            unit={weightUnit}
          />
        ) : selected === "cardio" ? (
          <CardioProgress rows={state.data as CardioRow[]} />
        ) : (
          <FlexProgress rows={state.data as FlexRow[]} />
        )}
      </div>
    </section>
  );
}
