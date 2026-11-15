// ─────────────────────────────────────────────────────────────────────────────
// VYOMAASTRA Space Audio Synthesizer (Web Audio API)
// Provides authentic CW Morse Code beacon and Doppler frequency shift audio
// ─────────────────────────────────────────────────────────────────────────────

const MORSE_CODE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', ' ': ' ',
};

class SpaceAudioService {
  private ctx: AudioContext | null = null;
  private isMuted = true;
  private isBeaconActive = false;
  private beaconTimeout: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!muted) {
      this.initContext();
    } else {
      this.stopBeacon();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // Play a single pure sine tone at given frequency and duration (seconds)
  public playTone(freq: number, durationSec: number, gainValue = 0.1): Promise<void> {
    if (this.isMuted) return Promise.resolve();
    this.initContext();
    if (!this.ctx) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);

        // Smooth attack and release to eliminate clicks
        const now = this.ctx!.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainValue, now + 0.008);
        gain.gain.setValueAtTime(gainValue, now + durationSec - 0.008);
        gain.gain.linearRampToValueAtTime(0, now + durationSec);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now);
        osc.stop(now + durationSec);
        osc.onended = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // Play Doppler Shift Audio Chirp (simulates satellite approaching and passing)
  public async playDopplerChirp(centerFreq = 800, deltaShift = 250, durationSec = 2.5) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      // Doppler curve: High frequency at AOS, crossing center at TCA, dropping at LOS
      osc.frequency.setValueAtTime(centerFreq + deltaShift, now);
      osc.frequency.exponentialRampToValueAtTime(centerFreq, now + durationSec * 0.45);
      osc.frequency.exponentialRampToValueAtTime(Math.max(100, centerFreq - deltaShift), now + durationSec);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
      gain.gain.setValueAtTime(0.12, now + durationSec - 0.15);
      gain.gain.linearRampToValueAtTime(0, now + durationSec);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec);
    } catch {
      // Audio context ignore
    }
  }

  // Play Morse Code message
  public async playMorse(text: string, dotDurationMs = 60, freq = 800) {
    if (this.isMuted) return;
    const dotSec = dotDurationMs / 1000;
    const dashSec = dotSec * 3;
    const intraSymbolSec = dotSec;
    const interLetterSec = dotSec * 3;
    const interWordSec = dotSec * 7;

    const chars = text.toUpperCase().split('');
    for (const ch of chars) {
      if (this.isMuted) break;
      if (ch === ' ') {
        await new Promise(r => setTimeout(r, interWordSec * 1000));
        continue;
      }
      const code = MORSE_CODE[ch];
      if (!code) continue;

      for (const symbol of code) {
        if (this.isMuted) break;
        if (symbol === '.') {
          await this.playTone(freq, dotSec, 0.09);
        } else if (symbol === '-') {
          await this.playTone(freq, dashSec, 0.09);
        }
        await new Promise(r => setTimeout(r, intraSymbolSec * 1000));
      }
      await new Promise(r => setTimeout(r, interLetterSec * 1000));
    }
  }

  public startPeriodicBeacon(getText: () => string, intervalMs = 20000) {
    this.isBeaconActive = true;
    const loop = async () => {
      if (!this.isBeaconActive || this.isMuted) return;
      await this.playMorse(getText());
      if (this.isBeaconActive) {
        this.beaconTimeout = window.setTimeout(loop, intervalMs);
      }
    };
    loop();
  }

  public stopBeacon() {
    this.isBeaconActive = false;
    if (this.beaconTimeout) {
      clearTimeout(this.beaconTimeout);
      this.beaconTimeout = null;
    }
  }
}

export const spaceAudioService = new SpaceAudioService();
