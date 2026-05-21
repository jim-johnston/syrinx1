# VISIKI OT™ / syrinx1

**Procedural Web Audio API soundscapes for High-Performance HMIs. Zero dependencies.**

Syrinx1 is an open-source library of stateless, mathematical audio snippets designed specifically for industrial control rooms, SCADA dashboards, and High-Performance HMIs (ISA 18.2 compliant). 

Instead of relying on heavy `.wav` files or bloated third-party audio frameworks like Tone.js, Syrinx1 uses pure vanilla JavaScript and the native browser Web Audio API to generate clinical, highly-readable acoustic alerts.

## Features
* **Zero Dependencies:** Pure math. No NPM packages, no external audio files. 
* **Stateless Architecture:** Easy to drop into modern state-aware frontend frameworks (React, Vue, Angular).
* **Built-in Studio Limiter:** Master DynamicsCompressorNode prevents digital clipping and polyphonic distortion.
* **Web MIDI API Support:** Plug in a USB MIDI controller to test frequencies and play procedural instruments directly in the browser.
* **Real-time VU Metering:** Framerate-synced Root Mean Square (RMS) decibel visualizers.

## Usage
Simply click **COPY JS** on any sound in the interface to copy the self-contained JavaScript function. Drop it into your codebase and trigger it on a state change. 

If you are building looping alarms in React or Angular, use the built-in **NPM Integration Code Generator** inside the app to output the exact `setInterval` boilerplate required for your environment.

## Contributing
We welcome contributions from HMI developers and audio engineers. 
1. Use [WebAudio Designer](https://g200kg.github.io/web-audio-designer/) to mathematically model your sound.
2. Export the vanilla JavaScript.
3. Wrap it in a function, add a row to `index.html`, and submit a Pull Request.

## License
MIT License. Free for commercial, industrial, and enterprise use.# syrinx1
