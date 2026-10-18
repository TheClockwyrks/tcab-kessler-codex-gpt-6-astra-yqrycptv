import type { DeepReadonly } from "ts-essentials";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
export const rad = Math.PI / 180;
export const norm = (a: number) => ((a % 360) + 360) % 360;
export const offset = (a: number, b: number) => norm(a - b + 180) - 180;
export const point = (r: number, a: number) => ({
  x: C.STAGE_CX + r * Math.cos(a * rad),
  y: C.STAGE_CY + r * Math.sin(a * rad),
});
export const polar = (x: number, y: number) => ({
  r: Math.hypot(x - C.STAGE_CX, y - C.STAGE_CY),
  a: norm(Math.atan2(y - C.STAGE_CY, x - C.STAGE_CX) / rad),
});
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  parked: boolean;
  born: number;
}
export interface Assets {
  images: Record<string, ImageBitmap>;
  systems: Record<string, ParticleSystem>;
}
export interface KesslerState {
  assets: Assets;
  screen: C.Screen;
  ticks: number;
  simTicks: number;
  accumulator: number;
  wave: number;
  score: number;
  lives: number;
  interstitialTicks: number;
  waveAdvance: boolean;
  podSpawn: boolean;
  nextPod: C.PodKind | "none" | null;
  angle: number;
  balls: Ball[];
  rings: {
    angleDeg: number;
    speedDegPerSec: number;
    targets: { slot: number; hp: number }[];
  }[];
  pods: { kind: C.PodKind; r: number; a: number }[];
  effects: {
    widenTicks: number;
    narrowTicks: number;
    pierceTicks: number;
    shieldActive: boolean;
  };
  menu: { index: number };
  press: { id: number; index: number } | null;
  fx: { id: number; kind: string; x: number; y: number; age: number }[];
  serial: number;
  delta: number;
}
export type ReadState = DeepReadonly<KesslerState>;
export const speed = (w: number) =>
  Math.min(
    C.BALL_SPEED_CAP,
    C.BALL_SPEED_BASE + C.BALL_SPEED_PER_WAVE * (w - 1),
  );
export const orbit = (i: number, w: number) => {
  const r = C.RINGS[i];
  return (
    r.orbitSign *
    Math.min(
      r.orbitCapDegPerSec,
      r.orbitBaseDegPerSec + r.orbitPerWaveDegPerSec * (w - 1),
    )
  );
};
export const span = (s: ReadState) =>
  s.effects.widenTicks > 0
    ? C.WIDEN_SPAN_DEG
    : s.effects.narrowTicks > 0
      ? C.NARROW_SPAN_DEG
      : C.DEFLECTOR_BASE_SPAN_DEG;
export function rings(w: number) {
  return C.RINGS.map((r, i) => ({
    angleDeg: 0,
    speedDegPerSec: orbit(i, w),
    targets: Array.from({ length: r.slots }, (_, slot) => ({
      slot,
      hp: r.hitPoints as number,
    })),
  }));
}
export const emptyEffects = () => ({
  widenTicks: 0,
  narrowTicks: 0,
  pierceTicks: 0,
  shieldActive: false,
});
export function initial(assets: Assets): KesslerState {
  return {
    assets,
    screen: "title",
    ticks: 0,
    simTicks: 0,
    accumulator: 0,
    wave: C.START_WAVE,
    score: 0,
    lives: C.START_LIVES,
    interstitialTicks: 0,
    waveAdvance: true,
    podSpawn: true,
    nextPod: null,
    angle: C.DEFLECTOR_START_ANGLE_DEG,
    balls: [],
    rings: rings(C.START_WAVE),
    pods: [],
    effects: emptyEffects(),
    menu: { index: 0 },
    press: null,
    fx: [],
    serial: 0,
    delta: 0,
  };
}
/** Clone only owned simulation data; decoded assets are immutable shared resources. */
export function copy(s: ReadState): KesslerState {
  return {
    ...s,
    assets: s.assets as Assets,
    balls: s.balls.map((b) => ({ ...b })),
    rings: s.rings.map((r) => ({
      ...r,
      targets: r.targets.map((t) => ({ ...t })),
    })),
    pods: s.pods.map((p) => ({ ...p })),
    effects: { ...s.effects },
    menu: { ...s.menu },
    press: s.press ? { ...s.press } : null,
    fx: s.fx.map((f) => ({ ...f })),
  };
}
export function addBall(s: KesslerState, parked: boolean, heading = s.angle) {
  if (s.balls.length >= C.BALL_CAP || (parked && s.balls.some((b) => b.parked)))
    throw new Error("Ball capacity exceeded");
  s.balls.push({
    ...point(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.angle),
    vx: parked ? 0 : speed(s.wave) * Math.cos(heading * rad),
    vy: parked ? 0 : speed(s.wave) * Math.sin(heading * rad),
    parked,
    born: s.simTicks,
  });
}
export function launch(s: KesslerState) {
  const b = s.balls.find((b) => b.parked);
  if (!b) throw new Error("No parked ball");
  b.parked = false;
  b.vx = speed(s.wave) * Math.cos(s.angle * rad);
  b.vy = speed(s.wave) * Math.sin(s.angle * rad);
}
export function drawPod(): C.PodKind | null {
  if (Math.random() >= C.POD_DROP_CHANCE) return null;
  let n = Math.random();
  for (const row of C.POD_KIND_TABLE) {
    n -= row.probability;
    if (n < 0) return row.kind;
  }
  return null;
}
export function effect(
  s: KesslerState,
  kind: "widen" | "narrow" | "pierce",
  ticks: number,
) {
  s.effects[`${kind}Ticks`] = ticks;
  if (ticks > 0 && kind !== "pierce")
    s.effects[kind === "widen" ? "narrowTicks" : "widenTicks"] = 0;
}
export function menuRect(s: ReadState, index: number) {
  return (s.screen === "title" || s.screen === "paused") &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < 2
    ? { x: 340, y: 620 + index * 70, width: 320, height: 54 }
    : null;
}
export function snapshot(s: ReadState) {
  return {
    screen: s.screen,
    ticks: s.ticks,
    wave: s.wave,
    score: s.score,
    lives: s.lives,
    interstitialTicks: s.interstitialTicks,
    waveAdvance: s.waveAdvance,
    podSpawn: s.podSpawn,
    nextPod: s.nextPod,
    paddle: { angleDeg: s.angle, spanDeg: span(s) },
    balls: s.balls.map((b) => ({
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      parked: b.parked,
      piercing: s.effects.pierceTicks > 0,
    })),
    rings: s.rings.map((r) => ({
      ...r,
      targets: r.targets.map((t) => ({ ...t })),
    })),
    pods: s.pods.map((p) => ({ kind: p.kind, ...point(p.r, p.a) })),
    effects: { ...s.effects },
    menu: {
      index: s.screen === "title" || s.screen === "paused" ? s.menu.index : 0,
    },
  };
}
