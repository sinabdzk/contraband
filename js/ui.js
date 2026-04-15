// ===== UI MANAGER - All rendering and DOM interaction =====
import { OPERATIONS, TERRITORIES, CREW_TYPES, UPGRADES, FRONTS, CONFIG, DILEMMAS, CREW_TRAITS, RANKS, MAINTENANCE, SUPPLY_MARKET, MINI_GAMES, TERRITORY_MAP } from './data.js';

// SVG icon helper - returns inline <svg> using the sprite
function ico(name, cls = '') {
  return `<svg class="ico ${cls}"><use href="#ico-${name}"/></svg>`;
}

export class UI {
  constructor() {
    this.currentTab = 'operations';
    this.engine = null;
    this.state = null;
    this.notifQueue = [];
    this.eventLog = [];
    this.lastResourceValues = {};
    this.ambientCtx = null;
    this.particles = [];
    this.hoveringTab = false;
    this.tabDirty = false;
  }

  init(engine, state) {
    this.engine = engine;
    this.state = state;
    this.bindNavigation();
    this.bindButtons();
    this.bindHoverTracking();
    this.initAmbientParticles();
    this.renderAll();
    this.updateRankDisplay();
    this.updateRivalPanel();
  }

  // ===== HOVER TRACKING =====
  // Skip full innerHTML re-renders while mouse is inside the tab content.
  // This prevents the flicker caused by DOM destruction + recreation each tick.

  bindHoverTracking() {
    const main = document.getElementById('content-area');
    if (!main) return;
    main.addEventListener('mouseenter', () => { this.hoveringTab = true; });
    main.addEventListener('mouseleave', () => {
      this.hoveringTab = false;
      if (this.tabDirty) { this.tabDirty = false; this.renderTabContent(); }
    });
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
      this.notify('Game saved!', 'success');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this.showModal('Settings', `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <p>Version: 0.1.0 | Ticks: ${this.state.tickCount}</p>
          <button class="btn btn-danger" id="modal-reset">${ico('trash')} Reset Save</button>
          <button class="btn" id="modal-export">${ico('export')} Export Save</button>
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
      const candidates = this.engine.generateCrewCandidates();
      if (candidates.length > 0) {
        this.showCrewCandidates();
      }
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
    this.updateRankDisplay();
    this.updateRivalPanel();
    if (this.hoveringTab) {
      this.tabDirty = true;
    } else {
      this.renderTabContent();
    }
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

    // Maintenance indicator
    const maintEl = document.getElementById('maintenance-cost');
    if (maintEl) {
      const maintCost = e.getMaintenanceCost();
      maintEl.textContent = maintCost > 0 ? ('-' + e.formatMoney(maintCost) + '/s upkeep') : '';
      maintEl.style.display = maintCost > 0 ? 'block' : 'none';
    }

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

    // Heat warning pulse
    this.updateHeatWarning();
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

    // ===== SUPPLY MARKET SECTION =====
    html += `<div class="supply-market-section">`;
    html += `<div class="supply-market-header">${ico('supplies','ico-lg ico-color-supplies')} Supply Market <span class="supply-count">${Math.floor(s.resources.supplies)} in stock</span></div>`;
    html += `<p class="supply-market-desc">Product doesn't appear from nowhere. Source your supplies here.</p>`;
    html += `<div class="supply-market-grid">`;
    for (const src of SUPPLY_MARKET) {
      const canBuy = s.level >= src.levelReq && canAffordObj(s, src.cost);
      const locked = s.level < src.levelReq;
      const costText = Object.entries(src.cost).map(([res, val]) => {
        if (res === 'dirtyMoney') return '$' + e.formatNum(val);
        if (res === 'influence') return val + ' inf';
        return val + ' ' + res;
      }).join(' + ');
      html += `<button class="supply-btn ${locked ? 'locked' : ''}" ${canBuy ? '' : 'disabled'} onclick="window._engine.buySupplies('${src.id}'); window._ui.renderOperationsTab();">`;
      html += `<span class="supply-btn-name">${src.name}</span>`;
      html += `<span class="supply-btn-yield">+${src.yield} ${ico('supplies','ico-sm')}</span>`;
      html += `<span class="supply-btn-cost">${costText}${src.heatGain > 1 ? ' · +' + src.heatGain + ' heat' : ''}</span>`;
      if (locked) html += `<span class="supply-btn-lock">Lv ${src.levelReq}</span>`;
      html += `</button>`;
    }
    html += `</div></div>`;

    // ===== OPERATIONS LIST =====
    for (const op of OPERATIONS) {
      const unlocked = s.operations.unlocked.includes(op.id);
      const canUnlock = !unlocked && s.level >= op.levelReq;
      const isRunning = s.operations.running.some(r => r.id === op.id);
      const autoOn = s.operations.autoEnabled[op.id];
      const completions = s.operations.completions[op.id] || 0;
      const minCrew = op.minCrew || 0;
      const hasEnoughCrew = s.crew.length >= minCrew;
      const autoLocked = op.autoReq && s.level < op.autoReq;

      if (!unlocked && !canUnlock && s.level < op.levelReq - 3) continue;

      const cost = unlocked ? e.getOpCost(op) : {};
      const reward = e.getOpReward(op);
      const heat = e.getOpHeat(op);
      const duration = e.getOpDuration(op);

      const cardClass = unlocked ? (isRunning ? 'op-card running' : 'op-card') : 'op-card locked';

      html += `<div class="${cardClass}" data-op="${op.id}" data-cat="${op.category}">`;
      html += `<div class="op-header">`;
      html += `<span class="op-name">${op.name}</span>`;
      html += `<span class="op-category">${op.category}</span>`;
      html += `</div>`;
      html += `<p class="op-desc">${op.desc}</p>`;

      // Crew requirement badge
      if (unlocked && minCrew > 0) {
        const crewOk = hasEnoughCrew;
        html += `<div class="op-crew-req ${crewOk ? 'met' : 'unmet'}">${ico('crew','ico-sm')} ${s.crew.length}/${minCrew} crew${op.miniGame ? ' · ' + ico(MINI_GAMES[op.miniGame]?.icon || 'ops','ico-sm') + ' Mini-game' : ''}</div>`;
      }

      if (unlocked) {
        html += `<div class="op-progress-container">`;
        html += `<div class="op-progress-bar" id="op-progress-${op.id}"></div>`;
        html += `</div>`;
        html += `<div class="op-stats">`;
        if (reward.dirtyMoney) html += `<div class="op-stat"><span class="op-stat-label">${ico('dirty','ico-color-dirty')}</span><span class="op-stat-value reward">+${e.formatMoney(reward.dirtyMoney)}</span></div>`;
        if (reward.cleanMoney) html += `<div class="op-stat"><span class="op-stat-label">${ico('clean','ico-color-clean')}</span><span class="op-stat-value reward">+${e.formatMoney(reward.cleanMoney)}</span></div>`;
        if (reward.supplies) html += `<div class="op-stat"><span class="op-stat-label">${ico('supplies','ico-color-supplies')}</span><span class="op-stat-value reward">+${reward.supplies}</span></div>`;
        if (reward.influence) html += `<div class="op-stat"><span class="op-stat-label">${ico('influence','ico-color-influence')}</span><span class="op-stat-value reward">+${reward.influence}</span></div>`;

        const costEntries = Object.entries(cost);
        for (const [res, val] of costEntries) {
          const iconName = res === 'supplies' ? 'supplies' : res === 'dirtyMoney' ? 'dirty' : res === 'cleanMoney' ? 'clean' : res === 'influence' ? 'influence' : '';
          html += `<div class="op-stat"><span class="op-stat-label">${ico(iconName)}</span><span class="op-stat-value cost">-${res === 'dirtyMoney' || res === 'cleanMoney' ? e.formatMoney(val) : val}</span></div>`;
        }

        html += `<div class="op-stat"><span class="op-stat-label">${ico('heat','ico-color-heat')}</span><span class="op-stat-value heat">+${heat}</span></div>`;
        html += `<div class="op-stat"><span class="op-stat-label">${ico('clock','ico-color-blue')}</span><span class="op-stat-value time">${duration}s</span></div>`;
        html += `</div>`;

        html += `<div class="op-actions">`;
        if (!isRunning) {
          const canStart = hasEnoughCrew && canAffordObj(s, cost);
          html += `<button class="btn btn-primary btn-sm" ${canStart ? '' : 'disabled'} onclick="window._engine.startOperation('${op.id}'); window._ui.renderOperationsTab();">${ico('play')} ${op.miniGame ? 'Cook' : 'Start'}</button>`;
        } else {
          html += `<button class="btn btn-sm" disabled>${ico('clock')} Running...</button>`;
        }
        if (op.autoCapable) {
          if (autoLocked) {
            html += `<button class="btn btn-sm" disabled title="Auto unlocks at level ${op.autoReq}">${ico('lock')} Auto (Lv${op.autoReq})</button>`;
          } else {
            html += `<button class="btn btn-sm btn-auto ${autoOn ? 'active' : ''}" onclick="window._engine.toggleAutoOp('${op.id}'); window._ui.renderOperationsTab();">${ico('refresh')} Auto${autoOn ? ' ON' : ''}</button>`;
          }
        }
        html += `<span class="op-count">×${completions}</span>`;
        html += `</div>`;
      } else if (canUnlock) {
        html += `<div class="op-stats">`;
        html += `<div class="op-stat"><span class="op-stat-label">Unlock Cost:</span><span class="op-stat-value cost">${e.formatMoney(op.unlockCost)}</span></div>`;
        html += `<div class="op-stat"><span class="op-stat-label">Level:</span><span class="op-stat-value">${op.levelReq}</span></div>`;
        html += `<div class="op-stat"><span class="op-stat-label">Crew needed:</span><span class="op-stat-value">${op.minCrew || 0}</span></div>`;
        html += `</div>`;
        html += `<div class="op-actions">`;
        html += `<button class="btn btn-primary btn-sm" onclick="window._engine.unlockOperation('${op.id}'); window._ui.renderOperationsTab();">${ico('unlock')} Unlock (${e.formatMoney(op.unlockCost)})</button>`;
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

    let html = '<div class="territory-map-grid">';

    for (const terr of TERRITORIES) {
      const tData = s.territories[terr.id];
      const control = tData ? Math.floor(tData.control) : 0;
      const expanding = tData ? tData.expanding : false;
      const canExpand = s.level >= terr.levelReq;
      const isOwned = control >= 100;

      const diffClass = `diff-${terr.difficulty}`;
      const cardClass = `map-district ${isOwned ? 'controlled' : ''} ${!canExpand ? 'locked' : ''} ${expanding ? 'expanding' : ''}`;

      html += `<div class="${cardClass}" data-terr="${terr.id}">`;

      // Control fill overlay
      html += `<div class="district-fill" style="height:${control}%"></div>`;

      html += `<div class="district-content">`;
      html += `<div class="district-header">`;
      html += `<span class="district-name">${terr.name}</span>`;
      html += `<span class="district-diff ${diffClass}">${terr.difficulty}</span>`;
      html += `</div>`;

      // Progress bar + percentage
      html += `<div class="district-control-row">`;
      html += `<div class="district-control-bar"><div class="district-control-bar-fill" style="width:${control}%"></div></div>`;
      html += `<span class="district-control-text">${control}%</span>`;
      html += `</div>`;

      // Bonuses
      html += `<div class="district-bonuses">`;
      for (const bonus of terr.bonusText) {
        html += `<span class="district-bonus">${bonus}</span>`;
      }
      html += `</div>`;

      // Action
      html += `<div class="district-action">`;
      if (canExpand && !isOwned) {
        if (!tData) {
          const costText = Object.entries(terr.costToExpand)
            .map(([res, val]) => `${res === 'dirtyMoney' ? '$' : res === 'cleanMoney' ? 'Clean $' : ''}${e.formatNum(val)}${res === 'influence' ? ' inf' : ''}`)
            .join(', ');
          html += `<button class="btn btn-primary btn-xs" onclick="window._engine.expandTerritory('${terr.id}'); window._ui.renderTerritoryTab();">Expand (${costText})</button>`;
        } else if (!expanding) {
          html += `<button class="btn btn-xs" onclick="window._engine.expandTerritory('${terr.id}'); window._ui.renderTerritoryTab();">Resume</button>`;
        } else {
          html += `<span class="district-expanding">${ico('clock','ico-sm ico-color-gold')} Expanding...</span>`;
        }
      } else if (!canExpand) {
        html += `<span class="district-locked-text">${ico('lock','ico-sm')} Lv ${terr.levelReq}</span>`;
      } else {
        html += `<span class="district-owned">${ico('check','ico-sm ico-color-green')} Controlled</span>`;
      }
      html += `</div>`;

      html += `</div>`;
      html += `</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ===== CREW TAB =====

  renderCrewTab() {
    const s = this.state;
    const e = this.engine;

    document.getElementById('crew-count').textContent = `Crew: ${s.crew.length} / ${e.getMaxCrew()}`;

    const cost = e.getRecruitCost();
    const recruitBtn = document.getElementById('btn-recruit');
    recruitBtn.innerHTML = `${ico('user-plus')} Recruit ($${e.formatNum(cost)})`;
    recruitBtn.disabled = s.crew.length >= e.getMaxCrew() || s.resources.dirtyMoney < cost;

    const container = document.getElementById('crew-list');
    let html = '';

    // Crew salary info
    const maintCost = e.getMaintenanceCost();
    if (s.crew.length > 0) {
      html += `<div class="crew-maintenance-bar">`;
      html += `<span>${ico('dirty','ico-color-dirty')} Crew Salaries: <strong>-${e.formatMoney(maintCost)}/s</strong></span>`;
      html += `</div>`;
    }

    for (const member of s.crew) {
      const typeData = CREW_TYPES.find(t => t.id === member.type);
      if (!typeData) continue;

      html += `<div class="crew-card">`;
      html += `<div class="crew-header">`;
      html += `<span class="crew-name">${member.name}</span>`;
      html += `<span class="crew-type ${typeData.color}">${typeData.name}</span>`;
      html += `</div>`;

      // Traits
      if (member.traits && member.traits.length > 0) {
        html += `<div class="crew-traits">`;
        for (const traitId of member.traits) {
          const trait = CREW_TRAITS.find(t => t.id === traitId);
          if (trait) {
            html += `<span class="trait-badge" style="border-color:${trait.color};color:${trait.color}" title="${trait.desc}">${trait.name}</span>`;
          }
        }
        html += `</div>`;
      }

      html += `<div class="crew-stats">`;
      html += `<div class="crew-stat"><span class="crew-stat-label">Level</span><span class="crew-stat-value">${member.level}</span></div>`;
      html += `<div class="crew-stat"><span class="crew-stat-label">Bonus</span><span class="crew-stat-value">${typeData.desc}</span></div>`;
      html += `<div class="crew-stat"><span class="crew-stat-label">Loyalty</span><span class="crew-stat-value">${Math.floor(member.loyalty)}%</span></div>`;
      html += `</div>`;

      html += `<div class="crew-loyalty-bar"><div class="crew-loyalty-fill" style="width:${member.loyalty}%; background:${member.loyalty > 60 ? 'var(--accent-green)' : member.loyalty > 30 ? 'var(--heat-mid)' : 'var(--accent-red)'}"></div></div>`;

      html += `<div style="display:flex;gap:6px;margin-top:6px;">`;
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
      html += `<div class="upgrade-category-title">${ico(cat.icon, 'ico-lg ico-color-gold')} ${cat.title}</div>`;
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
          html += `<button class="btn btn-sm" disabled>${ico('check','ico-color-green')} MAXED</button>`;
        } else if (isLocked) {
          html += `<button class="btn btn-sm" disabled>${ico('lock')} Lv ${item.levelReq}</button>`;
        } else {
          const currIco = item.currency === 'dirtyMoney' ? ico('dirty','ico-color-dirty') : ico('clean','ico-color-clean');
          html += `<button class="btn btn-primary btn-sm" ${canBuy ? '' : 'disabled'} onclick="window._engine.purchaseUpgrade('${item.id}'); window._ui.renderUpgradesTab();">${currIco} ${e.formatMoney(cost)}</button>`;
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
      html += `<div class="front-name">${owned ? ico('check','ico-color-green')+' ' : ''}${front.name}</div>`;
      html += `<div class="front-desc">${front.desc}</div>`;
      html += `<div class="front-stats">`;
      html += `<span>Capacity: $${e.formatNum(front.launderCapacity)}/s</span>`;
      html += `<span>Efficiency: +${Math.floor(front.efficiency * 100)}%</span>`;
      html += `</div>`;

      if (owned) {
        html += `<span style="font-size:11px;color:var(--accent-green)">Owned</span>`;
      } else if (isLocked) {
        html += `<button class="btn btn-sm" disabled>${ico('lock')} Lv ${front.levelReq}</button>`;
      } else {
        const costText = Object.entries(front.cost).map(([, v]) => e.formatMoney(v)).join(', ');
        html += `<button class="btn btn-primary btn-sm" ${canBuy && canAffordObj(s, front.cost) ? '' : 'disabled'} onclick="window._engine.purchaseFront('${front.id}'); window._ui.renderLaunderingTab();">${ico('clean','ico-color-clean')} Buy (${costText})</button>`;
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

    const rank = e.getCurrentRank();

    const stats = [
      { label: 'Rank', value: rank.title },
      { label: 'Player Level', value: s.level },
      { label: 'Prestige', value: s.prestige?.count || 0 },
      { label: 'Total Dirty Earned', value: e.formatMoney(s.stats.totalDirtyEarned) },
      { label: 'Total Clean Earned', value: e.formatMoney(s.stats.totalCleanEarned) },
      { label: 'Current Dirty Cash', value: e.formatMoney(s.resources.dirtyMoney) },
      { label: 'Current Clean Cash', value: e.formatMoney(s.resources.cleanMoney) },
      { label: 'Maintenance/s', value: e.formatMoney(e.getMaintenanceCost()) },
      { label: 'Total Operations', value: s.stats.totalOperations.toLocaleString() },
      { label: 'Crew Hired', value: s.stats.totalCrewHired },
      { label: 'Current Crew', value: s.crew.length },
      { label: 'Territories Controlled', value: Object.values(s.territories).filter(t => t.control >= 100).length + '/' + TERRITORIES.length },
      { label: 'Dilemmas Faced', value: s.stats.totalDilemmasFaced || 0 },
      { label: 'Rivals Defeated', value: s.stats.totalRivalsDefeated || 0 },
      { label: 'Events Triggered', value: s.stats.totalEventsTriggered },
      { label: 'Business Fronts', value: s.laundering.fronts.length + '/' + FRONTS.length },
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

    // Prestige section
    html += `<div class="prestige-section">`;
    html += `<h3>${ico('crown','ico-lg ico-color-gold')} Go Legitimate</h3>`;
    html += `<p class="prestige-desc">Reset your empire and start fresh with permanent bonuses. Requires Level 25 and $1M clean money.</p>`;
    html += `<p class="prestige-bonus">Current bonus: +${(s.prestige?.count || 0) * 10}% all income &amp; XP</p>`;
    if (e.canPrestige()) {
      html += `<button class="btn btn-prestige" onclick="if(confirm('Go legitimate? This resets everything but gives permanent +10% income/XP. Continue?')){window._engine.performPrestige(); window._ui.renderAll(); window._ui.renderStatsTab();}">GO LEGITIMATE (Prestige ${(s.prestige?.count || 0) + 1})</button>`;
    } else {
      html += `<button class="btn btn-prestige" disabled>Requires Lv 25 + $1M Clean</button>`;
    }
    html += `</div>`;

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

  // ===== DILEMMA SYSTEM =====

  showDilemma(dilemma) {
    const overlay = document.getElementById('dilemma-overlay');
    if (!overlay) return;
    const container = document.getElementById('dilemma-content');

    let html = `<div class="dilemma-icon">${ico(dilemma.icon || 'alert', 'ico-xl')}</div>`;
    html += `<h2 class="dilemma-title">${dilemma.name}</h2>`;
    html += `<p class="dilemma-desc">${dilemma.desc}</p>`;
    html += `<div class="dilemma-choices">`;

    dilemma.choices.forEach((choice, i) => {
      const riskColor = choice.risk === 'high' ? 'var(--accent-red)' : choice.risk === 'medium' ? 'var(--heat-mid)' : 'var(--accent-green)';
      html += `<button class="dilemma-choice" onclick="window._engine.resolveDilemma(${i});">`;
      html += `<div class="dilemma-choice-label">${choice.label}</div>`;
      html += `<div class="dilemma-choice-desc">${choice.desc}</div>`;
      html += `<span class="dilemma-risk" style="color:${riskColor}">${choice.risk.toUpperCase()} RISK</span>`;
      html += `</button>`;
    });

    html += `</div>`;
    container.innerHTML = html;
    overlay.classList.remove('hidden');
  }

  hideDilemma() {
    const overlay = document.getElementById('dilemma-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ===== MINI-GAME SYSTEM =====

  showMiniGame(gameType, opData) {
    const config = MINI_GAMES[gameType];
    if (!config) return;
    const overlay = document.getElementById('minigame-overlay');
    if (!overlay) return;

    // Build zone gradient
    const zones = config.zones;
    const gradientParts = zones.map(z => `${z.color} ${z.start}%, ${z.color} ${z.end}%`);
    const gradient = `linear-gradient(to right, ${gradientParts.join(', ')})`;

    let html = `<div class="minigame-box">`;
    html += `<div class="minigame-icon">${ico(config.icon || 'ops', 'ico-xl')}</div>`;
    html += `<h2 class="minigame-title">${config.title}</h2>`;
    html += `<p class="minigame-desc">${config.desc}</p>`;
    html += `<p class="minigame-op-name">${opData.name}</p>`;
    html += `<div class="minigame-meter" style="background:${gradient};">`;
    html += `<div class="minigame-needle" id="minigame-needle"></div>`;
    html += `</div>`;
    html += `<div class="minigame-zone-labels">`;
    for (const z of zones) {
      const width = z.end - z.start;
      html += `<span style="width:${width}%;color:${z.color}">${z.label}</span>`;
    }
    html += `</div>`;
    html += `<div class="minigame-actions">`;
    html += `<button class="btn btn-primary minigame-lock-btn" id="minigame-lock-btn">LOCK IN</button>`;
    html += `<button class="btn btn-sm" id="minigame-cancel-btn">Cancel</button>`;
    html += `</div>`;
    html += `</div>`;

    const content = document.getElementById('minigame-content');
    content.innerHTML = html;
    overlay.classList.remove('hidden');

    // Start needle animation
    this.miniGamePos = 0;
    this.miniGameDir = 1;
    this.miniGameSpeed = config.speed;
    this.miniGameRunning = true;

    const needle = document.getElementById('minigame-needle');
    const animate = () => {
      if (!this.miniGameRunning) return;
      this.miniGamePos += this.miniGameSpeed * this.miniGameDir;
      if (this.miniGamePos >= 100) { this.miniGamePos = 100; this.miniGameDir = -1; }
      if (this.miniGamePos <= 0) { this.miniGamePos = 0; this.miniGameDir = 1; }
      if (needle) needle.style.left = this.miniGamePos + '%';
      this.miniGameFrame = requestAnimationFrame(animate);
    };
    this.miniGameFrame = requestAnimationFrame(animate);

    // Bind buttons
    document.getElementById('minigame-lock-btn').addEventListener('click', () => {
      this.miniGameRunning = false;
      if (this.miniGameFrame) cancelAnimationFrame(this.miniGameFrame);
      this.engine.completeMiniGame(this.miniGamePos);
    }, { once: true });

    document.getElementById('minigame-cancel-btn').addEventListener('click', () => {
      this.miniGameRunning = false;
      if (this.miniGameFrame) cancelAnimationFrame(this.miniGameFrame);
      this.engine.cancelMiniGame();
    }, { once: true });
  }

  hideMiniGame() {
    this.miniGameRunning = false;
    if (this.miniGameFrame) cancelAnimationFrame(this.miniGameFrame);
    const overlay = document.getElementById('minigame-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ===== CREW CANDIDATE SELECTION =====

  showCrewCandidates() {
    const s = this.state;
    const e = this.engine;
    if (!s.crewCandidates || s.crewCandidates.length === 0) return;

    const cost = e.getRecruitCost();
    let html = `<p class="recruit-cost">Cost: <strong>${e.formatMoney(cost)}</strong></p>`;
    html += `<div class="candidate-grid">`;

    s.crewCandidates.forEach((c, i) => {
      const type = CREW_TYPES.find(t => t.id === c.type);
      html += `<div class="candidate-card">`;
      html += `<div class="candidate-info">`;
      html += `<div class="candidate-name">${c.name}</div>`;
      html += `<div class="candidate-meta">`;
      html += `<span class="crew-type ${type?.color || ''}">${type?.name || c.type}</span>`;
      html += `<span>Lv ${c.level}</span>`;
      html += `<span>Loyalty ${c.loyalty}%</span>`;
      html += `</div>`;
      html += `<div class="candidate-desc">${type?.desc || ''}</div>`;
      if (c.traits && c.traits.length > 0) {
        html += `<div class="candidate-traits">`;
        for (const traitId of c.traits) {
          const trait = CREW_TRAITS.find(t => t.id === traitId);
          if (trait) {
            html += `<span class="trait-badge" style="border-color:${trait.color};color:${trait.color}" title="${trait.desc}">${trait.name}</span>`;
          }
        }
        html += `</div>`;
      }
      html += `</div>`;
      html += `<button class="btn btn-primary btn-sm candidate-hire" onclick="event.stopPropagation(); window._engine.hireCandidate(${i}); window._ui.hideModal(); window._ui.renderCrewTab();">HIRE</button>`;
      html += `</div>`;
    });

    html += `</div>`;
    html += `<div class="recruit-footer"><button class="btn btn-sm" onclick="window._ui.hideModal();">Cancel</button></div>`;

    this.showModal('Choose Your Recruit', html);
  }

  // ===== RIVAL PANEL =====

  updateRivalPanel() {
    const s = this.state;
    const e = this.engine;
    const panel = document.getElementById('rival-panel');
    if (!panel || !s.rival) return;

    const riv = s.rival;
    const powerPct = Math.min(100, riv.power);
    const powerColor = riv.power > 60 ? 'var(--accent-red)' : riv.power > 30 ? 'var(--heat-mid)' : 'var(--accent-green)';
    const cost = Math.floor(1000 + riv.power * 200);
    const influenceCost = Math.floor(2 + riv.power * 0.1);
    const canAttack = s.resources.dirtyMoney >= cost && s.resources.influence >= influenceCost;

    let html = `<div class="rival-name">${ico('target','ico-color-red')} ${riv.name}</div>`;
    html += `<div class="rival-power-bar"><div class="rival-power-fill" style="width:${powerPct}%;background:${powerColor}"></div></div>`;
    html += `<div class="rival-info">Power: ${Math.floor(riv.power)}</div>`;
    if (riv.truceTicks > 0) {
      html += `<div class="rival-truce">${ico('shield','ico-color-green')} Truce: ${riv.truceTicks}s</div>`;
    } else {
      html += `<button class="btn btn-danger btn-xs rival-attack-btn" ${canAttack ? '' : 'disabled'} onclick="window._engine.attackRival(); window._ui.updateRivalPanel();">`;
      html += `${ico('zap')} STRIKE ($${e.formatNum(cost)})`;
      html += `</button>`;
    }
    if (riv.defeated > 0) {
      html += `<div class="rival-defeated">${ico('crown','ico-color-gold')} Defeated: ${riv.defeated}</div>`;
    }

    panel.innerHTML = html;
  }

  // ===== RANK DISPLAY =====

  updateRankDisplay() {
    const e = this.engine;
    const rankEl = document.getElementById('player-rank');
    if (!rankEl) return;
    const rank = e.getCurrentRank();
    rankEl.textContent = rank.title;
    rankEl.title = rank.desc;
  }

  // ===== FLOATING NUMBERS =====

  spawnFloat(text, type = 'money', anchorEl) {
    const container = document.getElementById('float-numbers');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `float-num ${type}`;
    el.textContent = text;

    // Position near the resource bar element if given, otherwise random top area
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      el.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 40) + 'px';
      el.style.top = (rect.bottom + 4) + 'px';
    } else {
      el.style.left = (200 + Math.random() * 400) + 'px';
      el.style.top = (80 + Math.random() * 40) + 'px';
    }

    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1600);
  }

  spawnRewardFloats(reward, xp) {
    const e = this.engine;
    if (reward.dirtyMoney) {
      this.spawnFloat('+' + e.formatMoney(reward.dirtyMoney), 'money', document.getElementById('res-dirty'));
    }
    if (reward.cleanMoney) {
      this.spawnFloat('+' + e.formatMoney(reward.cleanMoney), 'clean', document.getElementById('res-clean'));
    }
    if (reward.influence) {
      this.spawnFloat('+' + reward.influence, 'influence', document.getElementById('res-influence'));
    }
    if (reward.supplies) {
      this.spawnFloat('+' + reward.supplies, 'supplies', document.getElementById('res-supplies'));
    }
    if (xp > 0) {
      this.spawnFloat('+' + xp + ' XP', 'xp');
    }
  }

  // ===== LEVEL UP CELEBRATION =====

  showLevelUp(level) {
    const overlay = document.getElementById('levelup-overlay');
    const lvText = document.getElementById('levelup-level');
    if (!overlay || !lvText) return;
    lvText.textContent = `Level ${level}`;
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 2200);
  }

  // ===== HEAT WARNING =====

  updateHeatWarning() {
    const heat = Math.floor(this.state.resources.heat);
    const heatEl = document.querySelector('.heat-resource');
    if (heatEl) {
      if (heat >= 70) {
        heatEl.classList.add('heat-danger');
      } else {
        heatEl.classList.remove('heat-danger');
      }
    }
  }

  // ===== OP CARD COMPLETION FLASH =====

  flashOpComplete(opId) {
    const card = document.querySelector(`.op-card[data-op="${opId}"]`);
    if (card) {
      card.classList.add('just-completed');
      setTimeout(() => card.classList.remove('just-completed'), 700);
    }
  }

  // ===== AMBIENT PARTICLE SYSTEM =====

  initAmbientParticles() {
    const canvas = document.getElementById('ambient-canvas');
    if (!canvas) return;
    this.ambientCtx = canvas.getContext('2d');
    this.particles = [];

    const resize = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: 1 + Math.random() * 1.5,
        alpha: 0.1 + Math.random() * 0.3,
      });
    }

    const animate = () => {
      requestAnimationFrame(animate);
      this.drawAmbientParticles();
    };
    animate();
  }

  drawAmbientParticles() {
    const ctx = this.ambientCtx;
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
      ctx.fill();
    }

    // Draw connecting lines between close particles
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.06 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }
}

function canAffordObj(state, costs) {
  for (const [resource, amount] of Object.entries(costs)) {
    if ((state.resources[resource] || 0) < amount) return false;
  }
  return true;
}
