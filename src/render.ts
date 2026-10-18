import type { RenderApi } from "@clockwyrks/simple-2d";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import { type ReadState, rad, point, span, menuRect } from "./model";
export const BACKGROUND = "#060e16";
// Presentation-only players are scoped to the engine context, never to gameplay state.
const players = new WeakMap<
  CanvasRenderingContext2D,
  Map<number, { player: ParticleCanvasPlayer; age: number }>
>();
const ink = "#e8f4f4",
  muted = "#7896a6",
  cyan = "#9aede8",
  amber = "#edae79";
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = ink,
  align: CanvasTextAlign = "left",
  font = "monospace",
) {
  ctx.fillStyle = color;
  ctx.font = `${size >= 30 ? "600" : "400"} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function arc(ctx: CanvasRenderingContext2D, r: number, start = 0, end = 360) {
  ctx.beginPath();
  ctx.arc(C.STAGE_CX, C.STAGE_CY, r, start * rad, end * rad);
}
function band(
  ctx: CanvasRenderingContext2D,
  inner: number,
  outer: number,
  start: number,
  end: number,
) {
  ctx.beginPath();
  ctx.arc(C.STAGE_CX, C.STAGE_CY, outer, start * rad, end * rad);
  ctx.arc(C.STAGE_CX, C.STAGE_CY, inner, end * rad, start * rad, true);
  ctx.closePath();
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  xx: number,
  yy: number,
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(xx, yy);
  ctx.stroke();
}
function image(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  size: number,
) {
  ctx.drawImage(s.assets.images[path], x - size / 2, y - size / 2);
}
function field(s: ReadState, ctx: CanvasRenderingContext2D) {
  const glow = ctx.createRadialGradient(500, 500, 60, 500, 500, 500);
  glow.addColorStop(0, "#142c36");
  glow.addColorStop(0.5, "#0b1a25");
  glow.addColorStop(1, BACKGROUND);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  for (let i = 0; i < 210; i++) {
    const x = (Math.sin(i * 91.7) * 43758.5453) % 1,
      y = (Math.sin(i * 27.1 + 8) * 18329.7) % 1;
    ctx.fillStyle = i % 9 === 0 ? "#6b8c9c" : "#263c4b";
    ctx.beginPath();
    ctx.arc(
      Math.abs(x) * 1000,
      Math.abs(y) * 1000,
      i % 9 === 0 ? 1.25 : 0.65,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#203d4a";
  arc(ctx, C.FIELD_RADIUS);
  ctx.stroke();
  ctx.strokeStyle = "#142b38";
  arc(ctx, C.FIELD_RADIUS + 6);
  ctx.stroke();
  for (let a = 0; a < 360; a += 3) {
    const p = point(C.FIELD_RADIUS + 5, a),
      q = point(C.FIELD_RADIUS + (a % 15 === 0 ? 12 : 8), a);
    ctx.strokeStyle = a % 15 === 0 ? "#48616b" : "#1c3440";
    line(ctx, p.x, p.y, q.x, q.y);
  }
  for (let i = 0; i < s.rings.length; i++) {
    const ring = s.rings[i],
      d = C.RINGS[i];
    ctx.strokeStyle = "#18303d";
    ctx.setLineDash([2, 9]);
    arc(ctx, d.midRadius);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const t of ring.targets) {
      const a = ring.angleDeg + t.slot * d.slotWidthDeg + C.STRUCTURAL_GAP_DEG,
        b = a + d.targetArcDeg;
      const damaged = i === 1 && t.hp === 1;
      band(ctx, d.innerRadius, d.outerRadius, a, b);
      const g = ctx.createLinearGradient(
        0,
        500 - d.outerRadius,
        0,
        500 + d.outerRadius,
      );
      g.addColorStop(
        0,
        damaged ? "#654c3c" : ["#365766", "#456170", "#314653"][i],
      );
      g.addColorStop(1, damaged ? "#292b2b" : "#172d38");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = damaged
        ? "#b78460"
        : ["#75959f", "#8ea9ae", "#617d89"][i];
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = damaged ? "#e0a26c" : i === 1 ? "#9bb9bc" : "#4b7685";
      ctx.lineWidth = 2;
      arc(ctx, d.innerRadius + 4, a + 1, b - 1);
      ctx.stroke();
      for (let j = 1; j < 5; j++) {
        const ang = a + (d.targetArcDeg * j) / 5;
        const p = point(d.innerRadius + 7, ang),
          q = point(d.outerRadius - 4, ang);
        ctx.strokeStyle = "#0b202c";
        ctx.lineWidth = 2;
        line(ctx, p.x, p.y, q.x, q.y);
      }
      const p = point(d.midRadius, (a + b) / 2);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(((a + b) / 2 + 90) * rad);
      ctx.fillStyle = damaged ? amber : "#c3d3cc";
      ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = "#304a55";
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
      if (damaged) {
        const p1 = point(d.innerRadius, a + 4),
          p2 = point(d.midRadius, a + 8),
          p3 = point(d.outerRadius, a + 5);
        ctx.strokeStyle = "#e8b287";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = "#26434d";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 8]);
  arc(ctx, (C.DEFLECTOR_TRACK_INNER + C.DEFLECTOR_TRACK_OUTER) / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const half = span(s) / 2;
  band(
    ctx,
    C.DEFLECTOR_TRACK_INNER,
    C.DEFLECTOR_TRACK_OUTER,
    s.angle - half,
    s.angle + half,
  );
  ctx.fillStyle = "#547f89";
  ctx.fill();
  ctx.strokeStyle = cyan;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowColor = cyan;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#d3ffef";
  ctx.lineWidth = 3;
  arc(ctx, C.DEFLECTOR_TRACK_OUTER, s.angle - half + 1, s.angle + half - 1);
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (const a of [s.angle - half + 3, s.angle + half - 3]) {
    const p = point(178, a);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#28404a";
  arc(ctx, 112);
  ctx.stroke();
  for (let a = 0; a < 360; a += 90) {
    const p = point(118, a),
      q = point(125, a);
    line(ctx, p.x, p.y, q.x, q.y);
  }
  image(
    s,
    ctx,
    C.SPRITE_PATHS.planet,
    C.STAGE_CX,
    C.STAGE_CY,
    C.PLANET_SPRITE_SIZE,
  );
  if (s.effects.shieldActive) {
    ctx.strokeStyle = "#88dfff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#60bdff";
    arc(ctx, C.SHIELD_RADIUS);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  for (const p of s.pods) {
    const pos = point(p.r, p.a);
    image(s, ctx, C.SPRITE_PATHS.pods[p.kind], pos.x, pos.y, C.POD_SPRITE_SIZE);
  }
  for (const b of s.balls) {
    if (s.effects.pierceTicks) {
      ctx.strokeStyle = amber;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    const frame =
      Math.floor((s.simTicks - b.born) / C.BALL_FRAME_TICKS) %
      C.BALL_SPIN_FRAMES;
    image(s, ctx, C.SPRITE_PATHS.ball[frame], b.x, b.y, C.BALL_SPRITE_SIZE);
  }
  let active = players.get(ctx);
  if (!active) {
    active = new Map();
    players.set(ctx, active);
  }
  const liveIds = new Set(s.fx.map((f) => f.id));
  for (const id of active.keys()) if (!liveIds.has(id)) active.delete(id);
  for (const f of s.fx) {
    ctx.save();
    ctx.translate(f.x, f.y);
    const system = s.assets.systems[f.kind] as ParticleSystem;
    const w = ctx.canvas.width,
      h = ctx.canvas.height;
    ctx.scale(system.field.width / w, system.field.height / h);
    ctx.translate(0, -h);
    let playback = active.get(f.id);
    if (!playback || f.age < playback.age) {
      playback = {
        player: new ParticleCanvasPlayer(system, ctx, {
          seed: f.id * 9137,
          clear: false,
          pixelRadius: 1,
          composite: "lighter",
        }),
        age: 0,
      };
      active.set(f.id, playback);
    }
    playback.player.update(Math.max(0, f.age - playback.age));
    playback.age = f.age;
    ctx.restore();
  }
}
function hud(s: ReadState, ctx: CanvasRenderingContext2D) {
  text(ctx, "K / ORBITAL DEMOLITION", 30, 30, 12, muted);
  text(ctx, "SCORE", 30, 63, 12, muted);
  text(ctx, s.score.toString().padStart(6, "0"), 30, 93, 27, ink);
  text(ctx, "WAVE", 970, 32, 12, muted, "right");
  text(ctx, s.wave.toString().padStart(2, "0"), 970, 64, 27, ink, "right");
  text(ctx, "HULL", 30, 936, 12, muted);
  text(ctx, `${s.lives} / ${C.START_LIVES}`, 30, 966, 24, cyan);
  text(ctx, "A / D  ROTATE", 970, 936, 12, muted, "right");
  text(ctx, "SPACE  LAUNCH   ·   P  PAUSE", 970, 962, 12, muted, "right");
  let y = 118;
  for (const k of ["widen", "narrow", "pierce", "shield"] as const) {
    const ticks =
      k === "shield"
        ? s.effects.shieldActive
          ? 1
          : 0
        : s.effects[`${k}Ticks`];
    if (ticks) {
      image(s, ctx, C.SPRITE_PATHS.pods[k], 42, y, C.POD_SPRITE_SIZE);
      text(
        ctx,
        k === "shield" ? "READY" : `${Math.ceil(ticks / C.TICK_HZ)}s`,
        62,
        y + 5,
        12,
        cyan,
      );
      y += 26;
    }
  }
  if (s.balls.some((b) => b.parked))
    text(ctx, "SPACE TO DEPLOY", 500, 627, 12, cyan, "center");
}
function veil(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#040c16d9";
  ctx.fillRect(0, 0, 1000, 1000);
}
function menu(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  items: readonly string[],
) {
  items.forEach((label, i) => {
    const r = menuRect(s, i)!;
    const on = s.menu.index === i;
    ctx.fillStyle = on ? "#a6e7df" : "#102330";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = on ? "#d6fff5" : "#34515f";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.width - 1, r.height - 1);
    text(ctx, label, 500, r.y + 34, 18, on ? "#09252d" : muted, "center");
    if (on) text(ctx, "›", r.x + 20, r.y + 35, 23, "#1e5159");
  });
}
export function render(s: ReadState, { ctx }: RenderApi) {
  field(s, ctx);
  if (["playing", "paused", "waveclear", "gameover"].includes(s.screen))
    hud(s, ctx);
  if (s.screen === "playing") return;
  veil(ctx);
  if (s.screen === "title") {
    text(
      ctx,
      "O R B I T A L   R E C O V E R Y   D I V I S I O N",
      500,
      272,
      13,
      cyan,
      "center",
    );
    text(ctx, C.TITLE_TEXT, 500, 407, 102, ink, "center", "sans-serif");
    ctx.strokeStyle = "#4c7982";
    line(ctx, 340, 438, 660, 438);
    text(
      ctx,
      "A BEAUTIFUL CASCADE OF CONSEQUENCES",
      500,
      478,
      13,
      muted,
      "center",
    );
    text(
      ctx,
      "Break the orbit. Keep the planet.",
      500,
      529,
      20,
      "#b9cbce",
      "center",
      "sans-serif",
    );
    menu(s, ctx, C.TITLE_ITEMS);
    text(ctx, "↑ ↓  SELECT     ENTER  CONFIRM", 500, 814, 12, muted, "center");
    text(ctx, "SECTOR 07  /  LOW ORBIT", 48, 951, 12, muted);
    text(ctx, "KESSLER  ·  01", 952, 951, 12, muted, "right");
  } else if (s.screen === "paused") {
    text(ctx, "FLIGHT SUSPENDED", 500, 370, 13, cyan, "center");
    text(ctx, "PAUSED", 500, 448, 64, ink, "center", "sans-serif");
    text(ctx, "Your orbit is holding.", 500, 502, 18, muted, "center");
    menu(s, ctx, C.PAUSE_ITEMS);
  } else if (s.screen === "howto") {
    text(ctx, "MISSION BRIEF", 150, 180, 13, cyan);
    text(ctx, C.TITLE_ITEMS[1], 150, 242, 50, ink, "left", "sans-serif");
    const rows = [
      [
        "01 / DEFLECT",
        "Circle the planet. Send the demolition ball back into orbit.",
      ],
      [
        "02 / DEMOLISH",
        "Hit derelicts to score. Clear all three rings to finish a wave.",
      ],
      [
        "03 / SURVIVE",
        "A ball that reaches the planet burns up. Lose the last ball,",
        "lose a life. Steer each bounce with the edge of your deflector.",
      ],
      [
        "04 / SALVAGE",
        "Destroyed derelicts shed pods. Sweep beneath them to catch",
        "new tools — but watch for the amber narrowing pod.",
      ],
    ];
    let y = 318;
    for (const row of rows) {
      text(ctx, row[0], 150, y, 14, cyan);
      for (let i = 1; i < row.length; i++)
        text(ctx, row[i], 150, y + 29 * i, 18, "#b8cbd2", "left", "sans-serif");
      y += row.length === 4 ? 123 : 105;
    }
    const kinds = C.POD_KINDS;
    kinds.forEach((k, i) => {
      image(s, ctx, C.SPRITE_PATHS.pods[k], 190 + i * 150, 761, 24);
      text(ctx, k.toUpperCase(), 190 + i * 150, 798, 11, muted, "center");
    });
    text(
      ctx,
      "← → / A D  ROTATE     SPACE  LAUNCH     ESC / P  PAUSE",
      500,
      858,
      13,
      cyan,
      "center",
    );
    text(
      ctx,
      "↑ ↓ / W S  MENU     ENTER / SPACE  CONFIRM     ESC  BACK",
      500,
      888,
      13,
      muted,
      "center",
    );
    text(ctx, "ENTER OR ESC TO RETURN", 500, 940, 13, ink, "center");
  } else if (s.screen === "waveclear") {
    text(ctx, "ORBIT SECURED", 500, 425, 16, cyan, "center");
    text(
      ctx,
      `WAVE ${s.wave} CLEAR`,
      500,
      493,
      55,
      ink,
      "center",
      "sans-serif",
    );
    text(
      ctx,
      `+${C.WAVE_CLEAR_BONUS_PER_WAVE * s.wave}  CLEANUP BONUS`,
      500,
      548,
      17,
      amber,
      "center",
    );
    text(ctx, "Preparing the next debris field", 500, 610, 16, muted, "center");
  } else {
    text(ctx, "SIGNAL LOST", 500, 352, 14, amber, "center");
    text(ctx, C.GAMEOVER_TEXT, 500, 438, 65, ink, "center", "sans-serif");
    text(
      ctx,
      s.score.toString().padStart(6, "0"),
      500,
      535,
      43,
      cyan,
      "center",
    );
    text(
      ctx,
      `FINAL SCORE   /   WAVE ${s.wave}`,
      500,
      576,
      13,
      muted,
      "center",
    );
    text(ctx, "ENTER / SPACE TO RETURN", 500, 710, 15, ink, "center");
  }
}
