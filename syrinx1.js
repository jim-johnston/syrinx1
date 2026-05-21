document.addEventListener("DOMContentLoaded", () => {
    
    // --- UI LOGIC: Accordions ---
    const headers = document.querySelectorAll('.section-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-target');
            const content = document.getElementById(targetId);
            const icon = document.getElementById(`icon-${targetId}`);
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.textContent = 'expand_more';
            } else {
                content.style.display = 'none';
                icon.textContent = 'chevron_right';
            }
        });
    });

    // --- AUDIO ENGINE & VU METER ---
    let audioCtx = null;
    let masterCompressor = null; // NEW: Studio limiter to prevent distortion!
    let masterReverb = null;
    let reverbGain = null;
    let masterAnalyser = null;
    let activeNodes = []; 
    
    // VU Meter State
    let activeVizElement = null;
    let analyserData = null;
    let animationId = null;

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // 1. Master Compressor (Prevents polyphonic clipping/distortion)
            masterCompressor = audioCtx.createDynamicsCompressor();
            masterCompressor.threshold.value = -12;
            masterCompressor.knee.value = 10;
            masterCompressor.ratio.value = 12;
            masterCompressor.attack.value = 0.002;
            masterCompressor.release.value = 0.1;

            // 2. Decibel / Volume Analyzer Node
            masterAnalyser = audioCtx.createAnalyser();
            masterAnalyser.fftSize = 256;
            analyserData = new Uint8Array(masterAnalyser.frequencyBinCount);

            // Wire Master Chain: Compressor -> Analyser -> Speakers
            masterCompressor.connect(masterAnalyser);
            masterAnalyser.connect(audioCtx.destination);

            // 3. Reverb Engine
            const length = audioCtx.sampleRate * 2.0; 
            const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
            const left = impulse.getChannelData(0);
            const right = impulse.getChannelData(1);
            for (let i = 0; i < length; i++) {
                const decay = Math.exp(-i / (audioCtx.sampleRate * 0.3)); 
                left[i] = (Math.random() * 2 - 1) * decay;
                right[i] = (Math.random() * 2 - 1) * decay;
            }
            masterReverb = audioCtx.createConvolver();
            masterReverb.buffer = impulse;
            
            reverbGain = audioCtx.createGain();
            reverbGain.gain.value = 0.2; 
            
            masterReverb.connect(reverbGain);
            reverbGain.connect(masterCompressor); // Reverb routed to compressor too!

            startVUMeter();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    // Connects all procedural audio into the safety of the Compressor
    function connectToOutput(node) {
        node.connect(masterCompressor);
    }

    // RMS Volume Calculation Loop
    function startVUMeter() {
        if (animationId) cancelAnimationFrame(animationId);
        function draw() {
            animationId = requestAnimationFrame(draw);
            if (!activeVizElement || !masterAnalyser) return;
            
            masterAnalyser.getByteFrequencyData(analyserData);
            let sum = 0;
            for(let i = 0; i < analyserData.length; i++) {
                sum += analyserData[i];
            }
            let avg = sum / analyserData.length;
            // Map the average frequency energy to a 0-100% width
            let width = Math.min(100, (avg / 100) * 100); 
            activeVizElement.style.width = width + '%';
        }
        draw();
    }

    // Instantly stops all playing procedural audio
    function stopAllAudio() {
        activeNodes.forEach(node => {
            try { node.stop(); } catch (e) {}
            try { node.disconnect(); } catch (e) {}
        });
        activeNodes = [];
        
        // Reset all visualizers
        document.querySelectorAll('.viz-fill').forEach(viz => viz.style.width = '0%');
        activeVizElement = null;

        // Reset all play buttons to "play_arrow"
        document.querySelectorAll('.play-btn .material-icons').forEach(icon => icon.textContent = 'play_arrow');
    }

    // --- BUTTON TOGGLE LOGIC ---
    function handleToggle(btnId, vizId, playFunction, durationMs) {
        const btn = document.getElementById(btnId);
        const icon = btn.querySelector('.material-icons');
        const isPlaying = icon.textContent === 'stop';

        // If clicking a playing sound, stop it
        if (isPlaying) {
            stopAllAudio();
            return;
        }

        // Otherwise, stop current sounds and start this one
        stopAllAudio();
        icon.textContent = 'stop';
        activeVizElement = document.getElementById(vizId);
        
        playFunction();

        // Auto-reset button state after duration (if not infinite)
        if (durationMs > 0) {
            setTimeout(() => {
                // Only reset if this specific button is still in the 'stop' state
                if (icon.textContent === 'stop') {
                    icon.textContent = 'play_arrow';
                    if (activeVizElement && activeVizElement.id === vizId) {
                        activeVizElement.style.width = '0%';
                        activeVizElement = null;
                    }
                }
            }, durationMs);
        }
    }


    // --- ALARM SET 1: Chords ---
    function playPriority1() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [400, 600, 800]; 
        const pulseDuration = 0.15; 
        const pulseGap = 0.10;      
        const attack = 0.04;        
        const release = 0.05;       

        for (let i = 0; i < 3; i++) {
            const startTime = now + (i * (pulseDuration + pulseGap));
            freqs.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.type = index % 2 === 0 ? 'sine' : 'triangle';
                osc.frequency.value = freq;
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.12, startTime + attack);
                gainNode.gain.setValueAtTime(0.12, startTime + pulseDuration - release);
                gainNode.gain.linearRampToValueAtTime(0, startTime + pulseDuration);
                osc.connect(gainNode);
                connectToOutput(gainNode);
                osc.start(startTime);
                osc.stop(startTime + pulseDuration);
                activeNodes.push(osc); 
            });
        }
    }

    function playPriority2() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [500, 700]; 
        const pulseDuration = 0.20; 
        const pulseGap = 0.15;      
        const attack = 0.04;        
        const release = 0.05;       

        for (let i = 0; i < 2; i++) {
            const startTime = now + (i * (pulseDuration + pulseGap));
            freqs.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.type = index % 2 === 0 ? 'sine' : 'triangle';
                osc.frequency.value = freq;
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(0.10, startTime + attack);
                gainNode.gain.setValueAtTime(0.10, startTime + pulseDuration - release);
                gainNode.gain.linearRampToValueAtTime(0, startTime + pulseDuration);
                osc.connect(gainNode);
                connectToOutput(gainNode);
                osc.start(startTime);
                osc.stop(startTime + pulseDuration);
                activeNodes.push(osc);
            });
        }
    }

    function playPriority3() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [600, 750]; 
        const pulseDuration = 0.25; 
        const attack = 0.05;        
        const release = 0.10;       

        freqs.forEach((freq) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.08, now + attack);
            gainNode.gain.setValueAtTime(0.08, now + pulseDuration - release);
            gainNode.gain.linearRampToValueAtTime(0, now + pulseDuration);
            osc.connect(gainNode);
            connectToOutput(gainNode);
            osc.start(now);
            osc.stop(now + pulseDuration);
            activeNodes.push(osc);
        });
    }

    function playPriority4() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [800, 1000]; 
        const pulseDuration = 0.15; 
        const attack = 0.02;        
        const release = 0.05;       

        freqs.forEach((freq) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.06, now + attack);
            gainNode.gain.setValueAtTime(0.06, now + pulseDuration - release);
            gainNode.gain.linearRampToValueAtTime(0, now + pulseDuration);
            osc.connect(gainNode);
            connectToOutput(gainNode);
            osc.start(now);
            osc.stop(now + pulseDuration);
            activeNodes.push(osc);
        });
    }

    function playPriority5() {
        initAudio();
        const now = audioCtx.currentTime;
        const freq = 400; 
        const pulseDuration = 0.10; 
        const attack = 0.02;        
        const release = 0.05;       

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.04, now + attack); 
        gainNode.gain.setValueAtTime(0.04, now + pulseDuration - release);
        gainNode.gain.linearRampToValueAtTime(0, now + pulseDuration);
        osc.connect(gainNode);
        connectToOutput(gainNode);
        osc.start(now);
        osc.stop(now + pulseDuration);
        activeNodes.push(osc);
    }

    // --- ALARM SET 2: STRUMS ---
    function playStrumP1() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [440, 554.37, 659.25, 880]; 
        const pulseDuration = 0.4; 
        const pulseGap = 0.15;
        const strumDelay = 0.04; 
        const attack = 0.02;        
        const release = 0.1;       

        for (let i = 0; i < 3; i++) {
            const startTime = now + (i * (pulseDuration + pulseGap));
            freqs.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                
                const noteStart = startTime + (index * strumDelay);
                gainNode.gain.setValueAtTime(0, noteStart);
                gainNode.gain.linearRampToValueAtTime(0.08, noteStart + attack); 
                gainNode.gain.setValueAtTime(0.08, noteStart + pulseDuration - release);
                gainNode.gain.linearRampToValueAtTime(0, noteStart + pulseDuration);
                
                osc.connect(gainNode);
                connectToOutput(gainNode);
                osc.start(noteStart);
                osc.stop(noteStart + pulseDuration);
                activeNodes.push(osc);
            });
        }
    }

    function playStrumP2() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [523.25, 659.25, 783.99]; 
        const pulseDuration = 0.5; 
        const pulseGap = 0.2;
        const strumDelay = 0.06; 
        const attack = 0.03;        
        const release = 0.15;       

        for (let i = 0; i < 2; i++) {
            const startTime = now + (i * (pulseDuration + pulseGap));
            freqs.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                
                const noteStart = startTime + (index * strumDelay);
                gainNode.gain.setValueAtTime(0, noteStart);
                gainNode.gain.linearRampToValueAtTime(0.08, noteStart + attack); 
                gainNode.gain.setValueAtTime(0.08, noteStart + pulseDuration - release);
                gainNode.gain.linearRampToValueAtTime(0, noteStart + pulseDuration);
                
                osc.connect(gainNode);
                connectToOutput(gainNode);
                osc.start(noteStart);
                osc.stop(noteStart + pulseDuration);
                activeNodes.push(osc);
            });
        }
    }

    function playStrumP3() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [587.33, 739.99, 880]; 
        const pulseDuration = 0.6; 
        const strumDelay = 0.08; 
        const attack = 0.04;        
        const release = 0.2;       

        freqs.forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const noteStart = now + (index * strumDelay);
            gainNode.gain.setValueAtTime(0, noteStart);
            gainNode.gain.linearRampToValueAtTime(0.07, noteStart + attack); 
            gainNode.gain.setValueAtTime(0.07, noteStart + pulseDuration - release);
            gainNode.gain.linearRampToValueAtTime(0, noteStart + pulseDuration);
            
            osc.connect(gainNode);
            connectToOutput(gainNode);
            osc.start(noteStart);
            osc.stop(noteStart + pulseDuration);
            activeNodes.push(osc);
        });
    }

    function playStrumP4() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [783.99, 1046.50]; 
        const pulseDuration = 0.3; 
        const strumDelay = 0.03; 
        const attack = 0.02;        
        const release = 0.1;       

        freqs.forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const noteStart = now + (index * strumDelay);
            gainNode.gain.setValueAtTime(0, noteStart);
            gainNode.gain.linearRampToValueAtTime(0.06, noteStart + attack); 
            gainNode.gain.setValueAtTime(0.06, noteStart + pulseDuration - release);
            gainNode.gain.linearRampToValueAtTime(0, noteStart + pulseDuration);
            
            osc.connect(gainNode);
            connectToOutput(gainNode);
            osc.start(noteStart);
            osc.stop(noteStart + pulseDuration);
            activeNodes.push(osc);
        });
    }

    function playStrumP5() {
        initAudio();
        const now = audioCtx.currentTime;
        const freqs = [440, 523.25]; 
        const pulseDuration = 0.4; 
        const strumDelay = 0.08; 
        const attack = 0.05;        
        const release = 0.15;       

        freqs.forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const noteStart = now + (index * strumDelay);
            gainNode.gain.setValueAtTime(0, noteStart);
            gainNode.gain.linearRampToValueAtTime(0.04, noteStart + attack); 
            gainNode.gain.setValueAtTime(0.04, noteStart + pulseDuration - release);
            gainNode.gain.linearRampToValueAtTime(0, noteStart + pulseDuration);
            
            osc.connect(gainNode);
            connectToOutput(gainNode);
            osc.start(noteStart);
            osc.stop(noteStart + pulseDuration);
            activeNodes.push(osc);
        });
    }

    // --- UI CLICKS ---
    function playClickUI() {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        connectToOutput(gain);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    function playClickCommand() {
        initAudio();
        const now = audioCtx.currentTime;
        const bufferSize = audioCtx.sampleRate * 0.3; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(4000, now + 0.25); 
        filter.Q.value = 1.2;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        noise.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        noise.start(now);
    }

    // --- AMBIENT NOISE & WARP DRIVE ---
    function playAmbientNoise() {
        initAudio();
        
        // Procedural TRUE Pink Noise (Voss-McCartney Algorithm)
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            data[i] *= 0.11; // Gain compensation
            b6 = white * 0.115926;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        // "Warm Pink" Curve: Rolls off the harsh high-frequencies that cause listener fatigue
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 1200; // Dropped from 4000Hz to remove the "hiss"

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.05; // Drastically lowered volume so it sits perfectly in the background
        
        noise.connect(noiseFilter);
        noiseFilter.connect(gainNode);
        connectToOutput(gainNode);
        
        noise.start();
        activeNodes.push(noise);
    }
       
    function playWarpDrive() {
        initAudio();
        
        // Base Gamma Drone
        const drone = audioCtx.createOscillator();
        drone.type = 'sine';
        drone.frequency.value = 40; 
        
        // Alpha Beat frequency (50Hz - 40Hz = 10Hz Alpha pulse for relaxed focus)
        const throb = audioCtx.createOscillator();
        throb.type = 'sine';
        throb.frequency.value = 50; 
        
        const oscGain = audioCtx.createGain();
        oscGain.gain.value = 0.15; // INCREASED: The Alpha pulse is now front and center

        drone.connect(oscGain);
        throb.connect(oscGain);
        
        // Procedural TRUE Brown Noise (eliminates the Biquad filter "note")
        const bufferSize = audioCtx.sampleRate * 2; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // Mathematical integration to create smooth random walk (Brownian motion)
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // Compensate for volume loss in the algorithm
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true; 
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.value = 0.04; // DECREASED: Pushed to the background as a subtle physical texture
        
        noise.connect(noiseGain);
        connectToOutput(oscGain);
        connectToOutput(noiseGain);
        
        drone.start();
        throb.start();
        noise.start();
        activeNodes.push(drone, throb, noise); 
    }

    // --- INSTRUMENTS ---
    function playEPiano(freq = 261.63, sustain = false) {
        initAudio();
        const now = audioCtx.currentTime;
        const releaseTime = sustain ? 2.5 : 0.35; 
        [freq, freq * 1.005].forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = i === 0 ? 'sine' : 'triangle';
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(i === 0 ? 0.3 : 0.1, now + 0.02); 
            gain.gain.exponentialRampToValueAtTime(0.01, now + releaseTime);
            osc.connect(gain);
            connectToOutput(gain);
            gain.connect(masterReverb); 
            osc.start(now);
            osc.stop(now + releaseTime);
            activeNodes.push(osc);
        });
    }

    function playPanFlute(freq = 523.25, sustain = false) {
        initAudio();
        const now = audioCtx.currentTime;
        
        // Hold for 4 seconds if sustained, otherwise short staccato
        const duration = sustain ? 4.0 : 0.25; 
        const release = 0.3;
        const totalTime = duration + release;
        
        // Body (Pure Sine)
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        oscGain.gain.setValueAtTime(0, now);
        oscGain.gain.linearRampToValueAtTime(0.3, now + 0.08); // Soft attack
        oscGain.gain.setValueAtTime(0.3, now + duration); // Flat, steady hold
        oscGain.gain.linearRampToValueAtTime(0, now + totalTime); // Fade out
        
        osc.connect(oscGain);
        connectToOutput(oscGain);
        oscGain.connect(masterReverb);

        // Noise Chiff (Breath)
        const bufferSize = audioCtx.sampleRate * totalTime; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = freq * 2;
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.015, now + 0.05); // Much less attack peak
        noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.15); // Breath swells up during the note
        noiseGain.gain.setValueAtTime(0.04, now + duration); // Holds steady
        noiseGain.gain.linearRampToValueAtTime(0, now + totalTime); 
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        connectToOutput(noiseGain);
        noiseGain.connect(masterReverb);

        osc.start(now);
        osc.stop(now + totalTime);
        noise.start(now);
        activeNodes.push(osc, noise);
    }

    function playBanjo(freq = 392.00) {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4000, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + 0.2);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.02); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        osc.start(now);
        osc.stop(now + 0.4);
        activeNodes.push(osc);
    }

    function playKick() {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now); 
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1); 
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        connectToOutput(gain);
        gain.connect(masterReverb);
        osc.start(now);
        osc.stop(now + 0.2);
        activeNodes.push(osc);
    }

    function playSnare() {
        initAudio();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, now);
        oscGain.gain.setValueAtTime(1, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(oscGain);
        connectToOutput(oscGain);

        const bufferSize = audioCtx.sampleRate * 0.2; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(1, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        connectToOutput(noiseGain);
        noiseGain.connect(masterReverb);

        osc.start(now);
        osc.stop(now + 0.2);
        noise.start(now);
        activeNodes.push(osc, noise);
    }

    function playShaker() {
        initAudio();
        const now = audioCtx.currentTime;
        const bufferSize = audioCtx.sampleRate * 0.1; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 6000;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.8, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        noise.connect(filter);
        filter.connect(gain);
        connectToOutput(gain);
        gain.connect(masterReverb);
        noise.start(now);
        activeNodes.push(noise);
    }

    // --- BIND EVENT LISTENERS TO TOGGLES ---
    document.getElementById('btn-p1-play').addEventListener('click', () => handleToggle('btn-p1-play', 'viz-p1', playPriority1, 1000));
    document.getElementById('btn-p2-play').addEventListener('click', () => handleToggle('btn-p2-play', 'viz-p2', playPriority2, 1000));
    document.getElementById('btn-p3-play').addEventListener('click', () => handleToggle('btn-p3-play', 'viz-p3', playPriority3, 500));
    document.getElementById('btn-p4-play').addEventListener('click', () => handleToggle('btn-p4-play', 'viz-p4', playPriority4, 500));
    document.getElementById('btn-p5-play').addEventListener('click', () => handleToggle('btn-p5-play', 'viz-p5', playPriority5, 500));

    document.getElementById('btn-strum-p1-play').addEventListener('click', () => handleToggle('btn-strum-p1-play', 'viz-strum-p1', playStrumP1, 2000));
    document.getElementById('btn-strum-p2-play').addEventListener('click', () => handleToggle('btn-strum-p2-play', 'viz-strum-p2', playStrumP2, 1500));
    document.getElementById('btn-strum-p3-play').addEventListener('click', () => handleToggle('btn-strum-p3-play', 'viz-strum-p3', playStrumP3, 1000));
    document.getElementById('btn-strum-p4-play').addEventListener('click', () => handleToggle('btn-strum-p4-play', 'viz-strum-p4', playStrumP4, 500));
    document.getElementById('btn-strum-p5-play').addEventListener('click', () => handleToggle('btn-strum-p5-play', 'viz-strum-p5', playStrumP5, 500));

    // Clicks (Fast transient visualizer reset)
    document.getElementById('btn-click-ui').addEventListener('click', () => handleToggle('btn-click-ui', 'viz-click-ui', playClickUI, 200));
    document.getElementById('btn-click-cmd').addEventListener('click', () => handleToggle('btn-click-cmd', 'viz-click-cmd', playClickCommand, 400));

    // Ambient (Infinite duration, pass 0)
    document.getElementById('btn-noise-play').addEventListener('click', () => handleToggle('btn-noise-play', 'viz-noise', playAmbientNoise, 0));
    document.getElementById('btn-warp-play').addEventListener('click', () => handleToggle('btn-warp-play', 'viz-warp', playWarpDrive, 0));

    // Instruments (Fast transient visualizer reset)
    document.getElementById('btn-inst-epiano').addEventListener('click', () => handleToggle('btn-inst-epiano', 'viz-inst-epiano', () => playEPiano(261.63, false), 500));
    document.getElementById('btn-inst-flute').addEventListener('click', () => handleToggle('btn-inst-flute', 'viz-inst-flute', () => playPanFlute(523.25, false), 500));
    document.getElementById('btn-inst-banjo').addEventListener('click', () => handleToggle('btn-inst-banjo', 'viz-inst-banjo', () => playBanjo(392.00), 500));
    document.getElementById('btn-inst-kick').addEventListener('click', () => handleToggle('btn-inst-kick', 'viz-inst-kick', playKick, 300));
    document.getElementById('btn-inst-snare').addEventListener('click', () => handleToggle('btn-inst-snare', 'viz-inst-snare', playSnare, 300));
    document.getElementById('btn-inst-shaker').addEventListener('click', () => handleToggle('btn-inst-shaker', 'viz-inst-shaker', playShaker, 200));

    // --- COPY JS LOGIC ---
    function copyToClipboard(buttonElement, functionCode) {
        const codeToCopy = `// VISIKI OT | syrinx1
// Zero-dependency procedural Web Audio API snippet
${functionCode.toString()}`;

        navigator.clipboard.writeText(codeToCopy).then(() => {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'COPIED!';
            buttonElement.style.color = 'var(--brand-color)';
            buttonElement.style.borderColor = 'var(--brand-color)';
            
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.style.color = '';
                buttonElement.style.borderColor = '';
            }, 2000);
        }).catch(err => console.error("Failed to copy text: ", err));
    }

    // Helper to wire up buttons based on row ID/Class and the function
    function bindCopy(selector, func) {
        const row = document.querySelector(selector);
        if (row) {
            const btn = row.querySelector('.copy-btn');
            if (btn) btn.addEventListener('click', (e) => copyToClipboard(e.target, func));
        }
    }

    // Set 1: Chords
    bindCopy('.p1', playPriority1);
    bindCopy('.p2', playPriority2);
    bindCopy('.p3', playPriority3);
    bindCopy('.p4', playPriority4);
    bindCopy('.p5', playPriority5);

    // Set 2: Strums
    bindCopy('#row-strum-p1', playStrumP1);
    bindCopy('#row-strum-p2', playStrumP2);
    bindCopy('#row-strum-p3', playStrumP3);
    bindCopy('#row-strum-p4', playStrumP4);
    bindCopy('#row-strum-p5', playStrumP5);

    // Clicks & Ambient
    document.getElementById('btn-click-ui').closest('.sound-row').querySelector('.copy-btn').addEventListener('click', (e) => copyToClipboard(e.target, playClickUI));
    document.getElementById('btn-click-cmd').closest('.sound-row').querySelector('.copy-btn').addEventListener('click', (e) => copyToClipboard(e.target, playClickCommand));
    document.getElementById('btn-noise-play').closest('.sound-row').querySelector('.copy-btn').addEventListener('click', (e) => copyToClipboard(e.target, playAmbientNoise));
    document.getElementById('btn-warp-play').closest('.sound-row').querySelector('.copy-btn').addEventListener('click', (e) => copyToClipboard(e.target, playWarpDrive));

    // Synthesized Instruments
    bindCopy('#row-inst-epiano', playEPiano);
    bindCopy('#row-inst-flute', playPanFlute);
    bindCopy('#row-inst-banjo', playBanjo);
    bindCopy('#row-inst-kick', playKick);
    bindCopy('#row-inst-snare', playSnare);
    bindCopy('#row-inst-shaker', playShaker);

    // --- WEB MIDI API ENGINE ---
    let activeMidiInstrument = null;
    let midiInitialized = false;

    function initWebMIDI() {
        if (!midiInitialized && navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
            midiInitialized = true;
        } else if (!navigator.requestMIDIAccess) {
            console.warn("Web MIDI API not supported in this browser.");
        }
    }
    function onMIDISuccess(midiAccess) {
        const inputs = midiAccess.inputs.values();
        for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
            input.value.onmidimessage = handleMIDIMessage;
        }
        
        // Listen for MIDI controllers being plugged in after page load
        midiAccess.onstatechange = (e) => {
            if (e.port.type === 'input' && e.port.state === 'connected') {
                e.port.onmidimessage = handleMIDIMessage;
            }
        };
    }

    function onMIDIFailure() {
        console.warn("Could not access your MIDI devices.");
    }

    function handleMIDIMessage(message) {
        const command = message.data[0];
        const note = message.data[1];
        const velocity = message.data[2];

        // Command 144 is "Note On". We ignore Note Off (128) because our functions handle their own release envelopes.
        if (command === 144 && velocity > 0) {
            if (!activeMidiInstrument) return;
            
            // Tell the VU meter which bar to animate!
            activeVizElement = document.getElementById('viz-inst-' + activeMidiInstrument);
            
            // Convert MIDI Note to Hz: f = 440 * 2^((n - 69) / 12)
            const freq = 440 * Math.pow(2, (note - 69) / 12);

            switch(activeMidiInstrument) {
                case 'epiano': 
                    playEPiano(freq, true); // True passes the longer sustain parameter!
                    break;
                case 'flute': 
                    playPanFlute(freq, true); 
                    break;
                case 'banjo': 
                    playBanjo(freq); 
                    break;
                case 'kick': 
                    playKick(); // Drums don't track pitch, but they will fire on any key press
                    break;
                case 'snare': 
                    playSnare(); 
                    break;
                case 'shaker': 
                    playShaker(); 
                    break;
            }
        }
    }

    // Bind MIDI Toggle Buttons
    const midiButtons = document.querySelectorAll('.midi-btn');
    midiButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all buttons
            midiButtons.forEach(b => b.classList.remove('active'));
            
            const selectedInstrument = e.target.getAttribute('data-midi');
            
            // If clicking the already active one, turn it off
            if (activeMidiInstrument === selectedInstrument) {
                activeMidiInstrument = null;
            } else {
                // Otherwise arm the new instrument
                activeMidiInstrument = selectedInstrument;
                e.target.classList.add('active');
                
                // Initialize MIDI access the first time a button is clicked
                initWebMIDI(); 
            }
        });
    });

    // --- NPM MODAL & CODE GENERATOR LOGIC ---
    const npmModal = document.getElementById('npm-modal');
    const btnShowNpm = document.getElementById('btn-show-npm');
    const btnCloseModal = document.querySelector('.close-modal');
    
    // Generator Elements
    const selectSound = document.getElementById('npm-select-sound');
    const inputInterval = document.getElementById('npm-input-interval');
    const codeOutput = document.getElementById('npm-code-output');
    const btnCopyNpmCode = document.getElementById('btn-copy-npm-code');

    function updateNpmCode() {
        if (!selectSound || !inputInterval || !codeOutput) return;
        
        const funcName = selectSound.value;
        const interval = inputInterval.value;
        const compName = funcName.replace('play', '') + 'Alarm'; // e.g., Priority1Alarm

        const template = `import { useEffect, useRef } from 'react';
import { ${funcName} } from 'visiki-ot-syrinx1'; 

export function ${compName}({ isUnacknowledged }) {
    const intervalRef = useRef(null);

    useEffect(() => {
        if (isUnacknowledged) {
            // Play immediately, then loop every ${interval}ms
            ${funcName}();
            intervalRef.current = setInterval(${funcName}, ${interval});
        } else {
            // Stop looping when operator acknowledges
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        // Cleanup on unmount
        return () => clearInterval(intervalRef.current);
    }, [isUnacknowledged]);

    return null; // Audio component has no UI
}`;
        codeOutput.textContent = template;
    }

    // Wiring it up
    if (btnShowNpm && npmModal) {
        // Initialize the code block on first load
        updateNpmCode();

        // Listen for changes on the inputs
        selectSound.addEventListener('change', updateNpmCode);
        inputInterval.addEventListener('input', updateNpmCode);

        // Open/Close logic
        btnShowNpm.addEventListener('click', () => npmModal.style.display = 'flex');
        btnCloseModal.addEventListener('click', () => npmModal.style.display = 'none');
        npmModal.addEventListener('click', (e) => {
            if (e.target === npmModal) npmModal.style.display = 'none';
        });

        // Copy Code Button Logic
        btnCopyNpmCode.addEventListener('click', () => {
            navigator.clipboard.writeText(codeOutput.textContent).then(() => {
                const originalText = btnCopyNpmCode.textContent;
                btnCopyNpmCode.textContent = 'COPIED!';
                btnCopyNpmCode.style.color = 'var(--brand-color)';
                btnCopyNpmCode.style.borderColor = 'var(--brand-color)';
                
                setTimeout(() => {
                    btnCopyNpmCode.textContent = originalText;
                    btnCopyNpmCode.style.color = '#ffffff';
                    btnCopyNpmCode.style.borderColor = '#555';
                }, 2000);
            });
        });
    }

    // --- SUPPORT MODAL LOGIC ---
    const supportModal = document.getElementById('support-modal');
    const btnSupport = document.getElementById('btn-support');
    const btnCloseSupport = document.querySelector('.close-support');

    if (btnSupport && supportModal) {
        btnSupport.addEventListener('click', () => supportModal.style.display = 'flex');
        btnCloseSupport.addEventListener('click', () => supportModal.style.display = 'none');
        supportModal.addEventListener('click', (e) => {
            if (e.target === supportModal) supportModal.style.display = 'none';
        });
    }
});