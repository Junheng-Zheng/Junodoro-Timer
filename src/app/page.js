"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Play, X, RotateCcw, Pause, ArrowRight } from "lucide-react";
function formatMMSS(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function Home() {
  const stages = useMemo(
    () => [
      { key: "focus-1", label: "Focus", seconds: 25 * 60 },
      { key: "break-1", label: "Short break", seconds: 5 * 60 },
      { key: "focus-2", label: "Focus", seconds: 25 * 60 },
      { key: "break-2", label: "Short break", seconds: 5 * 60 },
      { key: "focus-3", label: "Focus", seconds: 25 * 60 },
      { key: "break-3", label: "Short break", seconds: 5 * 60 },
      { key: "focus-4", label: "Focus", seconds: 25 * 60 },
      { key: "break-4", label: "Long break", seconds: 15 * 60 },
    ],
    [],
  );

  const [stageIndex, setStageIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(stages[0].seconds);
  const [isRunning, setIsRunning] = useState(false);

  const stage = stages[stageIndex];
  const nextStage = stages[(stageIndex + 1) % stages.length];

  const goToStage = (nextIndex) => {
    const safeIndex =
      ((nextIndex % stages.length) + stages.length) % stages.length;
    setStageIndex(safeIndex);
    setRemainingSeconds(stages[safeIndex].seconds);
  };

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

  useEffect(() => {
    if (!isRunning) return;
    if (remainingSeconds <= 0) return;

    const id = window.setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [isRunning, remainingSeconds]);

  const totalForStage = stage.seconds;
  const progress =
    totalForStage > 0 ? (totalForStage - remainingSeconds) / totalForStage : 0;

  const cardSkewControls = useAnimationControls();
  const clickAudioRef = useRef(null);
  const alarmAudioRef = useRef(null);

  useEffect(() => {
    clickAudioRef.current = new Audio("/click.mp3");
    alarmAudioRef.current = new Audio("/alarm.mp3");
  }, []);

  const playClickSound = useCallback(() => {
    const audio = clickAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, []);

  const playAlarmSound = useCallback(() => {
    const audio = alarmAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, []);

  const stopAlarmSound = useCallback(() => {
    const audio = alarmAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    if (remainingSeconds !== 0) return;
    playAlarmSound();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRunning(false);
    skip();
  }, [isRunning, remainingSeconds, playAlarmSound, skip]);

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
          className={`w-full overflow-hidden h-full relative z-10 flex items-center justify-center ${variant === "secondary" ? "bg-white aspect-square    text-black  border border-black/10" : "bg-linear-to-r from-red-500 w-full to-orange-600 text-white border aspect-2 border-white/20  "} rounded-3xl `}
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
    <div className="flex h-dvh flex-col items-center  fixed left-0 top-0 w-full  saturate-90 brightness-95  justify-center  px-6 font-sans ">
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

            <div className="p-6 border relative  border-white/20 items-center flex flex-col gap-1 justify-center text-6xl rounded-[28px] overflow-hidden bg-linear-to-b from-[#232323] to-black shadow-inner  shadow-black text-white tabular-nums ">
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
                <div className="flex items-center opacity-90 font-normal gap-1 text-[8px] font-mono  tracking-tight">
                  <ArrowRight className="w-2 h-2 shrink-0" />
                  <p className="text-[8px] font-mono tracking-tight text-right">
                    {nextStage.label}
                  </p>
                </div>
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
                  const completed = i < stageIndex;
                  const active = i === stageIndex;
                  const fillRatio = completed
                    ? 1
                    : active
                      ? Math.min(1, Math.max(0, progress))
                      : 0;
                  const fillClass =
                    s.label === "Focus" ? "bg-red-500" : "bg-red-500";
                  const segmentTransition =
                    isRunning && active
                      ? "transition-[width] duration-1000 ease-linear"
                      : "transition-[width] duration-200 ease-out";

                  return (
                    <div
                      key={s.key}
                      className="flex h-5 min-w-0 overflow-hidden rounded-md bg-white/10"
                      style={{ flex: `${s.seconds} 1 0%` }}
                    >
                      <div
                        className={`h-full rounded-md ${fillClass} ${segmentTransition}`}
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
      </button> */}
      {/* <div className="flex flex-col items-center justify-center pt-12 ">
        <p>To Do List</p>
      </div> */}
      {/* <button
        type="button"
        onClick={skip}
        className="shrink-0 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-zinc-900"
      >
        Skip
      </button> */}
    </div>
  );
}
