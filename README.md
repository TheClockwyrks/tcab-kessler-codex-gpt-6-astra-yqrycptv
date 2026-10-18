# Kessler

An orbital demolition arcade game. Circle a warm planet with a deflector, steer a spinning demolition ball through three rings of derelicts, and catch the salvage that falls from the wreckage. Clear the orbit to enter a faster wave. Keep one ball alive to preserve your hull.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local address Vite prints. Everything runs in the browser. Sound unlocks on the first keyboard or pointer interaction.

## Build

```sh
npm run build
npm run preview
```

Publish the complete `dist/` directory. The site supports a static host's root or a subdirectory. Assets are committed under `assets/`; `public/assets` links that directory into Vite's static bundle. No asset-generation programs, network services, or credentials are needed to build or play.

## Controls

- **Left / Right** or **A / D**: rotate the deflector.
- **Space**: launch the parked ball.
- **P** or **Escape**: pause or resume.
- **Up / Down** or **W / S**: select a menu item.
- **Enter / Space**: confirm; **Escape**: return from instructions.
- Mouse, pen, and touch operate the menus. Flight uses the keyboard.
- **Backtick**: engine diagnostics.

Hit near the deflector's edge to steer the outgoing bounce. Cyan outward chevrons widen it; amber inward chevrons narrow it. Three violet dots launch extra balls, the blue shield catches one missed ball, and the gold bolt lets every ball pierce armor.

## Verification

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The tests run the actual Simple 2D engine with a counted clock and locally decoded sprites, covering menu input, fixed-step simulation, collisions, salvage, scoring, and lifecycle transitions. `src/model.ts` holds the state and geometry, `src/simulation.ts` resolves ticks, `src/debug.ts` provides the specified pure poses, and `src/render.ts` draws the scene. `src/game.ts` connects those modules to the engine.

## Original assets and showcase

The original planet and five pod sprites were rasterized with `draw`, the six spin frames with `draw-sheet`, and three live particle systems with `particle-2d`. Thirteen synthesized cues and two sequenced music beds use `sfx-synth` and `music`. `scripts/produce.py` preserves their one-time authoring recipe; it is not part of any install or build command. A short endpoint taper closes the music loops.

`showcase/` contains player-facing copy, screenshots, and a live-play recording captured with the engine recorder.
