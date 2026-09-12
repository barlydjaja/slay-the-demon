import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { GameState, isGameplay } from './GameState';
import { AREAS, BOSS, BOSS_AGGRO_DISTANCE, WORLD, type Settings } from './config';
import { CollisionSystem } from './CollisionSystem';
import { InputManager } from './InputManager';
import { CameraController } from './CameraController';
import { Castle } from '../world/Castle';
import { Effects } from '../world/Effects';
import { WaterReflection } from '../world/WaterReflection';
import { Lighting } from '../world/Lighting';
import { Player } from '../player/Player';
import { Enemy } from '../enemies/Enemy';
import { Boss } from '../enemies/Boss';
import { AudioManager } from '../audio/AudioManager';
import { HUD } from '../ui/HUD';
import type { Greenfields } from '../world/Greenfields';
import { FieldLighting } from '../world/FieldLighting';
import { disposeScene } from '../world/disposeScene';
import { clearPrimitiveCache } from '../world/primitives';
import {
  FIELD_BOUNDS,
  FIELD_SPAWN,
  FIELD_CHECKPOINT,
  ELDER_POSITION,
  ELDER_STORY,
  FIELD_ENCOUNTERS,
  VILLAGE,
  inVillage,
  canLeaveCastle,
} from '../world/GreenfieldsConfig';

export class Game {
  state = GameState.LOADING;
  private beforePause = GameState.PLAYING;
  private scene = new THREE.Scene();
  private renderer!: THREE.WebGLRenderer | WebGPURenderer;
  private collision = new CollisionSystem();
  private audio = new AudioManager();
  private camera = new CameraController();
  private input = new InputManager(document.querySelector<HTMLElement>('#game')!);
  private hud: HUD;
  private castle?: Castle;
  private fields?: Greenfields;
  private fieldsModule?: Promise<typeof import('../world/Greenfields')>;
  private chapter: 'castle' | 'fields' = 'castle';
  private bossDefeated = false;
  private storyRead = false;
  private elderGreeted = false;
  private storyPage = 0;
  private villageFound = false;
  private fieldArea = '';
  private allMonstersCleared = false;
  private effects!: Effects;
  private lighting!: Lighting | FieldLighting;
  private player!: Player;
  private enemies: Enemy[] = [];
  private boss?: Boss;
  private reflection?: WaterReflection;
  private arenaSeal = this.collision.add(0, -115, 8.8, 1);
  private checkpoint = false;
  private areaIndex = -1;
  private introTime = 0;
  private lastTime = 0;
  private time = 0;
  private lastHealth = 100;
  private debugEnabled = false;
  private fps = 60;
  private telemetryTime = 0;
  private uiTime = 0;
  private rendererName = 'WebGL 2';
  private resolutionScale = 1;
  private slowFrames = 0;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private aim = new THREE.Vector3();
  constructor() {
    this.arenaSeal.active = false;
    this.hud = new HUD({
      play: () => this.play(),
      advance: () => this.advanceStory(),
      leaveDialogue: () => this.leaveStory(),
      resume: () => this.resume(),
      restart: () => this.restart(),
      quit: () => this.quit(),
      skip: () => this.skipIntro(),
      settings: (s) => this.applySettings(s),
    });
    window.addEventListener('resize', () => {
      this.camera.resize();
      this.renderer?.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('blur', () => {
      if (isGameplay(this.state)) this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isGameplay(this.state)) this.pause();
    });
  }
  async init() {
    try {
      this.hud.loading(8, 'Finding a little light…');
      await this.paint();
      await this.createRenderer();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.91;
      const canvas = this.renderer.domElement;
      canvas.setAttribute(
        'aria-label',
        '3D castle. Use WASD to move, left mouse to strike, right mouse to block, and Escape to pause.',
      );
      canvas.tabIndex = 0;
      document.querySelector('#game')!.appendChild(canvas);
      this.hud.loading(24, 'Laying the rain-soaked stone…');
      await this.paint();
      await this.buildCastle();
      this.applySettings(this.hud.settings);
      this.hud.loading(78, 'Gathering mist and candlelight…');
      await this.paint();
      this.camera.update(1, 0, this.player.position, true, false);
      this.castle!.update(0, 0, this.player.position.z);
      this.lighting.update(0.1, 0, 0, 11, false, false);
      await this.renderer.compileAsync(this.scene, this.camera.camera);
      this.hud.loading(100, 'A kingdom is waiting.');
      await this.paint();
      this.changeState(GameState.MENU);
      if (
        (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV &&
        new URLSearchParams(location.search).get('chapter') === 'fields'
      ) {
        await this.enterFields();
        const inspect = new URLSearchParams(location.search).get('view');
        if (inspect === 'village') this.player.reset(-18, 16);
        if (inspect === 'ruins') this.player.reset(-25, -20);
        if (inspect === 'pond') this.player.reset(21, -18);
        this.camera.snap(this.player.position);
      }
      this.lastTime = performance.now();
      requestAnimationFrame(this.tick);
    } catch (error) {
      console.error('Game initialization failed', error);
      this.hud.error(
        'The kingdom could not awaken. Please enable hardware acceleration and use a browser with WebGL 2 support.',
      );
    }
  }
  private async buildCastle() {
    this.effects = new Effects();
    this.scene.add(this.effects.group);
    this.castle = new Castle(this.collision);
    this.scene.add(this.castle.group);
    this.lighting = new Lighting(this.scene, this.castle.torches);
    this.hud.loading(52, 'Waking the last machine…');
    await this.paint();
    this.player = new Player(this.collision, this.effects, this.audio);
    this.scene.add(this.player.model.group);
    this.player.model.group.rotation.y = 0.3;
    this.spawnEnemies();
    const boss = (this.boss = new Boss(this.collision, this.effects, this.audio));
    this.scene.add(boss.model.group, boss.telegraphs);
    this.reflection = await WaterReflection.create(this.renderer, this.castle.water);
    this.scene.add(this.reflection.surface);
    boss.onAggro = () => {
      this.changeState(GameState.BOSS_COMBAT);
      this.arenaSeal.active = true;
      this.hud.toast('The last guardian of an empty kingdom.');
      this.camera.shake = 0.75;
    };
    boss.onDamage = (blocked) => {
      this.hud.flash(blocked);
      this.camera.shake = blocked ? 0.25 : 0.7;
    };
    boss.onDeath = () => {
      // Fetch the next map while the gate opens, before the player reaches it.
      void this.loadFieldsModule().catch(() => {});
      this.changeState(GameState.BOSS_DEAD);
      this.camera.shake = 1;
      this.arenaSeal.active = false;
      this.effects.burst(boss.position.x, 3, boss.position.z, 0xd6b7c8, 60, 7);
    };
  }
  private loadFieldsModule() {
    return (this.fieldsModule ??= import('../world/Greenfields').catch((error) => {
      this.fieldsModule = undefined;
      throw error;
    }));
  }
  private async enterFields() {
    if (this.state === GameState.TRANSITION || this.chapter === 'fields') return;
    this.changeState(GameState.TRANSITION);
    this.hud.loading(6, 'Beyond the hollow kingdom…');
    this.audio.setBoss(false);
    try {
      await this.paint();
      this.reflection?.dispose();
      this.reflection = undefined;
      disposeScene(this.scene);
      clearPrimitiveCache();
      this.castle = undefined;
      this.boss = undefined;
      this.enemies = [];
      this.scene = new THREE.Scene();
      this.collision = new CollisionSystem(FIELD_BOUNDS);
      this.hud.loading(28, 'Opening the Greenfields…');
      await this.paint();
      const { Greenfields } = await this.loadFieldsModule();
      this.fields = await Greenfields.create(this.collision, async (progress, label) => {
        this.hud.loading(progress, label);
        await this.paint();
      });
      this.scene.add(this.fields.group);
      this.effects = new Effects(true, this.collision.heightAt);
      this.scene.add(this.effects.group);
      this.lighting = new FieldLighting(this.scene);
      this.hud.loading(73, 'Waking the last machine in a new world…');
      await this.paint();
      this.player = new Player(this.collision, this.effects, this.audio);
      this.player.reset(FIELD_SPAWN.z, FIELD_SPAWN.x);
      this.scene.add(this.player.model.group);
      for (const spawn of FIELD_ENCOUNTERS) {
        const enemy = new Enemy(
          spawn.type,
          5,
          spawn.x,
          spawn.z,
          this.collision,
          this.effects,
          this.audio,
          this.fields.assets.clone(spawn.type),
        );
        this.enemies.push(enemy);
        this.scene.add(enemy.model.group);
        if (this.enemies.length % 3 === 0) {
          this.hud.loading(
            78 + (this.enemies.length / FIELD_ENCOUNTERS.length) * 10,
            'Waking the creatures of the meadow…',
          );
          await this.paint();
        }
      }
      this.chapter = 'fields';
      this.lastHealth = 100;
      this.checkpoint = false;
      this.camera.snap(this.player.position);
      this.camera.update(1, this.time, this.player.position, false, false);
      this.fields.update(this.time);
      this.hud.chapter(true);
      this.applySettings(this.hud.settings);
      this.hud.loading(92, 'Preparing sunlight and shadows…');
      await this.paint();
      await this.renderer.compileAsync(this.scene, this.camera.camera);
      this.hud.loading(100, 'Chapter II · A new beginning');
      await this.paint();
      this.audio.setFields(true);
      this.audio.play('victory');
      this.changeState(GameState.PLAYING);
      this.hud.location('The Greenfields', 'CHAPTER II · A NEW BEGINNING');
      this.fieldArea = 'fields';
      this.hud.objective('An old man waits beneath the tree. Approach him.', 'BEYOND THE GATE');
      this.hud.toast('CHAPTER II · Follow the meadow path.');
      this.renderer.domElement.focus();
    } catch (error) {
      console.error('Could not load the Greenfields', error);
      // Keep the render loop away from the partially released map.
      this.state = GameState.TRANSITION;
      this.hud.error('The Greenfields could not load. Please reload the game to try again.');
    }
  }
  private startStory() {
    if (this.chapter !== 'fields' || !isGameplay(this.state)) return;
    this.storyPage = 0;
    this.elderGreeted = true;
    this.changeState(GameState.DIALOGUE);
    this.showStoryPage();
  }
  private showStoryPage() {
    this.hud.dialogue(ELDER_STORY[this.storyPage], this.storyPage, ELDER_STORY.length);
  }
  private advanceStory() {
    if (this.state !== GameState.DIALOGUE) return;
    this.storyPage++;
    if (this.storyPage >= ELDER_STORY.length) {
      this.storyRead = true;
      this.fields?.setStoryRead(true);
      this.leaveStory();
      this.hud.toast('Follow the sunflowers to Firstlight Village.');
    } else this.showStoryPage();
  }
  private leaveStory() {
    if (this.state !== GameState.DIALOGUE) return;
    // Leaving early permits free exploration; E reopens the elder's tale.
    this.changeState(GameState.PLAYING);
    this.renderer.domElement.focus();
  }
  private paint() {
    // A single rAF resumes before paint and can leave the previous percentage
    // onscreen throughout expensive work. Let that frame paint before continuing.
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }
  private async createRenderer() {
    if ('gpu' in navigator) {
      let gpu: WebGPURenderer | undefined;
      try {
        const { WebGPURenderer } = await import('three/webgpu');
        gpu = new WebGPURenderer({ antialias: true });
        await gpu.init();
        this.renderer = gpu;
        this.rendererName = (gpu.backend as unknown as { isWebGPUBackend?: boolean })
          .isWebGPUBackend
          ? 'WebGPU'
          : 'WebGL 2';
        return;
      } catch (error) {
        console.info('WebGPU unavailable; using WebGL 2.', error);
        gpu?.dispose();
      }
    }
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.rendererName = 'WebGL 2';
  }
  private spawnEnemies() {
    const spawn: [number, 'armor' | 'spider', number, number][] = [
      [1, 'armor', -2, -22],
      [1, 'spider', 3, -27],
      [1, 'spider', -5, -33],
      [1, 'armor', 2, -37],
      [2, 'armor', 1, -51],
      [2, 'spider', -3, -56],
      [2, 'armor', 4, -63],
      [2, 'spider', -2, -68],
      [2, 'armor', 0, -73],
      [3, 'spider', -1, -85],
      [3, 'armor', 2, -92],
      [3, 'spider', -2, -98],
      [3, 'armor', 1, -102],
    ];
    for (const [zone, type, x, z] of spawn) {
      const enemy = new Enemy(type, zone, x, z, this.collision, this.effects, this.audio);
      this.enemies.push(enemy);
      this.scene.add(enemy.model.group);
    }
  }
  private changeState(state: GameState) {
    this.state = state;
    this.input.enabled = isGameplay(state);
    this.input.clear();
    this.hud.setState(state);
  }
  private play() {
    void this.audio
      .start()
      .catch(() => this.hud.toast('Sound is unavailable. The journey can continue.'));
    if (this.chapter === 'fields') {
      this.audio.setPaused(false);
      this.changeState(GameState.PLAYING);
      this.renderer.domElement.focus();
      return;
    }
    this.resetWorld();
    this.changeState(GameState.INTRO);
    this.introTime = 0;
    this.hud.intro(0);
  }
  private resetWorld() {
    this.checkpoint = false;
    this.areaIndex = -1;
    this.castle?.reset();
    this.bossDefeated = false;
    for (const enemy of this.enemies) enemy.reset();
    this.player.reset();
    this.boss?.reset();
    this.arenaSeal.active = false;
    this.lastHealth = 100;
    this.camera.snap(this.player.position);
    this.audio.setPaused(false);
  }
  private skipIntro() {
    if (this.state !== GameState.INTRO) return;
    this.changeState(GameState.PLAYING);
    this.hud.toast('WASD to move · Aim with the mouse · Hold LMB to strike');
    this.renderer.domElement.focus();
  }
  private pause() {
    if (!isGameplay(this.state)) return;
    this.beforePause = this.state;
    this.changeState(GameState.PAUSED);
    this.audio.setPaused(true);
  }
  private resume() {
    if (this.state !== GameState.PAUSED) return;
    this.changeState(this.beforePause);
    this.audio.setPaused(false);
    this.renderer.domElement.focus();
  }
  private restart() {
    void this.audio.start();
    if (this.chapter === 'fields') {
      const spawn = this.villageFound ? FIELD_CHECKPOINT : FIELD_SPAWN;
      this.player.reset(spawn.z, spawn.x);
      for (const enemy of this.enemies) if (enemy.health > 0) enemy.reset();
      this.camera.snap(this.player.position);
      this.lastHealth = 100;
      this.audio.setPaused(false);
      this.changeState(GameState.PLAYING);
      this.hud.toast(
        this.villageFound
          ? 'FIRSTLIGHT · The village keeps your light safe.'
          : 'The meadow is waiting.',
      );
    } else if (this.checkpoint) {
      this.player.reset(WORLD.checkpointZ);
      this.boss?.reset();
      this.bossDefeated = false;
      this.castle?.resetExit();
      this.arenaSeal.active = false;
      this.camera.snap(this.player.position);
      this.lastHealth = 100;
      this.audio.setPaused(false);
      this.changeState(GameState.PLAYING);
      this.hud.toast('Sanctuary restored. A little hope remains.');
    } else {
      this.resetWorld();
      this.changeState(GameState.PLAYING);
    }
    this.renderer.domElement.focus();
  }
  private quit() {
    if (this.chapter === 'castle') this.resetWorld();
    else if (this.player.health <= 0) this.restart();
    this.audio.setPaused(false);
    this.player.model.group.rotation.y = 0.3;
    this.changeState(GameState.MENU);
  }
  private tick = (now: number) => {
    const rawDt = (now - this.lastTime) / 1000,
      dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.lastTime = now;
    if (this.state === GameState.TRANSITION) {
      this.input.endFrame();
      requestAnimationFrame(this.tick);
      return;
    }
    if (this.state !== GameState.PAUSED) this.time += dt;
    if (this.input.consume('F3')) this.debugEnabled = !this.debugEnabled;
    if (this.input.consume('Escape')) {
      if (!this.hud.closeDialog()) {
        if (this.state === GameState.PAUSED) this.resume();
        else if (this.state === GameState.INTRO) this.skipIntro();
        else if (this.state === GameState.DIALOGUE) this.leaveStory();
        else this.pause();
      }
    }
    if (this.state === GameState.DIALOGUE && this.input.consume('KeyE')) this.advanceStory();
    const playing = isGameplay(this.state),
      menu = this.state === GameState.MENU;
    if (this.state === GameState.INTRO) {
      this.introTime += dt;
      this.hud.intro(Math.floor(this.introTime / 2.6));
      if (this.introTime > 10.8 || this.input.consume('Space')) this.skipIntro();
    }
    if (playing) this.updateGameplay(dt);
    else if (menu || this.state === GameState.INTRO)
      this.player.model.animate(this.time, false, false, 0, false, 0, 0);
    else if (this.state === GameState.PLAYER_DEAD)
      this.player.update(dt, this.time, this.input, null);
    else if (this.state === GameState.BOSS_DEAD && this.boss) {
      this.boss.update(dt, this.time, this.player);
      if (this.boss.deadTime > 4) {
        this.bossDefeated = true;
        this.castle!.exitOpened = true;
        this.player.health = 100;
        this.lastHealth = 100;
        this.audio.setBoss(false);
        this.audio.play('victory');
        this.changeState(GameState.PLAYING);
        this.hud.toast('THE REAPER HAS FALLEN · The far gate is opening.');
        this.hud.memory('Beyond the throne, a warm breeze. Beyond the walls… life.');
      }
    }
    if (this.state !== GameState.PAUSED) {
      this.fields?.update(this.time);
      this.castle?.update(this.time, dt, this.player.position.z);
      this.effects.update(dt, this.time, this.player.position.z);
      this.lighting.update(
        dt,
        this.time,
        this.player.position.x,
        this.player.position.z,
        this.boss?.active ?? false,
        this.state === GameState.VICTORY || this.state === GameState.BOSS_DEAD,
      );
      if (this.lighting.lightning) this.audio.play('thunder');
      this.audio.update(dt);
    }
    this.camera.update(
      dt,
      this.time,
      this.player.position,
      menu || this.state === GameState.INTRO,
      (this.boss?.active ?? false) || this.state === GameState.BOSS_DEAD,
    );
    this.hud.update(dt);
    this.input.endFrame();
    this.reflection?.update(this.time, this.renderer);
    this.renderer.render(this.scene, this.camera.camera);
    this.updateTelemetry(dt, rawDt);
    requestAnimationFrame(this.tick);
  };
  private updateGameplay(dt: number) {
    this.mouse.set(this.input.mouse.x, this.input.mouse.y);
    this.raycaster.setFromCamera(this.mouse, this.camera.camera);
    this.ground.constant = -this.player.position.y;
    const aim = this.input.mouse.active
      ? this.raycaster.ray.intersectPlane(this.ground, this.aim)
      : null;
    this.player.update(dt, this.time, this.input, aim);
    if (this.chapter === 'fields') {
      const nearElder =
        Math.hypot(
          this.player.position.x - ELDER_POSITION.x,
          this.player.position.z - ELDER_POSITION.z,
        ) < 4.8;
      if (this.input.consume('KeyE')) {
        if (nearElder) {
          this.startStory();
          return;
        }
        if (
          Math.hypot(this.player.position.x - VILLAGE.x, this.player.position.z - VILLAGE.z) < 3.8
        )
          this.restAtWell();
      }
      if (nearElder && !this.elderGreeted) {
        this.startStory();
        return;
      }
    }
    if (
      canLeaveCastle(
        this.bossDefeated,
        this.castle?.exitReady ?? false,
        this.player.position.x,
        this.player.position.z,
      )
    ) {
      void this.enterFields();
      return;
    }
    for (const enemy of this.enemies) {
      const near = enemy.position.distanceToSquared(this.player.position) < 34 ** 2;
      enemy.model.group.visible = near && enemy.deadTime < 4;
      if (!near) continue;
      enemy.update(dt, this.time, this.player, this.camera.camera);
      if (enemy.tryHit(this.player)) this.camera.shake = 0.19;
    }
    if (this.boss && (this.player.position.z < -108 || this.boss.active)) {
      this.boss.update(dt, this.time, this.player);
      if (this.boss.tryHit(this.player)) this.camera.shake = 0.28;
    }
    if (this.player.health < this.lastHealth) {
      this.hud.flash();
      this.camera.shake = 0.45;
    }
    this.lastHealth = this.player.health;
    if (this.player.health <= 0) {
      this.audio.setBoss(false);
      this.changeState(GameState.PLAYER_DEAD);
      return;
    }
    this.uiTime -= dt;
    if (this.uiTime <= 0) {
      this.uiTime = 0.07;
      if (this.chapter === 'castle') this.progress();
      else this.fieldProgress();
      this.hud.health(this.player.health, this.player.stamina, this.player.blocking);
      if (this.boss?.active) this.hud.boss(this.boss.health, this.boss.tell);
    }
  }
  private restAtWell() {
    this.player.health = 100;
    this.player.stamina = 100;
    this.lastHealth = 100;
    this.audio.play('heal');
    this.effects.burst(this.player.position.x, 1, this.player.position.z, 0xffe3a3, 25, 2);
    this.hud.toast('FIRSTLIGHT WELL · Health and energy restored.');
  }
  private fieldProgress() {
    const p = this.player.position;
    const village = inVillage(p.x, p.z);
    const area = village ? 'village' : 'fields';
    if (area !== this.fieldArea) {
      this.fieldArea = area;
      this.hud.location(
        village ? 'Firstlight Village' : 'The Greenfields',
        village ? 'A LIGHT THAT ENDURED · SANCTUARY' : 'CHAPTER II · A NEW BEGINNING',
      );
    }
    if (village && !this.villageFound) {
      this.villageFound = true;
      this.restAtWell();
      this.hud.toast('FIRSTLIGHT FOUND · Health restored · Village checkpoint reached');
      this.hud.memory('A child laughs somewhere beyond the roofs. The machine pauses to listen.');
    }
    const remaining = this.enemies.filter((e) => e.health > 0).length;
    if (!remaining && !this.allMonstersCleared) {
      this.allMonstersCleared = true;
      this.audio.play('victory');
      this.hud.toast('THE FIELDS ARE QUIET · Firstlight will see another dawn.');
    }
    this.hud.objective(
      !this.storyRead
        ? 'Speak with Elder Rowan by the old tree.'
        : !this.villageFound
          ? 'Follow the sunflowers to Firstlight Village.'
          : remaining
            ? `Guard the new beginning. ${remaining} creatures roam the fields.`
            : 'The village is safe. Explore the world you have protected.',
      village ? 'FIRSTLIGHT SANCTUARY' : 'HUMANITY’S LAST HOPE',
    );
    const nearElder = Math.hypot(p.x - ELDER_POSITION.x, p.z - ELDER_POSITION.z) < 4.8;
    const nearWell = Math.hypot(p.x - VILLAGE.x, p.z - VILLAGE.z) < 3.8;
    this.hud.interaction(
      nearElder ? 'Speak with Elder Rowan' : nearWell ? 'Rest at the village well' : '',
    );
  }
  private progress() {
    if (!this.castle || !this.boss) return;
    let index = AREAS.findIndex(
      (area) => this.player.position.z <= area.z && this.player.position.z > area.end,
    );
    if (index < 0) index = 4;
    if (index !== this.areaIndex) {
      this.areaIndex = index;
      this.hud.area(index);
    }
    const remaining = this.enemies.filter((e) => e.zone === index && e.health > 0).length;
    for (let zone = 1; zone <= 3; zone++)
      if (this.enemies.every((e) => e.zone !== zone || e.health === 0)) {
        if (this.castle.openGate(zone)) this.hud.toast('The seal has broken. The way is open.');
      }
    if (this.bossDefeated)
      this.hud.objective(
        'Walk through the sunlit gate behind the throne.',
        'A WORLD BEYOND THE WALLS',
      );
    else if (this.boss.active)
      this.hud.objective('Let it strike. Answer in the silence.', 'THE HOODED REAPER');
    else if (index > 0 && index < 4 && remaining > 0)
      this.hud.objective(
        `${AREAS[index].objective} ${remaining} guardian${remaining > 1 ? 's' : ''} remain.`,
      );
    else
      this.hud.objective(
        index === 3 ? 'Follow the blue light to the sanctuary.' : AREAS[index].objective,
      );
    if (!this.checkpoint && this.player.position.z < -108) {
      this.checkpoint = true;
      this.player.health = 100;
      this.player.stamina = 100;
      this.lastHealth = 100;
      this.audio.play('heal');
      this.effects.burst(this.player.position.x, 1, this.player.position.z, 0xa5e6e4, 35, 2);
      this.hud.toast('SANCTUARY FOUND · Health restored · Checkpoint saved');
    }
    for (const memory of this.castle.memories)
      if (
        !memory.seen &&
        Math.hypot(this.player.position.x - memory.x, this.player.position.z - memory.z) < 3.6
      ) {
        memory.seen = true;
        this.hud.memory(memory.text);
      }
  }
  private applySettings(settings: Settings) {
    if (!this.renderer) return;
    this.resolutionScale =
      settings.quality === 'high' ? 1.35 : settings.quality === 'medium' ? 1 : 0.7;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.resolutionScale));
    this.renderer.shadowMap.enabled = settings.shadows !== 'low';
    if (this.lighting) {
      const size = settings.shadows === 'high' ? 2048 : 1024;
      this.lighting.sun.shadow.mapSize.set(size, size);
      if (this.lighting.sun.shadow.map) {
        this.lighting.sun.shadow.map.dispose();
        this.lighting.sun.shadow.map = null;
      }
    }
    this.castle?.setReflections(settings.reflections);
    this.reflection?.setQuality(settings.reflections);
    this.effects?.setQuality(settings.particles);
    this.audio.setMuted(!settings.audio);
    if (settings.audio && this.state !== GameState.LOADING) void this.audio.start();
  }
  private updateTelemetry(dt: number, rawDt: number) {
    this.fps += (1 / Math.max(0.001, rawDt) - this.fps) * 0.035;
    this.telemetryTime += dt;
    // Hysteresis prevents resolution oscillation on slower GPUs.
    if (rawDt > 0.026 && rawDt < 0.2 && isGameplay(this.state)) this.slowFrames += dt;
    else this.slowFrames = Math.max(0, this.slowFrames - dt * 0.45);
    if (this.slowFrames > 7 && this.resolutionScale > 0.65) {
      this.resolutionScale = Math.max(0.65, this.resolutionScale - 0.15);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.resolutionScale));
      this.slowFrames = 0;
    }
    if (this.telemetryTime < 0.3) return;
    this.telemetryTime = 0;
    const info = this.renderer.info.render as unknown as {
      calls?: number;
      drawCalls?: number;
      triangles: number;
    };
    this.hud.debug(
      `${this.rendererName}  |  ${Math.round(this.fps)} FPS\nDraw calls  ${info.drawCalls ?? info.calls ?? 0}\nTriangles   ${info.triangles.toLocaleString()}\nResolution  ${this.resolutionScale.toFixed(2)}×\nPlayer      ${this.player.position.x.toFixed(1)}, ${this.player.position.z.toFixed(1)}\nHealth      ${this.player.health} / 100\nBoss HP     ${this.boss?.health ?? '—'} / ${BOSS.health}\nBoss state  ${this.boss?.state ?? 'Greenfields'}\nAggro       ${BOSS_AGGRO_DISTANCE} units\nGame state  ${this.state}`,
      this.debugEnabled,
    );
  }
}
