// ===== APP ENTRY POINT - Initialize and start the game =====
import { createNewState, loadGame, saveGame, deleteSave, exportSave, importSave } from './state.js';
import { GameEngine } from './engine.js';
import { UI } from './ui.js';

// Initialize
const ui = new UI();
let state = loadGame() || createNewState();
const engine = new GameEngine(state, ui);

// Expose to global for UI onclick handlers
window._engine = engine;
window._ui = ui;
window._saveGame = { saveGame, deleteSave, exportSave, importSave, createNewState };

// Calculate offline progress
function processOfflineProgress() {
  if (!state.lastSaveTime) return;
  const now = Date.now();
  const elapsed = Math.floor((now - state.lastSaveTime) / 1000);
  if (elapsed < 5) return; // Less than 5 seconds, skip

  const offlineTicks = Math.min(elapsed, 3600); // Cap at 1 hour
  if (offlineTicks > 10) {
    // Simplified offline progress: passive income only
    const passiveIncome = engine.getUpgradeEffect('passiveIncome');
    if (passiveIncome > 0) {
      const bonus = 1 + engine.getAllBonus('incomeMultiplier');
      const offlineEarnings = Math.floor(passiveIncome * bonus * offlineTicks * 0.5); // 50% efficiency offline
      state.resources.dirtyMoney += offlineEarnings;
      state.stats.totalDirtyEarned += offlineEarnings;

      if (offlineEarnings > 0) {
        setTimeout(() => {
          ui.notify(`Earned ${engine.formatMoney(offlineEarnings)} while away (${formatTimeAway(offlineTicks)})!`, 'success');
          ui.addEvent(`Offline earnings: +${engine.formatMoney(offlineEarnings)}`, 'money');
        }, 2000);
      }
    }

    // Passive supplies
    const passiveSupplies = engine.getUpgradeEffect('passiveSupplies');
    if (passiveSupplies > 0) {
      state.resources.supplies += Math.floor(passiveSupplies * offlineTicks * 0.5);
    }

    // Territory progress
    for (const [id, tData] of Object.entries(state.territories)) {
      if (tData.expanding && tData.control < 100) {
        const terr = engine.constructor ? null : null; // handled by engine
        tData.control = Math.min(100, tData.control + offlineTicks * 0.1);
      }
    }

    // Heat decays offline
    state.resources.heat = Math.max(0, state.resources.heat - offlineTicks * 0.05);
  }
}

function formatTimeAway(seconds) {
  if (seconds >= 3600) return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
  if (seconds >= 60) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
  return seconds + 's';
}

// Start the game
function boot() {
  processOfflineProgress();
  ui.init(engine, state);
  engine.start();

  // Show game, hide loading
  setTimeout(() => {
    const loading = document.getElementById('loading-screen');
    loading.classList.add('fade-out');
    setTimeout(() => {
      loading.style.display = 'none';
      document.getElementById('game-container').classList.remove('hidden');
    }, 500);
  }, 1600);

  // Initial event
  ui.addEvent('Welcome back, Boss. Your empire awaits.', 'info');

  // Save on close
  window.addEventListener('beforeunload', () => {
    saveGame(state);
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === '1') ui.switchTab('operations');
    if (e.key === '2') ui.switchTab('territory');
    if (e.key === '3') ui.switchTab('crew');
    if (e.key === '4') ui.switchTab('upgrades');
    if (e.key === '5') ui.switchTab('laundering');
    if (e.key === '6') ui.switchTab('stats');
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveGame(state);
      ui.notify('Game saved!', 'success');
    }
  });
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
