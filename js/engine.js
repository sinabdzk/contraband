// ===== GAME ENGINE - Core game loop and all systems =====
import { CONFIG, OPERATIONS, TERRITORIES, CREW_TYPES, CREW_FIRST_NAMES, CREW_LAST_NAMES, UPGRADES, FRONTS, EVENTS } from './data.js';
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

    // Timed buffs
    if (s.marketBoomTicks > 0) s.marketBoomTicks--;
    if (s.crewBoostTicks > 0) s.crewBoostTicks--;

    // Events
    this.processEvents();

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
    return Math.max(1, Math.floor(opData.duration * (1 - speedBonus) * boostMultiplier));
  }

  getOpReward(opData) {
    const incomeBonus = 1 + this.getAllBonus('incomeMultiplier');
    const boomMultiplier = this.state.marketBoomTicks > 0 ? 2.0 : 1.0;

    // Category-specific bonuses
    let categoryBonus = 1;
    if (opData.category === 'Drugs') categoryBonus += this.getAllBonus('drugBonus');
    if (opData.category === 'Cyber') categoryBonus += this.getAllBonus('cyberBonus');

    const reward = {};
    for (const [res, amount] of Object.entries(opData.reward)) {
      if (res === 'dirtyMoney' || res === 'cleanMoney') {
        reward[res] = Math.floor(amount * incomeBonus * boomMultiplier * categoryBonus);
      } else {
        reward[res] = amount;
      }
    }
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
    return Math.max(0, Math.floor(opData.heatGain * Math.max(0.1, heatReduction)));
  }

  getOpXP(opData) {
    const xpBonus = 1 + this.getAllBonus('xpGain') + this.getAllBonus('crewXPBonus');
    return Math.floor(opData.xp * xpBonus);
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
    return Math.floor(base * Math.pow(CONFIG.RECRUIT_COST_GROWTH, count) * Math.max(0.3, discount));
  }

  // ===== ACTIONS =====

  startOperation(opId) {
    const s = this.state;
    const opData = OPERATIONS.find(o => o.id === opId);
    if (!opData) return false;
    if (!s.operations.unlocked.includes(opId)) return false;

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

    spendResources(s, cost);
    const duration = this.getOpDuration(opData);
    s.operations.running.push({
      id: opId,
      startTick: s.tickCount,
      duration: duration,
    });
    return true;
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
      this.completeOperation(run.id);
    }
  }

  completeOperation(opId) {
    const s = this.state;
    const opData = OPERATIONS.find(o => o.id === opId);
    if (!opData) return;

    const reward = this.getOpReward(opData);
    const heat = this.getOpHeat(opData);
    const xp = this.getOpXP(opData);

    // Apply rewards
    for (const [res, amount] of Object.entries(reward)) {
      s.resources[res] = (s.resources[res] || 0) + amount;
      if (res === 'dirtyMoney') s.stats.totalDirtyEarned += amount;
      if (res === 'cleanMoney') s.stats.totalCleanEarned += amount;
    }

    // Apply heat
    s.resources.heat = Math.min(CONFIG.MAX_HEAT, s.resources.heat + heat);
    s.stats.totalHeatGained += heat;

    // Floating number particles
    this.ui.spawnRewardFloats(reward, xp);
    this.ui.flashOpComplete(opId);

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
    s.operations.completions[opId] = (s.operations.completions[opId] || 0) + 1;
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
      // Don't auto-start if already running
      if (s.operations.running.some(r => r.id === opId)) continue;
      // Check if we have room
      if (s.operations.running.length >= this.getMaxSimultaneousOps()) continue;

      const cost = this.getOpCost(opData);
      if (canAfford(s, cost)) {
        this.startOperation(opId);
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
    s.operations.autoEnabled[opId] = !s.operations.autoEnabled[opId];
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
    const speedBonus = 1 + this.getAllBonus('territorySpeed') + this.getAllBonus('territoryControl');

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

  recruitCrew() {
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
      // Loyalty decay
      const loyaltyDecayReduction = 1 - this.getUpgradeEffect('loyaltyDecay');
      member.loyalty = Math.max(10, member.loyalty - 0.02 * loyaltyDecayReduction);
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
    // From running operations (estimate)
    for (const run of this.state.operations.running) {
      const opData = OPERATIONS.find(o => o.id === run.id);
      if (opData) {
        const reward = this.getOpReward(opData);
        const duration = this.getOpDuration(opData);
        rate += (reward.dirtyMoney || 0) / duration;
      }
    }
    // Passive income
    rate += this.getUpgradeEffect('passiveIncome') * (1 + this.getAllBonus('incomeMultiplier'));
    // Subtract laundering
    rate -= this.state.laundering.rate;
    return rate;
  }

  getCleanIncomeRate() {
    let rate = 0;
    rate += this.state.laundering.rate * this.getLaunderEfficiency();
    return rate;
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
