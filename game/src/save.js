// save.js — progress saved to localStorage: money, missions, earnings.
// Nothing leaves the browser; a corrupt save is ignored and starts fresh.
const SAVE_KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      missionsCompleted: Array.isArray(data.missionsCompleted) ? data.missionsCompleted : [],
      totalEarned: typeof data.totalEarned === 'number' ? data.totalEarned : 0,
      bestWanted: typeof data.bestWanted === 'number' ? data.bestWanted : 0,
    };
  } catch (error) {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      money: Math.round(game.player.money),
      missionsCompleted: game.missions.completed.slice(),
      totalEarned: Math.round(game.player.totalEarned),
      bestWanted: game.player.bestWanted,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) {
    // storage full or blocked: the game still plays, it just does not save.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (error) {}
}
