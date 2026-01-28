"use client";

import { useEffect, useRef, useState } from "react";

type GameStatus = "idle" | "running" | "gameover";

type Bullet = { x: number; y: number; speed: number; r: number };
type Enemy = { x: number; y: number; speed: number; r: number; hp: number };
type Star = { x: number; y: number; speed: number; r: number };

type Player = { x: number; y: number; r: number };

type GameTab = "shooter" | "2048";

type Tile = { id: number; value: number } | null;

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

const SIZE = 4;

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
  const audioRef = useRef<{
    ctx: AudioContext | null;
    bgOsc1: OscillatorNode | null;
    bgOsc2: OscillatorNode | null;
    bgGain: GainNode | null;
    lastShoot: number;
  }>({ ctx: null, bgOsc1: null, bgOsc2: null, bgGain: null, lastShoot: 0 });

  const [activeGame, setActiveGame] = useState<GameTab>("shooter");
  const [status, setStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [canvasSize, setCanvasSize] = useState({
    w: GAME_CONFIG.width,
    h: GAME_CONFIG.height,
    scale: 1,
  });

  // 2048 state
  const [board, setBoard] = useState<Tile[][]>(() => createEmptyBoard());
  const [score2048, setScore2048] = useState(0);
  const [best2048, setBest2048] = useState(0);
  const [gameOver2048, setGameOver2048] = useState(false);
  const tileIdRef = useRef(1);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("moltbot-highscore") : null;
    if (saved) setHighScore(Number(saved) || 0);
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("moltbot-2048-best") : null;
    if (saved) setBest2048(Number(saved) || 0);
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
        playShoot();
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
              playBoom();
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

    if (status === "running" && activeGame === "shooter") startLoop();
    else draw();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activeGame]);

  useEffect(() => {
    if (activeGame !== "shooter") {
      if (status === "running") setStatus("idle");
      stopAudio();
    }
  }, [activeGame, status]);

  const ensureAudio = () => {
    if (!soundOn || typeof window === "undefined") return;
    let ctx = audioRef.current.ctx;
    if (!ctx) {
      ctx = new AudioContext();
      audioRef.current.ctx = ctx;
    }
    if (ctx.state === "suspended") ctx.resume();
    if (!audioRef.current.bgOsc1) {
      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.value = 110;
      osc2.frequency.value = 220;
      osc2.detune.value = 3;
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      audioRef.current.bgGain = gain;
      audioRef.current.bgOsc1 = osc1;
      audioRef.current.bgOsc2 = osc2;
    }
  };

  const stopAudio = () => {
    const { bgOsc1, bgOsc2, bgGain } = audioRef.current;
    bgOsc1?.stop();
    bgOsc2?.stop();
    bgOsc1?.disconnect();
    bgOsc2?.disconnect();
    bgGain?.disconnect();
    audioRef.current.bgOsc1 = null;
    audioRef.current.bgOsc2 = null;
    audioRef.current.bgGain = null;
  };

  const playTone = (freq: number, duration: number, volume: number, type: OscillatorType) => {
    if (!soundOn) return;
    ensureAudio();
    const ctx = audioRef.current.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  };

  const playShoot = () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - audioRef.current.lastShoot < 120) return;
    audioRef.current.lastShoot = now;
    playTone(520, 0.05, 0.05, "square");
  };

  const playBoom = () => playTone(160, 0.18, 0.08, "sawtooth");
  const playGameOver = () => playTone(90, 0.35, 0.08, "triangle");

  useEffect(() => {
    if (!soundOn) stopAudio();
  }, [soundOn]);

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
    ensureAudio();
    setStatus("running");
  };

  const endGame = () => {
    setStatus("gameover");
    playGameOver();
    stopAudio();
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

  // 2048 helpers
  function createEmptyBoard(): Tile[][] {
    return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
  }

  function cloneBoard(b: Tile[][]): Tile[][] {
    return b.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  function addRandomTile(b: Tile[][]): Tile[][] {
    const empty: { r: number; c: number }[] = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!b[r][c]) empty.push({ r, c });
    if (empty.length === 0) return b;
    const pick = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const next = cloneBoard(b);
    next[pick.r][pick.c] = { id: tileIdRef.current++, value };
    return next;
  }

  function canMove(b: Tile[][]): boolean {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (!b[r][c]) return true;
      const v = b[r][c]!.value;
      if (r < SIZE - 1 && b[r + 1][c] && b[r + 1][c]!.value === v) return true;
      if (c < SIZE - 1 && b[r][c + 1] && b[r][c + 1]!.value === v) return true;
    }
    return false;
  }

  function moveLeft(b: Tile[][]): { board: Tile[][]; gained: number; moved: boolean } {
    let gained = 0;
    let moved = false;
    const next = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) {
      let target = 0;
      let lastMerged = -1;
      for (let c = 0; c < SIZE; c++) {
        const cell = b[r][c];
        if (!cell) continue;
        if (next[r][target] && next[r][target]!.value === cell.value && lastMerged !== target) {
          next[r][target] = { id: tileIdRef.current++, value: cell.value * 2 };
          gained += cell.value * 2;
          lastMerged = target;
          moved = true;
          target++;
        } else {
          if (c !== target) moved = true;
          next[r][target] = { ...cell };
          target++;
        }
      }
    }
    return { board: next, gained, moved };
  }

  function rotateRight(b: Tile[][]): Tile[][] {
    const res = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) res[c][SIZE - 1 - r] = b[r][c] ? { ...b[r][c]! } : null;
    return res;
  }

  function rotateLeft(b: Tile[][]): Tile[][] {
    const res = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) res[SIZE - 1 - c][r] = b[r][c] ? { ...b[r][c]! } : null;
    return res;
  }

  function move(dir: "left" | "right" | "up" | "down") {
    if (gameOver2048) return;
    let working = cloneBoard(board);
    if (dir === "right") working = rotateRight(rotateRight(working));
    if (dir === "up") working = rotateLeft(working);
    if (dir === "down") working = rotateRight(working);

    const result = moveLeft(working);
    let nextBoard = result.board;
    const gained = result.gained;
    const moved = result.moved;

    if (dir === "right") nextBoard = rotateRight(rotateRight(nextBoard));
    if (dir === "up") nextBoard = rotateRight(nextBoard);
    if (dir === "down") nextBoard = rotateLeft(nextBoard);

    if (!moved) return;
    nextBoard = addRandomTile(nextBoard);
    setBoard(nextBoard);
    setScore2048((s) => {
      const newScore = s + gained;
      setBest2048((prev) => {
        const next = Math.max(prev, newScore);
        if (typeof window !== "undefined") localStorage.setItem("moltbot-2048-best", String(next));
        return next;
      });
      return newScore;
    });

    if (!canMove(nextBoard)) setGameOver2048(true);
  }

  function reset2048() {
    tileIdRef.current = 1;
    let b = createEmptyBoard();
    b = addRandomTile(addRandomTile(b));
    setBoard(b);
    setScore2048(0);
    setGameOver2048(false);
  }

  useEffect(() => {
    reset2048();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (activeGame !== "2048") return;
      if (e.key === "ArrowLeft") move("left");
      if (e.key === "ArrowRight") move("right");
      if (e.key === "ArrowUp") move("up");
      if (e.key === "ArrowDown") move("down");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame, board, gameOver2048, score2048]);

  const tileColor = (value: number) => {
    const map: Record<number, string> = {
      2: "bg-slate-200 text-slate-700",
      4: "bg-slate-300 text-slate-700",
      8: "bg-orange-300 text-white",
      16: "bg-orange-400 text-white",
      32: "bg-orange-500 text-white",
      64: "bg-orange-600 text-white",
      128: "bg-yellow-400 text-white",
      256: "bg-yellow-500 text-white",
      512: "bg-yellow-600 text-white",
      1024: "bg-emerald-500 text-white",
      2048: "bg-emerald-600 text-white",
    };
    return map[value] || "bg-emerald-700 text-white";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start py-6">
      <div className="w-full max-w-3xl px-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">游戏盒子</h1>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 rounded-full text-sm ${activeGame === "shooter" ? "bg-sky-400 text-slate-900" : "bg-white/10"}`}
              onClick={() => setActiveGame("shooter")}
            >
              飞机大战
            </button>
            <button
              className={`px-3 py-1 rounded-full text-sm ${activeGame === "2048" ? "bg-sky-400 text-slate-900" : "bg-white/10"}`}
              onClick={() => setActiveGame("2048")}
            >
              2048
            </button>
          </div>
        </div>
      </div>

      {activeGame === "shooter" && (
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

          <button
            className="absolute top-3 right-3 text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20"
            onClick={() => setSoundOn((v) => !v)}
          >
            声音：{soundOn ? "开" : "关"}
          </button>

          {status !== "running" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-2xl text-center px-6">
              <h2 className="text-2xl font-semibold mb-2">飞机大战</h2>
              {status === "idle" && (
                <p className="text-sm text-white/70 mb-6">触控拖拽移动，自动射击，避开敌机。</p>
              )}
              {status === "gameover" && (
                <p className="text-sm text-white/70 mb-6">游戏结束！本局得分 {Math.floor(score)}</p>
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
      )}

      {activeGame === "2048" && (
        <div className="w-full max-w-md px-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-white/60">得分</div>
              <div className="text-xl font-semibold">{score2048}</div>
            </div>
            <div>
              <div className="text-sm text-white/60">最高</div>
              <div className="text-xl font-semibold">{best2048}</div>
            </div>
            <button className="px-3 py-2 rounded-full bg-white/10" onClick={reset2048}>
              重新开始
            </button>
          </div>

          <div
            className="bg-slate-800 rounded-2xl p-3 select-none touch-none"
            onTouchStart={(e) => {
              const t = e.touches[0];
              touchStartRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              const start = touchStartRef.current;
              if (!start) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;
              if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
              if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
              else move(dy > 0 ? "down" : "up");
              touchStartRef.current = null;
            }}
          >
            <div className="grid grid-cols-4 gap-2">
              {board.flat().map((cell, idx) => (
                <div
                  key={cell ? cell.id : `empty-${idx}`}
                  className={`h-16 rounded-xl flex items-center justify-center text-xl font-semibold ${cell ? tileColor(cell.value) : "bg-white/10"}`}
                >
                  {cell?.value ?? ""}
                </div>
              ))}
            </div>

            {gameOver2048 && (
              <div className="mt-3 text-center text-sm text-red-300">游戏结束，已无法移动</div>
            )}
          </div>

          <p className="text-xs text-white/50 mt-3">支持触控滑动/键盘方向键。</p>
        </div>
      )}
    </div>
  );
}
