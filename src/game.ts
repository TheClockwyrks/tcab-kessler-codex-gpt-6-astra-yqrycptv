import type { Game } from "@clockwyrks/simple-2d";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import {
  type KesslerState,
  type Assets,
  initial,
  copy,
  span,
  addBall,
  launch,
  menuRect,
} from "./model";
import { debug } from "./debug";
import { tick } from "./simulation";
import { render, BACKGROUND } from "./render";
export { BACKGROUND };
export type { KesslerState };
export type KesslerDebugApi = typeof debug;
export const game: Game<KesslerState, KesslerDebugApi> = {
  async initialize(api) {
    for (const a of C.ACTIONS)
      api.input.register(a, { keys: [...C.BINDINGS[a]] });
    const paths = [
      C.SPRITE_PATHS.planet,
      ...Object.values(C.SPRITE_PATHS.pods),
      ...C.SPRITE_PATHS.ball,
    ];
    const images = Object.fromEntries(
      await Promise.all(
        paths.map(async (p) => [p, await api.assets.loadImage(p)]),
      ),
    );
    const systems = Object.fromEntries(
      await Promise.all(
        Object.entries(C.PARTICLE_PATHS).map(async ([k, p]) => [
          k,
          JSON.parse(await (await api.assets.load(p)).text()) as ParticleSystem,
        ]),
      ),
    );
    await Promise.all([
      ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
      ...Object.entries(C.BED_PATHS).map(([name, path]) =>
        api.audio.load(`music-${name}`, path),
      ),
    ]);
    for (const key of ["screen", "score", "lives", "wave"] as const)
      api.diagnostics.register(key, (s) => s[key]);
    api.diagnostics.register("paddle angle", (s) => s.angle);
    api.diagnostics.register("paddle span", span);
    api.diagnostics.register("balls", (s) => s.balls.length);
    api.diagnostics.register("targets", (s) =>
      s.rings.reduce((n, r) => n + r.targets.length, 0),
    );
    api.diagnostics.register("pods", (s) => s.pods.length);
    for (const key of [
      "widenTicks",
      "narrowTicks",
      "pierceTicks",
      "shieldActive",
    ] as const)
      api.diagnostics.register(key, (s) => s.effects[key]);
    return [initial({ images, systems } as Assets), debug];
  },
  update(state, api, dt) {
    let s = copy(state);
    s.delta = dt;
    s.fx = s.fx
      .map((f) => ({ ...f, age: f.age + dt }))
      .filter((f) => f.age < 1.2);
    const pressed = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
    );
    const turn = api.input.value("right") - api.input.value("left");
    const screen = state.screen;
    const sound = (cue: C.CueName) => api.audio.play(cue);
    const go = (name: C.Screen, index = 0) => {
      s.screen = name;
      s.menu.index = index;
      s.press = null;
    };
    if (screen === "title" || screen === "paused") {
      if (pressed.up || pressed.down) {
        s.menu.index = 1 - s.menu.index;
        sound(C.CUES.menuMove);
      }
      let accept = pressed.confirm;
      for (const sample of api.input.pointerSamples()) {
        let hit = -1;
        for (let i = 0; i < 2; i++) {
          const r = menuRect(s, i)!;
          if (
            sample.x >= r.x &&
            sample.x <= r.x + r.width &&
            sample.y >= r.y &&
            sample.y <= r.y + r.height
          )
            hit = i;
        }
        if (
          hit >= 0 &&
          (sample.type === "move" || sample.type === "down") &&
          s.menu.index !== hit
        ) {
          s.menu.index = hit;
          sound(C.CUES.menuMove);
        }
        if (sample.type === "down")
          s.press = hit < 0 ? null : { id: sample.id, index: hit };
        if (sample.type === "up") {
          if (s.press?.id === sample.id && s.press.index === hit) {
            s.menu.index = hit;
            accept = true;
          }
          s.press = null;
        }
      }
      if (screen === "paused" && (pressed.back || pressed.pause)) go("playing");
      else if (accept) {
        sound(C.CUES.menuSelect);
        if (screen === "title") {
          if (s.menu.index === 0) {
            const ticks = s.ticks;
            const accumulator = s.accumulator;
            s = initial(s.assets);
            s.ticks = ticks;
            s.accumulator = accumulator;
            go("playing");
            addBall(s, true);
          } else go("howto");
        } else if (s.menu.index === 0) go("playing");
        else {
          const ticks = s.ticks;
          const accumulator = s.accumulator;
          s = initial(s.assets);
          s.ticks = ticks;
          s.accumulator = accumulator;
          go("title");
        }
      }
    } else if (screen === "howto" && (pressed.confirm || pressed.back))
      go("title", 1);
    else if (screen === "gameover" && pressed.confirm) go("title");
    else if (screen === "playing") {
      if (pressed.back || pressed.pause) go("paused");
      else if (pressed.launch && s.balls.some((b) => b.parked)) launch(s);
    }
    s.accumulator += dt;
    while (s.accumulator + 1e-10 >= C.TICK_DT) {
      s.accumulator = Math.max(0, s.accumulator - C.TICK_DT);
      tick(s, turn, sound);
    }
    const bed =
      s.screen === "gameover"
        ? null
        : s.screen === "title" || s.screen === "howto"
          ? "title"
          : "play";
    for (const name of Object.keys(C.BED_PATHS)) {
      const cue = `music-${name}`;
      if (name === bed) api.audio.loop(cue);
      else api.audio.stop(cue);
    }
    return s;
  },
  render,
};
