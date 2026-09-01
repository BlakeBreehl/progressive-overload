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
import { relationObject } from "../../lib/supabaseError";
import { WeightFeature } from "../weight/WeightFeature";
import { Combobox } from "../../components/SelectionControls";
import { ChartControls, defaultAxisSettings, paddedDomain, rangeDates } from "../../components/ChartControls";
import { chronological } from "../../lib/history";
import {
  aggregateCardio,
  bestSet,
  runningMetrics,
  type StrengthPoint,
} from "./logic";
import { defaultStrengthExercise } from "./defaultExercise";
import { loadStrengthProgressRows, strengthExerciseUsage, type StrengthProgressRow } from "./repository";
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
  duration_seconds: number;
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

const date = (iso: string) => iso.slice(0, 10);
const within = (value: string, start: string, end: string) =>
  (!start || value >= start) && (!end || value <= end);
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

type ParsedStrength = StrengthPoint & {
  exerciseId: string;
  exerciseName: string;
  locationId: string;
  source: "dated" | "monthly" | "yearly";
  periodLabel: string;
};
function parseStrength(
  rows: StrengthRow[],
  historical: HistoricalRow[] = [],
): ParsedStrength[] {
  const dated = rows.flatMap((row) => {
    const exercise = relationObject<{ id: string; name: string }>(
        row.exercise,
        "progress.strength.exercise",
      ),
      workout = relationObject<{
        performed_at: string;
        location: { id: string; name: string } | null;
      }>(row.workout, "progress.strength.workout");
    if (!exercise || !workout || row.weight == null || row.reps == null)
      return [];
    const day = date(workout.performed_at);
    return [
      {
        date: day,
        weight: Number(row.weight),
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
    const exercise = relationObject<{ id: string; name: string }>(
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

function StrengthTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { reps?: number; location?: string };
  }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
       <strong>{label?fullLocalDateLabel(label):""}</strong>
      {payload.map((item) => (
        <p key={item.name}>
          {item.name}: {item.value} {unit}
          {item.payload.reps != null ? ` × ${item.payload.reps}` : ""}
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
}: {
  title: string;
  periods: string[];
  exercises: Array<[string, string]>;
  points: ParsedStrength[];
  yearly?: boolean;
}) {
  const [value, setValue] = useState("");
  const shown = exercises.filter(([, name]) =>
    name.toLowerCase().includes(value.toLowerCase()),
  );
  return (
    <div className="surface-card overflow-x-auto">
      <div className="sticky left-0 flex flex-wrap items-center justify-between gap-2 bg-white">
        <h3 className="font-display font-bold text-ink">{title}</h3>
        <input
          aria-label={`Filter ${title} exercises`}
          className="field-input max-w-64"
          placeholder="Filter exercises"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
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
          {shown.map(([id, name]) => (
            <tr key={id}>
              <th className="sticky left-0 z-10 bg-white">{name}</th>
              {periods.map((period) => {
                const candidate = bestSet(
                  points.filter(
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
                        {candidate.weight} × {candidate.reps}
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
    </div>
  );
}

function StrengthProgress({
  rows,
  unit,
}: {
  rows: StrengthRow[];
  unit: string;
}) {
  const usage = strengthExerciseUsage(rows),
    points = parseStrength(rows),
    exercises = [
      ...new Map(
        usage.map((point) => [point.exerciseId, point.exerciseName]),
      ).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1])),
    [selected, setSelected] = useState<string | null>(null),
    [axes, setAxes] = useState(defaultAxisSettings),
    [location, setLocation] = useState("");
  const automatic=defaultStrengthExercise(usage),axisDates=rangeDates(axes),exercise = selected ?? automatic?.id ?? "",
    selectedUsage=usage.filter(point=>point.exerciseId===exercise),
    isDistance=selectedUsage[0]?.trackingType==="distance",
    selectedPoints = points.filter(
      (point) =>
        (!exercise || point.exerciseId === exercise) &&
        within(point.date, axisDates.start, axisDates.end) &&
        (!location || (location === "__none__" ? !point.locationId : point.locationId === location)),
    ),
    distancePoints=usage.filter(point=>point.exerciseId===exercise&&point.distance!=null&&within(point.date,axisDates.start,axisDates.end)&&(!location||(location==="__none__"?!point.locationId:point.locationId===location))),
    locations = [
      ...new Map(
        usage.filter((point) => point.locationId).map((point) => [point.locationId, point.location!]),
      ).entries(),
    ],
    chart: Array<{date:string;result:number;reps?:number;location?:string|null}> = isDistance ? distancePoints.map(point=>({date:point.date,result:Number(point.distance),reps:point.laps??undefined,location:point.location})) : selectedPoints.map((point) => ({date:point.date,result:point.weight,reps:point.reps,location:point.location})),chartUnit=isDistance?(distancePoints[0]?.distanceUnit??"distance"):unit,strengthDomain=paddedDomain(chart.map(point=>point.result),axes),
    months = Array.from({ length: 12 }, (_, index) => {
      const value = new Date();
      value.setMonth(value.getMonth() - 11 + index);
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    }),
    years = [...new Set(points.map((point) => point.date.slice(0, 4)))].sort();
  if(!automatic)return <div className="empty-card"><strong className="text-ink">No Strength progress yet</strong><p className="mt-1 text-sm text-slate-500">Log your first lift to start an exercise Progress graph.</p></div>;
  const exerciseName=exercises.find(([id])=>id===exercise)?.[1]??automatic.name;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-4">
        <Combobox
          label="Exercise"
          value={exercise}
          options={exercises.map(([id, name]) => ({ value: id, label: name }))}
          onChange={(value)=>setSelected(value)}
        />
        <div className="lg:col-span-2"><ChartControls settings={axes} setSettings={setAxes} unit={unit}/></div>
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
      </div>
      <div className="surface-card">
        <h2 className="font-display text-lg font-bold text-ink">
          {exerciseName} Progress
        </h2>
        <div className="mt-3 h-80">
          {chart.length ? (
            <ResponsiveContainer>
              <LineChart data={chart}>
                <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" />
                <TimeXAxis dates={chart.map(point=>point.date)} />
                <YAxis domain={strengthDomain} unit={` ${chartUnit}`} />
                <Tooltip content={<StrengthTooltip unit={chartUnit} />} />
                <Legend />
                <Line
                  dataKey="result"
                  name={isDistance ? "Actual recorded distance" : "Actual recorded set"}
                  stroke="#d71920"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-card">No {exerciseName} entries in this date range.</div>
          )}
        </div>
      </div>
      <StrengthTable
        title="Monthly — last 12 calendar months"
        periods={months}
        exercises={exercises}
        points={points}
      />
      <StrengthTable
        title="Yearly"
        periods={years}
        exercises={exercises}
        points={points}
        yearly
      />
    </div>
  );
}

type CardioPoint = {
  date: string;
  name: string;
    location?: string;
  locationId: string;
  duration: number;
  distance?: number;
  unit?: string;
  speed?: number;
  pace?: number;
  incline?: number;
  difficulty?: number;
};
function CardioProgress({ rows }: { rows: CardioRow[] }) {
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
        date: date(row.performed_at),
        name,
        location,
        locationId: row.location_id ?? "",
        duration: row.duration_seconds,
        distance: metrics?.distanceMiles ?? row.distance ?? undefined,
        unit: metrics ? "miles" : (row.distance_unit ?? undefined),
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
    visible = chronological(points.filter(
      (point) => point.name === activity && within(point.date, cardioDates.start, cardioDates.end) && (!location || (location === "__none__" ? !point.locationId : point.locationId === location)),
    ), (point) => point.date),
    chart = visible.map((point) => ({
      ...point,
      durationMinutes: point.duration / 60,
      paceMinutes: point.pace ? point.pace / 60 : undefined,
    })),
    weekly = aggregateCardio(visible, "week"),
    monthly = aggregateCardio(visible, "month"),cardioDomain=paddedDomain(chart.flatMap(point=>[point.durationMinutes,point.distance,point.speed,point.paceMinutes].filter((value):value is number=>value!==undefined)),axes);
  const table = (title: string, items: ReturnType<typeof aggregateCardio>) => (
    <div className="surface-card overflow-x-auto">
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
        <div className="lg:col-span-2"><ChartControls settings={axes} setSettings={setAxes} unit="metric value"/></div>
        <Combobox label="Location" value={location} options={[{ value: "", label: "All locations" }, { value: "__none__", label: "No location" }, ...locations.map(([id, name]) => ({ value: id, label: name }))]} onChange={setLocation} />
      </div>
      <div className="surface-card">
        <h2 className="font-display text-lg font-bold text-ink">
          {activity} Progress
        </h2>
        <div className="mt-3 h-80">
          {chart.length ? (
            <ResponsiveContainer>
              <LineChart data={chart}>
                <CartesianGrid stroke="#e5e5e5" />
                <TimeXAxis dates={chart.map(point=>point.date)} />
                <YAxis domain={cardioDomain} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
                        <strong>
                          {activity} · {fullLocalDateLabel(String(label))}
                        </strong>
                        <p>Duration: {duration(payload[0].payload.duration)}</p>
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
                <Line
                  dataKey="durationMinutes"
                  name="Duration (minutes)"
                  stroke="#111"
                />
                <Line
                  dataKey="distance"
                  name="Distance"
                  stroke="#d71920"
                  strokeWidth={3}
                />
                <Line dataKey="speed" name="Average speed" stroke="#8f2025" />
                <Line dataKey="paceMinutes" name="Average pace" stroke="#555" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-card">No matching Cardio entries.</div>
          )}
        </div>
      </div>
      {table("Weekly totals", weekly)}
      {table("Monthly totals", monthly)}
    </div>
  );
}

function FlexProgress({ rows }: { rows: FlexRow[] }) {
  const [timeAxes, setTimeAxes] = useState(defaultAxisSettings),
    [repAxes, setRepAxes] = useState(defaultAxisSettings),
    [stretch, setStretch] = useState(""),
    [body, setBody] = useState("");
  const parsed = rows.map((row) => {
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
              <ResponsiveContainer>
                <LineChart data={items as typeof visible}>
                  <CartesianGrid stroke="#e5e5e5" />
                  <TimeXAxis dates={(items as typeof visible).map(item=>item.date)} />
                  <YAxis domain={paddedDomain((items as typeof visible).map(item=>kind==="time"?item.time:item.reps),kind==="time"?timeAxes:repAxes)} />
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
                  <Line dataKey="sets" name="Sets" stroke="#111" />
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
    key = `${userId}:${selected}`,
    loading = selected !== "weight" && state.key !== key;
  useEffect(() => {
    if (!selected || selected === "weight") return;
    let active = true;
    if(selected==="strength"){
      loadStrengthProgressRows(client,userId).then(data=>{if(active)setState({key,data,error:""})}).catch(()=>{if(active)setState({key,data:[],error:"Progress data could not load. Check your connection and retry."})});
      return()=>{active=false};
    }
    const query =
      selected === "cardio"
          ? client
              .from("cardio_sessions")
              .select(
                "id,performed_at,duration_seconds,distance,distance_unit,speed,incline,difficulty,location_id,activity:cardio_activities!cardio_activity_owned_fk(name),location:locations!cardio_location_owned_fk(name)",
              )
              .eq("user_id", userId)
          : client
              .from("mobility_sessions")
              .select(
                "id,performed_at,activity_id,activity:mobility_activities!mobility_activity_owned_fk(name,tracking_type,areas:mobility_activity_area_assignments!mobility_area_owned_fk(body_area)),sets:mobility_sets!mobility_sets_session_owned_fk(duration_seconds,reps)",
              )
              .eq("user_id", userId);
    query.then((result) => {
      if (!active) return;
      setState({
        key,
        data: (result.data ?? []) as ProgressRows,
        error: result.error
          ? "Progress data could not load. Check your connection and retry."
          : "",
      });
    });
    return () => {
      active = false;
    };
  }, [client, userId, selected, key]);
  if (!tabs.length)
    return <div className="empty-card">Enable a module to view Progress.</div>;
  return (
    <section>
      <p className="eyebrow">STATISTICS CENTER</p>
      <h1 className="page-title">Progress</h1>
      <div className="mt-5 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            className={selected === tab ? "primary-button" : "secondary-button"}
            key={tab}
            onClick={() => setChoice(tab)}
          >
            {tab === "weight" ? "Weight" : tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {loading ? (
          <div className="surface-card">Loading Progress…</div>
        ) : state.error ? (
          <div className="surface-card text-red">{state.error}</div>
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
