import { DEFAULT_SETTINGS, AREAS, BOSS, type Settings, type Quality } from '../game/config';
import { GameState } from '../game/GameState';
const crest = `<svg viewBox="0 0 48 60" fill="none" aria-hidden="true"><path d="M24 2 44 14v23L24 57 4 37V14L24 2Z" stroke="currentColor"/><path d="M24 9v34m-8-23 8-7 8 7M14 30l10 11 10-11M8 18l16 9 16-9" stroke="currentColor"/><path d="m24 43-4 5 4 5 4-5-4-5Z" fill="currentColor"/></svg>`;
const robotIcon = `<svg viewBox="0 0 50 50" fill="none" aria-hidden="true"><path d="M24 6v6m-3-6h6" stroke="#b9bfaa" stroke-width="2"/><rect x="11" y="13" width="28" height="24" rx="7" fill="#658c9d"/><path d="M14 34h22" stroke="#a2b7bb" stroke-width="3"/><rect x="15" y="20" width="20" height="9" rx="3" fill="#14232e"/><path d="M20 23v3m10-3v3" stroke="#cdf3f1" stroke-width="2.5"/><path d="M7 20v10m36-10v10" stroke="#8198a1" stroke-width="3"/></svg>`;
export interface UIActions {
  play: () => void;
  resume: () => void;
  restart: () => void;
  quit: () => void;
  skip: () => void;
  settings: (settings: Settings) => void;
}
export class HUD {
  private root = document.querySelector<HTMLElement>('#ui')!;
  private elements: Record<string, HTMLElement> = {};
  settings: Settings = { ...DEFAULT_SETTINGS };
  private modalFrom = 'menu';
  private toastTimer = 0;
  private memoryTimer = 0;
  private areaTimer = 0;
  private currentState = GameState.LOADING;
  constructor(private actions: UIActions) {
    try {
      const stored = JSON.parse(localStorage.getItem('last-hope-settings') || '{}');
      for (const key of ['quality', 'shadows', 'reflections', 'particles'] as const)
        if (['low', 'medium', 'high'].includes(stored[key])) this.settings[key] = stored[key];
      if (typeof stored.audio === 'boolean') this.settings.audio = stored.audio;
    } catch {}
    this.root.innerHTML = `
      <div class="vignette"></div><div class="screen-grain"></div><div class="frame"><i></i><i></i><i></i><i></i></div>
      <section id="loading" class="loading"><div class="loading-seal">${crest}</div><p class="eyebrow">A FORGOTTEN KINGDOM</p><h1>THE LAST HOPE</h1><p id="load-label">Waking a forgotten machine…</p><div class="loading-track"><span id="load-progress"></span></div><small id="load-percent">0%</small></section>
      <header id="masthead" class="masthead hidden"><div class="brand">${crest}<span>THE LAST HOPE</span></div><div class="edition">AN INTERACTIVE TALE <span>VOL. 01</span></div></header>
      <section id="menu" class="title-menu hidden"><p class="eyebrow"><span></span> IN THE SHADOW OF A FALLEN KINGDOM</p><h1><span>THE LAST</span><strong>HOPE</strong></h1><div class="title-rule"><i></i><b>✧</b><i></i></div><p class="tagline">A castle forgotten.<br>A demon awakened.<br><em>One machine remains.</em></p><div class="menu-buttons"><button id="play" class="play-button"><span class="button-glyph">⟡</span><span>BEGIN JOURNEY</span><span class="button-arrow">→</span></button><div class="secondary-buttons"><button id="menu-settings">SETTINGS</button><span>·</span><button id="credits-button">CREDITS</button></div></div><p class="save-note">A SHORT TALE OF COURAGE &amp; WHAT REMAINS</p></section>
      <div id="scene-caption" class="scene-caption hidden"><span class="tiny-diamond"></span><div>THE FORGOTTEN GATE<small>AFTER THE RAIN, ONLY SILENCE.</small></div></div>
      <footer id="menu-footer" class="menu-footer hidden"><div><span class="keyboard-icon">⌨</span> DESIGNED FOR KEYBOARD &amp; MOUSE</div><button id="audio-toggle"><span id="audio-icon">♫</span> <span id="audio-label">SOUND ON</span></button><span class="version">CHAPTER I <i>/</i> THE HOLLOW KINGDOM</span></footer>
      <section id="hud" class="hud hidden"><div class="player-status"><div class="portrait">${robotIcon}</div><div class="player-bars"><div class="player-label"><span>THE LAST MACHINE</span><span id="hp-number">100 <small>/ 100</small></span></div><div class="health-track"><div id="health-ghost"></div><div id="health-fill"></div></div><div class="stamina-track"><div id="stamina-fill"></div></div></div></div><div class="area-top"><span id="area-top-subtitle">CASTLE ENTRANCE</span><span id="area-top-name">The Forgotten Gate</span></div><div class="objective"><span>⟡</span><div><small id="objective-label">THE JOURNEY</small><p id="objective-text">Follow the light into the courtyard.</p></div></div><div class="control-strip"><div><kbd>W A S D</kbd><span>Move</span></div><div><kbd>SHIFT</kbd><span>Sprint</span></div><i></i><div><kbd>LMB</kbd><span>Strike</span></div><div id="block-control"><kbd>RMB</kbd><span>Block</span></div><div><kbd>SPACE</kbd><span>Evade</span></div></div><button id="pause-button" class="pause-control"><span>PAUSE</span><kbd>ESC</kbd></button></section>
      <div id="area-reveal" class="area-reveal hidden"><p class="eyebrow" id="area-reveal-subtitle"></p><h2 id="area-reveal-name"></h2><div class="title-rule"><i></i><b>✧</b><i></i></div></div>
      <div id="boss-ui" class="boss-ui hidden"><div class="boss-name"><i></i><span>THE HOODED REAPER</span><i></i></div><p>KEEPER OF THE HOLLOW THRONE</p><div class="boss-track"><div id="boss-ghost"></div><div id="boss-fill"></div></div><div id="boss-tell"></div></div>
      <div id="toast" class="toast hidden" role="status"></div><div id="memory" class="memory hidden"></div><div id="damage-flash"></div><div id="block-flash"></div>
      <section id="intro" class="cinematic hidden"><div class="intro-content"><p class="eyebrow">IN THE END, THERE WAS SILENCE.</p><h2 id="intro-text">Humanity is gone.</h2><span class="intro-diamond">✧</span></div><button id="skip-intro" class="text-button">SKIP INTRO <kbd>SPACE</kbd></button></section>
      <section id="pause" class="modal-backdrop hidden"><div class="modal pause-modal"><div class="modal-crest">${crest}</div><p class="eyebrow">A MOMENT OF STILLNESS</p><h2>Journey paused</h2><div class="modal-buttons"><button id="resume" class="primary">RESUME JOURNEY <span>→</span></button><button id="pause-settings">SETTINGS</button><button id="restart">RESTART FROM CHECKPOINT</button><button id="quit">RETURN TO TITLE</button></div><p class="modal-footnote">The kingdom can wait.</p></div></section>
      <section id="settings" class="modal-backdrop hidden"><div class="modal settings-modal"><button class="close-modal" id="settings-close" aria-label="Close settings">×</button><p class="eyebrow">MAKE YOURSELF AT HOME</p><h2>Settings</h2><p class="settings-intro">A beautiful kingdom, at your own pace.</p>${(['quality', 'shadows', 'reflections', 'particles'] as const).map((key) => `<label class="setting-row"><span>${key === 'quality' ? 'Visual quality' : key.charAt(0).toUpperCase() + key.slice(1)}</span><select id="setting-${key}" aria-label="${key}"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>`).join('')}<label class="setting-row"><span>Sound &amp; music</span><input id="setting-audio" type="checkbox" role="switch" /></label><div class="setting-row"><span>Display</span><button id="fullscreen" class="text-button">ENTER FULLSCREEN ↗</button></div><p class="settings-tip">Choose Low for a lighter experience.<br>Your preferences are saved on this device.</p><button id="settings-done" class="primary">RETURN TO JOURNEY</button></div></section>
      <section id="credits" class="modal-backdrop hidden"><div class="modal credits-modal"><button id="credits-close" class="close-modal" aria-label="Close credits">×</button><div class="modal-crest">${crest}</div><p class="eyebrow">A SMALL MACHINE. AN ENTIRE WORLD.</p><h2>The Last Hope</h2><p>A tale of a forgotten creation<br>and the courage to keep going.</p><div class="credits-rule"></div><p class="credit-label">CRAFTED WITH</p><p>Three.js · TypeScript · Web Audio</p><p class="credit-label">ART &amp; SOUND</p><p>Original procedural 3D models,<br>environments, animation, and score.</p><p class="modal-footnote">For everyone who has ever felt left behind.</p></div></section>
      <section id="death" class="modal-backdrop hidden"><div class="modal ending"><p class="eyebrow">EVEN SMALL LIGHTS FLICKER</p><h2>Not the end.</h2><p>The machine is silent.<br>But a little hope remains.</p><button id="retry" class="primary">AWAKEN AGAIN <span>→</span></button><button id="death-quit" class="text-button">RETURN TO TITLE</button><small id="checkpoint-note">Continue from your last sanctuary.</small></div></section>
      <section id="victory" class="modal-backdrop hidden"><div class="modal ending"><div class="modal-crest">${crest}</div><p class="eyebrow">THE DEMON HAS FALLEN.</p><h2>The Last Hope</h2><p>Humanity may be gone,<br>but its final creation remains.</p><div class="title-rule"><i></i><b>✧</b><i></i></div><p class="victory-line">And for the first time,<br>the silence feels like peace.</p><button id="play-again" class="primary">PLAY AGAIN <span>→</span></button><button id="victory-quit" class="text-button">RETURN TO TITLE</button></div></section>
      <div id="debug" class="debug hidden"></div><div class="desktop-notice"><div class="modal-crest">${crest}</div><h2>A journey for a bigger window.</h2><p>This experience is designed for desktop browsers.<br>Please use a keyboard and mouse.</p></div>`;
    this.root.querySelectorAll<HTMLElement>('[id]').forEach((el) => (this.elements[el.id] = el));
    this.on('play', actions.play);
    this.on('resume', actions.resume);
    this.on('pause-button', () =>
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })),
    );
    for (const id of ['restart', 'retry']) this.on(id, actions.restart);
    for (const id of ['quit', 'death-quit', 'victory-quit']) this.on(id, actions.quit);
    this.on('play-again', actions.play);
    this.on('skip-intro', actions.skip);
    this.on('menu-settings', () => this.openSettings('menu'));
    this.on('pause-settings', () => this.openSettings('pause'));
    for (const id of ['settings-close', 'settings-done']) this.on(id, () => this.closeSettings());
    this.on('credits-button', () => this.show('credits'));
    this.on('credits-close', () => this.hide('credits'));
    for (const key of ['quality', 'shadows', 'reflections', 'particles'] as const) {
      const el = this.el('setting-' + key) as HTMLSelectElement;
      el.value = this.settings[key];
      el.onchange = () => {
        this.settings[key] = el.value as Quality;
        if (key === 'quality')
          for (const part of ['shadows', 'reflections', 'particles'] as const) {
            this.settings[part] = el.value as Quality;
            (this.el('setting-' + part) as HTMLSelectElement).value = el.value;
          }
        this.saveSettings();
      };
    }
    (this.el('setting-audio') as HTMLInputElement).checked = this.settings.audio;
    this.el('setting-audio').onchange = () => {
      this.settings.audio = (this.el('setting-audio') as HTMLInputElement).checked;
      this.saveSettings();
    };
    this.on('audio-toggle', () => {
      this.settings.audio = !this.settings.audio;
      (this.el('setting-audio') as HTMLInputElement).checked = this.settings.audio;
      this.saveSettings();
    });
    this.on('fullscreen', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
        this.el('fullscreen').textContent = document.fullscreenElement
          ? 'EXIT FULLSCREEN ↙'
          : 'ENTER FULLSCREEN ↗';
      } catch {
        this.toast('Fullscreen is unavailable in this browser window.');
      }
    });
    this.updateAudioLabel();
  }
  private el(id: string) {
    return this.elements[id];
  }
  private on(id: string, handler: () => void) {
    this.el(id).addEventListener('click', handler);
  }
  private show(id: string) {
    this.el(id).classList.remove('hidden');
  }
  private hide(id: string) {
    this.el(id).classList.add('hidden');
  }
  private updateAudioLabel() {
    this.el('audio-label').textContent = this.settings.audio ? 'SOUND ON' : 'SOUND OFF';
    this.el('audio-icon').textContent = this.settings.audio ? '♫' : '♪';
  }
  private saveSettings() {
    try {
      localStorage.setItem('last-hope-settings', JSON.stringify(this.settings));
    } catch {}
    this.updateAudioLabel();
    this.actions.settings({ ...this.settings });
  }
  private openSettings(from: string) {
    this.modalFrom = from;
    this.hide(from);
    this.show('settings');
    this.el('settings-close').focus();
  }
  closeSettings() {
    this.hide('settings');
    this.show(this.modalFrom);
  }
  closeDialog() {
    if (!this.el('settings').classList.contains('hidden')) {
      this.closeSettings();
      return true;
    }
    if (!this.el('credits').classList.contains('hidden')) {
      this.hide('credits');
      return true;
    }
    return false;
  }
  setState(state: GameState) {
    this.currentState = state;
    for (const id of [
      'loading',
      'menu',
      'masthead',
      'scene-caption',
      'menu-footer',
      'hud',
      'intro',
      'pause',
      'death',
      'victory',
      'settings',
      'credits',
    ])
      this.hide(id);
    const isMenu = state === GameState.MENU;
    document.body.classList.toggle('in-menu', isMenu);
    document.body.classList.toggle(
      'in-game',
      [GameState.PLAYING, GameState.BOSS_COMBAT].includes(state),
    );
    if (isMenu)
      for (const id of ['menu', 'masthead', 'scene-caption', 'menu-footer']) this.show(id);
    if ([GameState.PLAYING, GameState.BOSS_COMBAT, GameState.BOSS_DEAD].includes(state))
      this.show('hud');
    if (state === GameState.LOADING) this.show('loading');
    if (state === GameState.INTRO) this.show('intro');
    if (state === GameState.PAUSED) this.show('pause');
    if (state === GameState.PLAYER_DEAD) this.show('death');
    if (state === GameState.VICTORY) this.show('victory');
    if (state !== GameState.BOSS_COMBAT) this.hide('boss-ui');
    if (isMenu || state === GameState.INTRO) {
      this.hide('memory');
      this.hide('toast');
      this.hide('area-reveal');
    }
  }
  loading(progress: number, label: string) {
    this.el('load-label').textContent = label;
    this.el('load-progress').style.width = progress + '%';
    this.el('load-percent').textContent = Math.round(progress) + '%';
  }
  health(health: number, stamina: number, blocking: boolean) {
    this.el('health-fill').style.width = health + '%';
    this.el('health-ghost').style.width = health + '%';
    this.el('stamina-fill').style.width = stamina + '%';
    this.el('hp-number').innerHTML = `${Math.ceil(health)} <small>/ 100</small>`;
    this.el('block-control').classList.toggle('active', blocking);
  }
  boss(health: number, tell: string) {
    this.show('boss-ui');
    this.el('boss-fill').style.width = (health / BOSS.health) * 100 + '%';
    this.el('boss-ghost').style.width = (health / BOSS.health) * 100 + '%';
    this.el('boss-tell').textContent = tell;
  }
  area(index: number) {
    const area = AREAS[index];
    this.el('area-top-subtitle').textContent = area.subtitle;
    this.el('area-top-name').textContent = area.name;
    this.el('area-reveal-subtitle').textContent = area.subtitle;
    this.el('area-reveal-name').textContent = area.name;
    this.show('area-reveal');
    this.areaTimer = 4.5;
  }
  objective(text: string, label = 'THE JOURNEY') {
    this.el('objective-text').textContent = text;
    this.el('objective-label').textContent = label;
  }
  toast(text: string) {
    this.el('toast').textContent = text;
    this.show('toast');
    this.toastTimer = 3.3;
  }
  memory(text: string) {
    this.el('memory').textContent = text;
    this.show('memory');
    this.memoryTimer = 6;
  }
  intro(index: number) {
    this.el('intro-text').innerHTML = [
      'Humanity is gone.',
      'Their kingdom became a tomb.',
      'Their final weapon<br>was forgotten.',
      'Until today.',
    ][Math.min(3, index)];
  }
  flash(blocked = false) {
    const el = this.el(blocked ? 'block-flash' : 'damage-flash');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
  update(dt: number) {
    this.toastTimer -= dt;
    this.memoryTimer -= dt;
    this.areaTimer -= dt;
    if (this.toastTimer <= 0) this.hide('toast');
    if (this.memoryTimer <= 0) this.hide('memory');
    if (this.areaTimer <= 0) this.hide('area-reveal');
  }
  debug(text: string, visible: boolean) {
    this.el('debug').textContent = text;
    this.el('debug').classList.toggle('hidden', !visible);
  }
  error(message: string) {
    this.setState(GameState.LOADING);
    this.el('load-label').textContent = message;
    this.el('load-percent').textContent = 'Please reload to try again.';
  }
}
