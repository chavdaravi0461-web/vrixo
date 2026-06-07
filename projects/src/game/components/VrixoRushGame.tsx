"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { GameMode } from "@/game/utils/rewardTiers";

type FallingItem = {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  kind: "coin" | "shoe" | "watch" | "gift" | "cone" | "pothole" | "truck" | "magnet" | "shield" | "double";
};

type Reward = {
  code: string;
  label: string;
  expires_at: string;
  min_order_value: number;
  discount_type: string;
  discount_value: number;
};

type DrawGameState = {
  items: FallingItem[];
  playerX: number;
  shield: number;
};

const collectibles = ["coin", "shoe", "watch", "gift"] as const;
const obstacles = ["cone", "pothole", "truck"] as const;
const powerups = ["magnet", "shield", "double"] as const;

export function VrixoRushGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef({ left: false, right: false });
  const directionRef = useRef(0);
  const gameRef = useRef({
    running: false,
    paused: false,
    startedAt: 0,
    lastFrame: 0,
    lastSpawn: 0,
    playerX: 0.5,
    score: 0,
    lives: 3,
    collectedItems: 0,
    obstaclesHit: 0,
    items: [] as FallingItem[],
    nextId: 1,
    shield: 0,
    magnetUntil: 0,
    doubleUntil: 0
  });
  const [mode, setMode] = useState<GameMode>("coupon");
  const [status, setStatus] = useState<"start" | "playing" | "paused" | "over">("start");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(() =>
    typeof window === "undefined"
      ? 0
      : Number(localStorage.getItem("vrixo-rush-high-score") ?? 0)
  );
  const [reward, setReward] = useState<Reward | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sessionIdRef = useRef(makeSessionId());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keysRef.current.left = true;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keysRef.current.right = true;
      if (event.key === " " && status === "playing") togglePause();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keysRef.current.left = false;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keysRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      gameRef.current.running = false;
    };
  }, [status]);

  useEffect(() => {
    let frame = 0;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      if (!gameRef.current.running || gameRef.current.paused) return;
      tick(time);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // The loop reads mutable refs by design; recreating it every render would restart gameplay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startGame(nextMode = mode) {
    sessionIdRef.current = makeSessionId();
    gameRef.current = {
      running: true,
      paused: false,
      startedAt: performance.now(),
      lastFrame: performance.now(),
      lastSpawn: 0,
      playerX: 0.5,
      score: 0,
      lives: 3,
      collectedItems: 0,
      obstaclesHit: 0,
      items: [],
      nextId: 1,
      shield: 0,
      magnetUntil: 0,
      doubleUntil: 0
    };
    setMode(nextMode);
    setScore(0);
    setLives(3);
    setReward(null);
    setStatus("playing");
  }

  function togglePause() {
    const game = gameRef.current;
    if (!game.running) return;
    game.paused = !game.paused;
    setStatus(game.paused ? "paused" : "playing");
  }

  function tick(time: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const game = gameRef.current;
    const width = canvas.width;
    const height = canvas.height;
    const dt = Math.min((time - game.lastFrame) / 1000, 0.04);
    game.lastFrame = time;
    const elapsed = (time - game.startedAt) / 1000;
    const speedScale = 1 + elapsed / 38;

    const direction =
      directionRef.current || (keysRef.current.left ? -1 : 0) + (keysRef.current.right ? 1 : 0);
    game.playerX = clamp(game.playerX + direction * dt * 0.72, 0.08, 0.92);
    game.score += dt * 9 * (time < game.doubleUntil ? 2 : 1);

    if (time - game.lastSpawn > Math.max(360, 850 - elapsed * 8)) {
      game.lastSpawn = time;
      game.items.push(spawnItem(game.nextId++, speedScale, width));
    }

    const player = { x: game.playerX * width, y: height - 58, size: 44 };
    game.items = game.items
      .map((item) => moveItem(item, dt, speedScale, player, time < game.magnetUntil))
      .filter((item) => item.y < height + 80);

    for (const item of game.items) {
      if (!collides(player, item)) continue;
      item.y = height + 120;
      if (isObstacle(item.kind)) {
        if (game.shield > 0) {
          game.shield -= 1;
        } else {
          game.lives -= 1;
          game.obstaclesHit += 1;
          setLives(game.lives);
        }
      } else if (item.kind === "shield") {
        game.shield = 1;
        game.score += 40;
      } else if (item.kind === "magnet") {
        game.magnetUntil = time + 6000;
        game.score += 40;
      } else if (item.kind === "double") {
        game.doubleUntil = time + 6500;
        game.score += 40;
      } else {
        game.collectedItems += 1;
        game.score += item.kind === "coin" ? 55 : 90;
      }
    }

    draw(ctx, width, height, game, elapsed);
    setScore(Math.floor(game.score));

    if (game.lives <= 0 || elapsed >= 180) {
      finishGame();
    }
  }

  async function finishGame() {
    const game = gameRef.current;
    if (!game.running) return;
    game.running = false;
    const finalScore = Math.floor(game.score);
    const durationSeconds = Math.floor((performance.now() - game.startedAt) / 1000);
    const nextHigh = Math.max(highScore, finalScore);
    localStorage.setItem("vrixo-rush-high-score", String(nextHigh));
    setHighScore(nextHigh);
    setStatus("over");

    if (mode === "quick") return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/game/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: finalScore,
          durationSeconds,
          collectedItems: game.collectedItems,
          obstaclesHit: game.obstaclesHit,
          sessionId: sessionIdRef.current,
          mode
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.message ?? "Reward could not be unlocked.");
        return;
      }

      if (payload.reward) {
        setReward(payload.reward);
        toast.success("Coupon unlocked.");
      } else {
        toast.message(payload.message ?? "Score saved.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function copyCoupon() {
    if (!reward?.code) return;
    navigator.clipboard.writeText(reward.code);
    toast.success("Coupon copied.");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe,transparent_35%),linear-gradient(135deg,#0f172a,#0f766e)] px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-cyan-100">Play & Win Coupon</p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">Vrixo Delivery Rush</h1>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-2 backdrop-blur">
            {([
              ["quick", "Quick Play"],
              ["coupon", "Coupon Challenge"],
              ["daily", "Daily Reward"]
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${mode === value ? "bg-white text-slate-950" : "text-white"}`}
                onClick={() => setMode(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-slate-950 shadow-2xl">
            <canvas ref={canvasRef} width={900} height={560} className="h-[62vh] min-h-[430px] w-full touch-none" />
            {status !== "playing" ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/75 p-6 text-center backdrop-blur-sm">
                <div className="max-w-md">
                  <h2 className="text-3xl font-black">
                    {status === "start" ? "Ready for the rush?" : status === "paused" ? "Paused" : "Delivery complete"}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    Collect shoes, watches, coins, and gift boxes. Avoid cones, potholes, and rival trucks. Powerups give shield, magnet, and double score.
                  </p>
                  {reward ? (
                    <div className="mt-5 rounded-2xl bg-white p-4 text-slate-950">
                      <p className="text-sm font-bold text-teal-700">{reward.label}</p>
                      <p className="mt-1 text-3xl font-black tracking-wide">{reward.code}</p>
                      <p className="mt-1 text-xs text-slate-500">Valid till {new Date(reward.expires_at).toLocaleDateString("en-IN")}</p>
                      <Button type="button" className="mt-4 w-full" onClick={copyCoupon}>Copy coupon</Button>
                    </div>
                  ) : null}
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button type="button" onClick={() => startGame(mode)}>
                      {status === "start" ? "Start Game" : "Play Again"}
                    </Button>
                    {status === "paused" ? <Button type="button" variant="secondary" onClick={togglePause}>Resume</Button> : null}
                    <Link href="/shop"><Button type="button" variant="secondary">Shop Now</Button></Link>
                    <Link href="/account/coupons"><Button type="button" variant="outline">View My Coupons</Button></Link>
                  </div>
                  {submitting ? <p className="mt-4 text-sm text-cyan-100">Checking reward securely...</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-white/15 bg-white p-5 text-slate-950 shadow-xl">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Score" value={score} />
              <Stat label="High score" value={highScore} />
              <Stat label="Lives" value={lives} />
              <Stat label="Mode" value={mode === "daily" ? "Daily" : mode === "coupon" ? "Coupon" : "Quick"} />
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-950">Reward tiers</p>
              <p className="mt-2">500: 5% OFF</p>
              <p>1000: 10% OFF</p>
              <p>2000: 15% OFF</p>
              <p>3000: Free Delivery</p>
              <p>5000: Special limited coupon</p>
            </div>
            <Button type="button" className="mt-5 w-full" onClick={togglePause} disabled={status === "start" || status === "over"}>
              {status === "paused" ? "Resume" : "Pause"}
            </Button>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-4 z-20 mx-auto flex max-w-xs justify-between gap-4 px-4 md:hidden">
          <button
            className="h-16 flex-1 rounded-2xl bg-white/90 text-2xl font-black text-slate-950 shadow-lg"
            onTouchStart={() => (directionRef.current = -1)}
            onTouchEnd={() => (directionRef.current = 0)}
            onMouseDown={() => (directionRef.current = -1)}
            onMouseUp={() => (directionRef.current = 0)}
            type="button"
          >
            ←
          </button>
          <button
            className="h-16 flex-1 rounded-2xl bg-white/90 text-2xl font-black text-slate-950 shadow-lg"
            onTouchStart={() => (directionRef.current = 1)}
            onTouchEnd={() => (directionRef.current = 0)}
            onMouseDown={() => (directionRef.current = 1)}
            onMouseUp={() => (directionRef.current = 0)}
            type="button"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function spawnItem(id: number, speedScale: number, width: number): FallingItem {
  const roll = Math.random();
  const kind =
    roll > 0.9
      ? powerups[Math.floor(Math.random() * powerups.length)]
      : roll > 0.68
        ? obstacles[Math.floor(Math.random() * obstacles.length)]
        : collectibles[Math.floor(Math.random() * collectibles.length)];
  return {
    id,
    kind,
    x: 70 + Math.random() * (width - 140),
    y: -40,
    size: kind === "truck" ? 48 : 34,
    speed: 145 * speedScale + Math.random() * 90
  };
}

function moveItem(item: FallingItem, dt: number, speedScale: number, player: { x: number; y: number }, magnet: boolean) {
  const next = { ...item, y: item.y + item.speed * dt * speedScale };
  if (magnet && !isObstacle(item.kind)) {
    next.x += Math.sign(player.x - item.x) * 160 * dt;
  }
  return next;
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  game: DrawGameState,
  elapsed: number
) {
  ctx.clearRect(0, 0, width, height);
  const road = ctx.createLinearGradient(0, 0, 0, height);
  road.addColorStop(0, "#1e3a8a");
  road.addColorStop(1, "#0f172a");
  ctx.fillStyle = road;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,.18)";
  for (let y = -80 + ((elapsed * 130) % 120); y < height; y += 120) {
    ctx.fillRect(width / 2 - 6, y, 12, 62);
  }
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(70, 0, 3, height);
  ctx.fillRect(width - 73, 0, 3, height);
  for (const item of game.items) drawItem(ctx, item);
  const x = game.playerX * width;
  const y = height - 58;
  ctx.fillStyle = game.shield > 0 ? "#22c55e" : "#f97316";
  roundRect(ctx, x - 32, y - 24, 64, 48, 14);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DC", x, y + 6);
}

function drawItem(ctx: CanvasRenderingContext2D, item: FallingItem) {
  const emoji: Record<FallingItem["kind"], string> = {
    coin: "₹",
    shoe: "S",
    watch: "W",
    gift: "★",
    cone: "▲",
    pothole: "●",
    truck: "TR",
    magnet: "M",
    shield: "SH",
    double: "2x"
  };
  ctx.fillStyle = isObstacle(item.kind) ? "#ef4444" : item.kind === "coin" ? "#facc15" : "#38bdf8";
  ctx.beginPath();
  ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(emoji[item.kind], item.x, item.y + 5);
}

function collides(player: { x: number; y: number; size: number }, item: FallingItem) {
  return Math.hypot(player.x - item.x, player.y - item.y) < player.size / 2 + item.size / 2;
}

function isObstacle(kind: FallingItem["kind"]) {
  return obstacles.includes(kind as (typeof obstacles)[number]);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeSessionId() {
  return `rush_${Date.now()}_${crypto.randomUUID()}`;
}
