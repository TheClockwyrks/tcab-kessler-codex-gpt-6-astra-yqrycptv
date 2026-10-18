"""One-time asset authoring. Not part of the build."""
import json, math, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parents[1]

def run(*a):
    p = subprocess.run([str(x) for x in a], capture_output=True, text=True, cwd='/tmp')
    if p.returncode:
        raise RuntimeError(p.stderr + p.stdout)

def sprite(path, w, ops, tool='draw'):
    f = '/tmp/pixels.json'
    pathlib.Path(f).write_text(json.dumps(ops))
    run(tool, 'render', '--actions', f, '--out', root / 'assets' / path, '--width', w, '--height', w)

def pixel(x, y, c):
    return dict(op='set_pixel', x=x, y=y, color=c)

def color(rgb):
    return '#' + ''.join((f'{max(0, min(255, int(v))):02x}' for v in rgb)) + 'ff'
ops = []
for y in range(160):
    for x in range(160):
        X = (x - 79.5) / 70
        Y = (y - 79.5) / 70
        r = X * X + Y * Y
        if r <= 1:
            z = math.sqrt(1 - r)
            light = max(0, -X * 0.6 - Y * 0.45 + z * 0.65)
            n = math.sin(X * 5 + Y * 2 + z * 3) + math.sin(Y * 7 - z * 4 + X * 2) * 0.65 + math.sin(X * 13 - Y * 10 + z * 8) * 0.25 + math.sin(X * 29 + Y * 23 + z * 17) * 0.12
            land = n > 0.35
            base = (178, 133, 83) if land else (41, 88, 103)
            clouds = max(0, math.sin(Y * 16 + X * 5 + math.sin(X * 7 + z * 6) * 2) + math.sin(X * 23 + Y * 12) * 0.3 - 0.65) * 0.6
            rgb = [b * (0.19 + 0.81 * light) + clouds * 100 * light for b in base]
            rim = (1 - z) ** 6
            ops.append(pixel(x, y, color([rgb[0] + rim * 28, rgb[1] + rim * 65, rgb[2] + rim * 75])))
        elif r < 1.15:
            a = int(65 * (1 - (r - 1) / 0.15) ** 2)
            ops.append(pixel(x, y, f'#79ccdf{a:02x}'))
sprite('sprites/planet.png', 160, ops)
colors = ['#83eed6ff', '#ff906fff', '#b9a5ffff', '#76cfffff', '#ffe1a0ff']
for k, c in zip(['widen', 'narrow', 'multiball', 'shield', 'pierce'], colors):
    ops = [dict(op='fill_circle', cx=12, cy=12, r=10, color='#102630ff'), dict(op='stroke_circle', cx=12, cy=12, r=10, color=c)]

    def line(x1, y1, x2, y2):
        ops.append(dict(op='line', x0=x1, y0=y1, x1=x2, y1=y2, color=c))
    if k == 'widen':
        for s in [-1, 1]:
            line(12 + s * 7, 12, 12 + s * 2, 7)
            line(12 + s * 7, 12, 12 + s * 2, 17)
    elif k == 'narrow':
        for s in [-1, 1]:
            line(12 + s * 2, 12, 12 + s * 7, 7)
            line(12 + s * 2, 12, 12 + s * 7, 17)
    elif k == 'multiball':
        for x, y in [(8, 15), (16, 15), (12, 7)]:
            ops.append(dict(op='fill_circle', cx=x, cy=y, r=3, color=c))
    elif k == 'shield':
        for a, b, d, e in [(6, 7, 18, 7), (6, 7, 7, 15), (18, 7, 17, 15), (7, 15, 12, 19), (17, 15, 12, 19)]:
            line(a, b, d, e)
    else:
        for a, b, d, e in [(14, 5, 8, 13), (8, 13, 15, 11), (15, 11, 10, 19)]:
            line(a, b, d, e)
    sprite('sprites/pods/' + k + '.png', 24, ops)
for frame in range(6):
    ops = []
    for y in range(24):
        for x in range(24):
            X = (x - 11.5) / 8
            Y = (y - 11.5) / 8
            r = X * X + Y * Y
            if r <= 1:
                z = math.sqrt(1 - r)
                light = 0.4 + 0.6 * max(0, -X * 0.4 - Y * 0.5 + z * 0.8)
                band = math.sin(math.atan2(X, z) * 3 + frame * math.pi / 3) > 0.5
                base = (104, 211, 236) if band else (233, 250, 250)
                ops.append(pixel(x, y, color([b * light for b in base])))
            elif r < 1.8:
                ops.append(pixel(x, y, '#65dfff' + f'{int(40 * (1.8 - r) / 0.8):02x}'))
    sprite(f'sprites/ball/{frame}.png', 24, ops, 'draw-sheet')

def config(name, extra):
    p = '/tmp/' + name + '.json'
    d = dict(actions='/tmp/' + name + '-ops.json', preview='/tmp/' + name + '.png', seed=42)
    d.update(extra)
    pathlib.Path(p).write_text(json.dumps(d))
    return p
for name, c, count, speed in [('burst', '#b1f8ff', 38, 85), ('spark', '#d5ffff', 18, 65), ('burnup', '#ffb579', 30, 55)]:
    cfg = config(name, dict(width=200, height=200, duration_ms=1000, fps=30, system=str(root / 'assets/particles' / f'{name}.json')))
    run('particle-2d', '--config', cfg, 'init')
    run('particle-2d', '--config', cfg, 'add-emitter', '--name', 'debris', '--shape', 'point', '--x', 0, '--y', 0, '--burst', count, '--lifetime', 650, '--lifetime-spread', 220, '--speed', speed, '--speed-spread', 35, '--cone-angle', 180)
    run('particle-2d', '--config', cfg, 'set-particle', '--emitter', 'debris', '--size-from', 3, '--size-to', 0, '--opacity-from', 1, '--opacity-to', 0, '--color-gradient', c + '@0,#42647a@1', '--stretch', 0.04)
    run('particle-2d', '--config', cfg, 'render')
for i, (name, freq, dur) in enumerate([('paddle-bounce', 740, 150), ('field-bounce', 460, 180), ('target-hit', 910, 110), ('target-break', 180, 430), ('shield-reflect', 1150, 350), ('pod-catch', 880, 310), ('pod-catch-narrow', 260, 380), ('pod-burn', 140, 400), ('ball-lost', 110, 650), ('wave-clear', 660, 950), ('game-over', 65, 1800), ('menu-move', 1100, 60), ('menu-select', 1400, 100)]):
    cfg = config(name, dict(sample_rate=44100, channels='stereo', max_duration_ms=dur + 120, wav=str(root / 'assets/audio' / f'{name}.wav')))
    run('sfx-synth', '--config', cfg, 'init')
    run('sfx-synth', '--config', cfg, 'add-voice', '--name', 'tone', '--wave', 'sine', '--freq', freq, '--gain', '-10', '--dur', dur)
    run('sfx-synth', '--config', cfg, 'set-envelope', '--voice', 'tone', '--env', 'pluck')
    run('sfx-synth', '--config', cfg, 'set-pitch', '--voice', 'tone', '--slide-to', freq * (1.5 if name in ['pod-catch', 'wave-clear', 'menu-select'] else 0.45), '--over', dur)
    if name in ['target-break', 'ball-lost', 'game-over', 'pod-burn']:
        run('sfx-synth', '--config', cfg, 'add-voice', '--name', 'dust', '--wave', 'noise', '--gain', '-20', '--dur', dur * 0.7)
        run('sfx-synth', '--config', cfg, 'set-envelope', '--voice', 'dust', '--env', 'pluck')
    run('sfx-synth', '--config', cfg, 'render')
for name in ['title', 'play']:
    cfg = config('music-' + name, dict(sample_rate=44100, channels='stereo', max_duration_ms=16000, wav=str(root / 'assets/audio' / f'music-{name}.wav'), mid='/tmp/music.mid'))
    run('music', '--config', cfg, 'init')
    run('music', '--config', cfg, 'set-tempo', '--bpm', 120)
    for track, inst, gain in [('bass', 'sine', -24), ('glass', 'triangle', -30)]:
        run('music', '--config', cfg, 'define-track', '--name', track, '--instrument', inst)
        run('music', '--config', cfg, 'set-track-fx', '--track', track, '--gain', gain, '--env', 'gate')
    for beat in range(32):
        base = [38, 34, 41, 36][beat // 8]
        run('music', '--config', cfg, 'add-note', '--track', 'bass', '--pitch', base, '--t', beat, '--dur', 1.05, '--velocity', 75)
        for j in range(2 if name == 'play' else 1):
            run('music', '--config', cfg, 'add-note', '--track', 'glass', '--pitch', base + 24 + [0, 7, 12, 14][(beat + j) % 4], '--t', beat + j * 0.5, '--dur', 0.6, '--velocity', 60)
    run('music', '--config', cfg, 'render')
import wave, array
for name in ['title', 'play']:
    path = str(root / 'assets/audio' / f'music-{name}.wav')
    with wave.open(path, 'rb') as wav:
        params = wav.getparams()
        data = array.array('h', wav.readframes(wav.getnframes()))
    frames = 220
    for j in range(frames):
        gain = (frames - 1 - j) / (frames - 1)
        for channel in range(params.nchannels):
            index = len(data) - frames * params.nchannels + j * params.nchannels + channel
            data[index] = round(data[index] * gain)
    with wave.open(path, 'wb') as wav:
        wav.setparams(params)
        wav.writeframes(data.tobytes())
