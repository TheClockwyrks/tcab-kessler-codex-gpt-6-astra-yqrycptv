/// <reference types="node" />
import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import {
  createEngine,
  ConstantClock,
  SequenceClock,
} from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import * as C from "./constants";
import { point, type ReadState } from "./model";

// Supply real local bitmaps and file bodies to the engine's browser loaders.
// Audio decoding is the sole platform stub; cue events remain engine-owned.
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (path: string) => new Response(await readFile(path)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      decodeAudioData() {
        return Promise.resolve({});
      }
    },
  );
});
const engines: { destroy(): void }[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup() {
  const events = new EventTarget();
  const canvas = createCanvas(1000, 1000);
  const e = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => 1000,
      cssHeight: () => 1000,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(e);
  await e.initialize();
  const cues: string[] = [];
  e.events.on("cue:played", (v) => cues.push(v.cue));
  const key = async (code: string) => {
    events.dispatchEvent(
      Object.assign(new Event("keydown"), { code, repeat: false }),
    );
    await e.advance(1);
    events.dispatchEvent(Object.assign(new Event("keyup"), { code }));
  };
  const pose = (fn: (s: ReadState) => ReturnType<typeof e.debug.reset>) =>
    e.apply(fn);
  const snap = () => e.debug.snapshot(e.state);
  return { e, d: e.debug, pose, snap, key, cues, events };
}
async function isolated() {
  const t = await setup();
  t.pose((s) => t.d.setScreen(s, "playing"));
  t.pose(t.d.clearTargets);
  t.pose((s) => t.d.setWaveAdvance(s, false));
  t.pose((s) => t.d.setPodSpawn(s, false));
  return t;
}
function launchAt(
  t: Awaited<ReturnType<typeof setup>>,
  r: number,
  a: number,
  vr: number,
  vt = 0,
) {
  const p = point(r, a),
    rad = (a * Math.PI) / 180;
  t.pose((s) =>
    t.d.spawnBall(
      s,
      p.x,
      p.y,
      vr * Math.cos(rad) - vt * Math.sin(rad),
      vr * Math.sin(rad) + vt * Math.cos(rad),
    ),
  );
}
describe("Kessler through the Simple 2D engine", () => {
  it("boots, serves on confirm without also launching, and freezes animation while paused", async () => {
    const { e, d, key, snap } = await setup();
    expect(snap().rings.map((r) => r.targets.length)).toEqual([12, 16, 20]);
    expect(snap().balls).toEqual([]);
    await key("Enter");
    expect(snap().balls[0].parked).toBe(true);
    await key("Space");
    expect(snap().balls[0].parked).toBe(false);
    await key("KeyP");
    const saved = snap(),
      sim = e.state.simTicks;
    await e.advance(12);
    expect(snap().balls).toEqual(saved.balls);
    expect(e.state.simTicks).toBe(sim);
    expect(snap().ticks).toBe(saved.ticks + 12);
    await key("Escape");
    expect(snap().screen).toBe("playing");
    expect(d.menuItemRect(e.state, 0)).toBeNull();
  });
  it("navigates all menu screens with correct highlights and cues", async () => {
    const { key, snap, cues } = await setup();
    await key("ArrowUp");
    await key("Enter");
    expect(snap().screen).toBe("howto");
    await key("Escape");
    expect(snap().menu.index).toBe(1);
    await key("KeyW");
    await key("Enter");
    await key("Escape");
    await key("KeyS");
    await key("Enter");
    expect(snap().screen).toBe("title");
    expect(snap().menu.index).toBe(0);
    expect(cues).toContain(C.CUES.menuSelect);
  });
  it("accumulates fractional frames identically to full ticks", async () => {
    const a = await isolated(),
      b = await isolated();
    launchAt(a, 230, 20, 70);
    launchAt(b, 230, 20, 70);
    b.e.setClock(new SequenceClock([5, 10, 35]));
    await a.e.advance(60);
    await b.e.advance(60);
    expect(a.snap()).toEqual(b.snap());
  });
  it("uses immutable poses, validates domains and reconciles without moving time", async () => {
    const t = await setup(),
      s = t.e.state;
    expect(() => t.d.launchBall(s)).toThrow();
    expect(() => t.d.setWave(s, 0)).toThrow();
    expect(() => t.d.spawnTarget(s, 4, 0, 1)).toThrow();
    t.pose((v) => t.d.setPaddleAngle(v, -90));
    t.pose(t.d.parkBall);
    expect(t.snap().paddle.angleDeg).toBe(270);
    expect(s.balls).toHaveLength(0);
    expect(() => t.d.parkBall(t.e.state)).toThrow();
    t.pose((v) => t.d.setEffectTicks(v, "widen", 10));
    t.pose((v) => t.d.setEffectTicks(v, "narrow", 20));
    expect(t.snap().paddle.spanDeg).toBe(C.NARROW_SPAN_DEG);
    const before = t.snap();
    t.pose(t.d.reconcile);
    expect(t.snap()).toEqual(before);
  });
  it("applies deflector english and resets speed, reflecting in place", async () => {
    const t = await isolated();
    t.pose((s) => t.d.setPaddleAngle(s, 0));
    launchAt(t, 195, 10, -180);
    await t.e.advance(1);
    const b = t.snap().balls[0];
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(240);
    expect((Math.atan2(b.vy, b.vx) * 180) / Math.PI).toBeCloseTo(22);
    expect(Math.hypot(b.x - 500, b.y - 500)).toBeCloseTo(192);
    expect(t.cues).toEqual([C.CUES.paddleBounce]);
  });
  it("reflects at containment and consumes one shield in spawn order", async () => {
    const t = await isolated();
    launchAt(t, 471, 0, 240);
    await t.e.advance(1);
    expect(t.snap().balls[0].vx).toBeCloseTo(-240);
    t.pose(t.d.clearBalls);
    t.pose((s) => t.d.setShield(s, true));
    launchAt(t, 101, 0, -240);
    launchAt(t, 101, 0, -240);
    await t.e.advance(1);
    expect(t.snap().balls.map((b) => Math.sign(b.vx))).toEqual([1, -1]);
    expect(t.snap().effects.shieldActive).toBe(false);
  });
  it("scores separate armor hit and destruction, drawing a pod only on break", async () => {
    const t = await isolated();
    t.pose((s) => t.d.setPodSpawn(s, true));
    t.pose((s) => t.d.spawnTarget(s, 2, 0, 2));
    t.pose((s) => t.d.setRingSpeed(s, 2, 0));
    t.pose((s) => t.d.setNextPod(s, "pierce"));
    launchAt(t, 351, 10, 240);
    await t.e.advance(1);
    expect(t.snap().score).toBe(50);
    expect(t.snap().nextPod).toBe("pierce");
    t.pose(t.d.clearBalls);
    launchAt(t, 351, 10, 240);
    await t.e.advance(1);
    expect(t.snap().score).toBe(250);
    expect(t.snap().pods[0].kind).toBe("pierce");
    expect(t.snap().nextPod).toBeNull();
    expect(t.cues).toEqual([C.CUES.targetHit, C.CUES.targetBreak]);
  });
  it("leaves structural gaps untouched and handles an edge swept by a rotating ring", async () => {
    const t = await isolated();
    t.pose((s) => t.d.spawnTarget(s, 1, 0, 1));
    launchAt(t, 281, 0, 240);
    await t.e.advance(1);
    expect(t.snap().score).toBe(0);
    t.pose(t.d.clearBalls);
    t.pose((s) => t.d.spawnTarget(s, 2, 0, 2));
    t.pose((s) => t.d.setRingSpeed(s, 2, -60));
    launchAt(t, 372, 1.5, 0);
    await t.e.advance(1);
    expect(t.snap().score).toBe(50);
  });
  it("pierces armor without changing velocity and triggers the timed wave transition", async () => {
    const t = await isolated();
    t.pose((s) => t.d.setWaveAdvance(s, true));
    t.pose((s) => t.d.spawnTarget(s, 1, 0, 8));
    t.pose((s) => t.d.setEffectTicks(s, "pierce", 30));
    launchAt(t, 281, 15, 240);
    await t.e.advance(1);
    expect(t.snap().screen).toBe("waveclear");
    expect(t.snap().score).toBe(600);
    expect(t.snap().balls).toEqual([]);
    expect(t.snap().interstitialTicks).toBe(180);
    await t.e.advance(180);
    expect(t.snap().wave).toBe(2);
    expect(t.snap().balls[0].parked).toBe(true);
    expect(t.snap().rings[1].speedDegPerSec).toBe(15);
  });
  it.each(C.POD_KINDS)(
    "catches %s and applies its effect after the timer phase",
    async (kind) => {
      const t = await isolated();
      t.pose((s) => t.d.setPaddleAngle(s, 0));
      t.pose((s) => t.d.spawnPod(s, kind, 697, 500));
      await t.e.advance(1);
      expect(t.snap().score).toBe(25);
      expect(t.snap().pods).toEqual([]);
      if (kind === "widen") expect(t.snap().effects.widenTicks).toBe(600);
      if (kind === "narrow") expect(t.snap().paddle.spanDeg).toBe(30);
      if (kind === "pierce") expect(t.snap().effects.pierceTicks).toBe(360);
      if (kind === "shield") expect(t.snap().effects.shieldActive).toBe(true);
      if (kind === "multiball") expect(t.snap().balls).toHaveLength(2);
    },
  );
  it("burns pods, spends lives only on last-ball burn, and ends over silence", async () => {
    const t = await isolated();
    t.pose((s) => t.d.spawnPod(s, "shield", 579, 500));
    t.pose((s) => t.d.setLives(s, 1));
    launchAt(t, 79, 0, -240);
    await t.e.advance(1);
    expect(t.snap().screen).toBe("gameover");
    expect(t.snap().lives).toBe(0);
    expect(t.cues).toEqual([C.CUES.podBurn, C.CUES.ballLost, C.CUES.gameOver]);
    await t.key("Enter");
    expect(t.snap().screen).toBe("title");
  });
  it("clearing balls and targets is silent and does not cause a loss or wave", async () => {
    const t = await isolated();
    t.pose(t.d.parkBall);
    t.pose(t.d.clearBalls);
    await t.e.advance(3);
    expect(t.snap().lives).toBe(3);
    expect(t.snap().screen).toBe("playing");
    expect(t.cues).toEqual([]);
  });
  it("expires effects and enforces the six ball cap", async () => {
    const t = await isolated();
    for (let i = 0; i < 6; i++) launchAt(t, 250, 0, 0);
    expect(() => t.d.spawnBall(t.e.state, 0, 0, 0, 0)).toThrow();
    t.pose((s) => t.d.setEffectTicks(s, "widen", 1));
    await t.e.advance(1);
    expect(t.snap().paddle.spanDeg).toBe(48);
  });
  it("accepts touch releases only in the entry where the contact began", async () => {
    const t = await setup();
    const send = (type: string, x: number, y: number) =>
      t.events.dispatchEvent(
        Object.assign(new Event(type), {
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "touch",
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          isPrimary: true,
        }),
      );
    send("pointerdown", 500, 645);
    await t.e.advance(1);
    send("pointerup", 200, 645);
    await t.e.advance(1);
    expect(t.snap().screen).toBe("title");
    send("pointerdown", 500, 715);
    await t.e.advance(1);
    send("pointerup", 500, 715);
    await t.e.advance(1);
    expect(t.snap().screen).toBe("howto");
  });
});
