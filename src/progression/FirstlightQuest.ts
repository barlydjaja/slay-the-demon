export const MARA_POSITION = { x: 12, z: -19 };
export const CHILD_POSITION = { x: 18, z: -31 };
export const RESTORED_CHILD_POSITION = { x: 18, z: -20 };
export const FIRSTLIGHT_PARTS = {
  winding: {
    name: 'Copper winding',
    x: -19,
    z: 14,
    hint: 'Beside the abandoned cart on the pond’s eastern bank.',
    memory:
      'Copper worn smooth by a thousand repairs. Someone kept this little machine alive for as long as they could.',
  },
  sunwheel: {
    name: 'Sunwheel',
    x: -24,
    z: -28,
    hint: 'Beneath the ruined arch, west of Firstlight.',
    memory:
      'A voice crackles through the brass: “When the sails turn, there will be bread. Tell Mara I’ll be home before the rain.”',
  },
} as const;
export type FirstlightPart = keyof typeof FIRSTLIGHT_PARTS;
export interface FirstlightState {
  accepted: boolean;
  recovered: FirstlightPart[];
  restored: boolean;
}
export function validateFirstlight(value: unknown): FirstlightState {
  const data = value && typeof value === 'object' ? (value as Partial<FirstlightState>) : {};
  const recovered = (Object.keys(FIRSTLIGHT_PARTS) as FirstlightPart[]).filter(
    (id) => Array.isArray(data.recovered) && data.recovered.includes(id),
  );
  const accepted = data.accepted === true;
  return {
    accepted,
    recovered,
    restored: data.restored === true && accepted && recovered.length === 2,
  };
}
export class FirstlightQuest {
  private state: FirstlightState;
  constructor(value?: unknown) {
    this.state = validateFirstlight(value);
  }
  get accepted() {
    return this.state.accepted;
  }
  get restored() {
    return this.state.restored;
  }
  get ready() {
    return this.accepted && this.state.recovered.length === 2 && !this.restored;
  }
  get energyCapacity() {
    return this.restored ? 120 : 100;
  }
  has(id: FirstlightPart) {
    return this.state.recovered.includes(id);
  }
  accept() {
    if (this.accepted) return false;
    this.state.accepted = true;
    return true;
  }
  recover(id: FirstlightPart) {
    if (this.has(id) || this.restored) return false;
    this.state.recovered.push(id);
    return true;
  }
  restore() {
    if (!this.ready) return false;
    this.state.restored = true;
    return true;
  }
  snapshot(): FirstlightState {
    return { ...this.state, recovered: [...this.state.recovered] };
  }
  objective() {
    if (this.restored)
      return 'The mill turns again. Visit Mara and the child, or explore beyond the lanterns.';
    if (!this.accepted) return 'Speak with Mara, the millwright beside Firstlight’s well.';
    if (this.ready) return 'Return both components to Mara beside the village well.';
    const missing = (Object.keys(FIRSTLIGHT_PARTS) as FirstlightPart[]).filter(
      (id) => !this.has(id),
    );
    return missing.length === 2
      ? 'Recover the winding by the pond and the sunwheel at the western ruins. [J] Journal'
      : `Find the ${FIRSTLIGHT_PARTS[missing[0]].name.toLowerCase()}. ${FIRSTLIGHT_PARTS[missing[0]].hint}`;
  }
  maraPages() {
    if (this.restored)
      return [
        'Listen. That wooden heartbeat… I thought I would never hear it again. My father used to say that as long as the sails turned, someone would find their way home.',
        'You have a place here now, little one. Our light is yours.',
      ];
    if (this.ready)
      return [
        'You found them. Even the sunwheel… Father carried it when we fled. I never thought I would hold it again.',
        'Give me a moment. There. Can you hear it? Firstlight has a heartbeat again. I made a capacitor from the spare winding. It should help you travel a little farther.',
      ];
    if (this.accepted)
      return [
        `${this.has('winding') || this.has('sunwheel') ? 'One piece home. One more to find.' : 'The mill can wait. Come back in one piece.'} The winding was left beside a cart on the pond’s eastern bank. The sunwheel lies beneath the western ruined arch.`,
        'Your journal remembers the landmarks. Bring both back and we can make something good out of what remains.',
      ];
    return [
      'I’m Mara. I keep this mill… or I used to. When its heart broke, the village grew so quiet. My father said the sound of its sails meant there would be bread tomorrow.',
      'We left a copper winding beside a cart on the pond’s eastern bank. Father’s sunwheel was lost beneath the ruined arch west of here. Bring them home, and we can give Firstlight its voice again.',
      this.state.recovered.length
        ? 'You have already found part of what we lost. Perhaps you were listening before we even met.'
        : 'I can fit a spare capacitor to your frame when the work is done. A little more energy for the road ahead.',
    ];
  }
}
