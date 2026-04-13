// ===== UI MANAGER - All rendering and DOM interaction =====
import { OPERATIONS, TERRITORIES, CREW_TYPES, UPGRADES, FRONTS, CONFIG } from './data.js';

export class UI {
  constructor() {
    this.currentTab = 'operations';
    this.engine = null;
    this.state = null;
    this.notifQueue = [];
    this.eventLog = [];
    this.lastResourceValues = {};
  }

  init(engine, state) {
    this.engine = engine;
    this.state = state;
    this.bindNavigation();
    this.bindButtons();
    this.renderAll();
  }

  // ===== NAVIGATION =====

  bindNavigation() {
    document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    const panel = document.getElementById(`tab-${tabId}`);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');

    this.renderTabContent();
  }

  bindButtons() {
    document.getElementById('btn-save').addEventListener('click', () => {
      const { saveGame } = window._saveGame;
      saveGame(this.state);
      this.notify('💾 Game saved!', 'success');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this.showModal('Settings', `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <p>Version: 0.1.0 | Ticks: ${this.state.tickCount}</p>
          <button class="btn btn-danger" id="modal-reset">🗑️ Reset Save</button>
          <button class="btn" id="modal-export">📤 Export Save</button>
          <button class="btn" id="modal-close">Close</button>
        </div>
      `, () => {
        document.getElementById('modal-reset')?.addEventListener('click', () => {
          if (confirm('Are you sure? This will delete ALL progress!')) {
            const { deleteSave, createNewState } = window._saveGame;
            deleteSave();
            location.reload();
          }
        });
        document.getElementById('modal-export')?.addEventListener('click', () => {
          const { exportSave } = window._saveGame;
          const data = exportSave(this.state);
          navigator.clipboard.writeText(data).then(() => {
            this.notify('Save copied to clipboard!', 'success');
          });
        });
        document.getElementById('modal-close')?.addEventListener('click', () => this.hideModal());
      });
    });

    document.getElementById('btn-recruit').addEventListener('click', () => {
      this.engine.recruitCrew();
      this.renderCrewTab();
    });

    document.getElementById('launder-slider').addEventListener('input', (e) => {
      const rate = parseInt(e.target.value);
      this.engine.setLaunderRate(rate);
      document.getElementById('launder-slider-value').textContent = `$${this.engine.formatNum(rate)}/s`;
    });
  }

  // ===== MAIN UPDATE (called every tick) =====

  update() {
    this.updateResources();
    this.updateRunningOps();
    this.renderTabContent();
  }

  updateResources() {
    const s = this.state;
    const e = this.engine;

    // Dirty money
    const dirtyEl = document.getElementById('res-dirty');
    dirtyEl.textContent = e.formatMoney(s.resources.dirtyMoney);
    this.flashIfChanged('dirtyMoney', s.resources.dirtyMoney, dirtyEl);

    const dirtyRate = e.getDirtyIncomeRate();
    document.getElementById('rate-dirty').textContent = (dirtyRate >= 0 ? '+' : '') + e.formatMoney(dirtyRate) + '/s';
    document.getElementById('rate-dirty').style.color = dirtyRate >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    // Clean money
    document.getElementById('res-clean').textContent = e.formatMoney(s.resources.cleanMoney);
    const cleanRate = e.getCleanIncomeRate();
    document.getElementById('rate-clean').textContent = '+' + e.formatMoney(cleanRate) + '/s';

    // Influence
    document.getElementById('res-influence').textContent = Math.floor(s.resources.influence).toString();

    // Heat
    const heat = Math.floor(s.resources.heat);
    document.getElementById('res-heat').textContent = heat + '%';
    const heatBar = document.getElementById('heat-bar');
    heatBar.style.width = heat + '%';
    if (heat < 30) heatBar.style.background = 'var(--heat-low)';
    else if (heat < 60) heatBar.style.background = 'var(--heat-mid)';
    else heatBar.style.background = 'var(--heat-high)';

    // Supplies
    document.getElementById('res-supplies').textContent = Math.floor(s.resources.supplies).toString();

    // Level & XP
    document.getElementById('player-level').textContent = `Lv ${s.level}`;
    const xpPercent = Math.floor((s.xp / s.xpToNext) * 100);
    document.getElementById('xp-bar').style.width = xpPercent + '%';
    document.getElementById('xp-text').textContent = `${Math.floor(s.xp)} / ${s.xpToNext} XP`;
  }

  flashIfChanged(key, value, el) {
    if (this.lastResourceValues[key] !== undefined && value > this.lastResourceValues[key]) {
      el.classList.add('money-flash');
      setTimeout(() => el.classList.remove('money-flash'), 400);
    }
    this.lastResourceValues[key] = value;
  }

  updateRunningOps() {
    const s = this.state;
    for (const run of s.operations.running) {
      const el = document.getElementById(`op-progress-${run.id}`);
      if (el) {
        const elapsed = s.tickCount - run.startTick;
        const percent = Math.min(100, (elapsed / run.duration) * 100);
        el.style.width = percent + '%';
        el.style.opacity = '1';
      }
    }
  }

  // ===== TAB RENDERING =====

  renderAll() {
    this.renderTabContent();
  }

  renderTabContent() {
    switch (this.currentTab) {
      case 'operations': this.renderOperationsTab(); break;
      case 'territory': this.renderTerritoryTab(); break;
      case 'crew': this.renderCrewTab(); break;
      case 'upgrades': this.renderUpgradesTab(); break;
      case 'laundering': this.renderLaunderingTab(); break;
      case 'stats': this.renderStatsTab(); break;
    }
  }

  // ===== OPERATIONS TAB =====

  renderOperationsTab() {
    const container = document.getElementById('operations-list');
    const s = this.state;
    const e = this.engine;

    let html = '';
    for (const op of OPERATIONS) {
      const unlocked = s.operations.unlocked.includes(op.id);
      const canUnlock = !unlocked && s.level >= op.levelReq;
      const isRunning = s.operations.running.some(r => r.id === op.id);
      const autoOn = s.operations.autoEnabled[op.id];
      const completions = s.operations.completions[op.id] || 0;

      if (!unlocked && !canUnlock && s.level < op.levelReq - 3) continue; // Hide if too far away

      const cost = unlocked ? e.getOpCost(op) : {};
      const reward = e.getOpReward(op);
      const heat = e.getOpHeat(op);
      const duration = e.getOpDuration(op);

      const cardClass = unlocked ? (isRunning ? 'op-card running' : 'op-card') : 'op-card locked';

      html += `<div class="${cardClass}" data-op="${op.id}">`;
      html += `<div class="op-header">`;
      html += `<span class="op-name">${op.name}</span>`;
      html += `<span class="op-category">${op.category}</span>`;
      html += `</div>`;
      html += `<p class="op-desc">${op.desc}</p>`;

      if (unlocked) {
        html += `<div class="op-progress-container">`;
        html += `<div class="op-progress-bar" id="op-progress-${op.id}"></div>`;
        html += `</div>`;
        html += `<div class="op-stats">`;
        if (reward.dirtyMoney) html += `<div class="op-stat"><span class="op-stat-label">💰</span><span class="op-stat-value reward">+${e.formatMoney(reward.dirtyMoney)}</span></div>`;
        if (reward.cleanMoney) html += `<div class="op-stat"><span class="op-stat-label">💵</span><span class="op-stat-value reward">+${e.formatMoney(reward.cleanMoney)}</span></div>`;
        if (reward.supplies) html += `<div class="op-stat"><span class="op-stat-label">📦</span><span class="op-stat-value reward">+${reward.supplies}</span></div>`;
        if (reward.influence) html += `<div class="op-stat"><span class="op-stat-label">⭐</span><span class="op-stat-value reward">+${reward.influence}</span></div>`;

        const costEntries = Object.entries(cost);
        for (const [res, val] of costEntries) {
          const icon = res === 'supplies' ? '📦' : res === 'dirtyMoney' ? '💰' : res === 'cleanMoney' ? '💵' : res === 'influence' ? '⭐' : '';
          html += `<div class="op-stat"><span class="op-stat-label">${icon}</span><span class="op-stat-value cost">-${res === 'dirtyMoney' || res === 'cleanMoney' ? e.formatMoney(val) : val}</span></div>`;
        }

        html += `<div class="op-stat"><span class="op-stat-label">🔥</span><span class="op-stat-value heat">+${heat}</span></div>`;
        html += `<div class="op-stat"><span class="op-stat-label">⏱️</span><span class="op-stat-value time">${duration}s</span></div>`;
        html += `</div>`;

        html += `<div class="op-actions">`;
        if (!isRunning) {
          html += `<button class="btn btn-primary btn-sm" onclick="window._engine.startOperation('${op.id}'); window._ui.renderOperationsTab();">▶ Start</button>`;
        } else {
          html += `<button class="btn btn-sm" disabled>⏳ Running...</button>`;
        }
        if (op.autoCapable) {
          html += `<button class="btn btn-sm btn-auto ${autoOn ? 'active' : ''}" onclick="window._engine.toggleAutoOp('${op.id}'); window._ui.renderOperationsTab();">🔄 Auto${autoOn ? ' ON' : ''}</button>`;
        }
        html += `<span class="op-count">×${completions}</span>`;
        html += `</div>`;
      } else if (canUnlock) {
        html += `<div class="op-stats">`;
        html += `<div class="op-stat"><span class="op-stat-label">Unlock Cost:</span><span class="op-stat-value cost">${e.formatMoney(op.unlockCost)}</span></div>`;
        html += `<div class="op-stat"><span class="op-stat-label">Level:</span><span class="op-stat-value">${op.levelReq}</span></div>`;
        html += `</div>`;
        html += `<div class="op-actions">`;
        html += `<button class="btn btn-primary btn-sm" onclick="window._engine.unlockOperation('${op.id}'); window._ui.renderOperationsTab();">🔓 Unlock (${e.formatMoney(op.unlockCost)})</button>`;
        html += `</div>`;
      } else {
        html += `<div class="op-stats">`;
        html += `<div class="op-stat"><span class="op-stat-label">Requires Level:</span><span class="op-stat-value">${op.levelReq}</span></div>`;
        html += `</div>`;
      }

      html += `</div>`;
    }

    container.innerHTML = html;
  }

  // ===== TERRITORY TAB =====

  renderTerritoryTab() {
    const container = document.getElementById('territory-map');
    const s = this.state;
    const e = this.engine;

    let html = '';
    for (const terr of TERRITORIES) {
      const tData = s.territories[terr.id];
      const control = tData ? Math.floor(tData.control) : 0;
      const expanding = tData ? tData.expanding : false;
      const canExpand = s.level >= terr.levelReq;
      const isOwned = control >= 100;

      const diffClass = `diff-${terr.difficulty}`;
      const cardClass = `territory-card ${isOwned ? 'controlled' : ''} ${!canExpand ? 'locked' : ''}`;

      html += `<div class="${cardClass}">`;
      html += `<div class="territory-header">`;
      html += `<span class="territory-name">${terr.name}</span>`;
      html += `<span class="territory-difficulty ${diffClass}">${terr.difficulty.toUpperCase()}</span>`;
      html += `</div>`;
      html += `<p class="territory-desc">${terr.desc}</p>`;

      // Control bar
      html += `<div class="territory-control">`;
      html += `<div class="control-label"><span>Control</span><span>${control}%${expanding ? ' (expanding...)' : ''}</span></div>`;
      html += `<div class="control-bar-container"><div class="control-bar" style="width:${control}%"></div></div>`;
      html += `</div>`;

      // Bonuses
      html += `<div class="territory-bonuses">`;
      for (const bonus of terr.bonusText) {
        html += `<span class="territory-bonus">${bonus}</span>`;
      }
      html += `</div>`;

      // Actions
      if (canExpand && !isOwned) {
        if (!tData) {
          const costText = Object.entries(terr.costToExpand)
            .map(([res, val]) => `${res === 'dirtyMoney' ? '$' : res === 'cleanMoney' ? 'Clean $' : ''}${e.formatNum(val)}${res === 'influence' ? ' influence' : ''}`)
            .join(', ');
          html += `<button class="btn btn-primary btn-sm" onclick="window._engine.expandTerritory('${terr.id}'); window._ui.renderTerritoryTab();">📍 Expand (${costText})</button>`;
        } else if (!expanding) {
          html += `<button class="btn btn-sm" onclick="window._engine.expandTerritory('${terr.id}'); window._ui.renderTerritoryTab();">▶ Resume Expansion</button>`;
        } else {
          html += `<span style="font-size:12px;color:var(--accent-gold)">⏳ Expanding...</span>`;
        }
      } else if (!canExpand) {
        html += `<span style="font-size:12px;color:var(--text-muted)">🔒 Requires Level ${terr.levelReq}</span>`;
      } else {
        html += `<span style="font-size:12px;color:var(--accent-green)">✅ Fully Controlled</span>`;
      }

      html += `</div>`;
    }

    container.innerHTML = html;
  }

  // ===== CREW TAB =====

  renderCrewTab() {
    const s = this.state;
    const e = this.engine;

    document.getElementById('crew-count').textContent = `Crew: ${s.crew.length} / ${e.getMaxCrew()}`;

    const cost = e.getRecruitCost();
    const recruitBtn = document.getElementById('btn-recruit');
    recruitBtn.textContent = `👤 Recruit ($${e.formatNum(cost)})`;
    recruitBtn.disabled = s.crew.length >= e.getMaxCrew() || s.resources.dirtyMoney < cost;

    const container = document.getElementById('crew-list');
    let html = '';

    for (const member of s.crew) {
      const typeData = CREW_TYPES.find(t => t.id === member.type);
      if (!typeData) continue;

      html += `<div class="crew-card">`;
      html += `<div class="crew-header">`;
      html += `<span class="crew-name">${member.name}</span>`;
      html += `<span class="crew-type ${typeData.color}">${typeData.name}</span>`;
      html += `</div>`;

      html += `<div class="crew-stats">`;
      html += `<div class="crew-stat"><span class="crew-stat-label">Level</span><span class="crew-stat-value">${member.level}</span></div>`;
      html += `<div class="crew-stat"><span class="crew-stat-label">XP</span><span class="crew-stat-value">${member.xp}/${member.xpToNext}</span></div>`;
      html += `<div class="crew-stat"><span class="crew-stat-label">Bonus</span><span class="crew-stat-value">${typeData.desc}</span></div>`;
      html += `<div class="crew-stat"><span class="crew-stat-label">Loyalty</span><span class="crew-stat-value">${Math.floor(member.loyalty)}%</span></div>`;
      html += `</div>`;

      html += `<div class="crew-loyalty-bar"><div class="crew-loyalty-fill" style="width:${member.loyalty}%; background:${member.loyalty > 60 ? 'var(--accent-green)' : member.loyalty > 30 ? 'var(--heat-mid)' : 'var(--accent-red)'}"></div></div>`;

      html += `<div style="display:flex;gap:6px;">`;
      html += `<button class="btn btn-danger btn-sm" onclick="if(confirm('Dismiss ${member.name}?')){window._engine.dismissCrew(${member.id}); window._ui.renderCrewTab();}">Dismiss</button>`;
      html += `</div>`;

      html += `</div>`;
    }

    if (s.crew.length === 0) {
      html = `<p style="color:var(--text-muted);text-align:center;padding:40px;">No crew members yet. Recruit your first member!</p>`;
    }

    container.innerHTML = html;
  }

  // ===== UPGRADES TAB =====

  renderUpgradesTab() {
    const container = document.getElementById('upgrades-list');
    const s = this.state;
    const e = this.engine;

    let html = '';
    for (const [catId, cat] of Object.entries(UPGRADES)) {
      html += `<div class="upgrade-category">`;
      html += `<div class="upgrade-category-title">${cat.icon} ${cat.title}</div>`;
      html += `<div class="upgrade-list">`;

      for (const item of cat.items) {
        const currentLevel = s.upgrades[item.id] || 0;
        const isMaxed = currentLevel >= item.maxLevel;
        const isLocked = s.level < item.levelReq;
        const cost = Math.floor(item.baseCost * Math.pow(item.costGrowth, currentLevel));
        const canBuy = !isMaxed && !isLocked && (s.resources[item.currency] || 0) >= cost;

        const itemClass = isMaxed ? 'upgrade-item maxed' : isLocked ? 'upgrade-item locked' : 'upgrade-item';

        html += `<div class="${itemClass}">`;
        html += `<div class="upgrade-name">${item.name}</div>`;
        html += `<div class="upgrade-desc">${item.desc}</div>`;
        html += `<div class="upgrade-level">Level ${currentLevel} / ${item.maxLevel}</div>`;

        if (isMaxed) {
          html += `<button class="btn btn-sm" disabled>✅ MAXED</button>`;
        } else if (isLocked) {
          html += `<button class="btn btn-sm" disabled>🔒 Lv ${item.levelReq}</button>`;
        } else {
          const currIcon = item.currency === 'dirtyMoney' ? '💰' : '💵';
          html += `<button class="btn btn-primary btn-sm" ${canBuy ? '' : 'disabled'} onclick="window._engine.purchaseUpgrade('${item.id}'); window._ui.renderUpgradesTab();">${currIcon} ${e.formatMoney(cost)}</button>`;
        }

        html += `</div>`;
      }

      html += `</div></div>`;
    }

    container.innerHTML = html;
  }

  // ===== LAUNDERING TAB =====

  renderLaunderingTab() {
    const s = this.state;
    const e = this.engine;

    // Stats
    document.getElementById('launder-rate').textContent = e.formatMoney(s.laundering.rate) + '/s';
    document.getElementById('launder-efficiency').textContent = Math.floor(e.getLaunderEfficiency() * 100) + '%';
    document.getElementById('launder-processing').textContent = e.formatMoney(s.laundering.rate * e.getLaunderEfficiency());

    // Slider
    const slider = document.getElementById('launder-slider');
    const maxRate = e.getLaunderMaxRate();
    slider.max = maxRate;
    slider.value = Math.min(s.laundering.rate, maxRate);
    document.getElementById('launder-slider-value').textContent = `$${e.formatNum(s.laundering.rate)}/s`;

    // Fronts
    const container = document.getElementById('fronts-list');
    let html = '';

    for (const front of FRONTS) {
      const owned = s.laundering.fronts.includes(front.id);
      const canBuy = !owned && s.level >= front.levelReq;
      const isLocked = s.level < front.levelReq;

      html += `<div class="front-card ${owned ? 'owned' : ''}">`;
      html += `<div class="front-name">${owned ? '✅ ' : ''}${front.name}</div>`;
      html += `<div class="front-desc">${front.desc}</div>`;
      html += `<div class="front-stats">`;
      html += `<span>Capacity: $${e.formatNum(front.launderCapacity)}/s</span>`;
      html += `<span>Efficiency: +${Math.floor(front.efficiency * 100)}%</span>`;
      html += `</div>`;

      if (owned) {
        html += `<span style="font-size:11px;color:var(--accent-green)">Owned</span>`;
      } else if (isLocked) {
        html += `<button class="btn btn-sm" disabled>🔒 Lv ${front.levelReq}</button>`;
      } else {
        const costText = Object.entries(front.cost).map(([, v]) => e.formatMoney(v)).join(', ');
        html += `<button class="btn btn-primary btn-sm" ${canBuy && canAffordObj(s, front.cost) ? '' : 'disabled'} onclick="window._engine.purchaseFront('${front.id}'); window._ui.renderLaunderingTab();">💵 Buy (${costText})</button>`;
      }

      html += `</div>`;
    }

    if (FRONTS.every(f => s.level < f.levelReq && !s.laundering.fronts.includes(f.id))) {
      html = `<p style="color:var(--text-muted);">Keep leveling up to unlock business fronts for laundering!</p>`;
    }

    container.innerHTML = html;
  }

  // ===== STATS TAB =====

  renderStatsTab() {
    const s = this.state;
    const e = this.engine;

    const playTimeS = s.stats.playTimeTicks;
    const hrs = Math.floor(playTimeS / 3600);
    const mins = Math.floor((playTimeS % 3600) / 60);
    const secs = playTimeS % 60;

    const stats = [
      { label: 'Player Level', value: s.level },
      { label: 'Total Dirty Earned', value: e.formatMoney(s.stats.totalDirtyEarned) },
      { label: 'Total Clean Earned', value: e.formatMoney(s.stats.totalCleanEarned) },
      { label: 'Current Dirty Cash', value: e.formatMoney(s.resources.dirtyMoney) },
      { label: 'Current Clean Cash', value: e.formatMoney(s.resources.cleanMoney) },
      { label: 'Total Operations', value: s.stats.totalOperations.toLocaleString() },
      { label: 'Crew Hired', value: s.stats.totalCrewHired },
      { label: 'Current Crew', value: s.crew.length },
      { label: 'Territories Controlled', value: Object.values(s.territories).filter(t => t.control >= 100).length + '/' + TERRITORIES.length },
      { label: 'Upgrades Purchased', value: Object.values(s.upgrades).reduce((a, b) => a + b, 0) },
      { label: 'Events Triggered', value: s.stats.totalEventsTriggered },
      { label: 'Business Fronts', value: s.laundering.fronts.length + '/' + FRONTS.length },
      { label: 'Highest Level', value: s.stats.highestLevel },
      { label: 'Total Heat Gained', value: Math.floor(s.stats.totalHeatGained) },
      { label: 'Play Time', value: `${hrs}h ${mins}m ${secs}s` },
    ];

    let html = '';
    for (const stat of stats) {
      html += `<div class="stat-card">`;
      html += `<div class="stat-card-label">${stat.label}</div>`;
      html += `<div class="stat-card-value">${stat.value}</div>`;
      html += `</div>`;
    }

    document.getElementById('stats-panel').innerHTML = html;
  }

  // ===== NOTIFICATIONS =====

  notify(message, type = 'info') {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.className = `notification notif-${type}`;
    el.textContent = message;
    container.appendChild(el);

    // Remove after animation
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 3500);

    // Cap notifications
    while (container.children.length > CONFIG.MAX_NOTIFICATIONS) {
      container.removeChild(container.firstChild);
    }
  }

  // ===== EVENT LOG =====

  addEvent(text, type = 'info') {
    const container = document.getElementById('event-list');
    const el = document.createElement('div');
    el.className = `event-entry event-${type}`;

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    el.innerHTML = `<div class="event-time">${time}</div><div class="event-text">${text}</div>`;
    container.insertBefore(el, container.firstChild);

    // Cap events
    while (container.children.length > CONFIG.MAX_EVENT_LOG) {
      container.removeChild(container.lastChild);
    }
  }

  // ===== MODAL =====

  showModal(title, bodyHtml, afterRender) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-actions').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
    if (afterRender) afterRender();

    // Click outside to close
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.hideModal();
    }, { once: true });
  }

  hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
}

function canAffordObj(state, costs) {
  for (const [resource, amount] of Object.entries(costs)) {
    if ((state.resources[resource] || 0) < amount) return false;
  }
  return true;
}
