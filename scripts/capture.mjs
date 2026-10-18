/* global document */
// Development-only capture driver; run with the Vite server at localhost:5173.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
await page.goto("http://localhost:5173");
await page.waitForTimeout(700);
await page.screenshot({ path: "showcase/title.png" });
await page.evaluate(async () => {
  const { createEngine, ConstantClock } =
    await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
  const { game, BACKGROUND } = await import("/src/game.ts");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
  document.body.append(canvas);
  const e = createEngine({
    canvas,
    width: 1000,
    height: 1000,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / 60),
  });
  await e.initialize();
  // This handle belongs solely to the external capture driver, never the game.
  globalThis.captureEngine = e;
  const d = e.debug;
  e.apply((s) => d.setScreen(s, "playing"));
  e.apply((s) => d.setPaddleAngle(s, 115));
  e.apply((s) => d.setScore(s, 3275));
  e.apply((s) => d.setEffectTicks(s, "pierce", 360));
  e.apply((s) => d.setShield(s, true));
  e.apply((s) => d.spawnBall(s, 728, 631, 208, 120));
  e.apply((s) => d.spawnBall(s, 252, 628, -190, 95));
  e.apply((s) => d.spawnBall(s, 443, 241, -50, -235));
  e.apply((s) => d.spawnPod(s, "widen", 400, 730));
  e.apply((s) => d.spawnPod(s, "multiball", 685, 280));
  await e.advance(18);
});
await page.screenshot({ path: "showcase/field.png" });
const recording = await page.evaluate(async () => {
  const e = globalThis.captureEngine;
  e.startRecording();
  for (let i = 0; i < 210; i++) {
    if (i % 45 === 0) e.apply((s) => e.debug.setPaddleAngle(s, 115 + i * 0.75));
    await e.advance(1);
  }
  return e.stopRecording();
});
writeFileSync(
  "showcase/orbital-cascade.json.gz",
  gzipSync(JSON.stringify(recording)),
);
await browser.close();
