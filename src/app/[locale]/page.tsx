"use client";

import { Activity, AlertTriangle, Bug, Camera, Heart, Shield, Sparkles, Swords, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { useEffect, useState } from "react";
import { CameraCapture } from "~/components/camera-capture";
import { analyzeGenesisImage, generateEmbryoSVG, generateFinalPetImage, generateFinalPetStats, verifyFeedImage } from "~/lib/gemini";

type GameState = "intro" | "genesis" | "analyzing-genesis" | "quest" | "analyzing-feed" | "hatching" | "reveal";

interface Task {
  id: string;
  requirement: string;
  description: string;
  completed: boolean;
  mutationEffect?: string;
}

interface Worldview {
  theme: string;
  description: string;
  baseTraits: string[];
}

interface FinalPet {
  name: string;
  description: string;
  imageUrl: string;
  stats: { hp: number; atk: number; def: number; spd: number };
  isFailure: boolean;
  failureType: string;
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState>("intro");
  const [worldview, setWorldview] = useState<Worldview | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [mutations, setMutations] = useState<string[]>([]);
  const [embryoSVG, setEmbryoSVG] = useState<string | null>(null);
  const [finalPet, setFinalPet] = useState<FinalPet | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [environment, setEnvironment] = useState({ time: "白天", weather: "晴朗", temp: 25 });
  const [isDebug, setIsDebug] = useState(false);

  // Fetch environment data on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            const data = await res.json();
            const temp = data.current_weather.temperature;
            const weatherCode = data.current_weather.weathercode;
            let weather = "晴朗";
            if (weatherCode >= 50 && weatherCode <= 69) {
              weather = "雨天";
            }
            if (weatherCode >= 70 && weatherCode <= 79) {
              weather = "雪天";
            }
            if (weatherCode >= 80) {
              weather = "暴风雨";
            }

            const hour = new Date().getHours();
            let time = "白天";
            if (hour < 6 || hour > 18) {
              time = "夜晚";
            }

            setEnvironment({ time, weather, temp });
          } catch (e) {
            console.error("Failed to fetch weather", e);
          }
        },
        error => console.error("Geolocation error", error),
      );
    }
  }, []);

  const handleGenesisCapture = async (base64: string, mimeType: string) => {
    setGameState("analyzing-genesis");
    try {
      const result = await analyzeGenesisImage(base64, mimeType);
      setWorldview({
        theme: result.theme,
        description: result.description,
        baseTraits: result.baseTraits,
      });
      setTasks(result.tasks.map((t: any) => ({ ...t, completed: false })));

      const initialSVG = await generateEmbryoSVG(result.baseTraits, []);
      setEmbryoSVG(initialSVG);

      setGameState("quest");
    } catch (error) {
      console.error(error);
      setFeedbackMessage("分析图片失败，请重试。");
      setGameState("genesis");
    }
  };

  const handleFeedCapture = async (base64: string, mimeType: string) => {
    if (!activeTaskId) {
      return;
    }
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) {
      return;
    }

    setGameState("analyzing-feed");
    try {
      const result = await verifyFeedImage(task.requirement, base64, mimeType, isDebug);
      if (result.success) {
        setTasks(prev =>
          prev.map(t =>
            t.id === activeTaskId ? { ...t, completed: true, mutationEffect: result.mutationEffect } : t,
          ),
        );
        const newMutations = [...mutations, result.mutationEffect];
        setMutations(newMutations);

        const newSVG = await generateEmbryoSVG(worldview!.baseTraits, newMutations);
        setEmbryoSVG(newSVG);

        setFeedbackMessage(result.message);
      } else {
        setFeedbackMessage(result.message || "看起来不太符合要求，请再试一次！");
      }
    } catch (error) {
      console.error(error);
      setFeedbackMessage("验证图片失败，请重试。");
    }
    setGameState("quest");
    setActiveTaskId(null);
  };

  const handleHatch = async () => {
    setGameState("hatching");
    try {
      const statsResult = await generateFinalPetStats(worldview!.baseTraits, mutations, environment);
      const imageUrl = await generateFinalPetImage(statsResult.imagePrompt);

      setFinalPet({
        name: statsResult.name,
        description: statsResult.description,
        stats: statsResult.stats,
        isFailure: statsResult.isFailure,
        failureType: statsResult.failureType,
        imageUrl,
      });
      setGameState("reveal");
    } catch (error) {
      console.error(error);
      setFeedbackMessage("孵化失败！基因完全崩溃了。");
      setGameState("quest");
    }
  };

  const resetGame = () => {
    setGameState("intro");
    setWorldview(null);
    setTasks([]);
    setMutations([]);
    setEmbryoSVG(null);
    setFinalPet(null);
    setFeedbackMessage(null);
  };

  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-100 font-sans overflow-hidden flex flex-col items-center justify-center p-4 relative">
      {/* Debug Toggle */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setIsDebug(!isDebug)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors \${
            isDebug ? "bg-green-500/20 text-green-400 border border-green-500/50" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
          }`}
        >
          <Bug className="w-3 h-3" />
          {isDebug ? "调试模式: 开" : "调试模式: 关"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* Intro Screen */}
        {gameState === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center max-w-md"
          >
            <div className="mb-8 relative">
              <div className="absolute inset-0 bg-indigo-500 blur-[100px] opacity-20 rounded-full"></div>
              <Sparkles className="w-20 h-20 mx-auto text-indigo-400 mb-6" />
              <h1 className="text-5xl font-bold tracking-tighter mb-4 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
                Poco
              </h1>
              <p className="text-zinc-400 text-lg">
                扫描现实世界的物品，孵化并变异出你独一无二的数字宠物。
              </p>
            </div>
            <button
              onClick={() => setGameState("genesis")}
              className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            >
              开始孵化
            </button>
          </motion.div>
        )}

        {/* Genesis Screen */}
        {gameState === "genesis" && (
          <motion.div
            key="genesis"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center max-w-md w-full"
          >
            <h2 className="text-3xl font-bold mb-4">第一层：确立基调</h2>
            <p className="text-zinc-400 mb-8">
              拍下任意物品作为宠物的核心基因。
              （例如：毛线球、咖啡杯、植物）
            </p>
            <CameraCapture onCapture={handleGenesisCapture} buttonText="扫描基础物品" />
            {feedbackMessage && <p className="mt-4 text-red-400">{feedbackMessage}</p>}
          </motion.div>
        )}

        {/* Analyzing Genesis */}
        {gameState === "analyzing-genesis" && (
          <motion.div
            key="analyzing-genesis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="w-24 h-24 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold animate-pulse">提取核心基因...</h2>
            <p className="text-zinc-500 mt-2">正在确立世界观参数</p>
          </motion.div>
        )}

        {/* Quest Screen */}
        {gameState === "quest" && worldview && (
          <motion.div
            key="quest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md flex flex-col h-full max-h-[800px]"
          >
            <div className="text-center mb-6">
              <h2 className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-1">世界观已确立</h2>
              <h3 className="text-2xl font-bold">{worldview.theme}</h3>
              <p className="text-sm text-zinc-400 mt-1">{worldview.description}</p>
            </div>

            {/* Embryo Silhouette */}
            <div className="relative flex-1 min-h-[250px] bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-center mb-6 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.1)_0%,transparent_70%)]"></div>

              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 2, -2, 0],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative z-10 w-40 h-40 flex items-center justify-center"
                style={{
                  filter: `drop-shadow(0 0 \${20 + mutations.length * 20}px \${mutations.length > 0 ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.4)'})`,
                }}
              >
                {embryoSVG
                  ? (
                      <div
                        className="w-full h-full text-black [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current"
                        dangerouslySetInnerHTML={{ __html: embryoSVG }}
                      />
                    )
                  : (
                      <div
                        className="bg-black w-40 h-40 rounded-full blur-md transition-all duration-1000"
                        style={{
                          borderRadius: mutations.length === 0
                            ? "50%"
                            : mutations.length === 1
                              ? "40% 60% 70% 30% / 40% 50% 60% 50%"
                              : mutations.length === 2
                                ? "30% 70% 70% 30% / 30% 30% 70% 70%"
                                : "20% 80% 20% 80% / 80% 20% 80% 20%",
                        }}
                      >
                      </div>
                    )}
              </motion.div>

              {/* Environment Indicators */}
              <div className="absolute top-4 right-4 flex gap-2 text-xs font-mono text-zinc-500">
                <span className="bg-zinc-950 px-2 py-1 rounded">
                  {environment.temp}
                  °C
                </span>
                <span className="bg-zinc-950 px-2 py-1 rounded">{environment.weather}</span>
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2">
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">孵化任务</h4>
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all \${
                    task.completed
                      ? "bg-indigo-950/30 border-indigo-500/30"
                      : "bg-zinc-900 border-zinc-800"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className={`font-bold \${task.completed ? "text-indigo-300" : "text-zinc-200"}`}>
                        {task.requirement}
                      </h5>
                      <p className="text-xs text-zinc-500 mt-1">{task.description}</p>
                    </div>
                    {task.completed
                      ? (
                          <div className="bg-indigo-500/20 text-indigo-400 p-1.5 rounded-full">
                            <Zap className="w-4 h-4" />
                          </div>
                        )
                      : (
                          <button
                            onClick={() => setActiveTaskId(task.id)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        )}
                  </div>
                  {task.mutationEffect && (
                    <p className="text-xs text-indigo-400 italic mt-2 border-t border-indigo-500/20 pt-2">
                      变异：
                      {task.mutationEffect}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {feedbackMessage && (
              <div className="mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-center">
                {feedbackMessage}
              </div>
            )}

            {tasks.every(t => t.completed) && (
              <button
                onClick={handleHatch}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              >
                开始孵化
              </button>
            )}
          </motion.div>
        )}

        {/* Active Task Camera Overlay */}
        {activeTaskId && gameState === "quest" && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center">
              <h3 className="text-xl font-bold mb-2">
                寻找：
                {tasks.find(t => t.id === activeTaskId)?.requirement}
              </h3>
              <p className="text-zinc-400 mb-6">{tasks.find(t => t.id === activeTaskId)?.description}</p>
              <CameraCapture onCapture={handleFeedCapture} buttonText="拍摄物品" />
              <button
                onClick={() => setActiveTaskId(null)}
                className="mt-4 text-zinc-500 hover:text-white text-sm"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Analyzing Feed */}
        {gameState === "analyzing-feed" && (
          <motion.div
            key="analyzing-feed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="w-24 h-24 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold animate-pulse">基因融合中...</h2>
            <p className="text-zinc-500 mt-2">正在验证材料相容性</p>
          </motion.div>
        )}

        {/* Hatching Animation */}
        {gameState === "hatching" && (
          <motion.div
            key="hatching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center w-full max-w-md"
          >
            <h2 className="text-3xl font-bold mb-8 tracking-widest uppercase">猜猜我是谁？</h2>
            <div className="relative w-64 h-64 mx-auto mb-8">
              <motion.div
                animate={{
                  scale: [1, 1.2, 0.9, 1.1, 1],
                  rotate: [0, -10, 10, -5, 5, 0],
                  filter: ["blur(10px)", "blur(20px)", "blur(5px)"],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-black rounded-full"
                style={{
                  boxShadow: "0 0 100px rgba(255,255,255,0.5)",
                }}
              >
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl font-bold text-white opacity-50">?</span>
              </div>
            </div>
            <p className="text-zinc-400 animate-pulse">正在注入环境催化剂...</p>
            <div className="flex justify-center gap-4 mt-4 text-sm font-mono text-zinc-500">
              <span>{environment.time}</span>
              <span>•</span>
              <span>{environment.weather}</span>
              <span>•</span>
              <span>
                {environment.temp}
                °C
              </span>
            </div>
          </motion.div>
        )}

        {/* Reveal Screen */}
        {gameState === "reveal" && finalPet && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl"
          >
            <div className="relative aspect-square bg-black">
              <img
                src={finalPet.imageUrl}
                alt={finalPet.name}
                className="w-full h-full object-cover"
              />
              {finalPet.isFailure && (
                <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  基因崩溃：
                  {finalPet.failureType}
                </div>
              )}
            </div>

            <div className="p-6">
              <h2 className="text-3xl font-bold mb-2">{finalPet.name}</h2>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{finalPet.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 text-red-400 mb-1">
                    <Heart className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">HP</span>
                  </div>
                  <div className="text-xl font-mono">{finalPet.stats.hp}</div>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 text-orange-400 mb-1">
                    <Swords className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">ATK</span>
                  </div>
                  <div className="text-xl font-mono">{finalPet.stats.atk}</div>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">DEF</span>
                  </div>
                  <div className="text-xl font-mono">{finalPet.stats.def}</div>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 text-green-400 mb-1">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">SPD</span>
                  </div>
                  <div className="text-xl font-mono">{finalPet.stats.spd}</div>
                </div>
              </div>

              <button
                onClick={resetGame}
                className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors"
              >
                再孵化一只
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
