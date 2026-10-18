import * as C from "./constants";
import {
  type ReadState,
  type KesslerState,
  copy,
  initial,
  norm,
  point,
  polar,
  orbit,
  addBall,
  launch,
  effect,
  drawPod,
  snapshot,
  menuRect,
} from "./model";
const finite = (...v: number[]) => {
  if (v.some((n) => !Number.isFinite(n)))
    throw new Error("Expected finite number");
};
const integer = (n: number, min = 0, max = Infinity) => {
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error("Integer out of range");
};
const pose = (s: ReadState, fn: (n: KesslerState) => void) => {
  const n = copy(s);
  fn(n);
  return n;
};
const ringIndex = (n: number) => {
  integer(n, 1, C.RINGS.length);
  return n - 1;
};
const kind = (k: string) => {
  if (!C.POD_KINDS.includes(k as C.PodKind)) throw new Error("Invalid pod");
};
export const debug = {
  reset: (s: ReadState) => initial(s.assets as KesslerState["assets"]),
  reconcile: copy,
  snapshot,
  menuItemRect: menuRect,
  setScreen: (s: ReadState, name: C.Screen) =>
    pose(s, (n) => {
      if (!C.SCREENS.includes(name)) throw new Error("Invalid screen");
      n.screen = name;
    }),
  setScore: (s: ReadState, v: number) =>
    pose(s, (n) => {
      integer(v);
      n.score = v;
    }),
  setLives: (s: ReadState, v: number) =>
    pose(s, (n) => {
      integer(v);
      n.lives = v;
    }),
  setMenuIndex: (s: ReadState, v: number) =>
    pose(s, (n) => {
      if (!menuRect(s, v)) throw new Error("Invalid menu entry");
      n.menu.index = v;
    }),
  setInterstitialTicks: (s: ReadState, v: number) =>
    pose(s, (n) => {
      integer(v);
      n.interstitialTicks = v;
    }),
  setWave: (s: ReadState, v: number) =>
    pose(s, (n) => {
      integer(v, 1);
      n.wave = v;
      n.rings.forEach((r, i) => (r.speedDegPerSec = orbit(i, v)));
    }),
  setPaddleAngle: (s: ReadState, v: number) =>
    pose(s, (n) => {
      finite(v);
      n.angle = norm(v);
      n.balls
        .filter((b) => b.parked)
        .forEach((b) =>
          Object.assign(b, point(C.DEFLECTOR_BALL_CONTACT_RADIUS, n.angle)),
        );
    }),
  launchBall: (s: ReadState) => pose(s, launch),
  clearBalls: (s: ReadState) =>
    pose(s, (n) => {
      n.balls = [];
    }),
  spawnBall: (s: ReadState, x: number, y: number, vx: number, vy: number) =>
    pose(s, (n) => {
      finite(x, y, vx, vy);
      addBall(n, false);
      Object.assign(n.balls[n.balls.length - 1], { x, y, vx, vy });
    }),
  parkBall: (s: ReadState) => pose(s, (n) => addBall(n, true)),
  clearTargets: (s: ReadState) =>
    pose(s, (n) =>
      n.rings.forEach((r) => {
        r.targets = [];
      }),
    ),
  spawnTarget: (s: ReadState, r: number, slot: number, hp: number) =>
    pose(s, (n) => {
      const i = ringIndex(r);
      integer(slot, 0, C.RINGS[i].slots - 1);
      integer(hp, 1);
      n.rings[i].targets = n.rings[i].targets
        .filter((t) => t.slot !== slot)
        .concat({ slot, hp })
        .sort((a, b) => a.slot - b.slot);
    }),
  setRingAngle: (s: ReadState, r: number, v: number) =>
    pose(s, (n) => {
      finite(v);
      n.rings[ringIndex(r)].angleDeg = norm(v);
    }),
  setRingSpeed: (s: ReadState, r: number, v: number) =>
    pose(s, (n) => {
      finite(v);
      n.rings[ringIndex(r)].speedDegPerSec = v;
    }),
  clearPods: (s: ReadState) =>
    pose(s, (n) => {
      n.pods = [];
    }),
  spawnPod: (s: ReadState, k: C.PodKind, x: number, y: number) =>
    pose(s, (n) => {
      kind(k);
      finite(x, y);
      n.pods.push({ kind: k, ...polar(x, y) });
    }),
  setNextPod: (s: ReadState, k: C.PodKind | "none") =>
    pose(s, (n) => {
      if (k !== "none") kind(k);
      n.nextPod = k;
    }),
  drawPod: (_s: ReadState) => drawPod(),
  setEffectTicks: (s: ReadState, k: "widen" | "narrow" | "pierce", v: number) =>
    pose(s, (n) => {
      if (!["widen", "narrow", "pierce"].includes(k))
        throw new Error("Invalid effect");
      integer(v);
      effect(n, k, v);
    }),
  setShield: (s: ReadState, v: boolean) =>
    pose(s, (n) => {
      if (typeof v !== "boolean") throw new Error("Expected boolean");
      n.effects.shieldActive = v;
    }),
  setWaveAdvance: (s: ReadState, v: boolean) =>
    pose(s, (n) => {
      if (typeof v !== "boolean") throw new Error("Expected boolean");
      n.waveAdvance = v;
    }),
  setPodSpawn: (s: ReadState, v: boolean) =>
    pose(s, (n) => {
      if (typeof v !== "boolean") throw new Error("Expected boolean");
      n.podSpawn = v;
    }),
};
