import { FeatureBoundary } from "./components/FeatureBoundary";
import { dataLoadMessage } from "./lib/supabaseError";
import { ReleaseAnnouncement } from "./components/ReleaseAnnouncement";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AuthScreen, ConfigurationScreen } from "./AuthScreen";
import {
  defaultModules,
  type ModuleKey,
  type ModuleState,
} from "./domain/modules";
import { resolveAuthView } from "./lib/authGuard";
import { useAuth } from "./lib/authContext";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  completeOnboarding,
  loadUserSetupWithRetry,
  saveModuleSettings,
} from "./lib/settings";
import { SettingsPanel } from "./features/settings/SettingsPanel";
const LazyStrength = lazy(() =>
    import("./features/strength/StrengthFeature").then((module) => ({
      default: module.StrengthFeature,
    })),
  ),
  LazyCardio = lazy(() =>
    import("./features/cardio/CardioFeature").then((module) => ({
      default: module.CardioFeature,
    })),
  ),
  LazyFlexibility = lazy(() =>
    import("./features/flexibility/FlexibilityFeature").then((module) => ({
      default: module.FlexibilityFeature,
    })),
  ),
  LazyWeight = lazy(() =>
    import("./features/weight/WeightFeature").then((module) => ({
      default: module.WeightFeature,
    })),
  ),
  LazyProgress = lazy(() =>
    import("./features/progress/ProgressFeature").then((module) => ({
      default: module.ProgressFeature,
    })),
  );
const fallback = (
  <div className="surface-card" role="status">
    Loading module…
  </div>
);
const StrengthFeature = (props: ComponentProps<typeof LazyStrength>) => (
    <Suspense fallback={fallback}>
      <LazyStrength {...props} />
    </Suspense>
  ),
  CardioFeature = (props: ComponentProps<typeof LazyCardio>) => (
    <Suspense fallback={fallback}>
      <LazyCardio {...props} />
    </Suspense>
  ),
  FlexibilityFeature = (props: ComponentProps<typeof LazyFlexibility>) => (
    <Suspense fallback={fallback}>
      <LazyFlexibility {...props} />
    </Suspense>
  ),
  WeightFeature = (props: ComponentProps<typeof LazyWeight>) => (
    <Suspense fallback={fallback}>
      <LazyWeight {...props} />
    </Suspense>
  ),
  ProgressFeature = (props: ComponentProps<typeof LazyProgress>) => (
    <Suspense fallback={fallback}>
      <LazyProgress {...props} />
    </Suspense>
  );
import {
  createPath,
  parseAppRoute,
  screenPath,
  type AppScreen,
} from "./domain/routing";

type Screen = AppScreen;

const modules: Record<
  ModuleKey,
  { label: string; icon: string; blurb: string; color: string }
> = {
  strength: {
    label: "Strength",
    icon: "dumbbell",
    blurb: "Sets, reps & actual PRs",
    color: "#d71920",
  },
  cardio: {
    label: "Cardio",
    icon: "pulse",
    blurb: "Runs, rides & intervals",
    color: "#111111",
  },
  flexibility: {
    label: "Flexibility",
    icon: "spark",
    blurb: "Stretches, sets & body areas",
    color: "#8f2025",
  },
  weight: {
    label: "Bodyweight",
    icon: "scale",
    blurb: "Bodyweight trends",
    color: "#4b4b4b",
  },
};

const paths: Record<string, ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6M6 12h12" />
    </>
  ),
  pulse: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m5.6 5.6 2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </>
  ),
  scale: (
    <>
      <path d="M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M8 9a4 4 0 0 1 8 0M12 9l2-2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 15a2 2 0 0 0 .4 2.2l-2.2 2.2A2 2 0 0 0 15 19l-1 .4V22h-4v-2.6L9 19a2 2 0 0 0-2.2.4l-2.2-2.2A2 2 0 0 0 5 15l-.4-1H2v-4h2.6L5 9a2 2 0 0 0-.4-2.2l2.2-2.2A2 2 0 0 0 9 5l1-.4V2h4v2.6l1 .4a2 2 0 0 0 2.2-.4l2.2 2.2A2 2 0 0 0 19 9l.4 1H22v4h-2.6Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6" />
    </>
  ),
};
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 rotate-3 place-items-center rounded-xl bg-red text-white shadow-glow">
        <Icon name="pulse" size={21} />
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight text-ink">
        Progressive <span className="text-red">Overload</span>
      </span>
    </div>
  );
}
const moduleStyle = (color: string) =>
  ({ "--module-color": color }) as CSSProperties;

function Onboarding({ finish }: { finish: (state: ModuleState) => void }) {
  const [step, setStep] = useState(0);
  const [enabled, setEnabled] = useState<ModuleState>(defaultModules);
  return (
    <main className="onboarding-shell">
      <div className="absolute left-6 top-6">
        <Logo />
      </div>
      {step === 0 ? (
        <div className="onboarding-card text-center">
          <div className="mx-auto mb-8 grid size-24 rotate-3 place-items-center rounded-[2rem] bg-red text-white shadow-glow-lg">
            <Icon name="pulse" size={48} />
          </div>
          <p className="eyebrow">YOUR TRAINING, YOUR WAY</p>
          <h1 className="mt-3 font-display text-5xl font-black leading-[.95] tracking-[-.05em] text-ink sm:text-6xl">
            Build momentum.
            <br />
            <span className="text-red">See progress.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-slate-400">
            A focused home for every rep, run, stretch, and milestone. No
            noise—just your next win.
          </p>
          <button
            className="primary-button mt-9 w-full max-w-sm"
            onClick={() => setStep(1)}
          >
            Set up Progressive Overload <Icon name="arrow" />
          </button>
          <p className="mt-5 text-xs text-slate-600">
            Takes less than a minute
          </p>
        </div>
      ) : (
        <div className="onboarding-card w-full max-w-2xl">
          <p className="eyebrow">ONE QUICK STEP</p>
          <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-ink">
            What do you want to track?
          </h1>
          <p className="mt-3 text-slate-400">
            Pick your focus. Change this anytime in Settings.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {(Object.keys(modules) as ModuleKey[]).map((key) => {
              const item = modules[key];
              return (
                <button
                  key={key}
                  onClick={() =>
                    setEnabled({ ...enabled, [key]: !enabled[key] })
                  }
                  className={`module-pick ${enabled[key] ? "module-pick-active" : ""}`}
                  style={moduleStyle(item.color)}
                >
                  <span className="module-icon">
                    <Icon name={item.icon} />
                  </span>
                  <span className="flex-1 text-left">
                    <strong className="block text-ink">{item.label}</strong>
                    <small className="text-slate-500">{item.blurb}</small>
                  </span>
                  <span
                    className={`check ${enabled[key] ? "check-active" : ""}`}
                  >
                    {enabled[key] && <Icon name="check" size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            disabled={!Object.values(enabled).some(Boolean)}
            className="primary-button mt-7 w-full"
            onClick={() => finish(enabled)}
          >
            Start tracking <Icon name="arrow" />
          </button>
          <p className="mt-4 text-center text-xs text-slate-600">
            Choices affect navigation only. Your data is always safe.
          </p>
        </div>
      )}
    </main>
  );
}

function Home({
  enabled,
  go,
  add,
  settings,
}: {
  enabled: ModuleState;
  go: (s: Screen) => void;
  add: () => void;
  settings: () => void;
}) {
  return (
    <section>
      <div className="flex justify-end">
        <button
          className="icon-button"
          onClick={settings}
          aria-label="Open Settings"
        >
          <Icon name="settings" />
        </button>
      </div>
      <p className="eyebrow">{new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}</p>
      <h1 className="page-title">
        Hey, athlete <span className="inline-block animate-wave">👋</span>
      </h1>
      <p className="mt-2 text-sm text-slate-400">Ready to make today count?</p>
      <div className="hero-card mt-8">
        <div className="relative z-10 max-w-md">
          <span className="eyebrow text-white/60">TODAY'S MOVE</span>
          <h2 className="mt-2 font-display text-3xl font-black leading-tight text-white">
            Every entry is a vote for your strongest self.
          </h2>
          <button className="home-log-button mt-6" onClick={add}>
            <Icon name="plus" size={19} /> Log something
          </button>
        </div>
        <div className="hero-rings" />
      </div>
      <div className="mt-9">
        <p className="eyebrow">YOUR MODULES</p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">
          Pick up where you left off
        </h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(modules) as ModuleKey[])
          .filter((k) => enabled[k])
          .map((key) => {
            const item = modules[key];
            return (
              <button
                key={key}
                className="module-card"
                onClick={() => go(key)}
                style={moduleStyle(item.color)}
              >
                <span className="module-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="mt-5 block text-left">
                  <strong className="block font-display text-lg text-ink">
                    {item.label}
                  </strong>
                  <small className="mt-1 block text-slate-500">
                    Open module
                  </small>
                </span>
                <span className="absolute right-4 top-4 text-slate-600">
                  <Icon name="arrow" size={18} />
                </span>
              </button>
            );
          })}
      </div>
    </section>
  );
}

function EmptyScreen({
  screen,
  add,
}: {
  screen: Exclude<Screen, "home" | "settings">;
  add: () => void;
}) {
  const item =
    screen === "progress"
      ? { label: "Progress", icon: "chart" }
      : modules[screen];
  const detail =
    screen === "strength"
      ? "Track sets and reps. PRs here will only reflect actual weight, rep, and relevant distance or lap achievements."
      : screen === "flexibility"
        ? "Stretch names, duration per set, number of sets, and muscles or body areas will live here."
        : screen === "progress"
          ? "Charts and milestones will appear as you log activity."
          : `Log your first ${item.label.toLowerCase()} entry to get started.`;
  return (
    <section>
      <p className="eyebrow">
        {screen === "progress" ? "THE BIG PICTURE" : "TRAINING MODULE"}
      </p>
      <h1 className="page-title">{item.label}</h1>
      <div className="empty-card">
        <div className="empty-icon">
          <Icon name={item.icon} size={34} />
        </div>
        <h2 className="font-display text-2xl font-bold text-ink">
          Nothing here yet
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          {detail}
        </p>
        {screen !== "progress" && (
          <button className="primary-button mt-6" onClick={add}>
            <Icon name="plus" /> Add {item.label} entry
          </button>
        )}
      </div>
    </section>
  );
}

function AddSheet({
  enabled,
  close,
  pick,
}: {
  enabled: ModuleState;
  close: () => void;
  pick: (k: ModuleKey) => void;
}) {
  const active = (Object.keys(modules) as ModuleKey[]).filter(
    (k) => enabled[k],
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={close}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between">
          <div>
            <p className="eyebrow">QUICK ADD</p>
            <h2
              id="add-title"
              className="mt-1 font-display text-2xl font-black text-ink"
            >
              What did you do?
            </h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close">
            <Icon name="close" size={19} />
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {active.map((key) => {
            const item = modules[key];
            return (
              <button
                className="module-pick"
                style={moduleStyle(item.color)}
                key={key}
                onClick={() => pick(key)}
              >
                <span className="module-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="flex-1 text-left font-bold text-ink">
                  {item.label}
                </span>
                <Icon name="arrow" size={17} />
              </button>
            );
          })}
        </div>
        {!active.length && (
          <p className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-slate-400">
            Enable a module in Settings first.
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  const auth = useAuth();
  const initialRoute = parseAppRoute(window.location.pathname);
  const [onboarded, setOnboarded] = useState(false),
    [route, setRoute] = useState(initialRoute),
    [addOpen, setAddOpen] = useState(false);
  const screen = route.screen;
  const [enabled, setEnabled] = useState<ModuleState>(defaultModules),
    [loadedUserId, setLoadedUserId] = useState<string | null>(null),
    [setupError, setSetupError] = useState(""),
    [setupAttempt,setSetupAttempt]=useState(0),
    [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");
  useEffect(() => {
    const update = (event: Event) =>
      setWeightUnit((event as CustomEvent<"lb" | "kg">).detail);
    addEventListener("preferred-weight-unit", update);
    return () => removeEventListener("preferred-weight-unit", update);
  }, []);
  const setupUserId=auth.session?.user.id;
  useEffect(() => {
    if (!setupUserId || !supabase) return;
    let active = true;
    const userId = setupUserId;
    queueMicrotask(()=>{if(active){setLoadedUserId(null);setSetupError("")}});
    loadUserSetupWithRetry(supabase, userId)
      .then((setup) => {
        if (active) {
          setEnabled(setup.modules);
          setOnboarded(setup.onboardingCompleted);
          setWeightUnit(setup.preferredWeightUnit);
          setSetupError("");
        }
      })
      .catch((error) => {
        if (active)
          setSetupError(dataLoadMessage("Account setup",error));
      })
      .finally(() => {
        if (active) setLoadedUserId(userId);
      });
    return () => {
      active = false;
    };
  }, [setupUserId,setupAttempt]);
  const nav = useMemo(
    () => [
      { key: "home" as Screen, label: "Home", icon: "home" },
      ...(Object.keys(modules) as ModuleKey[])
        .filter((k) => enabled[k])
        .map((k) => ({
          key: k as Screen,
          label: modules[k].label,
          icon: modules[k].icon,
        })),
      { key: "progress" as Screen, label: "Progress", icon: "chart" },
    ],
    [enabled],
  );
  useEffect(() => {
    const onPop = () => setRoute(parseAppRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (
    next: ReturnType<typeof parseAppRoute>,
    replace = false,
    state?: unknown,
  ) => {
    const path = next.creating
      ? createPath(next.screen as ModuleKey)
      : screenPath(next.screen);
    window.history[replace ? "replaceState" : "pushState"](
      state ?? {},
      "",
      path,
    );
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const go = (s: Screen) => navigate({ screen: s, creating: false });
  const triggerAdd = (key: ModuleKey) => {
    setAddOpen(false);
    navigate({ screen: key, creating: true }, false, {
      returnTo: window.location.pathname,
    });
  };
  const leaveCreate = (saved = false) => {
    if (saved) {
      navigate({ screen, creating: false }, true);
      return;
    }
    if ((window.history.state as { returnTo?: string } | null)?.returnTo) {
      window.history.back();
      return;
    }
    navigate({ screen, creating: false }, true);
  };
  const authView = resolveAuthView(
    isSupabaseConfigured,
    auth.loading ||
      (Boolean(auth.session) && loadedUserId !== auth.session?.user.id),
    Boolean(auth.session),
  );
  if (authView === "configuration") return <ConfigurationScreen />;
  if (authView === "loading")
    return (
      <main className="onboarding-shell">
        {auth.error&&<div role="alert"><p>{auth.error}</p><button className="primary-button" onClick={auth.retry}>Retry</button></div>}
        <p className="eyebrow">LOADING PROGRESSIVE OVERLOAD…</p>
      </main>
    );
  if (authView === "authentication") return <AuthScreen />;
  if (setupError)
    return (
      <main className="onboarding-shell">
        <div className="auth-card text-center">
          <h1 className="font-display text-2xl font-black text-ink">
            We hit a snag
          </h1>
          <p className="mt-3 text-sm text-slate-400">{setupError}</p><button className="primary-button mt-4" onClick={()=>setSetupAttempt(value=>value+1)}>Retry</button>
        </div>
      </main>
    );
  if (!onboarded)
    return (
      <Onboarding
        finish={async (state) => {
          if (!supabase || !auth.session) return;
          await completeOnboarding(supabase, auth.session.user.id, state);
          setEnabled(state);
          setOnboarded(true);
        }}
      />
    );
  const changeSettings = (next: ModuleState) => {
    const previous = enabled;
    setEnabled(next);
    if (supabase && auth.session)
      saveModuleSettings(supabase, auth.session.user.id, next).catch(() =>
        setEnabled(previous),
      );
  };
  return (
    <div className="app-frame min-h-screen bg-white text-slate-700">
      {supabase&&auth.session&&<ReleaseAnnouncement key={auth.session.user.id} client={supabase} userId={auth.session.user.id} ready={loadedUserId===auth.session.user.id&&!setupError}/>}
      <aside className="sidebar">
        <Logo />
        <nav className="mt-10 flex flex-col gap-1">
          {nav.map((item) => (
            <button
              key={item.key}
              onClick={() => go(item.key)}
              className={`nav-item ${screen === item.key ? "nav-active" : ""}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/[.05] bg-white/[.025] p-4">
          <p className="text-xs font-bold text-ink">Keep showing up.</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Small wins become big changes.
          </p>
        </div>
      </aside>
      <header className="mobile-header">
        <Logo />
        <button
          onClick={() => go("settings")}
          className="icon-button"
          aria-label="Settings"
        >
          <Icon name="settings" />
        </button>
      </header>
      <main className="content"><FeatureBoundary key={`${auth.session?.user.id}:${screen}`}>
        {screen === "home" ? (
          <Home
            enabled={enabled}
            go={go}
            add={() => setAddOpen(true)}
            settings={() => go("settings")}
          />
        ) : screen === "settings" && supabase && auth.session ? (
          <SettingsPanel client={supabase} userId={auth.session.user.id} enabled={enabled} unit={weightUnit} change={changeSettings} onUnitChange={setWeightUnit} open={target=>go(target)} signOut={()=>void auth.signOut()} home={()=>go("home")}/>
        ) : screen === "strength" && supabase && auth.session ? (
          <StrengthFeature
            key={auth.session.user.id}
            client={supabase}
            userId={auth.session.user.id}
            weightUnit={weightUnit}
            create={route.creating}
            onExitCreate={leaveCreate}
          />
        ) : screen === "cardio" && supabase && auth.session ? (
          <CardioFeature
            key={auth.session.user.id}
            client={supabase}
            userId={auth.session.user.id}
            create={route.creating}
            onExitCreate={leaveCreate}
          />
        ) : screen === "flexibility" && supabase && auth.session ? (
          <FlexibilityFeature
            key={auth.session.user.id}
            client={supabase}
            userId={auth.session.user.id}
            create={route.creating}
            onExitCreate={leaveCreate}
          />
        ) : screen === "weight" && supabase && auth.session ? (
          <WeightFeature
            key={auth.session.user.id}
            client={supabase}
            userId={auth.session.user.id}
            unit={weightUnit}
            create={route.creating}
            onExitCreate={leaveCreate}
          />
        ) : screen === "progress" && supabase && auth.session ? (
          <ProgressFeature
            key={auth.session.user.id}
            client={supabase}
            userId={auth.session.user.id}
            enabled={enabled}
            weightUnit={weightUnit}
          />
        ) : (
          <EmptyScreen screen={screen as Exclude<Screen,"home"|"settings">} add={() => setAddOpen(true)} />
        )}
      </FeatureBoundary></main>
      <nav className="bottom-nav">
        {nav.map((item) => (
          <button
            key={item.key}
            onClick={() => go(item.key)}
            className={screen === item.key ? "text-red" : "text-slate-600"}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {addOpen && (
        <AddSheet
          enabled={enabled}
          close={() => setAddOpen(false)}
          pick={triggerAdd}
        />
      )}
    </div>
  );
}
export default App;
