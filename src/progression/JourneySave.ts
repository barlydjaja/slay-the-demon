import { FIELD_ENCOUNTERS } from '../world/GreenfieldsConfig';
import { validateFirstlight, type FirstlightState } from './FirstlightQuest';
export const JOURNEY_SAVE_KEY = 'last-hope-journey-v1';
export interface JourneySnapshot {
  version: 1;
  chapter: 'fields';
  storyRead: boolean;
  elderGreeted: boolean;
  villageFound: boolean;
  defeated: string[];
  firstlight: FirstlightState;
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function parseJourney(raw: string | null): JourneySnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || value.chapter !== 'fields') return null;
    const ids = new Set(FIELD_ENCOUNTERS.map((spawn) => spawn.id));
    return {
      version: 1,
      chapter: 'fields',
      storyRead: value.storyRead === true,
      elderGreeted: value.elderGreeted === true || value.storyRead === true,
      villageFound: value.villageFound === true,
      defeated: Array.isArray(value.defeated)
        ? ([
            ...new Set(
              value.defeated.filter((id: unknown) => typeof id === 'string' && ids.has(id)),
            ),
          ] as string[])
        : [],
      firstlight: validateFirstlight(value.firstlight),
    };
  } catch {
    return null;
  }
}
export class JourneySave {
  private storage?: StoragePort;
  private newerVersion = false;
  constructor(storage?: StoragePort) {
    try {
      this.storage = storage ?? globalThis.localStorage;
    } catch {
      /* Session remains playable. */
    }
  }
  load() {
    try {
      const raw = this.storage?.getItem(JOURNEY_SAVE_KEY) ?? null;
      if (raw) {
        try {
          this.newerVersion = Number(JSON.parse(raw)?.version) > 1;
        } catch {}
      }
      return parseJourney(raw);
    } catch {
      return null;
    }
  }
  save(snapshot: JourneySnapshot) {
    if (!this.storage || this.newerVersion) return false;
    try {
      this.storage.setItem(JOURNEY_SAVE_KEY, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  }
  clear() {
    if (!this.storage) return false;
    try {
      this.storage.removeItem(JOURNEY_SAVE_KEY);
      this.newerVersion = false;
      return true;
    } catch {
      return false;
    }
  }
}
