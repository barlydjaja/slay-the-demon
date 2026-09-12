/** Original procedural score and foley; no downloads or third-party audio. */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private drone!: GainNode;
  private voices: OscillatorNode[] = [];
  private noise!: AudioBuffer;
  private muted = false;
  private boss = false;
  private fields = false;
  private beat = 0;
  private elapsed = 0;
  async start() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.45;
    this.master.connect(c.destination);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + Math.random() * 0.04 - 0.02) * 0.992;
      data[i] = last * 2;
    }
    this.drone = c.createGain();
    this.drone.gain.value = 0.025;
    this.drone.connect(this.master);
    for (const hz of [55, 82.41, 110.13]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      o.connect(this.drone);
      o.start();
      this.voices.push(o);
    }
    const wind = c.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    const gain = c.createGain();
    gain.gain.value = 0.18;
    wind.connect(filter).connect(gain).connect(this.master);
    wind.start();
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.12);
  }
  setPaused(paused: boolean) {
    if (this.ctx)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : paused ? 0.12 : 0.45,
        this.ctx.currentTime,
        0.18,
      );
  }
  setFields(fields: boolean) {
    this.fields = fields;
    this.beat = 0;
    this.setBoss(false);
  }
  setBoss(active: boolean) {
    this.boss = active;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.drone.gain.cancelScheduledValues(now);
    this.drone.gain.setTargetAtTime(0.002, now, 0.2);
    this.drone.gain.setTargetAtTime(active ? 0.07 : 0.025, now + 1.7, 0.8);
    this.voices.forEach((v, i) =>
      v.frequency.setTargetAtTime(
        (active ? [36.71, 55, 73.49] : this.fields ? [65.41, 98, 130.81] : [55, 82.41, 110.13])[i],
        now,
        0.7,
      ),
    );
    if (active) this.play('wake');
  }
  private tone(
    freq: number,
    length: number,
    volume: number,
    type: OscillatorType = 'sine',
    end = freq,
  ) {
    if (!this.ctx) return;
    const c = this.ctx,
      now = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, end), now + length);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + length);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(now + length + 0.03);
  }
  private hiss(length: number, volume: number, frequency: number) {
    if (!this.ctx) return;
    const c = this.ctx,
      s = c.createBufferSource(),
      g = c.createGain(),
      f = c.createBiquadFilter();
    s.buffer = this.noise;
    f.type = 'bandpass';
    f.frequency.value = frequency;
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + length);
    s.connect(f).connect(g).connect(this.master);
    s.start();
    s.stop(c.currentTime + length);
  }
  play(
    name:
      | 'swing'
      | 'hit'
      | 'block'
      | 'hurt'
      | 'step'
      | 'dodge'
      | 'death'
      | 'wake'
      | 'telegraph'
      | 'heavy'
      | 'heal'
      | 'thunder'
      | 'victory'
      | 'reaperScream'
      | 'soulRing'
      | 'graveMark',
  ) {
    switch (name) {
      case 'reaperScream':
        this.tone(170, 2.1, 0.07, 'sawtooth', 43);
        this.tone(257, 1.9, 0.045, 'triangle', 52);
        this.hiss(1.7, 0.32, 750);
        break;
      case 'soulRing':
        this.tone(630, 1.4, 0.06, 'sine', 110);
        this.tone(647, 1.3, 0.045, 'sine', 95);
        break;
      case 'graveMark':
        this.tone(73, 0.45, 0.08, 'triangle', 25);
        this.hiss(0.3, 0.3, 320);
        break;
      case 'swing':
        this.hiss(0.2, 0.7, 1800);
        this.tone(280, 0.14, 0.045, 'triangle', 100);
        break;
      case 'hit':
        this.tone(140, 0.13, 0.12, 'triangle', 45);
        this.hiss(0.2, 0.8, 2600);
        break;
      case 'block':
        this.tone(960, 0.38, 0.075, 'triangle', 620);
        this.tone(1470, 0.22, 0.05);
        break;
      case 'hurt':
        this.tone(95, 0.27, 0.16, 'sawtooth', 40);
        break;
      case 'step':
        this.hiss(0.09, this.fields ? 0.13 : 0.22, this.fields ? 1600 : 900);
        this.tone(175, 0.06, 0.03, 'triangle', 85);
        break;
      case 'dodge':
        this.hiss(0.3, 0.45, 950);
        break;
      case 'death':
        this.tone(300, 1.7, 0.1, 'triangle', 22);
        break;
      case 'wake':
        this.tone(78, 3, 0.25, 'sawtooth', 24);
        this.hiss(1.7, 0.75, 140);
        break;
      case 'telegraph':
        this.tone(140, 0.65, 0.07, 'triangle', 420);
        break;
      case 'heavy':
        this.tone(100, 0.7, 0.23, 'triangle', 22);
        this.hiss(0.7, 1, 200);
        break;
      case 'heal':
        this.tone(523, 1, 0.06);
        this.tone(784, 1.5, 0.05);
        break;
      case 'thunder':
        this.hiss(1.9, 1.1, 75);
        this.tone(36, 1.8, 0.11, 'sine', 22);
        break;
      case 'victory':
        for (const f of [220, 329.63, 440, 554.37]) this.tone(f, 4, 0.045);
        break;
    }
  }
  update(dt: number) {
    this.elapsed += dt;
    this.beat -= dt;
    if (this.beat > 0) return;
    if (this.boss) {
      this.beat = 0.58;
      this.tone(this.elapsed % 2 > 1 ? 55 : 36.7, 0.3, 0.1, 'triangle', 24);
      if (Math.floor(this.elapsed) % 4 === 0) this.hiss(0.25, 0.18, 1200);
    } else {
      this.beat = 3.8;
      const notes = this.fields
        ? [261.63, 329.63, 392, 523.25, 392, 329.63]
        : [220, 329.63, 293.66, 164.81, 246.94];
      this.tone(notes[Math.floor(this.elapsed / 3.8) % notes.length], 2.8, 0.026);
      if (Math.random() > 0.45) this.tone(880 + Math.random() * 500, 0.16, 0.02);
    }
  }
}
