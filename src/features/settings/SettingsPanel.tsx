import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleKey, ModuleState } from "../../domain/modules";
import {
  deleteLocation,
  getLocations,
  saveLocation,
  setDefaultLocation,
} from "../strength/repository";
import type { Location } from "../strength/types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { savePreferredWeightUnit } from "../../lib/settings";

const moduleInfo: Record<
  ModuleKey,
  { label: string; description: string; symbol: string; color: string }
> = {
  strength: {
    label: "Strength",
    description: "Lifts, sets, reps, and actual PRs",
    symbol: "◆",
    color: "#d71920",
  },
  cardio: {
    label: "Cardio",
    description: "Runs, rides, intervals, and conditioning",
    symbol: "↗",
    color: "#111111",
  },
  flexibility: {
    label: "Flexibility",
    description: "Timed and repetition-based stretches",
    symbol: "✦",
    color: "#8f2025",
  },
  weight: {
    label: "Weight",
    description: "Morning and evening bodyweight trends",
    symbol: "○",
    color: "#555555",
  },
};

export function SettingsPanel({
  client,
  userId,
  enabled,
  unit,
  change,
  onUnitChange,
  open,
  signOut,
  home,
}: {
  client: SupabaseClient;
  userId: string;
  enabled: ModuleState;
  unit: "lb" | "kg";
  change: (state: ModuleState) => void;
  onUnitChange: (unit: "lb" | "kg") => void;
  open: (screen: "strength" | "cardio" | "flexibility") => void;
  signOut: () => void;
  home: () => void;
}) {
  const [locations, setLocations] = useState<Location[]>([]),
    [locationName, setLocationName] = useState(""),
    [editing, setEditing] = useState<Location | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleteTarget, setDeleteTarget] = useState<Location | null>(null),
    [unitTarget, setUnitTarget] = useState<"lb" | "kg" | null>(null);
  const load = useCallback(async () => {
    try {
      setLocations(await getLocations(client, userId));
      setError("");
    } catch {
      setError("Locations could not load. Check your connection and retry.");
    }
  }, [client, userId]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const save = async () => {
    if (!locationName.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveLocation(client, userId, locationName, editing?.id);
      setLocationName("");
      setEditing(null);
      await load();
    } catch {
      setError(
        "Could not save this location. Use a unique name and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <button className="text-button mb-4" onClick={home}>
        ← Back to Home
      </button>
      <p className="eyebrow">MAKE IT YOURS</p>
      <h1 className="page-title">Settings</h1>
      <div className="mt-7 max-w-3xl space-y-5">
        <section aria-labelledby="module-visibility">
          <h2
            id="module-visibility"
            className="font-display text-xl font-black text-ink"
          >
            Module Visibility
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose what appears in navigation. Your saved data is never deleted.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(Object.keys(moduleInfo) as ModuleKey[]).map((key) => {
              const item = moduleInfo[key];
              return (
                <button
                  role="switch"
                  aria-checked={enabled[key]}
                  aria-label={`${enabled[key] ? "Disable" : "Enable"} ${item.label}`}
                  className={`settings-module ${enabled[key] ? "settings-module-on" : ""}`}
                  style={
                    { "--module-accent": item.color } as React.CSSProperties
                  }
                  onClick={() => change({ ...enabled, [key]: !enabled[key] })}
                  key={key}
                >
                  <span className="settings-module-icon">{item.symbol}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block text-ink">{item.label}</strong>
                    <small className="text-slate-500">{item.description}</small>
                  </span>
                  <span
                    className={`toggle ${enabled[key] ? "toggle-on" : ""}`}
                    aria-hidden="true"
                  >
                    <span />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <details className="settings-accordion">
          <summary>
            Locations <span aria-hidden="true">⌄</span>
          </summary>
          <div className="p-4 pt-1">
            <p className="text-sm text-slate-500">
              Manage workout locations and choose one default.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="field-input"
                aria-label={
                  editing ? "Edit location name" : "New location name"
                }
                placeholder="Home gym"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
              />
              <button
                className="primary-button shrink-0"
                disabled={busy || !locationName.trim()}
                onClick={() => void save()}
              >
                {editing ? "Save Location" : "Add Location"}
              </button>
              {editing && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setEditing(null);
                    setLocationName("");
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red">
                {error}
              </p>
            )}
            <div className="mt-4 divide-y divide-slate-200">
              {locations.map((location) => (
                <div
                  className="flex min-h-14 items-center gap-2 py-2"
                  key={location.id}
                >
                  <div className="min-w-0 flex-1">
                    <strong className="text-sm text-ink">
                      {location.name}
                    </strong>
                    {location.isDefault && (
                      <span className="tag ml-2">Default</span>
                    )}
                  </div>
                  {!location.isDefault && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await setDefaultLocation(client, userId, location.id);
                          await load();
                        } catch {
                          setError("Could not change the default location.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Edit ${location.name}`}
                    onClick={() => {
                      setEditing(location);
                      setLocationName(location.name);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-button text-red"
                    aria-label={`Delete ${location.name}`}
                    onClick={() => {
                      setError("");
                      setDeleteTarget(location);
                    }}
                  >
                    ⌫
                  </button>
                </div>
              ))}
              {!locations.length && (
                <p className="py-5 text-center text-sm text-slate-500">
                  No locations yet. Add one above when you need it.
                </p>
              )}
            </div>
          </div>
        </details>
        <details className="settings-accordion">
          <summary>
            Manage Exercises &amp; Activities <span aria-hidden="true">⌄</span>
          </summary>
          <div className="grid gap-3 p-4 pt-1 sm:grid-cols-3">
            {[
              [
                "strength",
                "◆",
                "Strength Exercises",
                "Names, tracking, muscles, and compound status",
              ],
              [
                "cardio",
                "↗",
                "Cardio Activities",
                "Activities available while logging Cardio",
              ],
              ["flexibility", "✦", "Stretches", "Tracking type and body areas"],
            ].map(([screen, symbol, title, description]) => (
              <button
                className="management-link"
                onClick={() =>
                  open(screen as "strength" | "cardio" | "flexibility")
                }
                key={screen}
              >
                <span aria-hidden="true">{symbol}</span>
                <strong>{title}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </details>
        <section className="surface-card">
          <h2 className="font-bold text-ink">Preferred Units</h2>
          <p className="mt-2 text-sm text-slate-500">
            This controls new entries and default labels. Existing weigh-ins
            retain their recorded unit and values are never silently
            reinterpreted.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className={unit === "lb" ? "primary-button" : "secondary-button"}
              onClick={() => unit !== "lb" && setUnitTarget("lb")}
            >
              Pounds (lb)
            </button>
            <button
              className={unit === "kg" ? "primary-button" : "secondary-button"}
              onClick={() => unit !== "kg" && setUnitTarget("kg")}
            >
              Kilograms (kg)
            </button>
          </div>
        </section>
        <div className="surface-card flex items-center justify-between">
          <div>
            <strong className="block text-ink">Signed in</strong>
            <span className="text-xs text-slate-500">
              Progressive Overload predeployment build
            </span>
          </div>
          <button className="secondary-button" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this location?"
        description="This permanently removes the location. Entries that use it may prevent deletion or retain their history safely."
        confirmLabel="Delete Location"
        busy={busy}
        error={error}
        onCancel={() => {
          setDeleteTarget(null);
          setError("");
        }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setBusy(true);
          setError("");
          try {
            await deleteLocation(client, userId, deleteTarget.id);
            setDeleteTarget(null);
            await load();
          } catch {
            setError(
              "This location is used by existing entries. Change those entries before deleting it.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {deleteTarget && <strong>{deleteTarget.name}</strong>}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!unitTarget}
        title="Change preferred units?"
        description="New Strength and bodyweight entries will default to this unit. Existing recorded values keep their original numbers and stored units."
        confirmLabel="Change Units"
        destructive={false}
        busy={busy}
        error={error}
        onCancel={() => {
          setUnitTarget(null);
          setError("");
        }}
        onConfirm={async () => {
          if (!unitTarget) return;
          setBusy(true);
          setError("");
          try {
            await savePreferredWeightUnit(client, userId, unitTarget);
            onUnitChange(unitTarget);
            setUnitTarget(null);
          } catch {
            setError("Could not save your unit preference. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
