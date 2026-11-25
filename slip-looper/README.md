# SlipLoop — CDJ-style slip looper (VST3 / AU)

A zero-latency loop plugin for Ableton Live (or any VST3/AU host). Drop it on Deck A and Deck B,
map it to the APC40, and loop like a CDJ/DJM loop section: instant capture, halve/double without
pitch change, slip back onto the live beat.

## How it works

- **Always-on recorder** — the plugin records its input into a ring buffer all the time (16 bars at
  60 BPM plus headroom; ~50 MB per instance at 48 kHz).
- **Instant capture** — *Loop On* locks playback onto the **last N beats**, with the loop end snapped
  to the most recent beat on the host grid (*Quantize*). No record pass needed.
- **Halve / Double without pitch change** — only the length of the loop changes (1/16 beat … 16 bars),
  so pitch and tempo never change.
  - Halve keeps the loop start (like a CDJ).
  - Double keeps the loop start when the audio after the loop is already recorded, and otherwise
    reaches back into the recorded audio.
- **Slip** (on by default) — Ableton keeps playing underneath, so *Loop Off* drops you back on
  the live beat. With Slip **off**, *Loop Off* continues from the loop point instead (the track
  plays late by a whole number of loops, still on the grid); turn Slip back on to jump back to live.
- **No clicks** — a 4 ms equal-power crossfade at the loop point (using the audio just before the
  loop start) and a 5 ms equal-power crossfade on every on/off/halve/double change.
- **Tempo sync** — samples per beat = `sampleRate * 60 / hostBPM`, read from the host every block.
  Loop positions use double precision with interpolated reads, so 1/16-beat loops don't drift.

## Parameters (map with Cmd+M in Live)

| Parameter       | Type                  | APC40 suggestion          |
|-----------------|-----------------------|---------------------------|
| Loop On         | toggle                | clip-stop / track button  |
| Halve Loop      | trigger (resets to off by itself) | button        |
| Double Loop     | trigger (resets to off by itself) | button        |
| Default Length  | 1 / 2 / 4 / 8 bars (used each time a loop starts) | knob |
| Slip            | toggle (default on)   | button                    |
| Quantize        | toggle (default on)   | —                         |

Halve and Double switch themselves back off right after they fire, so every APC40 press counts.
(Live's MIDI map toggles on/off parameters, and an ordinary toggle would need two presses per action.)

## UI

A dark panel showing the current loop length (`4 BARS`, `1/4 BEAT`, …), a green LED and outline
while the loop is on, and the host BPM, with buttons for every parameter.

## Getting the plugin

**Easiest:** every push that changes `slip-looper/` runs the *SlipLoop macOS build* GitHub Action,
which builds Universal (Apple Silicon + Intel) VST3 and AU, runs the tests, `auval` and `pluginval`,
and uploads `SlipLoop-macOS-universal` as a build artifact. Unzip into:

- `~/Library/Audio/Plug-Ins/VST3/SlipLoop.vst3`
- `~/Library/Audio/Plug-Ins/Components/SlipLoop.component`

Then rescan plugins in Live (Settings → Plug-Ins → Rescan). The build is not code-signed. If macOS
blocks it, run `xattr -dr com.apple.quarantine <plugin path>`.

**Build locally (Xcode command line tools + CMake ≥ 3.22):**

```sh
cmake -S slip-looper -B build -DCMAKE_BUILD_TYPE=Release   # fetches JUCE 9.0.4
cmake --build build --config Release -j
ctest --test-dir build                                   # engine tests
```

Outputs are written to `build/SlipLoop_artefacts/Release/{VST3,AU}/`. Pass `-DJUCE_DIR=/path/to/JUCE`
to use a local JUCE checkout.

## Layout

```
slip-looper/
  Source/LoopEngine.h          DSP engine (no JUCE dependency, unit-tested)
  Source/PluginProcessor.*     parameters, host tempo/position, trigger handling
  Source/PluginEditor.*        UI
  Tests/LoopEngineTests.cpp    passthrough, click-free, periodicity, slip, halve/double, 10-min hold
```

## Known limits

- Control changes apply at block boundaries (≈1–3 ms at typical buffer sizes).
- Starting a loop or doubling copies that part of the recording inside the audio callback. At
  16 bars this is a few MB, about 1 ms on Apple Silicon.
- If you start a loop right after loading the plugin, it shortens the loop to fit the audio
  recorded so far.
- Assumes 4/4 (1 bar = 4 beats).

Licensing: JUCE 9 is GPLv3 / commercial. Fine for personal use; read JUCE's license before
distributing builds.
