"use client";

import { useEffect, useRef, useState } from "react";

type GameStatus = "idle" | "running" | "gameover";

type Bullet = { x: number; y: number; speed: number; r: number };
type Enemy = { x: number; y: number; speed: number; r: number; hp: number };
type Star = { x: number; y: number; speed: number; r: number };

type Player = { x: number; y: number; r: number };

const GAME_CONFIG = {
  width: 360,
  height: 640,
  playerRadius: 16,
  bulletRadius: 4,
  enemyRadius: 16,
  bulletSpeed: 480,
  enemySpeedMin: 80,
  enemySpeedMax: 180,
  spawnInterval: 700,
  fireInterval: 180,
  starCount: 60,
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const lastFireRef = useRef<number>(0);

  const playerRef = useRef<Player>({
    x: GAME_CONFIG.width / 2,
    y: GAME_CONFIG.height - 80,
    r: GAME_CONFIG.playerRadius,
  });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const starsRef = useRef<Star[]>([]);

  const [status, setStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [canvasSize, setCanvasSize] = useState({
    w: GAME_CONFIG.width,
    h: GAME_CONFIG.height,
    scale: 1,
  });

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("moltbot-highscore") : null;
    if (saved) setHighScore(Number(saved) || 0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const maxW = Math.min(window.innerWidth, 480);
      const maxH = window.innerHeight;
      const scale = Math.min(maxW / GAME_CONFIG.width, maxH / GAME_CONFIG.height);
      setCanvasSize({
        w: GAME_CONFIG.width * scale,
        h: GAME_CONFIG.height * scale,
        scale,
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const initStars = () => {
      const stars: Star[] = [];
      for (let i = 0; i < GAME_CONFIG.starCount; i++) {
        stars.push({
          x: Math.random() * GAME_CONFIG.width,
          y: Math.random() * GAME_CONFIG.height,
          speed: 20 + Math.random() * 60,
          r: 1 + Math.random() * 1.5,
        });
      }
      starsRef.current = stars;
    };

    initStars();

    const draw = () => {
      ctx.clearRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

      // background
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

      // stars
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      starsRef.current.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // player
      const p = playerRef.current;
      const pr = p.r;
      ctx.save();
      ctx.translate(p.x, p.y);

      // body
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(0, -pr * 1.4);
      ctx.lineTo(-pr * 0.35, pr * 0.9);
      ctx.lineTo(pr * 0.35, pr * 0.9);
      ctx.closePath();
      ctx.fill();

      // wings
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(-pr * 1.2, pr * 0.1);
      ctx.lineTo(0, pr * 0.4);
      ctx.lineTo(pr * 1.2, pr * 0.1);
      ctx.closePath();
      ctx.fill();

      // cockpit
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.ellipse(0, -pr * 0.4, pr * 0.25, pr * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // bullets
      ctx.fillStyle = "#fbbf24";
      bulletsRef.current.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // enemies
      enemiesRef.current.forEach((e) => {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = e.hp > 1 ? "#fb7185" : "#f97316";

        // body
        ctx.beginPath();
        ctx.moveTo(0, e.r * 1.2);
        ctx.lineTo(-e.r * 0.5, -e.r * 0.8);
        ctx.lineTo(e.r * 0.5, -e.r * 0.8);
        ctx.closePath();
        ctx.fill();

        // wings
        ctx.fillStyle = e.hp > 1 ? "#fda4af" : "#fdba74";
        ctx.beginPath();
        ctx.moveTo(-e.r * 1.1, -e.r * 0.2);
        ctx.lineTo(0, -e.r * 0.05);
        ctx.lineTo(e.r * 1.1, -e.r * 0.2);
        ctx.closePath();
        ctx.fill();

        // cockpit
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const update = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // update stars
      starsRef.current.forEach((s) => {
        s.y += s.speed * delta;
        if (s.y > GAME_CONFIG.height) {
          s.y = -5;
          s.x = Math.random() * GAME_CONFIG.width;
        }
      });

      // auto fire
      if (time - lastFireRef.current > GAME_CONFIG.fireInterval) {
        lastFireRef.current = time;
        const p = playerRef.current;
        bulletsRef.current.push({
          x: p.x,
          y: p.y - p.r - 6,
          speed: GAME_CONFIG.bulletSpeed,
          r: GAME_CONFIG.bulletRadius,
        });
      }

      // spawn enemies
      if (time - lastSpawnRef.current > GAME_CONFIG.spawnInterval) {
        lastSpawnRef.current = time;
        const r = GAME_CONFIG.enemyRadius;
        enemiesRef.current.push({
          x: r + Math.random() * (GAME_CONFIG.width - r * 2),
          y: -r,
          speed:
            GAME_CONFIG.enemySpeedMin +
            Math.random() * (GAME_CONFIG.enemySpeedMax - GAME_CONFIG.enemySpeedMin),
          r,
          hp: Math.random() < 0.2 ? 2 : 1,
        });
      }

      // move bullets
      bulletsRef.current.forEach((b) => (b.y -= b.speed * delta));
      bulletsRef.current = bulletsRef.current.filter((b) => b.y > -20);

      // move enemies
      enemiesRef.current.forEach((e) => (e.y += e.speed * delta));
      enemiesRef.current = enemiesRef.current.filter((e) => e.y < GAME_CONFIG.height + 40);

      // collisions
      const bullets = bulletsRef.current;
      const enemies = enemiesRef.current;

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < e.r + b.r) {
            bullets.splice(j, 1);
            e.hp -= 1;
            if (e.hp <= 0) {
              enemies.splice(i, 1);
              setScore((s) => s + 10);
            }
            break;
          }
        }
      }

      const p = playerRef.current;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < e.r + p.r) {
          endGame();
          return;
        }
      }

      setScore((s) => s + delta * 2);

      draw();
      frameRef.current = requestAnimationFrame(update);
    };

    const startLoop = () => {
      lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(update);
    };

    if (status === "running") startLoop();
    else draw();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const startGame = () => {
    bulletsRef.current = [];
    enemiesRef.current = [];
    setScore(0);
    lastSpawnRef.current = 0;
    lastFireRef.current = 0;
    playerRef.current = {
      x: GAME_CONFIG.width / 2,
      y: GAME_CONFIG.height - 80,
      r: GAME_CONFIG.playerRadius,
    };
    setStatus("running");
  };

  const endGame = () => {
    setStatus("gameover");
    setHighScore((prev) => {
      const next = Math.max(prev, Math.floor(score));
      if (typeof window !== "undefined") {
        localStorage.setItem("moltbot-highscore", String(next));
      }
      return next;
    });
  };

  const handlePointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / canvasSize.scale;
    const y = (clientY - rect.top) / canvasSize.scale;
    playerRef.current.x = Math.max(GAME_CONFIG.playerRadius, Math.min(GAME_CONFIG.width - GAME_CONFIG.playerRadius, x));
    playerRef.current.y = Math.max(GAME_CONFIG.playerRadius, Math.min(GAME_CONFIG.height - GAME_CONFIG.playerRadius, y));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.width}
          height={GAME_CONFIG.height}
          style={{ width: canvasSize.w, height: canvasSize.h }}
          className="rounded-2xl shadow-2xl border border-white/10 touch-none"
          onPointerDown={(e) => handlePointer(e.clientX, e.clientY)}
          onPointerMove={(e) => {
            if (e.buttons === 1 || status !== "idle") handlePointer(e.clientX, e.clientY);
          }}
        />

        <div className="absolute top-3 left-3 text-xs text-white/80">
          <div>得分：{Math.floor(score)}</div>
          <div>最高：{highScore}</div>
        </div>

        {status !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-2xl text-center px-6">
            <h1 className="text-2xl font-semibold mb-2">飞机大战</h1>
            {status === "idle" && (
              <p className="text-sm text-white/70 mb-6">
                触控拖拽移动，自动射击，避开敌机。
              </p>
            )}
            {status === "gameover" && (
              <p className="text-sm text-white/70 mb-6">
                游戏结束！本局得分 {Math.floor(score)}
              </p>
            )}
            <button
              className="px-6 py-3 rounded-full bg-sky-400 text-slate-900 font-semibold hover:bg-sky-300 transition"
              onClick={startGame}
            >
              {status === "idle" ? "点击开始" : "再来一局"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
