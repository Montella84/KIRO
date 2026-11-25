/**
 * Web Audio API piezo beep synthesizer.
 * Produces a classic two-tone 90s pager chirp using a square-wave oscillator.
 * No external audio files required.
 */
export function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = 'square';

    const now = ctx.currentTime;

    // Frequency sweep: 1800 Hz → 900 Hz over 80 ms, then back to 1800 Hz for 40 ms
    oscillator.frequency.setValueAtTime(1800, now);
    oscillator.frequency.linearRampToValueAtTime(900, now + 0.08);
    oscillator.frequency.linearRampToValueAtTime(1800, now + 0.12);

    // Gain envelope: 5 ms attack, sustain, 20 ms release
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.005);  // attack
    gain.gain.setValueAtTime(0.3, now + 0.18);             // sustain
    gain.gain.linearRampToValueAtTime(0, now + 0.2);       // release

    oscillator.start(now);
    oscillator.stop(now + 0.2);

    // Clean up AudioContext after beep completes
    oscillator.onended = () => {
      void ctx.close();
    };
  } catch (err) {
    // Suppress NotAllowedError (browser blocked AudioContext before user gesture)
    // and any other audio-related errors — beep is best-effort
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      return;
    }
    // Silently suppress other audio errors to avoid crashing the app
  }
}
