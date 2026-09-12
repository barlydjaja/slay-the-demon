export enum GameState {
  LOADING = 'LOADING',
  TRANSITION = 'TRANSITION',
  DIALOGUE = 'DIALOGUE',
  JOURNAL = 'JOURNAL',
  MENU = 'MENU',
  INTRO = 'INTRO',
  PLAYING = 'PLAYING',
  BOSS_COMBAT = 'BOSS_COMBAT',
  PAUSED = 'PAUSED',
  PLAYER_DEAD = 'PLAYER_DEAD',
  BOSS_DEAD = 'BOSS_DEAD',
  VICTORY = 'VICTORY',
}
export const isGameplay = (state: GameState) =>
  state === GameState.PLAYING || state === GameState.BOSS_COMBAT;
