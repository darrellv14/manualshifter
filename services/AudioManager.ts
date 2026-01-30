export class AudioManager {
    private audioCtx: AudioContext | null = null;
    
    // Engine Nodes
    private osc1: OscillatorNode | null = null;
    private osc2: OscillatorNode | null = null;
    private gainNode: GainNode | null = null;
    private masterGain: GainNode | null = null;

    // Tire Squeal Nodes
    private squealOsc: OscillatorNode | null = null;
    private squealGain: GainNode | null = null;

    // Backfire
    private noiseBuffer: AudioBuffer | null = null;
    private lastGasPosition: number = 0;
    private lastBackfireTime: number = 0;

    private isInitialized: boolean = false;
    private isRunning: boolean = false;

    constructor() {
        // Lazy initialization
    }

    public init() {
        if (this.isInitialized) return;
        
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioCtx = new AudioContextClass();
            this.isInitialized = true;

            // Pre-generate noise buffer for backfires
            const bufferSize = this.audioCtx.sampleRate; // 1 second
            this.noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    }

    public start() {
        if (!this.isInitialized || !this.audioCtx) this.init();
        if (!this.audioCtx) return;
        if (this.isRunning) return;

        // --- ENGINE SOUND ---
        this.osc1 = this.audioCtx.createOscillator();
        this.osc2 = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();
        this.masterGain = this.audioCtx.createGain();

        this.osc1.type = 'sawtooth';
        this.osc1.frequency.value = 50;
        this.osc2.type = 'square';
        this.osc2.frequency.value = 100;

        this.osc1.connect(this.gainNode);
        this.osc2.connect(this.gainNode);
        this.gainNode.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);

        this.osc1.start();
        this.osc2.start();
        this.masterGain.gain.value = 0.1;

        // --- TIRE SQUEAL ---
        this.squealOsc = this.audioCtx.createOscillator();
        this.squealGain = this.audioCtx.createGain();
        
        // High pitch screech
        this.squealOsc.type = 'triangle'; 
        this.squealOsc.frequency.value = 800; 
        
        this.squealOsc.connect(this.squealGain);
        this.squealGain.connect(this.audioCtx.destination);
        
        this.squealOsc.start();
        this.squealGain.gain.value = 0; // Start silent

        this.isRunning = true;
    }

    public stop() {
        if (!this.isRunning) return;
        if (this.osc1) this.osc1.stop();
        if (this.osc2) this.osc2.stop();
        if (this.squealOsc) this.squealOsc.stop();
        this.isRunning = false;
    }

    private triggerBackfire() {
        if (!this.audioCtx || !this.noiseBuffer) return;

        // Randomize number of pops (1 or 2)
        const pops = Math.random() > 0.8 ? 2 : 1;
        const now = this.audioCtx.currentTime;

        for (let i = 0; i < pops; i++) {
            const timeOffset = i * (0.08 + Math.random() * 0.05);
            const startTime = now + timeOffset;

            const src = this.audioCtx.createBufferSource();
            src.buffer = this.noiseBuffer;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400 + Math.random() * 300; 
            filter.Q.value = 1;

            const gain = this.audioCtx.createGain();
            
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            // Envelope: Sharp pop
            const volume = 0.5 + Math.random() * 0.5; 
            gain.gain.setValueAtTime(volume, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

            src.start(startTime);
            src.stop(startTime + 0.15);
        }
    }

    public update(rpm: number, load: number, tireSlip: number = 0, speed: number = 0) {
        if (!this.isRunning || !this.audioCtx || !this.osc1 || !this.osc2 || !this.gainNode || !this.squealOsc || !this.squealGain) return;

        // Resume context
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // --- ENGINE UPDATE ---
        if (rpm < 50) {
             // Engine stalled or off
             this.gainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
        } else {
             const baseFreq = 40 + (rpm / 20); 
             this.osc1.frequency.setTargetAtTime(baseFreq, this.audioCtx.currentTime, 0.1);
             this.osc2.frequency.setTargetAtTime(baseFreq * 1.5, this.audioCtx.currentTime, 0.1);

             // Load adds growl
             const volume = 0.05 + (rpm / 7000) * 0.1 + (load * 0.1);
             this.gainNode.gain.setTargetAtTime(volume, this.audioCtx.currentTime, 0.1);
        }

        // --- SQUEAL UPDATE ---
        const slipThreshold = 0.2;
        if (tireSlip > slipThreshold && Math.abs(speed) > 5) {
            const wobble = Math.sin(this.audioCtx.currentTime * 20) * 50;
            this.squealOsc.frequency.setTargetAtTime(800 + wobble + (speed * 2), this.audioCtx.currentTime, 0.1);
            
            const squealVol = Math.min(0.3, (tireSlip - slipThreshold) * 0.5);
            this.squealGain.gain.setTargetAtTime(squealVol, this.audioCtx.currentTime, 0.05);
        } else {
            this.squealGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
        }

        // --- BACKFIRE LOGIC ---
        // Trigger if gas is released rapidly (lastGas > 0.6 -> load < 0.1) at high RPM (> 3500)
        if (this.lastGasPosition > 0.6 && load < 0.1 && rpm > 3500) {
            const now = Date.now();
            if (now - this.lastBackfireTime > 400) { 
                // Higher RPM = Higher chance
                const chance = Math.min(0.8, (rpm - 3000) / 4000); 
                if (Math.random() < chance) {
                    this.triggerBackfire();
                    this.lastBackfireTime = now;
                }
            }
        }
        this.lastGasPosition = load;
    }
}