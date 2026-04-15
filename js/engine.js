// ===== GAME ENGINE - Core game loop and all systems =====
import { CONFIG, OPERATIONS, TERRITORIES, CREW_TYPES, CREW_FIRST_NAMES, CREW_LAST_NAMES, UPGRADES, FRONTS, EVENTS, DILEMMAS, CREW_TRAITS, RANKS, RIVAL_NAMES, MAINTENANCE, SUPPLY_MARKET, MINI_GAMES } from './data.js';
import { addXP, canAfford, spendResources, saveGame, xpForLevel } from './state.js';

export class GameEngine {
  constructor(state, ui) {
    this.state = state;
    this.ui = ui;
    this.tickInterval = null;
    this.autoSaveCounter = 0;
    this.eventCooldown = 0;
  }

  start() {
    this.tickInterval = setInterval(() => this.tick(), CONFIG.TICK_MS);
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  tick() {
    const s = this.state;
    s.tickCount++;
    s.stats.playTimeTicks++;

    // Process running operations
    this.processOperations();

    // Process auto-operations
    this.processAutoOperations();

    // Process territory control
    this.processTerritory();

    // Process laundering
    this.processLaundering();

    // Process passive income
    this.processPassiveIncome();

    // Heat decay
    this.processHeatDecay();

    // Maintenance costs (crew salaries, territory upkeep, front costs)
    this.processMaintenanceCosts();

    // Rival gang
    this.processRival();

    // Timed buffs
    if (s.marketBoomTicks > 0) s.marketBoomTicks--;
    if (s.crewBoostTicks > 0) s.crewBoostTicks--;

    // Events & Dilemmas
    this.processEvents();
    this.processDilemmas();

    // Auto-save
    this.autoSaveCounter++;
    if (this.autoSaveCounter >= CONFIG.AUTO_SAVE_INTERVAL) {
      this.autoSaveCounter = 0;
      saveGame(s);
    }

    // Update UI
    this.ui.update();
  }

  // ===== COMPUTED BONUSES =====

  getUpgradeEffect(effectName) {
    let total = 0;
    for (const cat of Object.values(UPGRADES)) {
      for (const item of cat.items) {
        if (item.effect === effectName) {
          const level = this.state.upgrades[item.id] || 0;
          total += level * item.valuePerLevel;
        }
      }
    }
    return total;
  }

  getTerritoryBonus(bonusName) {
    let total = 0;
    for (const [id, tData] of Object.entries(this.state.territories)) {
      if (tData.control > 0) {
        const terr = TERRITORIES.find(t => t.id === id);
        if (terr && terr.bonuses[bonusName]) {
          total += terr.bonuses[bonusName] * (tData.control / 100);
        }
      }
    }
    return total;
  }

  getCrewBonus(bonusName) {
    let total = 0;
    for (const member of this.state.crew) {
      const type = CREW_TYPES.find(t => t.id === member.type);
      if (type && type.bonus === bonusName) {
        total += type.bonusValue * (1 + (member.level - 1) * 0.15) * (member.loyalty / 100);
      }
    }
    return total;
  }

  getTraitBonus(traitId) {
    let count = 0;
    for (const c of this.state.crew) {
      if (c.traits && c.traits.includes(traitId)) count++;
    }
    return count;
  }

  getAllBonus(bonusName) {
    return this.getUpgradeEffect(bonusName) + this.getTerritoryBonus(bonusName) + this.getCrewBonus(bonusName);
  }

  getMaxSimultaneousOps() {
    return 1 + Math.floor(this.getUpgradeEffect('maxOps'));
  }

  getMaxCrew() {
    return CONFIG.MAX_CREW_BASE + Math.floor(this.getUpgradeEffect('maxCrew'));
  }

  getOpDuration(opData) {
    const speedBonus = this.getAllBonus('opSpeed') + this.getAllBonus('smugglingSpeed') + this.getAllBonus('productionSpeed');
    const boostMultiplier = this.state.crewBoostTicks > 0 ? 0.75 : 1.0;
    // Trait: Fearless => +12% speed per fearless crew
    const fearlessBonus = this.getTraitBonus('fearless') * 0.12;
    return Math.max(1, Math.floor(opData.duration * (1 - speedBonus - fearlessBonus) * boostMultiplier));
  }

  getOpReward(opData) {
    const incomeBonus = 1 + this.getAllBonus('incomeMultiplier');
    const boomMultiplier = this.state.marketBoomTicks > 0 ? 2.0 : 1.0;
    // Prestige bonus: +10% per prestige
    const prestigeBonus = 1 + (this.state.prestige?.count || 0) * 0.10;

    // Category-specific bonuses
    let categoryBonus = 1;
    if (opData.category === 'Drugs') categoryBonus += this.getAllBonus('drugBonus');
    if (opData.category === 'Cyber') categoryBonus += this.getAllBonus('cyberBonus');

    // Trait: Connected => +2 influence per operation (flat)
    const connectedCount = this.getTraitBonus('connected');

    const reward = {};
    for (const [res, amount] of Object.entries(opData.reward)) {
      if (res === 'dirtyMoney' || res === 'cleanMoney') {
        reward[res] = Math.floor(amount * incomeBonus * boomMultiplier * categoryBonus * prestigeBonus);
      } else {
        reward[res] = amount;
      }
    }
    // Add trait influence bonus
    if (connectedCount > 0) reward.influence = (reward.influence || 0) + connectedCount * 2;
    return reward;
  }

  getOpCost(opData) {
    const supplyDiscount = 1 - this.getAllBonus('supplyDiscount');
    const cost = {};
    for (const [res, amount] of Object.entries(opData.cost)) {
      if (res === 'supplies') {
        cost[res] = Math.max(1, Math.floor(amount * supplyDiscount));
      } else {
        cost[res] = amount;
      }
    }
    return cost;
  }

  getOpHeat(opData) {
    const heatReduction = 1 - this.getAllBonus('heatReduction') - this.getAllBonus('heatReduce');
    // Traits: Paranoid -10%, Ghost -15%
    const traitReduce = this.getTraitBonus('paranoid') * 0.10 + this.getTraitBonus('ghost') * 0.15;
    // Trait: Violent +5%
    const traitIncrease = this.getTraitBonus('violent') * 0.05;
    return Math.max(0, Math.floor(opData.heatGain * Math.max(0.1, heatReduction - traitReduce + traitIncrease)));
  }

  getOpXP(opData) {
    const xpBonus = 1 + this.getAllBonus('xpGain') + this.getAllBonus('crewXPBonus');
    // Trait: Genius +20%
    const geniusBonus = this.getTraitBonus('genius') * 0.20;
    // Prestige bonus: +10% per prestige
    const prestigeBonus = (this.state.prestige?.count || 0) * 0.10;
    return Math.floor(opData.xp * (xpBonus + geniusBonus + prestigeBonus));
  }

  getLaunderMaxRate() {
    let capacity = 0;
    for (const frontId of this.state.laundering.fronts) {
      const front = FRONTS.find(f => f.id === frontId);
      if (front) capacity += front.launderCapacity;
    }
    capacity += Math.floor(this.getUpgradeEffect('launderRate'));
    return capacity;
  }

  getLaunderEfficiency() {
    let eff = CONFIG.BASE_LAUNDER_EFFICIENCY;
    eff += this.getUpgradeEffect('launderEfficiency');
    eff += this.getAllBonus('launderEfficiency');
    eff += this.getAllBonus('launderEff');
    // Fronts add efficiency
    for (const frontId of this.state.laundering.fronts) {
      const front = FRONTS.find(f => f.id === frontId);
      if (front) eff += front.efficiency;
    }
    eff += this.getAllBonus('cleanMoneyBonus');
    return Math.min(0.98, eff);
  }

  getRecruitCost() {
    const base = CONFIG.RECRUIT_BASE_COST;
    const count = this.state.stats.totalCrewHired;
    const discount = 1 - this.getAllBonus('recruitCostReduction');
    // Trait: Negotiator -15% per negotiator crew member
    const negotiatorDiscount = 1 - this.getTraitBonus('negotiator') * 0.15;
    return Math.floor(base * Math.pow(CONFIG.RECRUIT_COST_GROWTH, count) * Math.max(0.3, discount) * Math.max(0.3, negotiatorDiscount));
  }

  // ===== ACTIONS =====

  startOperation(opId, rewardMultiplier = 1) {
    const s = this.state;
    const opData = OPERATIONS.find(o => o.id === opId);
    if (!opData) return false;
    if (!s.operations.unlocked.includes(opId)) return false;

    // Check crew requirement
    const minCrew = opData.minCrew || 0;
    if (s.crew.length < minCrew) {
      this.ui.notify(`Need at least ${minCrew} crew member${minCrew > 1 ? 's' : ''}!`, 'warning');
      return false;
    }

    // Check max simultaneous
    if (s.operations.running.length >= this.getMaxSimultaneousOps()) {
      this.ui.notify('Max operations running!', 'warning');
      return false;
    }

    // Check already running same op
    if (s.operations.running.some(r => r.id === opId)) {
      this.ui.notify('Operation already in progress!', 'warning');
      return false;
    }

    const cost = this.getOpCost(opData);
    if (!canAfford(s, cost)) {
      this.ui.notify('Not enough resources!', 'danger');
      return false;
    }

    // Mini-game check (manual play only, not from auto or post-minigame)
    if (opData.miniGame && rewardMultiplier === 1 && !s.pendingMiniGame) {
      // Verify we can afford before showing mini-game
      s.pendingMiniGame = { opId, gameType: opData.miniGame };
      this.ui.showMiniGame(opData.miniGame, opData);
      return 'minigame';
    }

    spendResources(s, cost);
    const duration = this.getOpDuration(opData);
    s.operations.running.push({
      id: opId,
      startTick: s.tickCount,
      duration: duration,
      rewardMultiplier: rewardMultiplier,
    });
    return true;
  }

  completeMiniGame(position) {
    const s = this.state;
    if (!s.pendingMiniGame) return;
    const { opId, gameType } = s.pendingMiniGame;
    const config = MINI_GAMES[gameType];
    if (!config) { s.pendingMiniGame = null; return; }

    // Determine zone
    let zone = config.zones[0];
    for (const z of config.zones) {
      if (position >= z.start && position < z.end) { zone = z; break; }
    }

    // Apply extra heat from bad result
    if (zone.heat > 0) {
      s.resources.heat = Math.min(CONFIG.MAX_HEAT, s.resources.heat + zone.heat);
    }

    const multiplier = zone.multiplier;
    s.pendingMiniGame = null;
    this.ui.hideMiniGame();

    // Show result
    const label = zone.label;
    const type = multiplier >= 1.0 ? 'success' : multiplier >= 0.6 ? 'warning' : 'danger';
    this.ui.notify(`${label}! ${Math.floor(multiplier * 100)}% yield`, type);

    // Now actually start the operation with the multiplier
    this.startOperation(opId, multiplier);
  }

  cancelMiniGame() {
    this.state.pendingMiniGame = null;
    this.ui.hideMiniGame();
  }

  processOperations() {
    const s = this.state;
    const completed = [];

    for (let i = s.operations.running.length - 1; i >= 0; i--) {
      const run = s.operations.running[i];
      const elapsed = s.tickCount - run.startTick;
      if (elapsed >= run.duration) {
        completed.push(run);
        s.operations.running.splice(i, 1);
      }
    }

    for (const run of completed) {
      this.completeOperation(run);
    }
  }

  completeOperation(run) {
    const s = this.state;
    const opData = OPERATIONS.find(o => o.id === run.id);
    if (!opData) return;

    const reward = this.getOpReward(opData);
    const heat = this.getOpHeat(opData);
    const xp = this.getOpXP(opData);
    const multiplier = run.rewardMultiplier || 1;

    // Apply rewards with mini-game multiplier
    for (const [res, amount] of Object.entries(reward)) {
      const adjusted = (res === 'dirtyMoney' || res === 'cleanMoney') ? Math.floor(amount * multiplier) : amount;
      s.resources[res] = (s.resources[res] || 0) + adjusted;
      if (res === 'dirtyMoney') s.stats.totalDirtyEarned += adjusted;
      if (res === 'cleanMoney') s.stats.totalCleanEarned += adjusted;
    }

    // Apply heat
    s.resources.heat = Math.min(CONFIG.MAX_HEAT, s.resources.heat + heat);
    s.stats.totalHeatGained += heat;

    // Floating number particles
    this.ui.spawnRewardFloats(reward, xp);
    this.ui.flashOpComplete(run.id);

    // XP
    const levelUps = addXP(s, xp);
    for (const lv of levelUps) {
      this.ui.notify(`Level Up! You are now level ${lv}!`, 'unlock');
      this.ui.addEvent(`Reached level ${lv}!`, 'unlock');
      this.ui.showLevelUp(lv);
      this.checkNewUnlocks();
    }

    // Crew XP
    this.giveCrewXP(1);

    // Stats
    s.operations.completions[run.id] = (s.operations.completions[run.id] || 0) + 1;
    s.stats.totalOperations++;

    // Notifications
    const moneyGained = reward.dirtyMoney || 0;
    if (moneyGained > 0) {
      this.ui.addEvent(`${opData.name}: +$${this.formatNum(moneyGained)}`, 'money');
    }
  }

  processAutoOperations() {
    const s = this.state;
    for (const opId of s.operations.unlocked) {
      if (!s.operations.autoEnabled[opId]) continue;
      const opData = OPERATIONS.find(o => o.id === opId);
      if (!opData || !opData.autoCapable) continue;
      // Auto requires level threshold
      if (opData.autoReq && s.level < opData.autoReq) continue;
      // Don't auto-start if already running
      if (s.operations.running.some(r => r.id === opId)) continue;
      // Check if we have room
      if (s.operations.running.length >= this.getMaxSimultaneousOps()) continue;
      // Check crew requirement
      if (opData.minCrew && s.crew.length < opData.minCrew) continue;

      const cost = this.getOpCost(opData);
      if (canAfford(s, cost)) {
        // Auto-ops skip mini-game with reduced multiplier (0.7x)
        const autoMultiplier = opData.miniGame ? 0.7 : 1;
        this.startOperation(opId, autoMultiplier);
      }
    }
  }

  unlockOperation(opId) {
    const s = this.state;
    const opData = OPERATIONS.find(o => o.id === opId);
    if (!opData) return false;
    if (s.operations.unlocked.includes(opId)) return false;
    if (s.level < opData.levelReq) return false;

    if (opData.unlockCost > 0) {
      if (s.resources.dirtyMoney < opData.unlockCost) {
        this.ui.notify('Not enough dirty money!', 'danger');
        return false;
      }
      s.resources.dirtyMoney -= opData.unlockCost;
    }
    s.operations.unlocked.push(opId);
    this.ui.notify(`Unlocked: ${opData.name}!`, 'unlock');
    this.ui.addEvent(`Unlocked operation: ${opData.name}`, 'unlock');
    return true;
  }

  toggleAutoOp(opId) {
    const s = this.state;
    const opData = OPERATIONS.find(o => o.id === opId);
    // Check auto level requirement
    if (opData && opData.autoReq && s.level < opData.autoReq) {
      this.ui.notify(`Auto requires level ${opData.autoReq}!`, 'warning');
      return;
    }
    s.operations.autoEnabled[opId] = !s.operations.autoEnabled[opId];
  }

  // ===== SUPPLY MARKET =====

  buySupplies(sourceId) {
    const s = this.state;
    const source = SUPPLY_MARKET.find(src => src.id === sourceId);
    if (!source) return false;
    if (s.level < source.levelReq) {
      this.ui.notify(`Requires level ${source.levelReq}!`, 'warning');
      return false;
    }
    if (!canAfford(s, source.cost)) {
      this.ui.notify('Not enough resources!', 'danger');
      return false;
    }
    spendResources(s, source.cost);
    s.resources.supplies += source.yield;
    if (source.heatGain) {
      s.resources.heat = Math.min(CONFIG.MAX_HEAT, s.resources.heat + source.heatGain);
    }
    this.ui.notify(`+${source.yield} supplies from ${source.name}`, 'success');
    this.ui.addEvent(`Bought ${source.yield} supplies via ${source.name}`, 'info');
    return true;
  }

  // ===== TERRITORY =====

  expandTerritory(terrId) {
    const s = this.state;
    const terr = TERRITORIES.find(t => t.id === terrId);
    if (!terr) return false;
    if (s.level < terr.levelReq) {
      this.ui.notify(`Requires level ${terr.levelReq}!`, 'warning');
      return false;
    }

    if (!s.territories[terrId]) {
      // First time expanding
      if (!canAfford(s, terr.costToExpand)) {
        this.ui.notify('Not enough resources!', 'danger');
        return false;
      }
      spendResources(s, terr.costToExpand);
      s.territories[terrId] = { control: 0, expanding: true };
      this.ui.notify(`Expanding into ${terr.name}!`, 'info');
      this.ui.addEvent(`Started expanding into ${terr.name}`, 'info');
      return true;
    } else if (!s.territories[terrId].expanding && s.territories[terrId].control < 100) {
      // Resume expanding
      const cost = {};
      for (const [res, val] of Object.entries(terr.costToExpand)) {
        cost[res] = Math.floor(val * 0.3);
      }
      if (!canAfford(s, cost)) {
        this.ui.notify('Not enough resources!', 'danger');
        return false;
      }
      spendResources(s, cost);
      s.territories[terrId].expanding = true;
      return true;
    }
    return false;
  }

  processTerritory() {
    const s = this.state;
    const violentBonus = this.getTraitBonus('violent') * 0.15;
    const speedBonus = 1 + this.getAllBonus('territorySpeed') + this.getAllBonus('territoryControl') + violentBonus;

    for (const [id, tData] of Object.entries(s.territories)) {
      if (tData.expanding && tData.control < 100) {
        const terr = TERRITORIES.find(t => t.id === id);
        if (!terr) continue;
        const gain = terr.controlRate * speedBonus;
        tData.control = Math.min(100, tData.control + gain);
        if (tData.control >= 100) {
          tData.control = 100;
          tData.expanding = false;
          this.ui.notify(`${terr.name} fully controlled!`, 'unlock');
          this.ui.addEvent(`Full control of ${terr.name}!`, 'unlock');
        }
      }
    }
  }

  // ===== CREW =====

  generateCrewCandidates() {
    const s = this.state;
    if (s.crew.length >= this.getMaxCrew()) {
      this.ui.notify('Crew is full! Upgrade capacity.', 'warning');
      return [];
    }
    const cost = this.getRecruitCost();
    if (s.resources.dirtyMoney < cost) {
      this.ui.notify(`Need $${this.formatNum(cost)} to recruit!`, 'danger');
      return [];
    }

    const qualityBonus = this.getUpgradeEffect('recruitQuality');
    const candidates = [];
    for (let i = 0; i < 3; i++) {
      const type = CREW_TYPES[Math.floor(Math.random() * CREW_TYPES.length)];
      const firstName = CREW_FIRST_NAMES[Math.floor(Math.random() * CREW_FIRST_NAMES.length)];
      const lastName = CREW_LAST_NAMES[Math.floor(Math.random() * CREW_LAST_NAMES.length)];
      const baseLoyalty = 40 + Math.floor(Math.random() * 35) + Math.floor(qualityBonus * 20);
      const baseLevel = 1 + Math.floor(Math.random() * Math.min(3, Math.floor(s.level / 5)));

      // Random traits (0-2)
      const numTraits = Math.random() < 0.3 ? 0 : Math.random() < 0.6 ? 1 : 2;
      const traitPool = [...CREW_TRAITS];
      const traits = [];
      for (let t = 0; t < numTraits; t++) {
        if (traitPool.length === 0) break;
        const idx = Math.floor(Math.random() * traitPool.length);
        traits.push(traitPool[idx].id);
        traitPool.splice(idx, 1);
      }

      candidates.push({
        name: `${firstName} ${lastName}`,
        type: type.id,
        level: baseLevel,
        loyalty: Math.min(100, baseLoyalty),
        traits: traits,
      });
    }
    s.crewCandidates = candidates;
    return candidates;
  }

  hireCandidate(index) {
    const s = this.state;
    if (index < 0 || index >= s.crewCandidates.length) return false;
    if (s.crew.length >= this.getMaxCrew()) return false;

    const cost = this.getRecruitCost();
    if (s.resources.dirtyMoney < cost) return false;
    s.resources.dirtyMoney -= cost;

    const candidate = s.crewCandidates[index];
    const member = {
      id: ++s.crewIdCounter,
      name: candidate.name,
      type: candidate.type,
      level: candidate.level,
      xp: 0,
      xpToNext: Math.floor(50 * Math.pow(1.3, candidate.level - 1)),
      loyalty: candidate.loyalty,
      assignment: null,
      traits: candidate.traits,
    };

    s.crew.push(member);
    s.stats.totalCrewHired++;
    s.crewCandidates = [];

    const type = CREW_TYPES.find(t => t.id === member.type);
    this.ui.notify(`Recruited ${member.name} (${type?.name})!`, 'success');
    this.ui.addEvent(`Hired ${member.name} — ${type?.name}`, 'info');
    return true;
  }

  recruitCrew() {
    // Legacy: still works as direct random hire (used by auto etc.)
    const s = this.state;
    if (s.crew.length >= this.getMaxCrew()) {
      this.ui.notify('Crew is full! Upgrade capacity.', 'warning');
      return false;
    }

    const cost = this.getRecruitCost();
    if (s.resources.dirtyMoney < cost) {
      this.ui.notify(`Need $${this.formatNum(cost)} to recruit!`, 'danger');
      return false;
    }

    s.resources.dirtyMoney -= cost;

    // Generate crew member
    const typeIdx = Math.floor(Math.random() * CREW_TYPES.length);
    const type = CREW_TYPES[typeIdx];
    const firstName = CREW_FIRST_NAMES[Math.floor(Math.random() * CREW_FIRST_NAMES.length)];
    const lastName = CREW_LAST_NAMES[Math.floor(Math.random() * CREW_LAST_NAMES.length)];

    const qualityBonus = this.getUpgradeEffect('recruitQuality');
    const baseLoyalty = 50 + Math.floor(Math.random() * 30) + Math.floor(qualityBonus * 20);

    const member = {
      id: ++s.crewIdCounter,
      name: `${firstName} ${lastName}`,
      type: type.id,
      level: 1,
      xp: 0,
      xpToNext: 50,
      loyalty: Math.min(100, baseLoyalty),
      assignment: null,
      traits: [],
    };

    s.crew.push(member);
    s.stats.totalCrewHired++;

    this.ui.notify(`Recruited ${member.name} (${type.name})!`, 'success');
    this.ui.addEvent(`Hired ${member.name} — ${type.name}`, 'info');
    return true;
  }

  dismissCrew(crewId) {
    const s = this.state;
    const idx = s.crew.findIndex(c => c.id === crewId);
    if (idx === -1) return false;
    const member = s.crew[idx];
    s.crew.splice(idx, 1);
    this.ui.addEvent(`${member.name} left the crew.`, 'warning');
    return true;
  }

  giveCrewXP(amount) {
    const s = this.state;
    const xpBonus = 1 + this.getUpgradeEffect('crewXP') + this.getAllBonus('crewXPBonus');
    for (const member of s.crew) {
      member.xp += Math.floor(amount * xpBonus);
      while (member.xp >= member.xpToNext) {
        member.xp -= member.xpToNext;
        member.level++;
        member.xpToNext = Math.floor(50 * Math.pow(1.3, member.level - 1));
        this.ui.addEvent(`${member.name} reached level ${member.level}!`, 'info');
      }
      // Loyalty decay per crew member
      const loyaltyDecayReduction = 1 - this.getUpgradeEffect('loyaltyDecay');
      let decayRate = 0.02 * loyaltyDecayReduction;
      // Trait: Loyal => 50% slower decay
      if (member.traits && member.traits.includes('loyal')) decayRate *= 0.5;
      // Trait: Addict => 2x faster decay
      if (member.traits && member.traits.includes('addict')) decayRate *= 2.0;
      member.loyalty = Math.max(10, member.loyalty - decayRate);
    }

    // Trait: Natural Leader => all crew +0.01 loyalty per tick per leader
    const leaderCount = this.getTraitBonus('leader');
    if (leaderCount > 0) {
      for (const member of s.crew) {
        member.loyalty = Math.min(100, member.loyalty + 0.01 * leaderCount);
      }
    }
  }

  // ===== UPGRADES =====

  purchaseUpgrade(upgradeId) {
    const s = this.state;
    let item = null;
    for (const cat of Object.values(UPGRADES)) {
      item = cat.items.find(i => i.id === upgradeId);
      if (item) break;
    }
    if (!item) return false;

    const currentLevel = s.upgrades[upgradeId] || 0;
    if (currentLevel >= item.maxLevel) {
      this.ui.notify('Already at max level!', 'warning');
      return false;
    }
    if (s.level < item.levelReq) {
      this.ui.notify(`Requires level ${item.levelReq}!`, 'warning');
      return false;
    }

    const cost = Math.floor(item.baseCost * Math.pow(item.costGrowth, currentLevel));
    if ((s.resources[item.currency] || 0) < cost) {
      this.ui.notify('Not enough funds!', 'danger');
      return false;
    }

    s.resources[item.currency] -= cost;
    s.upgrades[upgradeId] = currentLevel + 1;
    this.ui.notify(`${item.name} upgraded to level ${currentLevel + 1}!`, 'success');
    this.ui.addEvent(`Upgraded ${item.name} to Lv${currentLevel + 1}`, 'info');
    return true;
  }

  // ===== LAUNDERING =====

  setLaunderRate(rate) {
    const maxRate = this.getLaunderMaxRate();
    this.state.laundering.rate = Math.max(0, Math.min(rate, maxRate));
  }

  purchaseFront(frontId) {
    const s = this.state;
    const front = FRONTS.find(f => f.id === frontId);
    if (!front) return false;
    if (s.laundering.fronts.includes(frontId)) {
      this.ui.notify('Already owned!', 'warning');
      return false;
    }
    if (s.level < front.levelReq) {
      this.ui.notify(`Requires level ${front.levelReq}!`, 'warning');
      return false;
    }
    if (!canAfford(s, front.cost)) {
      this.ui.notify('Not enough clean money!', 'danger');
      return false;
    }

    spendResources(s, front.cost);
    s.laundering.fronts.push(frontId);
    this.ui.notify(`Purchased ${front.name}!`, 'success');
    this.ui.addEvent(`Bought ${front.name} as a front`, 'unlock');
    return true;
  }

  processLaundering() {
    const s = this.state;
    const rate = s.laundering.rate;
    if (rate <= 0) return;

    // Auto-launder enabled?
    const hasAuto = (s.upgrades['auto_launder'] || 0) >= 1;
    let actualRate = rate;

    if (hasAuto) {
      const maxRate = this.getLaunderMaxRate();
      actualRate = Math.min(maxRate, s.resources.dirtyMoney);
    }

    const toConvert = Math.min(actualRate, s.resources.dirtyMoney);
    if (toConvert <= 0) return;

    const efficiency = this.getLaunderEfficiency();
    const cleanGain = Math.floor(toConvert * efficiency);

    s.resources.dirtyMoney -= toConvert;
    s.resources.cleanMoney += cleanGain;
    s.stats.totalCleanEarned += cleanGain;
  }

  // ===== PASSIVE INCOME =====

  processPassiveIncome() {
    const s = this.state;
    const passiveIncome = this.getUpgradeEffect('passiveIncome');
    if (passiveIncome > 0) {
      const bonus = 1 + this.getAllBonus('incomeMultiplier');
      s.resources.dirtyMoney += Math.floor(passiveIncome * bonus);
      s.stats.totalDirtyEarned += Math.floor(passiveIncome * bonus);
    }

    const passiveInfluence = this.getUpgradeEffect('passiveInfluence');
    if (passiveInfluence > 0) {
      s.resources.influence += passiveInfluence;
    }

    const passiveSupplies = this.getUpgradeEffect('passiveSupplies');
    if (passiveSupplies > 0) {
      s.resources.supplies += passiveSupplies;
    }
  }

  // ===== HEAT =====

  processHeatDecay() {
    const s = this.state;
    if (s.resources.heat > 0) {
      const decayBonus = 1 + this.getUpgradeEffect('heatDecay');
      s.resources.heat = Math.max(0, s.resources.heat - CONFIG.HEAT_DECAY_PER_TICK * decayBonus);
    }
  }

  // ===== EVENTS =====

  processEvents() {
    if (this.eventCooldown > 0) {
      this.eventCooldown--;
      return;
    }

    const s = this.state;
    for (const event of EVENTS) {
      if (!event.condition(s)) continue;
      if (Math.random() > event.chance) continue;

      // Trigger event
      const result = event.effect(s);
      s.stats.totalEventsTriggered++;
      this.eventCooldown = 10 + Math.floor(Math.random() * 20); // 10-30 tick cooldown

      this.ui.notify(`${event.name}`, event.type === 'danger' ? 'danger' : event.type === 'money' ? 'success' : event.type === 'warning' ? 'warning' : 'info');
      this.ui.addEvent(`${event.name}: ${result}`, event.type === 'money' ? 'money' : event.type);
      break; // Only one event per tick
    }
  }

  // ===== UNLOCKS =====

  checkNewUnlocks() {
    const s = this.state;
    for (const op of OPERATIONS) {
      if (op.levelReq <= s.level && !s.operations.unlocked.includes(op.id) && op.unlockCost === 0) {
        s.operations.unlocked.push(op.id);
        this.ui.notify(`New operation available: ${op.name}!`, 'unlock');
      }
    }
  }

  // ===== INCOME RATE CALCULATION =====

  getDirtyIncomeRate() {
    let rate = 0;
    for (const run of this.state.operations.running) {
      const opData = OPERATIONS.find(o => o.id === run.id);
      if (opData) {
        const reward = this.getOpReward(opData);
        const duration = this.getOpDuration(opData);
        rate += (reward.dirtyMoney || 0) / duration;
      }
    }
    rate += this.getUpgradeEffect('passiveIncome') * (1 + this.getAllBonus('incomeMultiplier'));
    rate -= this.state.laundering.rate;
    // Subtract maintenance
    rate -= this.getMaintenanceCost();
    return rate;
  }

  getCleanIncomeRate() {
    let rate = 0;
    rate += this.state.laundering.rate * this.getLaunderEfficiency();
    return rate;
  }

  getMaintenanceCost() {
    const s = this.state;
    let cost = 0;
    // Crew salaries
    for (const c of s.crew) {
      let salary = MAINTENANCE.crewSalaryBase + MAINTENANCE.crewSalaryPerLevel * c.level;
      if (c.traits && c.traits.includes('greedy')) salary += 50;
      cost += salary;
    }
    // Territory upkeep
    for (const [id, tData] of Object.entries(s.territories)) {
      if (tData.control > 0) {
        const terr = TERRITORIES.find(t => t.id === id);
        if (terr) cost += (MAINTENANCE.territoryUpkeep[terr.difficulty] || 0) * (tData.control / 100);
      }
    }
    return cost;
  }

  getCleanMaintenanceCost() {
    const s = this.state;
    let cost = 0;
    for (const frontId of s.laundering.fronts) {
      const front = FRONTS.find(f => f.id === frontId);
      if (front) cost += front.launderCapacity * MAINTENANCE.frontOperatingCost;
    }
    return cost;
  }

  // ===== MAINTENANCE =====

  processMaintenanceCosts() {
    const s = this.state;
    const dirtyCost = this.getMaintenanceCost();
    const cleanCost = this.getCleanMaintenanceCost();

    if (dirtyCost > 0) {
      if (s.resources.dirtyMoney >= dirtyCost) {
        s.resources.dirtyMoney -= dirtyCost;
        s.stats.totalMaintenancePaid = (s.stats.totalMaintenancePaid || 0) + dirtyCost;
      } else {
        // Can't pay! Crew loyalty drops, territory decays
        s.resources.dirtyMoney = 0;
        s.crew.forEach(c => { c.loyalty = Math.max(10, c.loyalty - 0.5); });
        // Lose territory slowly
        for (const t of Object.values(s.territories)) {
          if (t.control > 0) t.control = Math.max(0, t.control - 0.2);
        }
      }
    }

    if (cleanCost > 0) {
      if (s.resources.cleanMoney >= cleanCost) {
        s.resources.cleanMoney -= cleanCost;
      }
      // If can't afford, fronts still work but at reduced capacity (handled via UI)
    }
  }

  // ===== RIVAL SYSTEM =====

  processRival() {
    const s = this.state;
    if (!s.rival) return;

    // Truce countdown
    if (s.rival.truceTicks > 0) {
      s.rival.truceTicks--;
      return;
    }

    // Rival grows in power over time
    s.rival.power += 0.03 + (s.level * 0.005);

    // Rival aggression slowly increases
    s.rival.aggression = Math.min(1.0, s.rival.aggression + 0.001);

    // Rival attack check
    if (s.rival.power >= 30 && s.rival.aggression >= 0.4) {
      const attackChance = 0.003 * s.rival.aggression;
      if (Math.random() < attackChance && (s.tickCount - s.rival.lastAttackTick) > 60) {
        this.rivalAttack();
      }
    }
  }

  rivalAttack() {
    const s = this.state;
    s.rival.lastAttackTick = s.tickCount;
    const power = s.rival.power;

    const attackTypes = [];
    if (s.resources.dirtyMoney > 1000) attackTypes.push('money');
    if (Object.values(s.territories).some(t => t.control > 20)) attackTypes.push('territory');
    if (s.resources.supplies > 5) attackTypes.push('supplies');

    if (attackTypes.length === 0) return;
    const attack = attackTypes[Math.floor(Math.random() * attackTypes.length)];

    switch (attack) {
      case 'money': {
        const stolen = Math.floor(s.resources.dirtyMoney * Math.min(0.15, power * 0.002));
        s.resources.dirtyMoney = Math.max(0, s.resources.dirtyMoney - stolen);
        this.ui.notify(`${s.rival.name} raided your stash! Lost $${this.formatNum(stolen)}`, 'danger');
        this.ui.addEvent(`${s.rival.name} stole $${this.formatNum(stolen)}!`, 'danger');
        break;
      }
      case 'territory': {
        const controlled = Object.entries(s.territories).filter(([, t]) => t.control > 20);
        if (controlled.length > 0) {
          const [key, terr] = controlled[Math.floor(Math.random() * controlled.length)];
          const loss = 5 + Math.floor(power * 0.2);
          s.territories[key].control = Math.max(0, terr.control - loss);
          const name = TERRITORIES.find(t => t.id === key)?.name || key;
          this.ui.notify(`${s.rival.name} attacked ${name}! Lost ${loss}% control`, 'danger');
          this.ui.addEvent(`${s.rival.name} seized territory in ${name} (-${loss}%)`, 'danger');
        }
        break;
      }
      case 'supplies': {
        const stolen = Math.floor(s.resources.supplies * 0.2);
        s.resources.supplies = Math.max(0, s.resources.supplies - stolen);
        this.ui.notify(`${s.rival.name} hijacked a supply run! Lost ${stolen} supplies`, 'danger');
        this.ui.addEvent(`${s.rival.name} stole ${stolen} supplies`, 'danger');
        break;
      }
    }
  }

  attackRival() {
    const s = this.state;
    if (!s.rival) return false;

    // Cost to strike: scales with rival power
    const cost = Math.floor(1000 + s.rival.power * 200);
    const influenceCost = Math.floor(2 + s.rival.power * 0.1);

    if (s.resources.dirtyMoney < cost || s.resources.influence < influenceCost) {
      this.ui.notify(`Need $${this.formatNum(cost)} and ${influenceCost} influence to attack!`, 'danger');
      return false;
    }

    s.resources.dirtyMoney -= cost;
    s.resources.influence -= influenceCost;
    s.resources.heat += 5;

    // Crew power affects success
    const crewPower = s.crew.reduce((sum, c) => sum + c.level * (c.loyalty / 100), 0);
    const bruiserBonus = this.getTraitBonus('bruiser') * 3;
    const damage = 10 + Math.floor((crewPower + bruiserBonus) * 0.5) + Math.floor(Math.random() * 10);

    s.rival.power = Math.max(0, s.rival.power - damage);

    if (s.rival.power <= 0) {
      // Rival defeated!
      s.rival.defeated++;
      s.stats.totalRivalsDefeated = (s.stats.totalRivalsDefeated || 0) + 1;
      const oldName = s.rival.name;
      const bonus = 5000 * (1 + s.rival.defeated);
      s.resources.dirtyMoney += bonus;
      s.resources.influence += 10;

      this.ui.notify(`${oldName} DESTROYED! +$${this.formatNum(bonus)} +10 influence!`, 'unlock');
      this.ui.addEvent(`Defeated ${oldName}! Spoils collected.`, 'unlock');

      // Spawn new rival with higher base power
      const availableNames = RIVAL_NAMES.filter(n => n !== oldName);
      s.rival.name = availableNames[Math.floor(Math.random() * availableNames.length)];
      s.rival.power = 10 + s.rival.defeated * 15;
      s.rival.aggression = 0.2 + s.rival.defeated * 0.1;
      s.rival.truceTicks = 30;
    } else {
      this.ui.notify(`Strike against ${s.rival.name}! Dealt ${damage} damage. Power: ${Math.floor(s.rival.power)}`, 'success');
      this.ui.addEvent(`Attacked ${s.rival.name}: -${damage} power`, 'info');
    }

    return true;
  }

  // ===== DILEMMA SYSTEM =====

  processDilemmas() {
    const s = this.state;
    // Don't trigger if one is already active
    if (s.dilemma) return;
    // Cooldown: only check once per 60 ticks
    if (s.tickCount % 60 !== 0) return;

    for (const dilemma of DILEMMAS) {
      if (!dilemma.condition(s)) continue;
      if (Math.random() > dilemma.chance * 3) continue; // Boosted since we check less often

      // Trigger dilemma
      s.dilemma = { id: dilemma.id };
      s.stats.totalDilemmasFaced = (s.stats.totalDilemmasFaced || 0) + 1;
      this.ui.showDilemma(dilemma);
      break;
    }
  }

  resolveDilemma(choiceIndex) {
    const s = this.state;
    if (!s.dilemma) return;

    const dilemma = DILEMMAS.find(d => d.id === s.dilemma.id);
    if (!dilemma || choiceIndex < 0 || choiceIndex >= dilemma.choices.length) return;

    const choice = dilemma.choices[choiceIndex];
    const result = choice.effect(s);

    this.ui.notify(result.msg, result.type === 'success' ? 'success' : result.type === 'danger' ? 'danger' : 'info');
    this.ui.addEvent(`${dilemma.name}: ${result.msg}`, result.type);

    s.dilemma = null;
    this.ui.hideDilemma();
  }

  // ===== RANK =====

  getCurrentRank() {
    const level = this.state.level;
    let current = RANKS[0];
    for (const rank of RANKS) {
      if (level >= rank.level) current = rank;
    }
    return current;
  }

  // ===== PRESTIGE =====

  canPrestige() {
    return this.state.level >= 25 && this.state.resources.cleanMoney >= 1000000;
  }

  performPrestige() {
    const s = this.state;
    if (!this.canPrestige()) return false;

    const newPrestigeCount = s.prestige.count + 1;
    const totalClean = (s.prestige.totalCleanLifetime || 0) + s.stats.totalCleanEarned;

    // Reset state but keep prestige data
    const rivalDefeated = s.rival?.defeated || 0;
    const fresh = {};
    Object.assign(fresh, JSON.parse(JSON.stringify(s)));

    // Reset resources
    s.resources = { ...CONFIG.STARTING_RESOURCES };
    s.level = 1;
    s.xp = 0;
    s.xpToNext = CONFIG.BASE_XP_PER_LEVEL;
    s.operations = { unlocked: ['street_dealing'], running: [], autoEnabled: {}, completions: {} };
    s.territories = {};
    s.crew = [];
    s.upgrades = {};
    s.laundering = { rate: 0, fronts: [] };
    s.marketBoomTicks = 0;
    s.crewBoostTicks = 0;
    s.crewIdCounter = 0;
    s.crewCandidates = [];
    s.dilemma = null;

    // Keep prestige + rival (rival power carries)
    s.prestige = { count: newPrestigeCount, totalCleanLifetime: totalClean };
    s.rival = { ...fresh.rival, defeated: rivalDefeated };

    // Reset stats (but keep lifetime ones)
    s.stats = {
      totalDirtyEarned: 0, totalCleanEarned: 0, totalOperations: 0,
      totalCrewHired: 0, totalHeatGained: 0, totalEventsTriggered: 0,
      totalDilemmasFaced: 0, totalRivalsDefeated: rivalDefeated,
      totalMaintenancePaid: 0, playTimeTicks: 0, highestLevel: 1,
    };

    this.ui.notify(`PRESTIGE ${newPrestigeCount}! +${newPrestigeCount * 10}% all income & XP permanently!`, 'unlock');
    this.ui.addEvent(`Went legitimate! Prestige Level ${newPrestigeCount}`, 'unlock');
    return true;
  }

  // ===== UTILITIES =====

  formatNum(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.floor(n).toString();
  }

  formatMoney(n) {
    return '$' + this.formatNum(n);
  }

  formatTime(seconds) {
    if (seconds >= 3600) {
      return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
    }
    if (seconds >= 60) {
      return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
    }
    return seconds + 's';
  }
}
