import {
  BOSS_ATTACKS,
  PHASE_DURATION,
  PHASE_ONE_PATTERN,
  PHASE_TWO_PATTERN,
} from '../enemies/BossAI';
import * as THREE from 'three';
import {
  DisciplineAbilities,
  DISCIPLINES,
  validDiscipline,
  type Discipline,
} from '../combat/Disciplines';
import type { WebGPURenderer } from 'three/webgpu';
import { GameState, isGameplay } from './GameState';
import { AREAS, BOSS, BOSS_AGGRO_DISTANCE, WORLD, type Settings } from './config';
import { CollisionSystem } from './CollisionSystem';
import { InputManager } from './InputManager';
import { CameraController } from './CameraController';
import { Castle } from '../world/Castle';
import { CastleAssets } from '../world/CastleAssets';
import { Effects } from '../world/Effects';
import { WaterReflection } from '../world/WaterReflection';
import { Lighting } from '../world/Lighting';
import { RobotAssets } from '../player/RobotAssets';
import { Player } from '../player/Player';
import { Enemy } from '../enemies/Enemy';
import { Boss } from '../enemies/Boss';
import { CastleCreatureAssets } from '../enemies/CastleCreatureAssets';
import { AudioManager } from '../audio/AudioManager';
import {
  FirstlightQuest,
  FIRSTLIGHT_PARTS,
  MARA_POSITION,
  CHILD_POSITION,
  RESTORED_CHILD_POSITION,
  type FirstlightPart,
} from '../progression/FirstlightQuest';
import { JourneySave, type JourneySnapshot } from '../progression/JourneySave';
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
  private abilities?: DisciplineAbilities;
  private firstlight = new FirstlightQuest();
  private journeySave = new JourneySave();
  private savedJourney = this.journeySave.load();
  private preview = false;
  private conversationPages: readonly string[] = [];
  private conversationSpeaker = 'Elder Rowan';
  private conversationRole = 'KEEPER OF FIRSTLIGHT';
  private conversationEnd = 'A NEW BEGINNING';
  private conversationDone?: () => void;
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
  private reviewPaused = false;
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
      chooseDiscipline: (choice) => this.chooseDiscipline(choice),
      leaveDisciplines: () => this.leaveDisciplines(),
      journal: () => this.toggleJournal(),
      newJourney: () => this.newJourney(),
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
    const inspect = new URLSearchParams(location.search);
    this.preview =
      !!(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV &&
      (inspect.has('chapter') || inspect.has('encounter'));
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
      this.hud.continueAvailable(!this.preview && !!this.savedJourney);
      if (
        (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV &&
        new URLSearchParams(location.search).get('chapter') === 'fields'
      ) {
        await this.enterFields();
        const inspect = new URLSearchParams(location.search).get('view');
        if (inspect === 'village') this.player.reset(-18, 16);
        if (inspect === 'ruins') this.player.reset(-25, -20);
        if (inspect === 'pond') this.player.reset(21, -18);
        if (inspect === 'mara') this.player.reset(-17.5, 12);
        if (inspect === 'winding') this.player.reset(14, -17);
        if (inspect === 'sunwheel') this.player.reset(-26, -24);
        if (inspect === 'disciplines' || inspect === 'combat') {
          this.firstlight.accept();
          this.firstlight.recover('winding');
          this.firstlight.recover('sunwheel');
          this.firstlight.restore();
          this.player.maxStamina = this.player.stamina = this.firstlight.energyCapacity;
          this.fields!.syncFirstlight(this.firstlight);
          this.player.reset(-23, 13.8);
          if (inspect === 'combat') {
            this.player.reset(5.5, 17);
            this.player.discipline =
              validDiscipline(new URLSearchParams(location.search).get('discipline')) ??
              'stormblade';
          }
        }
        if (inspect === 'repair') {
          this.firstlight.accept();
          this.firstlight.recover('winding');
          this.firstlight.recover('sunwheel');
          this.fields!.syncFirstlight(this.firstlight);
          this.player.reset(-17.5, 12);
        }
        this.camera.snap(this.player.position);
      }
      if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
        // Local encounter inspection; this entire branch is excluded from production.
        const inspect = new URLSearchParams(location.search);
        if (inspect.get('encounter') === 'reaper') {
          this.checkpoint = true;
          this.player.reset(-124.1);
          const phase = inspect.get('phase') === '2' ? 2 : 1;
          const pattern = phase === 2 ? PHASE_TWO_PATTERN : PHASE_ONE_PATTERN;
          const attack = pattern.findIndex((kind) => kind === inspect.get('attack'));
          if (phase === 2 && attack >= 0) this.boss!.phase = 2;
          if (attack >= 0) {
            this.player.reset(BOSS.spawnZ + 5);
            this.boss!.state = 'chase';
            this.boss!.attackIndex = attack;
            this.boss!.timer = 0.4;
            this.boss!.onAggro();
          }
          if (inspect.get('phase') === '2') this.boss!.health = BOSS.health / 2;
          this.camera.snap(this.player.position);
          this.changeState(attack >= 0 ? GameState.BOSS_COMBAT : GameState.PLAYING);
          // Explicit local review poses run the real encounter clock, then hold for visual QA.
          const pose = inspect.get('pose');
          if (pose) {
            const boss = this.boss!;
            boss.phase = phase;
            boss.health = BOSS.health;
            boss.timer = 0;
            this.player.invulnerable = 999;
            if (pose === 'transformation') {
              boss.state = 'phase';
              boss.phase = 2;
              boss.timer = PHASE_DURATION - 1.9;
              boss.model.animateState('phase', 'slash', 2, boss.timer, 0);
            } else {
              boss.state = 'chase';
              boss.attackIndex = Math.max(0, attack);
              boss.update(0.001, 0, this.player);
              const w = BOSS_ATTACKS[boss.attackKind].windup;
              const seconds =
                pose === 'windup'
                  ? w * 0.8
                  : pose === 'return'
                    ? w + 2.15
                    : w +
                      (boss.attackKind === 'dive'
                        ? 0.525
                        : boss.attackKind === 'loom'
                          ? 0.95
                          : 0.32);
              for (let t = 0; t < seconds; t += 0.01)
                boss.update(Math.min(0.01, seconds - t), t, this.player);
            }
            this.reviewPaused = true;
            this.progress();
            this.hud.boss(boss.health, boss.tell);
            const play = document.createElement('button');
            play.textContent = 'Play encounter';
            play.style.cssText =
              'position:fixed;z-index:100;left:28px;bottom:120px;padding:12px 18px;background:#19212b;color:#dde6e9;border:1px solid #687480;cursor:pointer';
            play.onclick = () => {
              this.reviewPaused = false;
              this.player.invulnerable = 0;
              play.remove();
            };
            document.body.appendChild(play);
          }
        } else if (inspect.get('encounter') === 'exit') {
          this.boss!.state = 'dead';
          this.boss!.model.group.visible = false;
          this.castle!.exitOpened = true;
          this.player.reset(-142.5);
          this.camera.snap(this.player.position);
          this.changeState(GameState.BOSS_DEAD);
        } else if (inspect.get('encounter') === 'guardians') {
          this.player.reset(-19, 0);
          this.camera.snap(this.player.position);
          this.changeState(GameState.PLAYING);
        }
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
    this.hud.loading(30, 'Uncovering the old kingdom…');
    await this.paint();
    const [assets, creatures, machine] = await Promise.all([
      CastleAssets.load(),
      CastleCreatureAssets.load(),
      RobotAssets.load(),
    ]);
    this.effects = new Effects();
    this.scene.add(this.effects.group);
    this.castle = new Castle(this.collision, assets);
    this.scene.add(this.castle.group);
    this.lighting = new Lighting(this.scene, this.castle.torches);
    this.hud.loading(52, 'Waking the last machine…');
    await this.paint();
    this.player = new Player(this.collision, this.effects, this.audio, machine);
    this.scene.add(this.player.model.group);
    this.player.model.group.rotation.y = 0.3;
    this.spawnEnemies(creatures);
    const boss = (this.boss = new Boss(this.collision, this.effects, this.audio, creatures));
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
    boss.onPhase = () => {
      this.hud.toast(
        'Its shroud splits open. Leave the crossing blades—and beware the falling shadow.',
      );
      this.camera.shake = 0.8;
    };
    boss.onImpact = () => {
      this.camera.shake = Math.max(this.camera.shake, 0.16);
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
  private async enterFields(saved?: JourneySnapshot | null) {
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
      const machine = await RobotAssets.load();
      this.player = new Player(this.collision, this.effects, this.audio, machine);
      this.abilities = new DisciplineAbilities(machine);
      this.scene.add(this.abilities.group);
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
      if (saved) {
        this.allMonstersCleared = saved.defeated.length === FIELD_ENCOUNTERS.length;
        this.storyRead = saved.storyRead;
        this.elderGreeted = saved.elderGreeted;
        this.villageFound = saved.villageFound;
        this.firstlight = new FirstlightQuest(saved.firstlight);
        this.enemies.forEach((enemy, i) => {
          if (saved.defeated.includes(FIELD_ENCOUNTERS[i].id)) {
            enemy.health = 0;
            enemy.state = 'dead';
            enemy.deadTime = 5;
            enemy.model.group.visible = false;
          }
        });
        const spawn = this.villageFound ? FIELD_CHECKPOINT : FIELD_SPAWN;
        this.player.reset(spawn.z, spawn.x);
      }
      this.fields.setStoryRead(this.storyRead);
      this.fields.syncFirstlight(this.firstlight);
      this.player.discipline = this.firstlight.restored ? validDiscipline(saved?.discipline) : null;
      this.player.maxStamina = this.firstlight.energyCapacity;
      this.player.stamina = this.player.maxStamina;
      this.lastHealth = 100;
      this.checkpoint = false;
      this.camera.snap(this.player.position);
      this.camera.update(1, this.time, this.player.position, false, false);
      this.fields.update(this.time);
      this.hud.chapter(true);
      this.applySettings(this.hud.settings);
      this.hud.loading(92, 'Gathering low mist and lantern light…');
      await this.paint();
      await this.renderer.compileAsync(this.scene, this.camera.camera);
      this.hud.loading(100, 'Chapter II · A new beginning');
      await this.paint();
      this.audio.setFields(true);
      this.audio.play('victory');
      this.changeState(GameState.PLAYING);
      this.hud.location('The Greenfields', 'CHAPTER II · BEYOND THE LANTERNS');
      this.fieldArea = 'fields';
      this.hud.objective('An old man waits beneath the tree. Approach him.', 'BEYOND THE GATE');
      this.hud.toast(
        saved ? 'WELCOME HOME · Your journey continues.' : 'CHAPTER II · Follow the meadow path.',
      );
      this.persistJourney();
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
    this.elderGreeted = true;
    this.persistJourney();
    this.startConversation(
      ELDER_STORY,
      'Elder Rowan',
      'KEEPER OF FIRSTLIGHT',
      'A NEW BEGINNING',
      () => {
        this.storyRead = true;
        this.fields?.setStoryRead(true);
        this.persistJourney();
        this.hud.toast('Follow the sunflowers to Firstlight Village.');
      },
    );
  }
  private startConversation(
    pages: readonly string[],
    speaker: string,
    role: string,
    final: string,
    done?: () => void,
  ) {
    if (!isGameplay(this.state)) return;
    this.storyPage = 0;
    this.conversationPages = pages;
    this.conversationSpeaker = speaker;
    this.conversationRole = role;
    this.conversationEnd = final;
    this.conversationDone = done;
    this.changeState(GameState.DIALOGUE);
    this.showStoryPage();
  }
  private startMara() {
    const repair = this.firstlight.ready,
      accepted = this.firstlight.accepted;
    this.startConversation(
      this.firstlight.maraPages(),
      'Mara',
      'MILLWRIGHT OF FIRSTLIGHT',
      repair ? 'BRING THE MILL TO LIFE' : accepted ? 'UNTIL NEXT TIME' : 'I’LL BRING THEM HOME',
      () => {
        if (repair && this.firstlight.restore()) {
          this.fields!.syncFirstlight(this.firstlight);
          this.player.maxStamina = this.firstlight.energyCapacity;
          this.restAtWell();
          this.audio.play('victory');
          this.hud.location('Firstlight Restored', 'A LIGHT TO COME HOME TO');
          this.hud.toast('CAPACITOR INSTALLED · +20 energy · Choose a discipline at the well');
          this.hud.memory(
            'The sails begin to turn. For a moment, the whole village stops to listen.',
          );
        } else if (!accepted) {
          this.firstlight.accept();
          this.hud.toast('MARA’S REQUEST · Two pieces of a heartbeat. [J] Journal');
        }
        this.persistJourney();
      },
    );
  }
  private showStoryPage() {
    this.hud.dialogue(
      this.conversationPages[this.storyPage],
      this.storyPage,
      this.conversationPages.length,
      this.conversationSpeaker,
      this.conversationRole,
      this.conversationEnd,
    );
  }
  private advanceStory() {
    if (this.state !== GameState.DIALOGUE) return;
    this.storyPage++;
    if (this.storyPage >= this.conversationPages.length) {
      const done = this.conversationDone;
      this.leaveStory();
      done?.();
    } else this.showStoryPage();
  }
  private leaveStory() {
    if (this.state !== GameState.DIALOGUE) return;
    this.conversationDone = undefined;
    this.changeState(GameState.PLAYING);
    this.renderer.domElement.focus();
  }
  private toggleJournal() {
    if (this.state === GameState.JOURNAL) {
      this.changeState(GameState.PLAYING);
      this.audio.setPaused(false);
      this.renderer.domElement.focus();
    } else if (this.chapter === 'fields' && isGameplay(this.state)) {
      this.hud.journal(this.firstlight, this.enemies.filter((enemy) => enemy.health > 0).length);
      this.changeState(GameState.JOURNAL);
      this.audio.setPaused(true);
    }
  }
  private persistJourney() {
    if (this.chapter !== 'fields') return;
    if (this.preview) {
      this.hud.saveStatus('preview');
      return;
    }
    const snapshot: JourneySnapshot = {
      version: 1,
      chapter: 'fields',
      storyRead: this.storyRead,
      elderGreeted: this.elderGreeted,
      villageFound: this.villageFound,
      firstlight: this.firstlight.snapshot(),
      discipline: this.player.discipline,
      defeated: this.enemies.flatMap((enemy, i) =>
        enemy.health <= 0 ? [FIELD_ENCOUNTERS[i].id] : [],
      ),
    };
    const saved = this.journeySave.save(snapshot);
    this.savedJourney = snapshot;
    this.hud.saveStatus(saved ? 'saved' : 'unavailable');
    this.hud.continueAvailable(saved);
  }
  private newJourney() {
    if (!this.journeySave.clear()) {
      this.hud.toast('The saved journey could not be replaced. Browser storage is unavailable.');
      return;
    }
    location.href = location.pathname;
  }
  private fieldInteraction(): 'elder' | 'mara' | 'child' | 'well' | FirstlightPart | null {
    const p = this.player.position;
    if (Math.hypot(p.x - ELDER_POSITION.x, p.z - ELDER_POSITION.z) < 4.8) return 'elder';
    if (Math.hypot(p.x - MARA_POSITION.x, p.z - MARA_POSITION.z) < 2.8) return 'mara';
    const child = this.firstlight.restored ? RESTORED_CHILD_POSITION : CHILD_POSITION;
    if (Math.hypot(p.x - child.x, p.z - child.z) < 2.6) return 'child';
    for (const id of Object.keys(FIRSTLIGHT_PARTS) as FirstlightPart[]) {
      const part = FIRSTLIGHT_PARTS[id];
      if (!this.firstlight.has(id) && Math.hypot(p.x - part.x, p.z - part.z) < 2.4) return id;
    }
    if (Math.hypot(p.x - VILLAGE.x, p.z - VILLAGE.z) < 3.8) return 'well';
    return null;
  }
  private interactFields() {
    const target = this.fieldInteraction();
    if (target === 'elder') this.startStory();
    else if (target === 'mara') this.startMara();
    else if (target === 'child')
      this.startConversation(
        [
          this.firstlight.restored
            ? 'It’s turning! Mara says tomorrow we can make bread shaped like your little head. You will stay for breakfast, won’t you?'
            : 'Mara watches the mill every morning. I think she’s waiting for it to remember how to turn. Can machines remember things?',
        ],
        'Pip',
        'A CHILD OF FIRSTLIGHT',
        'UNTIL NEXT TIME',
      );
    else if (target === 'well') {
      this.restAtWell();
      if (this.firstlight.restored) this.openDisciplines();
    } else if (target && this.firstlight.recover(target)) {
      this.fields!.syncFirstlight(this.firstlight);
      this.audio.play('heal');
      this.effects.burst(
        this.player.position.x,
        this.player.position.y + 1,
        this.player.position.z,
        0xffd58c,
        15,
        2,
      );
      this.hud.toast(`${FIRSTLIGHT_PARTS[target].name.toUpperCase()} RECOVERED · [J] Journal`);
      this.hud.memory(FIRSTLIGHT_PARTS[target].memory);
      this.persistJourney();
    }
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
  private spawnEnemies(creatures: CastleCreatureAssets) {
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
      const enemy = new Enemy(
        type,
        zone,
        x,
        z,
        this.collision,
        this.effects,
        this.audio,
        creatures.clone(type),
      );
      this.enemies.push(enemy);
      this.scene.add(enemy.model.group);
    }
  }
  private changeState(state: GameState) {
    if (state === GameState.PLAYER_DEAD) this.abilities?.reset();
    this.state = state;
    this.input.enabled = isGameplay(state);
    this.input.clear();
    this.hud.setState(state);
  }
  private play() {
    void this.audio
      .start()
      .catch(() => this.hud.toast('Sound is unavailable. The journey can continue.'));
    if (this.chapter !== 'fields' && this.savedJourney && !this.preview) {
      void this.enterFields(this.savedJourney);
      return;
    }
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
    void this.audio.start().catch(() => {});
    this.changeState(this.beforePause);
    this.audio.setPaused(false);
    this.renderer.domElement.focus();
  }
  private restart() {
    void this.audio.start();
    if (this.chapter === 'fields') {
      this.abilities?.reset();
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
    if (
      ![GameState.PAUSED, GameState.JOURNAL, GameState.DIALOGUE, GameState.DISCIPLINES].includes(
        this.state,
      )
    )
      this.time += dt;
    if (this.input.consume('KeyJ')) this.toggleJournal();
    if (this.input.consume('F3')) this.debugEnabled = !this.debugEnabled;
    if (this.input.consume('Escape')) {
      if (!this.hud.closeDialog()) {
        if (this.state === GameState.PAUSED) this.resume();
        else if (this.state === GameState.INTRO) this.skipIntro();
        else if (this.state === GameState.DIALOGUE) this.leaveStory();
        else if (this.state === GameState.JOURNAL) this.toggleJournal();
        else if (this.state === GameState.DISCIPLINES) this.leaveDisciplines();
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
    if (
      ![GameState.PAUSED, GameState.JOURNAL, GameState.DIALOGUE, GameState.DISCIPLINES].includes(
        this.state,
      )
    ) {
      this.fields?.update(this.time, this.player.position);
      this.castle?.update(this.time, dt, this.player.position.z);
      this.effects.update(dt, this.time, this.player.position.z);
      if (this.lighting instanceof Lighting) {
        this.lighting.bossPhase = this.boss?.phase ?? 1;
        if (this.boss) this.lighting.bossPosition.copy(this.boss.position);
      }
      this.lighting.update(
        dt,
        this.time,
        this.player.position.x,
        this.player.position.z,
        this.boss?.active ?? false,
        this.state === GameState.VICTORY || this.state === GameState.BOSS_DEAD,
      );
      if (this.lighting.lightning) this.audio.play('thunder');
      const millPresence =
        this.chapter === 'fields' && this.firstlight.restored
          ? Math.max(
              0,
              1 - Math.hypot(this.player.position.x - 29, this.player.position.z + 36) / 34,
            )
          : 0;
      this.audio.update(dt, millPresence);
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
    if (this.reviewPaused) return;
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
        this.interactFields();
        if (!isGameplay(this.state)) return;
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
    if (this.chapter === 'fields') {
      if (this.input.consume('KeyQ')) {
        const before = this.enemies.filter((enemy) => enemy.health <= 0).length;
        const message = this.abilities!.activate(
          this.player,
          this.enemies,
          this.collision,
          this.effects,
          this.audio,
        );
        this.hud.toast(message);
        if (this.enemies.filter((enemy) => enemy.health <= 0).length !== before)
          this.persistJourney();
      }
      this.abilities?.update(dt, this.time, this.player);
    }
    for (const enemy of this.enemies) {
      const near = enemy.position.distanceToSquared(this.player.position) < 34 ** 2;
      enemy.model.group.visible = near && enemy.deadTime < 4;
      if (!near) continue;
      enemy.update(dt, this.time, this.player, this.camera.camera);
      if (enemy.tryHit(this.player)) {
        this.camera.shake = 0.19;
        if (enemy.health <= 0 && this.chapter === 'fields') this.persistJourney();
      }
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
      this.hud.health(
        this.player.health,
        this.player.stamina,
        this.player.blocking,
        this.player.maxStamina,
      );
      this.hud.ability(
        this.player.discipline,
        this.player.abilityCooldown,
        this.player.stamina,
        this.player.parryCharge,
        this.firstlight.restored,
      );
      if (this.boss?.active) this.hud.boss(this.boss.health, this.boss.tell);
    }
  }
  private openDisciplines() {
    if (!isGameplay(this.state) || !this.firstlight.restored || this.fieldInteraction() !== 'well')
      return;
    this.changeState(GameState.DISCIPLINES);
    this.audio.setPaused(true);
    this.hud.disciplines(this.player.discipline);
  }
  private chooseDiscipline(choice: Discipline) {
    if (
      this.state !== GameState.DISCIPLINES ||
      !this.firstlight.restored ||
      !validDiscipline(choice) ||
      this.fieldInteraction() !== 'well'
    )
      return;
    this.player.chooseDiscipline(choice);
    this.abilities?.reset();
    this.persistJourney();
    this.leaveDisciplines();
    this.hud.toast(
      `${DISCIPLINES[choice].name.toUpperCase()} · [Q] ${DISCIPLINES[choice].ability}`,
    );
  }
  private leaveDisciplines() {
    if (this.state !== GameState.DISCIPLINES) return;
    this.changeState(GameState.PLAYING);
    this.audio.setPaused(false);
    this.renderer.domElement.focus();
  }
  private restAtWell() {
    this.player.health = 100;
    this.player.stamina = this.player.maxStamina;
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
        village ? 'A LIGHT THAT ENDURED · SANCTUARY' : 'CHAPTER II · BEYOND THE LANTERNS',
      );
    }
    if (village && !this.villageFound) {
      this.villageFound = true;
      this.restAtWell();
      this.hud.toast('FIRSTLIGHT FOUND · Health restored · Village checkpoint reached');
      this.hud.memory('A child laughs somewhere beyond the roofs. The machine pauses to listen.');
      this.persistJourney();
    }
    const remaining = this.enemies.filter((e) => e.health > 0).length;
    if (!remaining && !this.allMonstersCleared) {
      this.allMonstersCleared = true;
      this.audio.play('victory');
      this.hud.toast('THE FIELDS ARE QUIET · Firstlight will see another dawn.');
    }
    this.hud.objective(
      this.firstlight.accepted || this.villageFound
        ? this.firstlight.objective()
        : !this.storyRead
          ? 'Speak with Elder Rowan by the old tree.'
          : 'Follow the sunflowers to Firstlight Village.',
      this.firstlight.restored
        ? 'FIRSTLIGHT RESTORED'
        : this.firstlight.accepted
          ? 'A LIGHT TO COME HOME TO'
          : village
            ? 'FIRSTLIGHT SANCTUARY'
            : 'HUMANITY’S LAST HOPE',
    );
    const target = this.fieldInteraction();
    const labels = {
      elder: 'Speak with Elder Rowan',
      mara: this.firstlight.ready ? 'Return the components to Mara' : 'Speak with Mara',
      child: 'Speak with Pip',
      well: this.firstlight.restored ? 'Rest and choose a discipline' : 'Rest at the village well',
      winding: 'Recover copper winding',
      sunwheel: 'Recover sunwheel',
    };
    this.hud.interaction(target ? labels[target] : '');
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
        'Follow the pale light through the gate behind the throne.',
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
