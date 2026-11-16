// Short notification chimes made with the Web Audio API (no audio files to load).
// Muted per browser via localStorage; browsers only allow sound after the user has interacted with the page.
const KEY = 'cf-sound';

export const soundEnabled = () => {
    try {
        return localStorage.getItem(KEY) !== 'off';
    } catch {
        return true;
    }
};

export const setSoundEnabled = (on) => {
    try {
        localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
        /* storage blocked: sound stays on for this session */
    }
};

// [frequency Hz, start s, length s] per note
const TONES = {
    success: [[660, 0, 0.12], [990, 0.09, 0.2]],
    info: [[740, 0, 0.18]],
    warning: [[520, 0, 0.14], [520, 0.17, 0.14]],
    error: [[440, 0, 0.14], [294, 0.12, 0.26]]
};

let ctx = null;

export function playTone(kind = 'info') {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        ctx = ctx || new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        for (const [freq, start, len] of TONES[kind] || TONES.info) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            // soft attack and release so it never clicks
            gain.gain.setValueAtTime(0.0001, now + start);
            gain.gain.exponentialRampToValueAtTime(0.12, now + start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + start + len);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now + start);
            osc.stop(now + start + len + 0.02);
        }
    } catch {
        /* audio unavailable: toasts still show */
    }
}
