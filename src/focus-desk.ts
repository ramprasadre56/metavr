import {
  BoxGeometry,
  Color,
  ConeGeometry,
  createSystem,
  CylinderGeometry,
  DistanceGrabbable,
  Entity,
  Grabbed,
  Group,
  Hovered,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MovementMode,
  Object3D,
  PokeInteractable,
  Pressed,
  Quaternion,
  RayInteractable,
  SphereGeometry,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { DeskButton, TaskCard } from './focus-components.js';
import {
  DURATIONS,
  GARDEN_SLOTS,
  type DeskState,
  loadState,
  recordGrowth,
  saveState,
  streak,
  TASK_PRESETS,
  today,
} from './focus-store.js';
import { TextPanel } from './text-panel.js';
import { Sfx } from './sfx.js';

/* ---------- layout (metres, in desk-local space; +z faces the user) ---------- */
const DESK_DISTANCE = 0.72; // from the head in XR: seated arm's reach, board fits ~55deg FoV
const DESK_DISTANCE_2D = 1.05; // flat-browser preview (narrower camera FoV)
const DESK_DROP = 0.2; // below eye height
const COLUMN_X = [-0.25, 0, 0.25];
const COLUMN_TITLES = ['To do', 'Doing', 'Done'];
const COLUMN_COLORS = ['#5b8def', '#f2a541', '#3fbf7f'];
const CARD_W = 0.22;
const CARD_H = 0.06;
const CARD_TOP_Y = 0.12;
const CARD_GAP = 0.068;
const MAX_VISIBLE = 5;
const DONE_KEEP = 4;

const ORB_POS = new Vector3(-0.2, -0.2, 0.06);
const GARDEN_POS = new Vector3(0.38, -0.25, 0.1);

type Action = 'orb' | 'duration' | 'add' | 'recenter' | 'dismiss' | 'clear';

interface ControlRefs {
  timer: TextPanel;
  status: TextPanel;
  durationBtn: TextPanel;
  streakPanel: TextPanel;
  onboarding: Entity;
  orb: Mesh;
  orbMat: MeshStandardMaterial;
  ring: Mesh;
}

/**
 * Focus Desk: a seated, hands-first productivity space.
 *  - pinch-drag task cards across a spatial kanban (To do / Doing / Done)
 *  - pinch or poke the focus orb to run a focus session
 *  - every finished session or task grows the desk garden; streaks persist
 */
export class FocusDeskSystem extends createSystem({
  cards: { required: [TaskCard] },
  heldCards: { required: [TaskCard, Grabbed] },
  buttons: { required: [DeskButton] },
  pressedButtons: { required: [DeskButton, Pressed] },
  hoveredButtons: { required: [DeskButton, Hovered] },
}) {
  private state!: DeskState;
  private desk!: Group; // anchor; not an entity, only used for math
  private deskEntity!: Entity;
  private gardenRoot!: Group;
  private ui!: ControlRefs;
  private sfx = new Sfx();
  private cardPanels = new Map<number, TextPanel>();
  private cardEntities = new Map<number, Entity>();
  private plants: Object3D[] = [];
  private plantGrowth: number[] = [];

  private timerEnd = 0; // epoch ms, 0 = idle
  private pausedRemaining = 0; // ms, >0 when paused
  private needsPlacement = true;
  private lastSecond = -1;

  // scratch objects (no allocation in update)
  private v1 = new Vector3();
  private v2 = new Vector3();
  private q1 = new Quaternion();
  private m1 = new Matrix4();
  private up = new Vector3(0, 1, 0);

  init(): void {
    this.state = loadState();
    this.buildDesk();
    this.state.cards.forEach((c) => this.spawnCard(c.id, c.title, c.column));
    this.rebuildGarden(false);
    this.refreshLabels();

    this.queries.pressedButtons.subscribe('qualify', (e) => {
      this.onAction(e.getValue(DeskButton, 'action') as Action);
    });
    this.queries.heldCards.subscribe('qualify', () => this.sfx.pick());
    this.queries.heldCards.subscribe('disqualify', (e) => this.onCardDropped(e));

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((v) => {
        // Re-anchor in front of the user whenever they enter or leave XR.
        if (v === VisibilityState.Visible || v === VisibilityState.NonImmersive) {
          this.needsPlacement = true;
        }
      }),
    );
  }

  /* ------------------------------------------------------------------ build */

  private buildDesk(): void {
    this.desk = new Group();
    this.deskEntity = this.world.createTransformEntity(this.desk);

    // Board backplate + column headers
    const plate = new Mesh(
      new BoxGeometry(0.8, 0.44, 0.01),
      new MeshStandardMaterial({ color: '#1d2433', roughness: 0.9, transparent: true, opacity: 0.88 }),
    );
    plate.position.set(0, 0.0, -0.012);
    this.desk.add(plate);
    COLUMN_X.forEach((x, i) => {
      const header = new TextPanel(0.22, 0.045, {
        bg: COLUMN_COLORS[i],
        fg: '#ffffff',
        bold: true,
      }, COLUMN_TITLES[i]);
      header.mesh.position.set(x, 0.18, 0);
      this.desk.add(header.mesh);
    });
    const title = new TextPanel(0.3, 0.035, { bg: 'rgba(0,0,0,0)', fg: '#cfd8ea', bold: true }, 'FOCUS DESK');
    title.mesh.position.set(0, 0.245, 0);
    this.desk.add(title.mesh);

    // Focus orb (pinch or poke)
    const orbMat = new MeshStandardMaterial({
      color: '#7c5cff',
      emissive: new Color('#3b1fff'),
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.1,
    });
    const orb = new Mesh(new IcosahedronGeometry(0.045, 3), orbMat);
    const ring = new Mesh(
      new CylinderGeometry(0.062, 0.062, 0.004, 48, 1, true),
      new MeshStandardMaterial({ color: '#c9bcff', emissive: new Color('#7c5cff'), emissiveIntensity: 0.8, side: 2 }),
    );
    ring.rotation.x = Math.PI / 2;
    this.addButton(orb, 'orb', ORB_POS);
    this.desk.add(ring);
    ring.position.copy(ORB_POS);

    const timer = new TextPanel(0.16, 0.045, { bg: 'rgba(20,24,36,0.9)', fg: '#ffffff', bold: true }, '25:00');
    timer.mesh.position.set(ORB_POS.x, ORB_POS.y - 0.085, ORB_POS.z);
    this.desk.add(timer.mesh);
    const status = new TextPanel(0.2, 0.028, { bg: 'rgba(0,0,0,0)', fg: '#b9c2d6' }, 'Pinch the orb to focus');
    status.mesh.position.set(ORB_POS.x, ORB_POS.y + 0.075, ORB_POS.z);
    this.desk.add(status.mesh);

    // Buttons row
    const durationBtn = this.makeTextButton('25 min', 'duration', new Vector3(-0.04, -0.2, 0.05), 0.11);
    this.makeTextButton('+ Task', 'add', new Vector3(0.09, -0.2, 0.05), 0.11);
    this.makeTextButton('Clear done', 'clear', new Vector3(0.09, -0.265, 0.05), 0.11, '#3a4459');
    this.makeTextButton('Recenter', 'recenter', new Vector3(-0.04, -0.265, 0.05), 0.11, '#3a4459');

    // Garden tray
    this.gardenRoot = new Group();
    this.gardenRoot.position.copy(GARDEN_POS);
    this.gardenRoot.rotation.y = -0.45;
    const tray = new Mesh(
      new BoxGeometry(0.26, 0.03, 0.15),
      new MeshStandardMaterial({ color: '#6b4a32', roughness: 0.8 }),
    );
    const soil = new Mesh(
      new BoxGeometry(0.24, 0.006, 0.13),
      new MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 }),
    );
    soil.position.y = 0.016;
    this.gardenRoot.add(tray, soil);
    const streakPanel = new TextPanel(0.24, 0.06, { bg: 'rgba(20,24,36,0.9)', fg: '#ffe9a8', bold: true }, '');
    streakPanel.mesh.position.set(0, 0.13, -0.04);
    this.gardenRoot.add(streakPanel.mesh);
    this.desk.add(this.gardenRoot);

    // Onboarding card (first run)
    const onboardingPanel = new TextPanel(0.5, 0.22, {
      bg: 'rgba(250,250,255,0.97)',
      fg: '#1d2433',
      fontSize: 34,
      radius: 30,
    }, [
      'Welcome to Focus Desk',
      '',
      '1  Pinch a card and drag it across: To do → Doing → Done',
      '2  Pinch (or poke) the purple orb to start a focus session',
      '3  Every finished task or session grows your garden',
      '',
      'Pinch here to start',
    ].join('\n'));
    const onboarding = this.world.createTransformEntity(onboardingPanel.mesh, { parent: this.deskEntity });
    onboardingPanel.mesh.position.set(0, 0.02, 0.09);
    onboarding.addComponent(RayInteractable);
    onboarding.addComponent(PokeInteractable);
    onboarding.addComponent(DeskButton, { action: 'dismiss' });
    onboardingPanel.mesh.visible = !this.state.onboarded;
    if (this.state.onboarded) onboardingPanel.mesh.scale.setScalar(0.0001);

    this.ui = { timer, status, durationBtn, streakPanel, onboarding, orb, orbMat, ring };
  }

  private addButton(mesh: Mesh, action: Action, pos: Vector3): Entity {
    const e = this.world.createTransformEntity(mesh, { parent: this.deskEntity });
    mesh.position.copy(pos);
    e.addComponent(RayInteractable);
    e.addComponent(PokeInteractable);
    e.addComponent(DeskButton, { action });
    return e;
  }

  private makeTextButton(label: string, action: Action, pos: Vector3, w: number, bg = '#4a5bd4'): TextPanel {
    const p = new TextPanel(w, 0.048, { bg, fg: '#ffffff', bold: true }, label);
    this.addButton(p.mesh, action, pos);
    return p;
  }

  /* ------------------------------------------------------------------ cards */

  private spawnCard(id: number, title: string, column: number): void {
    const panel = new TextPanel(CARD_W, CARD_H, {
      bg: '#f7f8fc',
      fg: '#1d2433',
      border: COLUMN_COLORS[column],
      align: 'left',
      fontSize: 30,
    }, title);
    const e = this.world.createTransformEntity(panel.mesh);
    e.addComponent(TaskCard, { cardId: id, column });
    e.addComponent(RayInteractable);
    e.addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveFromTarget,
      rotate: false,
      scale: false,
      translate: true,
    });
    this.cardPanels.set(id, panel);
    this.cardEntities.set(id, e);
  }

  /** Lay out cards in desk space (cards are top-level so grab can move them). */
  private layoutCards(): void {
    const perColumn = [0, 0, 0];
    this.desk.updateWorldMatrix(true, false);
    this.desk.getWorldQuaternion(this.q1);
    for (const c of this.state.cards) {
      const e = this.cardEntities.get(c.id);
      if (!e || e.hasComponent(Grabbed)) continue;
      const slot = perColumn[c.column]++;
      const obj = e.object3D!;
      const visible = slot < MAX_VISIBLE;
      obj.visible = visible;
      const y = CARD_TOP_Y - Math.min(slot, MAX_VISIBLE - 1) * CARD_GAP;
      this.v1.set(COLUMN_X[c.column], y, 0.012);
      this.desk.localToWorld(this.v1);
      obj.position.copy(this.v1);
      obj.quaternion.copy(this.q1);
    }
  }

  private onCardDropped(e: Entity): void {
    const id = e.getValue(TaskCard, 'cardId') as number;
    const card = this.state.cards.find((c) => c.id === id);
    if (!card) return;
    // Which column is the card over? Use desk-local x.
    this.v1.copy(e.object3D!.position);
    this.desk.updateWorldMatrix(true, false);
    this.m1.copy(this.desk.matrixWorld).invert();
    this.v1.applyMatrix4(this.m1);
    let best = 0;
    for (let i = 1; i < 3; i++) {
      if (Math.abs(this.v1.x - COLUMN_X[i]) < Math.abs(this.v1.x - COLUMN_X[best])) best = i;
    }
    const prev = card.column;
    card.column = best;
    // Move the card to the end of its new column ordering (top of Done list).
    this.state.cards = this.state.cards.filter((c) => c !== card);
    if (best === 2) this.state.cards.unshift(card);
    else this.state.cards.push(card);
    e.setValue(TaskCard, 'column', best);
    this.cardPanels.get(id)?.setStyle({ border: COLUMN_COLORS[best] });

    if (best === 2 && prev !== 2) {
      recordGrowth(this.state, 'task');
      this.sfx.success();
      this.rebuildGarden(true);
      this.trimDone();
    } else {
      this.sfx.drop();
    }
    saveState(this.state);
    this.refreshLabels();
    this.layoutCards();
  }

  private trimDone(): void {
    const done = this.state.cards.filter((c) => c.column === 2);
    if (done.length <= DONE_KEEP) return;
    done.slice(DONE_KEEP).forEach((c) => this.removeCard(c.id));
  }

  private removeCard(id: number): void {
    this.state.cards = this.state.cards.filter((c) => c.id !== id);
    this.cardEntities.get(id)?.dispose();
    this.cardEntities.delete(id);
    this.cardPanels.delete(id);
  }

  /* ---------------------------------------------------------------- actions */

  private onAction(action: Action): void {
    switch (action) {
      case 'orb':
        this.toggleTimer();
        break;
      case 'duration': {
        if (this.timerEnd > 0 || this.pausedRemaining > 0) return;
        const i = (DURATIONS.indexOf(this.state.minutes) + 1) % DURATIONS.length;
        this.state.minutes = DURATIONS[i];
        this.sfx.tick();
        break;
      }
      case 'add': {
        const todo = this.state.cards.filter((c) => c.column === 0).length;
        if (todo >= MAX_VISIBLE) {
          this.ui.status.setText('To do is full - finish one first');
          this.sfx.drop();
          return;
        }
        const title = TASK_PRESETS[this.state.presetIndex % TASK_PRESETS.length];
        this.state.presetIndex++;
        const id = this.state.nextId++;
        this.state.cards.push({ id, title, column: 0 });
        this.spawnCard(id, title, 0);
        this.sfx.tick();
        break;
      }
      case 'clear':
        this.state.cards.filter((c) => c.column === 2).forEach((c) => this.removeCard(c.id));
        this.sfx.tick();
        break;
      case 'recenter':
        this.needsPlacement = true;
        this.sfx.tick();
        break;
      case 'dismiss':
        this.state.onboarded = true;
        this.ui.onboarding.object3D!.visible = false;
        this.ui.onboarding.object3D!.scale.setScalar(0.0001);
        this.sfx.success();
        break;
    }
    saveState(this.state);
    this.refreshLabels();
    this.layoutCards();
  }

  private toggleTimer(): void {
    const now = Date.now();
    if (this.timerEnd > 0) {
      this.pausedRemaining = Math.max(0, this.timerEnd - now);
      this.timerEnd = 0;
      this.sfx.tick();
    } else if (this.pausedRemaining > 0) {
      this.timerEnd = now + this.pausedRemaining;
      this.pausedRemaining = 0;
      this.sfx.start();
    } else {
      this.timerEnd = now + this.state.minutes * 60_000;
      this.sfx.start();
    }
    this.refreshLabels();
  }

  private completeSession(): void {
    this.timerEnd = 0;
    this.pausedRemaining = 0;
    recordGrowth(this.state, 'focus');
    saveState(this.state);
    this.sfx.success();
    this.rebuildGarden(true);
    this.ui.status.setText('Session complete - a flower bloomed!');
    this.refreshLabels(false);
  }

  /* ----------------------------------------------------------------- garden */

  private rebuildGarden(animateLast: boolean): void {
    this.plants.forEach((p) => this.gardenRoot.remove(p));
    this.plants = [];
    this.plantGrowth = [];
    const cols = 6;
    this.state.garden.forEach((g, i) => {
      const plant = g.kind === 'focus' ? makeFlower(i) : makeSprout(i);
      const cx = (i % cols) - (cols - 1) / 2;
      const cz = Math.floor(i / cols) - 1;
      plant.position.set(cx * 0.036, 0.019, cz * 0.038);
      const last = animateLast && i === this.state.garden.length - 1;
      plant.scale.setScalar(last ? 0.01 : 1);
      this.plantGrowth.push(last ? 0 : 1);
      this.gardenRoot.add(plant);
      this.plants.push(plant);
    });
  }

  /* ----------------------------------------------------------------- labels */

  private refreshLabels(resetStatus = true): void {
    const d = this.state.days[today()] ?? { focus: 0, tasks: 0 };
    const s = streak(this.state);
    this.ui.streakPanel.setText(
      `${s}-day streak\n${d.focus} focus · ${d.tasks} tasks today`,
    );
    this.ui.durationBtn.setText(`${this.state.minutes} min`);
    if (resetStatus) {
      this.ui.status.setText(
        this.timerEnd > 0
          ? 'Focusing… pinch to pause'
          : this.pausedRemaining > 0
            ? 'Paused - pinch to resume'
            : 'Pinch the orb to focus',
      );
    }
    this.updateTimerText(Date.now());
  }

  private updateTimerText(now: number): void {
    const remaining =
      this.timerEnd > 0
        ? Math.max(0, this.timerEnd - now)
        : this.pausedRemaining > 0
          ? this.pausedRemaining
          : this.state.minutes * 60_000;
    const secs = Math.ceil(remaining / 1000);
    if (secs === this.lastSecond) return;
    this.lastSecond = secs;
    const mm = Math.floor(secs / 60).toString().padStart(2, '0');
    const ss = (secs % 60).toString().padStart(2, '0');
    this.ui.timer.setText(`${mm}:${ss}`);
  }

  /* ----------------------------------------------------------------- update */

  update(delta: number, time: number): void {
    if (this.needsPlacement) this.placeDesk();

    const now = Date.now();
    if (this.timerEnd > 0 && now >= this.timerEnd) this.completeSession();
    this.updateTimerText(now);

    // Orb: breathing pulse while focusing, progress ring shrinks with time left.
    const active = this.timerEnd > 0;
    const pulse = active ? 1 + Math.sin(time * 2.2) * 0.06 : 1;
    const hover = this.ui.orb.parent && this.isHovered('orb') ? 1.12 : 1;
    this.ui.orb.scale.setScalar(pulse * hover);
    this.ui.orbMat.emissiveIntensity = active ? 0.9 + Math.sin(time * 2.2) * 0.3 : 0.45;
    const total = this.state.minutes * 60_000;
    const left = active ? this.timerEnd - now : this.pausedRemaining > 0 ? this.pausedRemaining : total;
    const frac = Math.min(1, Math.max(0.02, left / total));
    this.ui.ring.scale.set(frac, 1, frac);

    // Button hover feedback
    for (const e of this.queries.buttons.entities) {
      const a = e.getValue(DeskButton, 'action');
      if (a === 'orb' || a === 'dismiss') continue;
      const s = e.hasComponent(Hovered) ? 1.08 : 1;
      e.object3D!.scale.setScalar(s);
    }

    // Plant growth animation
    for (let i = 0; i < this.plants.length; i++) {
      if (this.plantGrowth[i] < 1) {
        this.plantGrowth[i] = Math.min(1, this.plantGrowth[i] + delta * 0.8);
        const t = this.plantGrowth[i];
        this.plants[i].scale.setScalar(0.01 + easeOutBack(t) * 0.99);
      }
    }
  }

  private isHovered(action: Action): boolean {
    for (const e of this.queries.hoveredButtons.entities) {
      if (e.getValue(DeskButton, 'action') === action) return true;
    }
    return false;
  }

  /** Anchor the desk in front of the viewer's head, yaw-only, at seated reach. */
  private placeDesk(): void {
    const cam = this.world.camera;
    cam.updateWorldMatrix(true, false);
    cam.getWorldPosition(this.v1);
    cam.getWorldDirection(this.v2);
    this.v2.y = 0;
    if (this.v2.lengthSq() < 1e-4) this.v2.set(0, 0, -1);
    this.v2.normalize();
    const obj = this.deskEntity.object3D!;
    const immersive = this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
    const dist = immersive ? DESK_DISTANCE : DESK_DISTANCE_2D;
    obj.position.set(
      this.v1.x + this.v2.x * dist,
      this.v1.y - (immersive ? DESK_DROP : 0.04),
      this.v1.z + this.v2.z * dist,
    );
    // face the user: desk +z points back toward the head
    const yaw = Math.atan2(-this.v2.x, -this.v2.z);
    this.q1.setFromAxisAngle(this.up, yaw);
    obj.quaternion.copy(this.q1);
    this.needsPlacement = false;
    this.layoutCards();
  }
}

/* ------------------------------------------------------------- plant meshes */

const stemMat = new MeshStandardMaterial({ color: '#3f8f4a', roughness: 0.8 });
const leafMat = new MeshStandardMaterial({ color: '#58c06a', roughness: 0.7 });
const petalColors = ['#ff7aa2', '#ffd166', '#c792ea', '#7fdbff', '#ff9f68'];
const petalMats = petalColors.map(
  (c) => new MeshStandardMaterial({ color: c, emissive: new Color(c), emissiveIntensity: 0.25, roughness: 0.5 }),
);
const centreMat = new MeshStandardMaterial({ color: '#ffe066', roughness: 0.6 });
const stemGeo = new CylinderGeometry(0.003, 0.004, 1, 6);
const leafGeo = new ConeGeometry(0.009, 0.03, 5);
const petalGeo = new SphereGeometry(0.008, 8, 6);
const centreGeo = new SphereGeometry(0.007, 8, 6);

function makeFlower(seed: number): Object3D {
  const g = new Group();
  const h = 0.06 + (seed % 3) * 0.012;
  const stem = new Mesh(stemGeo, stemMat);
  stem.scale.y = h;
  stem.position.y = h / 2;
  g.add(stem);
  const mat = petalMats[seed % petalMats.length];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new Mesh(petalGeo, mat);
    p.position.set(Math.cos(a) * 0.01, h, Math.sin(a) * 0.01);
    p.scale.set(1, 0.6, 1);
    g.add(p);
  }
  const c = new Mesh(centreGeo, centreMat);
  c.position.y = h + 0.002;
  g.add(c);
  const leaf = new Mesh(leafGeo, leafMat);
  leaf.position.set(0.006, h * 0.4, 0);
  leaf.rotation.z = -0.8;
  g.add(leaf);
  g.rotation.y = seed * 1.3;
  return g;
}

function makeSprout(seed: number): Object3D {
  const g = new Group();
  const h = 0.025 + (seed % 2) * 0.008;
  const stem = new Mesh(stemGeo, stemMat);
  stem.scale.y = h;
  stem.position.y = h / 2;
  g.add(stem);
  for (const side of [-1, 1]) {
    const leaf = new Mesh(leafGeo, leafMat);
    leaf.position.set(side * 0.007, h, 0);
    leaf.rotation.z = -side * 0.9;
    g.add(leaf);
  }
  g.rotation.y = seed * 0.9;
  return g;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export { GARDEN_SLOTS };
