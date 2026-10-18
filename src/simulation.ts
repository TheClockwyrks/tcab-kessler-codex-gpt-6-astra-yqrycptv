import * as C from "./constants";
import {
  type KesslerState,
  type Ball,
  rad,
  norm,
  offset,
  polar,
  point,
  span,
  speed,
  addBall,
  drawPod,
  effect,
  emptyEffects,
  rings,
} from "./model";
export type Sound = (cue: C.CueName) => void;
function burst(s: KesslerState, kind: string, x: number, y: number) {
  s.fx.push({ id: ++s.serial, kind, x, y, age: 0 });
}
function resetEffects(s: KesslerState) {
  s.effects = emptyEffects();
  s.pods = [];
}
/** Surface reflection, moving-ring impulse, speed preservation, then radial decay. */
export function reflect(
  b: Ball,
  angle: number,
  r: number,
  edge = false,
  kick = 0,
) {
  const speedIn = Math.hypot(b.vx, b.vy);
  const nx = Math.cos(angle * rad),
    ny = Math.sin(angle * rad);
  const sx = edge ? -ny : nx,
    sy = edge ? nx : ny;
  const dot = b.vx * sx + b.vy * sy;
  let vx = b.vx - 2 * dot * sx - ny * kick * rad * r * C.RING_KICK_FACTOR;
  let vy = b.vy - 2 * dot * sy + nx * kick * rad * r * C.RING_KICK_FACTOR;
  const len = Math.hypot(vx, vy);
  if (len === 0) return;
  vx *= speedIn / len;
  vy *= speedIn / len;
  const heading = Math.atan2(vy, vx) / rad;
  const axis = vx * nx + vy * ny >= 0 ? angle : angle + 180;
  const phi = offset(heading, axis);
  const out =
    heading - Math.sign(phi) * Math.min(C.ORBITAL_DECAY_DEG, Math.abs(phi));
  b.vx = speedIn * Math.cos(out * rad);
  b.vy = speedIn * Math.sin(out * rad);
}
function catchPod(s: KesslerState, kind: C.PodKind, sound: Sound) {
  s.score += C.POD_CATCH_SCORE;
  sound(kind === "narrow" ? C.CUES.podCatchNarrow : C.CUES.podCatch);
  switch (kind) {
    case "widen":
      effect(s, kind, C.WIDEN_DURATION_TICKS);
      break;
    case "narrow":
      effect(s, kind, C.NARROW_DURATION_TICKS);
      break;
    case "pierce":
      effect(s, kind, C.PIERCE_DURATION_TICKS);
      break;
    case "shield":
      s.effects.shieldActive = true;
      break;
    case "multiball":
      for (
        let i = 0;
        i < C.MULTIBALL_LAUNCH_COUNT && s.balls.length < C.BALL_CAP;
        i++
      )
        addBall(
          s,
          false,
          s.angle + (i === 0 ? 1 : -1) * C.MULTIBALL_OFFSET_DEG,
        );
  }
}
function damage(s: KesslerState, i: number, slot: number, sound: Sound) {
  const ring = s.rings[i],
    def = C.RINGS[i],
    target = ring.targets.find((t) => t.slot === slot)!;
  target.hp = s.effects.pierceTicks > 0 ? 0 : target.hp - 1;
  if (target.hp > 0) {
    s.score += C.HIT_SCORE;
    sound(C.CUES.targetHit);
    return;
  }
  ring.targets = ring.targets.filter((t) => t !== target);
  s.score += def.destroyScore;
  sound(C.CUES.targetBreak);
  const a = norm(
      ring.angleDeg +
        slot * def.slotWidthDeg +
        C.STRUCTURAL_GAP_DEG +
        def.targetArcDeg / 2,
    ),
    p = point(def.midRadius, a);
  burst(s, "burst", p.x, p.y);
  if (s.podSpawn) {
    const k =
      s.nextPod === null ? drawPod() : s.nextPod === "none" ? null : s.nextPod;
    s.nextPod = null;
    if (k) s.pods.push({ kind: k, r: def.midRadius, a });
  }
  if (s.waveAdvance && s.rings.every((r) => r.targets.length === 0)) {
    s.score += C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave;
    s.balls = [];
    resetEffects(s);
    s.screen = "waveclear";
    s.interstitialTicks = C.WAVECLEAR_TICKS;
    sound(C.CUES.waveClear);
  }
}
export function tick(s: KesslerState, turn: number, sound: Sound) {
  s.ticks++;
  if (s.screen === "waveclear") {
    s.interstitialTicks = Math.max(0, s.interstitialTicks - 1);
    if (s.interstitialTicks === 0) {
      s.wave++;
      s.rings = rings(s.wave);
      s.screen = "playing";
      addBall(s, true);
    }
    return;
  }
  if (s.screen !== "playing") return;
  s.simTicks++;
  s.angle = norm(s.angle + turn * C.DEFLECTOR_TURN_DEG_PER_SEC * C.TICK_DT);
  const oldAngles = s.rings.map((r) => r.angleDeg);
  s.rings.forEach(
    (r) => (r.angleDeg = norm(r.angleDeg + r.speedDegPerSec * C.TICK_DT)),
  );
  for (const k of ["widenTicks", "narrowTicks", "pierceTicks"] as const)
    s.effects[k] = Math.max(0, s.effects[k] - 1);
  s.pods = s.pods.filter((p) => {
    const prev = p.r;
    p.r -= C.POD_FALL_SPEED * C.TICK_DT;
    if (
      prev > C.DEFLECTOR_POD_CATCH_RADIUS &&
      p.r <= C.DEFLECTOR_POD_CATCH_RADIUS &&
      Math.abs(offset(p.a, s.angle)) <= span(s) / 2
    ) {
      catchPod(s, p.kind, sound);
      return false;
    }
    if (p.r <= C.BURNUP_RADIUS) {
      const pos = point(p.r, p.a);
      burst(s, "burnup", pos.x, pos.y);
      sound(C.CUES.podBurn);
      return false;
    }
    return true;
  });
  let burned = false;
  const survivors: Ball[] = [];
  for (const b of s.balls) {
    if (b.parked) {
      Object.assign(b, point(C.DEFLECTOR_BALL_CONTACT_RADIUS, s.angle));
      survivors.push(b);
      continue;
    }
    const prev = polar(b.x, b.y);
    b.x += b.vx * C.TICK_DT;
    b.y += b.vy * C.TICK_DT;
    const next = polar(b.x, b.y);
    const inward =
      b.vx * Math.cos(next.a * rad) + b.vy * Math.sin(next.a * rad) < 0;
    if (
      prev.r > C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      next.r <= C.DEFLECTOR_BALL_CONTACT_RADIUS &&
      inward &&
      Math.abs(offset(next.a, s.angle)) <= span(s) / 2
    ) {
      const nx = Math.cos(next.a * rad),
        ny = Math.sin(next.a * rad),
        dot = b.vx * nx + b.vy * ny;
      const heading =
        Math.atan2(b.vy - 2 * dot * ny, b.vx - 2 * dot * nx) / rad +
        C.ENGLISH_DEG_PER_OFFSET_DEG * offset(next.a, s.angle);
      const a =
        next.a +
        Math.max(
          -C.BOUNCE_CLAMP_DEG,
          Math.min(C.BOUNCE_CLAMP_DEG, offset(heading, next.a)),
        );
      b.vx = speed(s.wave) * Math.cos(a * rad);
      b.vy = speed(s.wave) * Math.sin(a * rad);
      sound(C.CUES.paddleBounce);
      burst(s, "spark", b.x, b.y);
    }
    for (let i = 0; i < s.rings.length; i++) {
      const r = s.rings[i],
        d = C.RINGS[i];
      const face =
        (prev.r > d.outerContactRadius && next.r <= d.outerContactRadius) ||
        (prev.r < d.innerContactRadius && next.r >= d.innerContactRadius);
      if (
        !face &&
        (next.r < d.innerContactRadius || next.r > d.outerContactRadius)
      )
        continue;
      for (const t of [...r.targets]) {
        const center =
          r.angleDeg +
          t.slot * d.slotWidthDeg +
          C.STRUCTURAL_GAP_DEG +
          d.targetArcDeg / 2;
        const inside = Math.abs(offset(next.a, center)) <= d.targetArcDeg / 2;
        const wasInside =
          Math.abs(
            offset(
              prev.a,
              oldAngles[i] +
                t.slot * d.slotWidthDeg +
                C.STRUCTURAL_GAP_DEG +
                d.targetArcDeg / 2,
            ),
          ) <=
          d.targetArcDeg / 2;
        if (inside && (face || !wasInside)) {
          if (s.effects.pierceTicks === 0)
            reflect(b, next.a, next.r, !face, r.speedDegPerSec);
          damage(s, i, t.slot, sound);
          break;
        }
      }
      if ((s.screen as C.Screen) === "waveclear") return;
    }
    if (
      s.effects.shieldActive &&
      prev.r > C.SHIELD_CONTACT_RADIUS &&
      next.r <= C.SHIELD_CONTACT_RADIUS
    ) {
      reflect(b, next.a, next.r);
      s.effects.shieldActive = false;
      sound(C.CUES.shieldReflect);
      burst(s, "spark", b.x, b.y);
    }
    if (
      prev.r < C.FIELD_CONTACT_RADIUS &&
      next.r >= C.FIELD_CONTACT_RADIUS &&
      !inward
    ) {
      reflect(b, next.a, next.r);
      sound(C.CUES.fieldBounce);
      burst(s, "spark", b.x, b.y);
    }
    if (next.r <= C.BURNUP_RADIUS) {
      burned = true;
      sound(C.CUES.ballLost);
      burst(s, "burnup", b.x, b.y);
    } else survivors.push(b);
  }
  s.balls = survivors;
  if (burned && s.balls.length === 0) {
    s.lives = Math.max(0, s.lives - 1);
    resetEffects(s);
    if (s.lives > 0) addBall(s, true);
    else {
      s.screen = "gameover";
      s.menu.index = 0;
      sound(C.CUES.gameOver);
    }
  }
}
