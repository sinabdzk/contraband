// ===== GAME STATE - State management, save/load =====
import { CONFIG, OPERATIONS, TERRITORIES, RIVAL_NAMES } from './data.js';

export function createNewState() {
  return {
    version: 4,
    resources: { ...CONFIG.STARTING_RESOURCES },
    level: 1,
    xp: 0,
    xpToNext: CONFIG.BASE_XP_PER_LEVEL,
    operations: {
      unlocked: ['street_dealing'],
      running: [],       // { id, startedAt (tick), duration, rewardMultiplier }
      autoEnabled: {},    // opId -> bool
      completions: {},    // opId -> count
    },
    territories: {},      // territoryId -> { control: 0-100, expanding: false }
    crew: [],             // { id, name, type, level, xp, loyalty, assignment, traits[] }
    upgrades: {},         // upgradeId -> level
    laundering: {
      rate: 0,            // dirty $ / second to launder
      fronts: [],         // frontId[]
    },
    rival: {
      name: RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)],
      power: 10,
      aggression: 0.3,
      truceTicks: 0,
      lastAttackTick: 0,
      defeated: 0,
    },
    dilemma: null,          // active dilemma event waiting for choice
    crewCandidates: [],     // 3 candidates for recruitment choice
    pendingMiniGame: null,  // { opId, gameType } — waiting for mini-game result
    prestige: {
      count: 0,
      totalCleanLifetime: 0,
    },
    marketBoomTicks: 0,
    crewBoostTicks: 0,
    stats: {
      totalDirtyEarned: 0,
      totalCleanEarned: 0,
      totalOperations: 0,
      totalCrewHired: 0,
      totalHeatGained: 0,
      totalEventsTriggered: 0,
      totalDilemmasFaced: 0,
      totalRivalsDefeated: 0,
      totalMaintenancePaid: 0,
      playTimeTicks: 0,
      highestLevel: 1,
    },
    tickCount: 0,
    lastSaveTime: Date.now(),
    crewIdCounter: 0,
  };
}

const SAVE_KEY = 'contraband_save_v4';

export function saveGame(state) {
  try {
    state.lastSaveTime = Date.now();
    const json = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

export function loadGame() {
  try {
    let json = localStorage.getItem(SAVE_KEY);
    // Also check old save keys for migration
    if (!json) json = localStorage.getItem('contraband_save_v3');
    if (!json) json = localStorage.getItem('contraband_save_v2');
    if (!json) return null;
    const state = JSON.parse(json);
    if (!state || !state.version) return null;
    return migrateState(state);
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function exportSave(state) {
  return btoa(JSON.stringify(state));
}

export function importSave(encoded) {
  try {
    const state = JSON.parse(atob(encoded));
    if (!state || !state.version) return null;
    return migrateState(state);
  } catch {
    return null;
  }
}

function migrateState(state) {
  const fresh = createNewState();
  // Ensure all keys exist
  state.resources = { ...fresh.resources, ...state.resources };
  state.operations = { ...fresh.operations, ...state.operations };
  state.stats = { ...fresh.stats, ...state.stats };
  state.laundering = { ...fresh.laundering, ...state.laundering };
  if (!state.upgrades) state.upgrades = {};
  if (!state.territories) state.territories = {};
  if (!state.crew) state.crew = [];
  if (!state.crewIdCounter) state.crewIdCounter = state.crew.length;
  if (!state.marketBoomTicks) state.marketBoomTicks = 0;
  if (!state.crewBoostTicks) state.crewBoostTicks = 0;
  // V3 migrations
  if (!state.rival) state.rival = { ...fresh.rival };
  if (!state.prestige) state.prestige = { ...fresh.prestige };
  if (state.dilemma === undefined) state.dilemma = null;
  if (!state.crewCandidates) state.crewCandidates = [];
  // Migrate crew traits
  for (const c of state.crew) { if (!c.traits) c.traits = []; }
  // V4 migrations
  if (state.pendingMiniGame === undefined) state.pendingMiniGame = null;
  // Ensure running ops have rewardMultiplier
  for (const r of state.operations.running) { if (!r.rewardMultiplier) r.rewardMultiplier = 1; }
  state.version = 4;
  return state;
}

// ===== State mutation helpers =====

export function xpForLevel(level) {
  return Math.floor(CONFIG.BASE_XP_PER_LEVEL * Math.pow(CONFIG.XP_GROWTH_FACTOR, level - 1));
}

export function addXP(state, amount) {
  const levelUps = [];
  state.xp += amount;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level++;
    state.xpToNext = xpForLevel(state.level);
    if (state.level > state.stats.highestLevel) {
      state.stats.highestLevel = state.level;
    }
    levelUps.push(state.level);
    // Check for new operation unlocks
    for (const op of OPERATIONS) {
      if (op.levelReq <= state.level && !state.operations.unlocked.includes(op.id)) {
        if (op.unlockCost === 0) {
          state.operations.unlocked.push(op.id);
        }
      }
    }
  }
  return levelUps;
}

export function getUpgradeLevel(state, upgradeId) {
  return state.upgrades[upgradeId] || 0;
}

export function getUpgradeEffect(state, effectName) {
  // Import UPGRADES inline to avoid circular
  let total = 0;
  // We'll iterate from data - caller should pass UPGRADES
  return total;
}

export function canAfford(state, costs) {
  for (const [resource, amount] of Object.entries(costs)) {
    if ((state.resources[resource] || 0) < amount) return false;
  }
  return true;
}

export function spendResources(state, costs) {
  for (const [resource, amount] of Object.entries(costs)) {
    state.resources[resource] = (state.resources[resource] || 0) - amount;
  }
}
