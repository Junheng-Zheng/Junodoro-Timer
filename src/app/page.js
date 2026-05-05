"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import {
  Play,
  X,
  RotateCcw,
  Pause,
  ArrowRight,
  Settings,
  Volume2,
  VolumeX,
  ArrowUpRight,
  PanelLeftClose,
} from "lucide-react";
function formatMMSS(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

const SETTINGS_STORAGE_KEY = "pomodoro.settings.v1";

const DEFAULT_SETTINGS = {
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  muteAllAudio: false,
};

function clampNumber(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeSettings(input) {
  const raw = input ?? {};
  return {
    pomodoroMinutes: clampNumber(raw.pomodoroMinutes, {
      min: 1,
      max: 180,
      fallback: DEFAULT_SETTINGS.pomodoroMinutes,
    }),
    shortBreakMinutes: clampNumber(raw.shortBreakMinutes, {
      min: 1,
      max: 60,
      fallback: DEFAULT_SETTINGS.shortBreakMinutes,
    }),
    longBreakMinutes: clampNumber(raw.longBreakMinutes, {
      min: 1,
      max: 180,
      fallback: DEFAULT_SETTINGS.longBreakMinutes,
    }),
    longBreakInterval: Math.round(
      clampNumber(raw.longBreakInterval, {
        min: 1,
        max: 12,
        fallback: DEFAULT_SETTINGS.longBreakInterval,
      }),
    ),
    autoStartBreaks: Boolean(raw.autoStartBreaks),
    autoStartPomodoros: Boolean(raw.autoStartPomodoros),
    muteAllAudio: Boolean(raw.muteAllAudio),
  };
}

export default function Home() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const stages = useMemo(() => {
    const nextStages = [];
    for (let i = 1; i <= settings.longBreakInterval; i += 1) {
      nextStages.push({
        key: `focus-${i}`,
        label: "Focus",
        seconds: settings.pomodoroMinutes * 60,
      });

      const isLast = i === settings.longBreakInterval;
      nextStages.push({
        key: isLast ? `break-long` : `break-${i}`,
        label: isLast ? "Long break" : "Short break",
        seconds:
          (isLast ? settings.longBreakMinutes : settings.shortBreakMinutes) *
          60,
      });
    }
    return nextStages;
  }, [settings]);

  const [stageIndex, setStageIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(stages[0].seconds);
  const [isRunning, setIsRunning] = useState(false);

  const stage = stages[stageIndex];
  const nextStage = stages[(stageIndex + 1) % stages.length];

  const goToStage = useCallback(
    (nextIndex) => {
      const safeIndex =
        ((nextIndex % stages.length) + stages.length) % stages.length;
      setStageIndex(safeIndex);
      setRemainingSeconds(stages[safeIndex].seconds);
    },
    [stages],
  );

  const skip = useCallback(() => {
    setStageIndex((prev) => {
      const next = (prev + 1) % stages.length;
      setRemainingSeconds(stages[next].seconds);
      return next;
    });
  }, [stages]);

  const resetStage = () => {
    setRemainingSeconds(stage.seconds);
    setIsRunning(false);
  };

  const skipToLastSecond = () => {
    setRemainingSeconds(1);
    setIsRunning(true);
  };
  const skipTo400 = () => {
    setRemainingSeconds(400);
    setIsRunning(true);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const normalized = normalizeSettings(parsed);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(normalized);
      setDraftSettings(normalized);
      setStageIndex(0);
      setRemainingSeconds(normalized.pomodoroMinutes * 60);
      setIsRunning(false);
    } catch {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    if (remainingSeconds <= 0) return;

    const id = window.setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [isRunning, remainingSeconds]);

  const totalForStage = stage.seconds;
  const elapsedInStage = Math.max(0, totalForStage - remainingSeconds);

  const stageOffsets = useMemo(() => {
    let acc = 0;
    return stages.map((s) => {
      const start = acc;
      acc += s.seconds;
      return start;
    });
  }, [stages]);

  const totalCycleSeconds = useMemo(
    () => stages.reduce((sum, s) => sum + s.seconds, 0),
    [stages],
  );

  const overallElapsedLive =
    (stageOffsets[stageIndex] ?? 0) + Math.min(totalForStage, elapsedInStage);

  const [progressRewindElapsed, setProgressRewindElapsed] = useState(null);
  const rewindRafRef = useRef(null);

  const rewindProgressToZero = useCallback(() => {
    const from = overallElapsedLive;
    const durationMs = 450;

    if (rewindRafRef.current) cancelAnimationFrame(rewindRafRef.current);
    setProgressRewindElapsed(from);

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = from * (1 - t);
      setProgressRewindElapsed(next);

      if (t < 1) {
        rewindRafRef.current = requestAnimationFrame(tick);
      } else {
        rewindRafRef.current = null;
        setProgressRewindElapsed(null);
      }
    };

    rewindRafRef.current = requestAnimationFrame(tick);
  }, [overallElapsedLive]);

  useEffect(() => {
    return () => {
      if (rewindRafRef.current) cancelAnimationFrame(rewindRafRef.current);
    };
  }, []);

  const overallElapsedForBar = progressRewindElapsed ?? overallElapsedLive;

  const cardSkewControls = useAnimationControls();
  const clickAudioRef = useRef(null);
  const alarmAudioRef = useRef(null);

  useEffect(() => {
    clickAudioRef.current = new Audio("/click.mp3");
    alarmAudioRef.current = new Audio("/alarm.mp3");
  }, []);

  const playClickSound = useCallback(() => {
    if (settings.muteAllAudio) return;
    const audio = clickAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, [settings.muteAllAudio]);

  const playAlarmSound = useCallback(() => {
    if (settings.muteAllAudio) return;
    const audio = alarmAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, [settings.muteAllAudio]);

  const stopAlarmSound = useCallback(() => {
    const audio = alarmAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const toggleMuteAllAudio = useCallback(() => {
    setSettings((s) => {
      const next = { ...s, muteAllAudio: !s.muteAllAudio };
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      if (next.muteAllAudio) stopAlarmSound();
      return next;
    });
    setDraftSettings((s) => ({ ...s, muteAllAudio: !s.muteAllAudio }));
  }, [stopAlarmSound]);

  const applyDraftSettings = useCallback(() => {
    const normalized = normalizeSettings(draftSettings);

    setSettings(normalized);
    setDraftSettings(normalized);
    try {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    } catch {
      // ignore
    }
    playClickSound();
    stopAlarmSound();
    setIsRunning(false);
    setStageIndex(0);
    setRemainingSeconds(normalized.pomodoroMinutes * 60);
    setIsSettingsOpen(false);
  }, [draftSettings, playClickSound, stopAlarmSound]);

  useEffect(() => {
    if (!isRunning) return;
    if (remainingSeconds !== 0) return;
    playAlarmSound();
    const nextIndex = (stageIndex + 1) % stages.length;
    const next = stages[nextIndex];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRunning(
      next?.label === "Focus"
        ? settings.autoStartPomodoros
        : settings.autoStartBreaks,
    );
    goToStage(nextIndex);
  }, [
    goToStage,
    isRunning,
    playAlarmSound,
    remainingSeconds,
    settings.autoStartBreaks,
    settings.autoStartPomodoros,
    stageIndex,
    stages,
  ]);

  useEffect(() => {
    void cardSkewControls.start({ skewX: -10, transition: { duration: 0 } });
  }, [cardSkewControls]);

  const pulseCardSkew = useCallback(() => {
    void (async () => {
      cardSkewControls.stop();
      await cardSkewControls.start({
        skewX: -8,
        transition: {
          duration: 0.045,
          ease: [0.25, 0.8, 0.25, 1],
        },
      });
      await cardSkewControls.start({
        skewX: -10,
        transition: {
          type: "spring",
          stiffness: 100,
          damping: 10,
          mass: 0.28,
        },
      });
    })();
  }, [cardSkewControls]);

  const Button = ({ children, onClick, variant = "secondary" }) => {
    return (
      <button
        type="button"
        onClick={(e) => {
          playClickSound();
          onClick(e);
        }}
        className={`rounded-3xl group text-black cursor-pointer active:translate-x-0 aspect-square   active:overflow-hidden active:translate-y-0  relative translate-x-[-8px] translate-y-[-8px]  ${variant === "secondary" ? "flex-1" : "flex-1 "}`}
      >
        {Array.from({ length: 8 }, (_, i) => i + 1).map((d) => (
          <div
            key={d}
            className={`absolute inset-0 rounded-3xl opacity-60 border border-white/20 ${variant === "secondary" ? "bg-linear-to-r from-gray-500  via-gray-400 to-gray-200" : "bg-linear-to-r from-orange-600 to-red-600"} z-0`}
            style={{
              transform: `translate(${d}px, ${d}px)`,
            }}
          />
        ))}
        <div
          className={`w-full overflow-hidden h-full relative z-10 flex items-center justify-center ${variant === "secondary" ? "bg-white aspect-square    text-black  border border-gray-100" : "bg-linear-to-r from-red-500 w-full to-orange-600 text-white border aspect-2 border-white/20  "} rounded-3xl `}
        >
          {variant === "primary" && (
            <>
              <div className="hidden md:block top-0 right-0  absolute w-8 h-8 bg-red-500  opacity-60 blur-sm z-0 rounded-full"></div>
              <div className="hidden md:block   bottom-0 left-0  absolute w-8 h-8 bg-red-500  opacity-60  blur-sm z-0 rounded-full"></div>
            </>
          )}
          <div className="bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] rounded-3xl  opacity-20   absolute inset-0 [background-size:2px_2px]" />
          <div className="relative z-10">{children}</div>
        </div>
      </button>
    );
  };

  const SideButton = () => {
    return (
      <div className="rounded-r-full group right-0 translate-x-[8px] z-30  translate-y-[0%]  bottom-[55%] absolute text-black  w-[4px] h-[40px] ">
        {Array.from({ length: 6 }, (_, i) => i + 1).map((d) => (
          <div
            key={d}
            className="absolute inset-0 rounded-[36px] opacity-60  bg-orange-600  z-0"
            style={{
              transform: `translate(${d}px, ${d}px)`,
            }}
          />
        ))}
        <div className="w-full h-full aspect-square relative z-10  border border-white/10 bg-linear-to-r from-orange-500 to-red-600 rounded-full"></div>
      </div>
    );
  };

  return (
    <div className="flex h-dvh cursor-crosshair bg-gray-100  items-center  fixed left-0 top-0 w-full  contrast-90 saturate-100 brightness-95  justify-center font-sans ">
      <div
        className={`fixed md:relative inset-0 md:border-r tracking-tight text-xl  border-gray-100 flex flex-col bg-white font-mono uppercase  h-full z-50 transition-all text-nowrap duration-300 overflow-hidden ${isSettingsOpen ? " translate-x-0 w-full md:w-[420px]" : " -translate-x-full delay-150 w-0"}`}
      >
        {/* <button
            type="button"
            aria-label="Close settings"
            onClick={() => setIsSettingsOpen(false)}
            className="absolute inset-0 bg-black/30"
          /> */}

        <div className="flex border-b flex-col items-end  border-gray-100 justify-end">
          {/* <h2 className="text-lg font-semibold p-5  uppercase">Settings</h2> */}
          <div className="flex w-full ">
            <div className="p-6 w-full  ">Settings</div>
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(false);
                playClickSound();
              }}
              className="flex items-center p-5 cursor-pointer hover:bg-gray-50 justify-center border-l h-full aspect-square border-gray-100 "
            >
              <PanelLeftClose strokeWidth={1.5} />
            </button>
          </div>
          {/* <div className="p-6 border-t border-gray-100">
            <svg
              width="100% "
              height="100%"
              viewBox="0 0 57 9"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.35999 8.73612C2.62399 8.73612 2.00399 8.60412 1.49999 8.34012C1.00399 8.06812 0.627993 7.70012 0.371993 7.23612C0.123993 6.77212 -6.80983e-06 6.24812 -6.80983e-06 5.66412V5.30412H1.58399V5.59212C1.58399 6.09612 1.73199 6.50012 2.02799 6.80412C2.32399 7.10012 2.77599 7.24812 3.38399 7.24812C3.86399 7.24812 4.21999 7.14412 4.45199 6.93612C4.68399 6.72812 4.79999 6.48012 4.79999 6.19212C4.79999 6.00812 4.75599 5.84012 4.66799 5.68812C4.57999 5.52812 4.41999 5.39211 4.18799 5.28012C3.95599 5.16012 3.62399 5.06412 3.19199 4.99212C2.63199 4.89612 2.13199 4.75612 1.69199 4.57212C1.25999 4.38812 0.915993 4.13212 0.659993 3.80412C0.411993 3.46812 0.287993 3.02412 0.287993 2.47212V2.40012C0.287993 1.94411 0.407993 1.53611 0.647993 1.17611C0.887993 0.808115 1.22399 0.520115 1.65599 0.312115C2.09599 0.104115 2.60799 0.000114679 3.19199 0.000114679C3.85599 0.000114679 4.41599 0.120115 4.87199 0.360115C5.32799 0.600115 5.67199 0.920115 5.90399 1.32011C6.14399 1.71212 6.26399 2.13612 6.26399 2.59211V3.02412H4.67999V2.73611C4.67999 2.40012 4.54799 2.10812 4.28399 1.86012C4.02799 1.61211 3.66399 1.48811 3.19199 1.48811C2.79999 1.48811 2.48399 1.57211 2.24399 1.74012C2.01199 1.90012 1.89599 2.12012 1.89599 2.40012C1.89599 2.68812 2.01999 2.92011 2.26799 3.09611C2.52399 3.27211 2.99999 3.42412 3.69599 3.55212C4.57599 3.70412 5.24799 3.97212 5.71199 4.35612C6.17599 4.73212 6.40799 5.28812 6.40799 6.02412V6.16812C6.40799 6.94412 6.13599 7.56812 5.59199 8.04012C5.04799 8.50412 4.30399 8.73612 3.35999 8.73612ZM7.75565 8.56812V0.168115H13.0596V1.68012H9.33965V3.60011H12.9156V5.11212H9.33965V7.05612H13.2036V8.56812H7.75565ZM16.8553 8.56812V1.68012H14.6233V0.168115H20.6713V1.68012H18.4393V8.56812H16.8553ZM24.059 8.56812V1.68012H21.827V0.168115H27.875V1.68012H25.643V8.56812H24.059ZM29.2466 8.56812V7.05612H31.2626V1.68012H29.2466V0.168115H34.8626V1.68012H32.8466V7.05612H34.8626V8.56812H29.2466ZM36.3183 8.56812V0.168115H39.4143L40.3983 7.77612H40.6143V0.168115H42.1983V8.56812H39.1023L38.1183 0.960115H37.9023V8.56812H36.3183ZM46.0779 8.73612C45.5659 8.73612 45.1019 8.61212 44.6859 8.36412C44.2699 8.10812 43.9379 7.72812 43.6899 7.22412C43.4419 6.72012 43.3179 6.09612 43.3179 5.35212V3.38412C43.3179 2.65612 43.4499 2.04012 43.7139 1.53611C43.9859 1.03211 44.3579 0.652115 44.8299 0.396115C45.3019 0.132115 45.8459 0.000114679 46.4619 0.000114679C47.1019 0.000114679 47.6499 0.136115 48.1059 0.408115C48.5619 0.680115 48.9099 1.04812 49.1499 1.51212C49.3899 1.96812 49.5099 2.48012 49.5099 3.04812V3.19212H47.9259V3.04812C47.9259 2.54412 47.7939 2.16412 47.5299 1.90812C47.2739 1.64412 46.9099 1.51212 46.4379 1.51212C45.9979 1.51212 45.6299 1.66012 45.3339 1.95612C45.0459 2.25212 44.9019 2.76812 44.9019 3.50411V5.28012C44.9019 6.57612 45.4299 7.22412 46.4859 7.22412C46.9579 7.22412 47.3139 7.09612 47.5539 6.84012C47.8019 6.58412 47.9259 6.24812 47.9259 5.83212H45.9099V4.32012H49.5099V8.56812H48.0699V7.63212H47.8539C47.7579 7.94412 47.5739 8.20812 47.3019 8.42412C47.0299 8.63212 46.6219 8.73612 46.0779 8.73612ZM53.7856 8.73612C53.0496 8.73612 52.4296 8.60412 51.9256 8.34012C51.4296 8.06812 51.0536 7.70012 50.7976 7.23612C50.5496 6.77212 50.4256 6.24812 50.4256 5.66412V5.30412H52.0096V5.59212C52.0096 6.09612 52.1576 6.50012 52.4536 6.80412C52.7496 7.10012 53.2016 7.24812 53.8096 7.24812C54.2896 7.24812 54.6456 7.14412 54.8776 6.93612C55.1096 6.72812 55.2256 6.48012 55.2256 6.19212C55.2256 6.00812 55.1816 5.84012 55.0936 5.68812C55.0056 5.52812 54.8456 5.39211 54.6136 5.28012C54.3816 5.16012 54.0496 5.06412 53.6176 4.99212C53.0576 4.89612 52.5576 4.75612 52.1176 4.57212C51.6856 4.38812 51.3416 4.13212 51.0856 3.80412C50.8376 3.46812 50.7136 3.02412 50.7136 2.47212V2.40012C50.7136 1.94411 50.8336 1.53611 51.0736 1.17611C51.3136 0.808115 51.6496 0.520115 52.0816 0.312115C52.5216 0.104115 53.0336 0.000114679 53.6176 0.000114679C54.2816 0.000114679 54.8416 0.120115 55.2976 0.360115C55.7536 0.600115 56.0976 0.920115 56.3296 1.32011C56.5696 1.71212 56.6896 2.13612 56.6896 2.59211V3.02412H55.1056V2.73611C55.1056 2.40012 54.9736 2.10812 54.7096 1.86012C54.4536 1.61211 54.0896 1.48811 53.6176 1.48811C53.2256 1.48811 52.9096 1.57211 52.6696 1.74012C52.4376 1.90012 52.3216 2.12012 52.3216 2.40012C52.3216 2.68812 52.4456 2.92011 52.6936 3.09611C52.9496 3.27211 53.4256 3.42412 54.1216 3.55212C55.0016 3.70412 55.6736 3.97212 56.1376 4.35612C56.6016 4.73212 56.8336 5.28812 56.8336 6.02412V6.16812C56.8336 6.94412 56.5616 7.56812 56.0176 8.04012C55.4736 8.50412 54.7296 8.73612 53.7856 8.73612Z"
                fill="black"
              />
            </svg>
          </div> */}
        </div>

        <div className="flex flex-col ">
          <div className="flex flex-col gap-3 p-5 border-b border-gray-100">
            <label className="flex justify-between  items-center gap-2 w-full">
              <span className="text-zinc-600">Focus</span>
              <input
                type="number"
                min={1}
                max={180}
                value={draftSettings.pomodoroMinutes}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    pomodoroMinutes: e.target.value,
                  }))
                }
                className="outline-none focus:none appearance-none text-right w-fit  "
              />
            </label>
            <label className="flex justify-between  items-center gap-2 w-full">
              <span className="text-zinc-600">Short break</span>
              <input
                type="number"
                min={1}
                max={60}
                value={draftSettings.shortBreakMinutes}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    shortBreakMinutes: e.target.value,
                  }))
                }
                className="outline-none focus:none  text-right w-fit  "
              />
            </label>
            <label className="flex justify-between  items-center gap-2 w-full">
              <span className="text-zinc-600">Long break</span>
              <input
                type="number"
                min={1}
                max={180}
                value={draftSettings.longBreakMinutes}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    longBreakMinutes: e.target.value,
                  }))
                }
                className="outline-none focus:none  text-right w-fit  "
              />
            </label>
            <label className="flex justify-between items-center gap-2 w-full">
              <span className="text-zinc-600">Intervals</span>
              <input
                type="number"
                min={1}
                max={12}
                value={draftSettings.longBreakInterval}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    longBreakInterval: e.target.value,
                  }))
                }
                className="outline-none focus:none  text-right w-fit  "
              />
            </label>
          </div>

          {/* <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-700">Auto start breaks</span>
              <input
                type="checkbox"
                checked={Boolean(draftSettings.autoStartBreaks)}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    autoStartBreaks: e.target.checked,
                  }))
                }
                className="h-5 w-5"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-700">Auto start pomodoros</span>
              <input
                type="checkbox"
                checked={Boolean(draftSettings.autoStartPomodoros)}
                onChange={(e) =>
                  setDraftSettings((s) => ({
                    ...s,
                    autoStartPomodoros: e.target.checked,
                  }))
                }
                className="h-5 w-5"
              />
            </label>
          </div> */}
        </div>

        <div className="flex  flex-col ">
          <button
            type="button"
            onClick={() => {
              const normalized = normalizeSettings(draftSettings);

              setSettings(normalized);
              setDraftSettings(normalized);
              try {
                window.localStorage.setItem(
                  SETTINGS_STORAGE_KEY,
                  JSON.stringify(normalized),
                );
              } catch {
                // ignore
              }
              playClickSound();
              stopAlarmSound();
              setIsRunning(false);
              setStageIndex(0);
              setRemainingSeconds(normalized.pomodoroMinutes * 60);
              setIsSettingsOpen(false);
            }}
            className="flex-1 group flex justify-between items-center bg-linear-to-r uppercase cursor-pointer bg-orange-600 px-6 py-4  text-white hover:saturate-110 active:scale-95 transition-all duration-300"
          >
            Apply
            <ArrowUpRight
              className="group-hover:rotate-45 transition-all duration-300"
              strokeWidth={1.5}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftSettings(DEFAULT_SETTINGS);
              setSettings(DEFAULT_SETTINGS);
              try {
                window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
              } catch {
                // ignore
              }
              playClickSound();
              stopAlarmSound();
              setIsRunning(false);
              setStageIndex(0);
              setRemainingSeconds(DEFAULT_SETTINGS.pomodoroMinutes * 60);
              setIsSettingsOpen(false);
            }}
            className=" flex-1 border-b border-gray-100 px-6 group py-4 active:scale-95 transition-all duration-300 uppercase cursor-pointer flex justify-between items-center  hover:bg-gray-50"
          >
            Reset
            <ArrowUpRight
              className="group-hover:rotate-45 transition-all duration-300"
              strokeWidth={1.5}
            />
          </button>
        </div>
      </div>

      <div
        className={`${isSettingsOpen ? "p-6 delay-150" : "p-0"} transition-all duration-300 bg-white w-full h-full`}
      >
        <div
          className={`w-full h-full flex items-center  bg-gray-100 justify-center ${isSettingsOpen ? "rounded-2xl" : "rounded-none"} transition-all duration-300`}
        >
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 1.8,
              ease: "easeInOut",
              repeat: Infinity,
            }}
            style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
            className="relative scale-105  translate-x-[-12px] md:scale-120 "
          >
            {/* <div className="w-[400px] h-[400px] bg-red-500 rounded-full"></div> */}
            <motion.div
              initial={{ skewX: -10 }}
              animate={cardSkewControls}
              className="relative"
            >
              <SideButton />
              {Array.from({ length: 16 }, (_, i) => i + 1).map((d) => (
                <div
                  key={d}
                  className="absolute inset-0 rounded-[36px] bg-linear-to-r opacity-60 from-[#4C4C4C] to-black z-0"
                  style={{
                    transform: `translate(${d}px, ${d}px)`,
                  }}
                />
              ))}
              <div
                style={{ transform: " " }}
                className="rounded-[36px] border overflow-hidden  border-white/10 p-3 bg-linear-to-b from-[#4C4C4C] to-black gap-3  flex flex-col z-20 relative "
              >
                <div className="top-0 left-0  absolute w-10 h-10 bg-white  opacity-60 blur-2xl z-1 rounded-full"></div>
                <div className="top-0 left-0  absolute w-30 h-30 bg-white/80  opacity-60 blur-2xl z-0 rounded-full"></div>
                <div className="bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)]  opacity-20   absolute inset-0 [background-size:2px_2px]" />

                <div className="p-7 border relative  border-white/20 items-center flex flex-col gap-1 justify-center text-6xl rounded-[28px] overflow-hidden bg-linear-to-b from-[#232323] to-black shadow-inner  shadow-black text-white tabular-nums ">
                  <div className="absolute inset-0  z-120 opacity-3 flex justify-between">
                    {Array.from({ length: 80 }, (_, i) => i + 1).map((d) => (
                      <div key={d} className="w-px h-full bg-white "></div>
                    ))}
                  </div>
                  {/* <div className="bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)]  opacity-20   absolute inset-0 [background-size:7px_7px]" /> */}
                  <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white blur-2xl  z-0 rounded-full"></div>

                  <div className="flex justify-between font-semibold uppercase w-full z-10  gap-2">
                    <div className="flex items-center gap-1 ">
                      {stage.label === "Focus" ? (
                        <div className="w-1.5 h-1.5   bg-red-500 z-0 rounded-full"></div>
                      ) : (
                        <div className="w-1.5 h-1.5   bg-lime-500 z-0 rounded-full"></div>
                      )}
                      <p className="text-xs font-mono  tracking-tight">
                        {" "}
                        {stage.label}
                      </p>
                    </div>
                    {/* <div className="flex items-center opacity-90 font-normal gap-1 text-[8px] font-mono  tracking-tight">
                  <ArrowRight className="w-2 h-2 shrink-0" />
                  <p className="text-[8px] font-mono tracking-tight text-right">
                    {nextStage.label}
                  </p>
                </div> */}
                    {/* <p className="text-xs font-mono tracking-tight">
                  {" "}
                  {stageIndex + 1}/{stages.length}
                </p> */}
                  </div>
                  <p className="tracking-tight font-semibold text-shadow-lg shadow-black z-10 font-mono">
                    {" "}
                    {formatMMSS(remainingSeconds)}
                  </p>
                  <div className="flex w-full overflow-hidden min-w-0 pt-2 gap-1">
                    {stages.map((s, i) => {
                      const start = stageOffsets[i] ?? 0;
                      const end = start + s.seconds;
                      const fillRatio =
                        s.seconds > 0
                          ? Math.min(
                              1,
                              Math.max(
                                0,
                                (overallElapsedForBar - start) / s.seconds,
                              ),
                            )
                          : 0;

                      const segmentTransition =
                        progressRewindElapsed != null
                          ? "transition-none"
                          : isRunning && i === stageIndex
                            ? "transition-[width] duration-1000 ease-linear"
                            : "transition-[width] duration-200 ease-out";

                      return (
                        <div
                          key={s.key}
                          className="flex h-5 min-w-0 overflow-hidden rounded-md bg-white/10"
                          style={{ flex: `${s.seconds} 1 0%` }}
                        >
                          <div
                            className={`h-full rounded-md bg-white/30 ${segmentTransition}`}
                            style={{ width: `${fillRatio * 100}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {/* <div className="flex justify-between font-semibold uppercase w-full z-10  gap-2">
                <div className="flex items-center gap-1 ">
                  {stage.label === "Focus" ? (
                    <div className="w-1.5 h-1.5   bg-red-500 z-0 rounded-full"></div>
                  ) : (
                    <div className="w-1.5 h-1.5   bg-lime-500 z-0 rounded-full"></div>
                  )}
                  <p className="text-xs font-mono  tracking-tight">
                    {" "}
                    {stage.label}
                  </p>
                </div>
                <p className="text-xs font-mono tracking-tight">
                  {" "}
                  {stageIndex + 1}/{stages.length}
                </p>
              </div> */}
                </div>

                <div className="flex flex-row items-center gap-3">
                  <Button
                    onClick={() => {
                      pulseCardSkew();
                      rewindProgressToZero();
                      setIsRunning(false);
                      goToStage(0);
                    }}
                  >
                    <X className="w-8 h-8" strokeWidth={3} />
                  </Button>

                  <Button
                    onClick={() => {
                      pulseCardSkew();
                      setIsRunning((r) => {
                        if (!r) stopAlarmSound();
                        return !r;
                      });
                    }}
                    variant="primary"
                  >
                    {isRunning ? (
                      <Pause
                        className="w-8 h-8 text-white fill-white  "
                        strokeWidth={3}
                      />
                    ) : (
                      <Play
                        className="w-8 h-8 text-shadow-md shadow-black fill-white"
                        strokeWidth={0}
                      />
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      pulseCardSkew();
                      resetStage();
                    }}
                  >
                    <RotateCcw className="w-8 h-8 " strokeWidth={3} />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 flex">
        <button
          type="button"
          onClick={() => {
            setIsSettingsOpen(true);
            playClickSound();
          }}
          className=" inline-flex cursor-pointer hover:bg-gray-50 gap-2 border border-gray-100 bg-white/90 w-[68px] h-[68px] text-sm font-medium text-black justify-center items-center  "
        >
          <Settings strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => {
            toggleMuteAllAudio();
            playClickSound();
          }}
          className=" inline-flex cursor-pointer hover:bg-gray-50 gap-2 border border-gray-100 bg-white/90 w-[68px] h-[68px] text-sm font-medium text-black justify-center items-center  "
        >
          {settings.muteAllAudio ? (
            <VolumeX strokeWidth={1.5} />
          ) : (
            <Volume2 strokeWidth={1.5} />
          )}
        </button>
      </div>

      {/* <button
        type="button"
        onClick={() => {
          playClickSound();
          pulseCardSkew();
          skipToLastSecond();
        }}
        className="mt-6 text-xs font-mono text-zinc-500 underline-offset-4 hover:text-zinc-800 underline"
      >
        Skip to last second (test alarm)
      </button>
      <button
        type="button"
        onClick={() => {
          playClickSound();
          pulseCardSkew();
          skipTo400();
        }}
        className="mt-6 text-xs font-mono text-zinc-500 underline-offset-4 hover:text-zinc-800 underline"
      >
        Skip to last second (test alarm)
      </button> */}
    </div>
  );
}
