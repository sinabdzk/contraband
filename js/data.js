// ===== GAME DATA - All configuration, definitions, and constants =====

export const CONFIG = {
  TICK_MS: 1000,
  AUTO_SAVE_INTERVAL: 30,
  MAX_EVENT_LOG: 60,
  MAX_NOTIFICATIONS: 5,
  BASE_XP_PER_LEVEL: 100,
  XP_GROWTH_FACTOR: 1.35,
  HEAT_DECAY_PER_TICK: 0.15,
  HEAT_RAID_THRESHOLD: 80,
  HEAT_RAID_CHANCE: 0.03,
  MAX_HEAT: 100,
  BASE_LAUNDER_EFFICIENCY: 0.70,
  RECRUIT_BASE_COST: 500,
  RECRUIT_COST_GROWTH: 1.3,
  MAX_CREW_BASE: 5,
  STARTING_RESOURCES: {
    dirtyMoney: 500,
    cleanMoney: 0,
    influence: 0,
    heat: 0,
    supplies: 10,
  },
};

export const OPERATIONS = [
  {
    id: 'street_dealing',
    name: 'Street Dealing',
    desc: 'Small-time drug deals on the corner. Low risk, quick money.',
    category: 'Drugs',
    unlockCost: 0,
    levelReq: 1,
    cost: { supplies: 2 },
    duration: 5,
    reward: { dirtyMoney: 150 },
    heatGain: 2,
    xp: 10,
    autoCapable: true,
  },
  {
    id: 'pickpocketing',
    name: 'Pickpocketing Ring',
    desc: 'Organize skilled pickpockets in tourist areas.',
    category: 'Theft',
    unlockCost: 800,
    levelReq: 2,
    cost: { dirtyMoney: 50 },
    duration: 8,
    reward: { dirtyMoney: 280, supplies: 1 },
    heatGain: 1,
    xp: 15,
    autoCapable: true,
  },
  {
    id: 'burglary',
    name: 'Burglary Crew',
    desc: 'Hit houses and businesses while owners sleep.',
    category: 'Theft',
    unlockCost: 2500,
    levelReq: 3,
    cost: { dirtyMoney: 200 },
    duration: 15,
    reward: { dirtyMoney: 950, supplies: 3 },
    heatGain: 5,
    xp: 30,
    autoCapable: true,
  },
  {
    id: 'protection_racket',
    name: 'Protection Racket',
    desc: 'Charge local businesses for "protection" services.',
    category: 'Extortion',
    unlockCost: 6000,
    levelReq: 5,
    cost: { dirtyMoney: 100, influence: 2 },
    duration: 20,
    reward: { dirtyMoney: 1500, influence: 1 },
    heatGain: 3,
    xp: 40,
    autoCapable: true,
  },
  {
    id: 'drug_lab',
    name: 'Drug Lab',
    desc: 'Set up a clandestine lab to cook product. Big money, big heat.',
    category: 'Drugs',
    unlockCost: 18000,
    levelReq: 7,
    cost: { dirtyMoney: 600, supplies: 8 },
    duration: 25,
    reward: { dirtyMoney: 4500, supplies: 2 },
    heatGain: 8,
    xp: 65,
    autoCapable: true,
  },
  {
    id: 'chop_shop',
    name: 'Chop Shop',
    desc: 'Steal cars, strip them down, sell the parts.',
    category: 'Theft',
    unlockCost: 40000,
    levelReq: 9,
    cost: { dirtyMoney: 900 },
    duration: 30,
    reward: { dirtyMoney: 8000, supplies: 5 },
    heatGain: 6,
    xp: 85,
    autoCapable: true,
  },
  {
    id: 'counterfeiting',
    name: 'Counterfeiting',
    desc: 'Print fake bills. Slow but high volume income.',
    category: 'Fraud',
    unlockCost: 90000,
    levelReq: 12,
    cost: { dirtyMoney: 3000, supplies: 10 },
    duration: 40,
    reward: { dirtyMoney: 20000 },
    heatGain: 10,
    xp: 120,
    autoCapable: true,
  },
  {
    id: 'arms_trafficking',
    name: 'Arms Trafficking',
    desc: 'Move military-grade weapons across borders. Extremely dangerous.',
    category: 'Trafficking',
    unlockCost: 250000,
    levelReq: 15,
    cost: { dirtyMoney: 12000, supplies: 15 },
    duration: 50,
    reward: { dirtyMoney: 60000, influence: 5 },
    heatGain: 18,
    xp: 200,
    autoCapable: true,
  },
  {
    id: 'cybercrime',
    name: 'Cyber Crime Unit',
    desc: 'Hack banks and corporations. Clean, quiet, deadly profitable.',
    category: 'Cyber',
    unlockCost: 600000,
    levelReq: 18,
    cost: { dirtyMoney: 8000 },
    duration: 25,
    reward: { dirtyMoney: 45000, cleanMoney: 5000 },
    heatGain: 3,
    xp: 180,
    autoCapable: true,
  },
  {
    id: 'casino_heist',
    name: 'Casino Heist',
    desc: 'Plan and execute a daring casino robbery. One big score.',
    category: 'Heist',
    unlockCost: 1500000,
    levelReq: 22,
    cost: { dirtyMoney: 50000, supplies: 20, influence: 10 },
    duration: 90,
    reward: { dirtyMoney: 350000, influence: 15 },
    heatGain: 25,
    xp: 500,
    autoCapable: false,
  },
  {
    id: 'import_export',
    name: 'Import / Export',
    desc: 'International smuggling network. Massive scale operations.',
    category: 'Trafficking',
    unlockCost: 4000000,
    levelReq: 25,
    cost: { dirtyMoney: 80000, supplies: 30, influence: 15 },
    duration: 120,
    reward: { dirtyMoney: 500000, supplies: 20, influence: 10 },
    heatGain: 20,
    xp: 800,
    autoCapable: true,
  },
  {
    id: 'financial_fraud',
    name: 'Financial Fraud',
    desc: 'Insider trading, Ponzi schemes, money flows like water.',
    category: 'Fraud',
    unlockCost: 12000000,
    levelReq: 30,
    cost: { cleanMoney: 200000, influence: 30 },
    duration: 180,
    reward: { dirtyMoney: 1500000, cleanMoney: 500000, influence: 25 },
    heatGain: 15,
    xp: 1500,
    autoCapable: true,
  },
];

export const TERRITORIES = [
  {
    id: 'slums',
    name: 'The Slums',
    desc: 'Run-down apartments and back alleys. Easy to control.',
    difficulty: 'easy',
    costToExpand: { dirtyMoney: 2000, influence: 3 },
    bonuses: { incomeMultiplier: 0.05, supplyDiscount: 0.05 },
    bonusText: ['+5% Income', '-5% Supply Cost'],
    controlRate: 2.0,
    levelReq: 2,
  },
  {
    id: 'docklands',
    name: 'Docklands',
    desc: 'The port area. Perfect for smuggling operations.',
    difficulty: 'easy',
    costToExpand: { dirtyMoney: 5000, influence: 5 },
    bonuses: { supplyDiscount: 0.15, smugglingSpeed: 0.10 },
    bonusText: ['-15% Supply Cost', '+10% Op Speed'],
    controlRate: 1.5,
    levelReq: 4,
  },
  {
    id: 'chinatown',
    name: 'Chinatown',
    desc: 'Dense neighborhood with strong community. Good for fronts.',
    difficulty: 'medium',
    costToExpand: { dirtyMoney: 12000, influence: 10 },
    bonuses: { launderEfficiency: 0.10, incomeMultiplier: 0.08 },
    bonusText: ['+10% Launder Eff.', '+8% Income'],
    controlRate: 1.0,
    levelReq: 6,
  },
  {
    id: 'red_light',
    name: 'Red Light District',
    desc: 'Entertainment district. Great for crew recruitment.',
    difficulty: 'medium',
    costToExpand: { dirtyMoney: 20000, influence: 12 },
    bonuses: { recruitCostReduction: 0.20, crewXPBonus: 0.10 },
    bonusText: ['-20% Recruit Cost', '+10% Crew XP'],
    controlRate: 1.0,
    levelReq: 8,
  },
  {
    id: 'industrial',
    name: 'Industrial Zone',
    desc: 'Warehouses and factories. Ideal for production ops.',
    difficulty: 'medium',
    costToExpand: { dirtyMoney: 35000, influence: 18 },
    bonuses: { productionSpeed: 0.15, supplyDiscount: 0.10 },
    bonusText: ['+15% Production', '-10% Supply Cost'],
    controlRate: 0.8,
    levelReq: 10,
  },
  {
    id: 'downtown',
    name: 'Downtown',
    desc: 'The heart of the city. High value, high competition.',
    difficulty: 'hard',
    costToExpand: { dirtyMoney: 80000, influence: 30 },
    bonuses: { incomeMultiplier: 0.20, influenceGain: 0.15 },
    bonusText: ['+20% Income', '+15% Influence'],
    controlRate: 0.5,
    levelReq: 14,
  },
  {
    id: 'tech_district',
    name: 'Tech District',
    desc: 'Silicon hub. Cyber operations thrive here.',
    difficulty: 'hard',
    costToExpand: { dirtyMoney: 150000, influence: 40 },
    bonuses: { cyberBonus: 0.25, heatReduction: 0.10 },
    bonusText: ['+25% Cyber Ops', '-10% Heat Gain'],
    controlRate: 0.4,
    levelReq: 17,
  },
  {
    id: 'financial_district',
    name: 'Financial District',
    desc: 'Banks and corporations. Laundering heaven.',
    difficulty: 'hard',
    costToExpand: { dirtyMoney: 400000, influence: 60 },
    bonuses: { launderEfficiency: 0.25, cleanMoneyBonus: 0.15 },
    bonusText: ['+25% Launder Eff.', '+15% Clean Money'],
    controlRate: 0.3,
    levelReq: 20,
  },
  {
    id: 'uptown',
    name: 'Uptown',
    desc: 'Wealthy neighborhoods. Massive income potential.',
    difficulty: 'extreme',
    costToExpand: { dirtyMoney: 1000000, influence: 100 },
    bonuses: { incomeMultiplier: 0.35, influenceGain: 0.20 },
    bonusText: ['+35% Income', '+20% Influence'],
    controlRate: 0.2,
    levelReq: 24,
  },
  {
    id: 'city_hall',
    name: 'City Hall',
    desc: 'Political power. Control the city from the inside.',
    difficulty: 'extreme',
    costToExpand: { dirtyMoney: 3000000, influence: 200, cleanMoney: 1000000 },
    bonuses: { heatReduction: 0.30, incomeMultiplier: 0.25, influenceGain: 0.30 },
    bonusText: ['-30% Heat', '+25% Income', '+30% Influence'],
    controlRate: 0.1,
    levelReq: 28,
  },
];

export const CREW_TYPES = [
  { id: 'muscle', name: 'Muscle', color: 'type-muscle', bonus: 'opSpeed', bonusValue: 0.08, desc: '+8% Operation Speed' },
  { id: 'brains', name: 'Brains', color: 'type-brains', bonus: 'xpGain', bonusValue: 0.10, desc: '+10% XP Gain' },
  { id: 'stealth', name: 'Stealth', color: 'type-stealth', bonus: 'heatReduce', bonusValue: 0.06, desc: '-6% Heat Gain' },
  { id: 'driver', name: 'Driver', color: 'type-driver', bonus: 'supplyDiscount', bonusValue: 0.08, desc: '-8% Supply Cost' },
  { id: 'hacker', name: 'Hacker', color: 'type-hacker', bonus: 'cyberBonus', bonusValue: 0.12, desc: '+12% Cyber Income' },
  { id: 'accountant', name: 'Accountant', color: 'type-accountant', bonus: 'launderEff', bonusValue: 0.08, desc: '+8% Launder Efficiency' },
  { id: 'chemist', name: 'Chemist', color: 'type-chemist', bonus: 'drugBonus', bonusValue: 0.12, desc: '+12% Drug Income' },
  { id: 'enforcer', name: 'Enforcer', color: 'type-enforcer', bonus: 'territoryControl', bonusValue: 0.10, desc: '+10% Territory Control' },
];

export const CREW_FIRST_NAMES = [
  'Marco', 'Viktor', 'Nina', 'Carlos', 'Jade', 'Rico', 'Dmitri', 'Isabella',
  'Tyrone', 'Koji', 'Aleksei', 'Sofia', 'Dante', 'Yuki', 'Omar', 'Valentina',
  'Zane', 'Ingrid', 'Phoenix', 'Marcel', 'Katya', 'Hector', 'Mei', 'Rashid',
  'Lena', 'Bruno', 'Sasha', 'Diego', 'Aria', 'Nikolai', 'Camille', 'Joaquin',
];

export const CREW_LAST_NAMES = [
  'Volkov', 'Santos', 'Blackwood', 'Romano', 'Kim', 'Sullivan', 'Petrova',
  'Garcia', 'Tanaka', 'Weber', 'Diaz', 'Cross', 'Mendez', 'Stone', 'Yi',
  'Russo', 'Drake', 'Ortega', 'Novak', 'Chen', 'Moretti', 'Reyes', 'Kovacs',
  'Silva', 'Park', 'Okafor', 'Lindström', 'Torres', 'Ivanov', 'Nakamura',
];

export const UPGRADES = {
  operations: {
    title: 'Operations',
    icon: 'ops',
    items: [
      { id: 'faster_ops', name: 'Efficient Planning', desc: 'Operations complete faster.', effect: 'opSpeed', valuePerLevel: 0.08, maxLevel: 10, baseCost: 1000, costGrowth: 1.8, currency: 'dirtyMoney', levelReq: 1 },
      { id: 'bigger_payouts', name: 'Better Connections', desc: 'Increase operation payouts.', effect: 'incomeMultiplier', valuePerLevel: 0.06, maxLevel: 15, baseCost: 2500, costGrowth: 1.9, currency: 'dirtyMoney', levelReq: 3 },
      { id: 'bulk_supplies', name: 'Bulk Suppliers', desc: 'Reduce supply costs for operations.', effect: 'supplyDiscount', valuePerLevel: 0.05, maxLevel: 10, baseCost: 1500, costGrowth: 1.7, currency: 'dirtyMoney', levelReq: 2 },
      { id: 'multi_ops', name: 'Multi-Threading', desc: 'Run additional simultaneous operations.', effect: 'maxOps', valuePerLevel: 1, maxLevel: 5, baseCost: 10000, costGrowth: 3.0, currency: 'dirtyMoney', levelReq: 5 },
    ],
  },
  crew: {
    title: 'Crew',
    icon: 'crew',
    items: [
      { id: 'crew_capacity', name: 'Extended Network', desc: 'Increase max crew size.', effect: 'maxCrew', valuePerLevel: 2, maxLevel: 10, baseCost: 3000, costGrowth: 2.0, currency: 'dirtyMoney', levelReq: 3 },
      { id: 'crew_training', name: 'Training Program', desc: 'Crew members gain XP faster.', effect: 'crewXP', valuePerLevel: 0.10, maxLevel: 8, baseCost: 5000, costGrowth: 1.8, currency: 'dirtyMoney', levelReq: 5 },
      { id: 'loyalty_program', name: 'Loyalty Bonuses', desc: 'Crew loyalty decreases slower.', effect: 'loyaltyDecay', valuePerLevel: 0.10, maxLevel: 5, baseCost: 8000, costGrowth: 2.0, currency: 'dirtyMoney', levelReq: 7 },
      { id: 'recruit_quality', name: 'Better Recruiting', desc: 'New recruits start with higher stats.', effect: 'recruitQuality', valuePerLevel: 0.12, maxLevel: 8, baseCost: 6000, costGrowth: 1.9, currency: 'dirtyMoney', levelReq: 4 },
    ],
  },
  heat: {
    title: 'Heat Management',
    icon: 'heat',
    items: [
      { id: 'bribe_cops', name: 'Corrupt Officers', desc: 'Reduce heat gain from operations.', effect: 'heatReduction', valuePerLevel: 0.06, maxLevel: 10, baseCost: 4000, costGrowth: 2.0, currency: 'dirtyMoney', levelReq: 3 },
      { id: 'safe_houses', name: 'Safe Houses', desc: 'Heat decays faster over time.', effect: 'heatDecay', valuePerLevel: 0.15, maxLevel: 8, baseCost: 8000, costGrowth: 2.2, currency: 'dirtyMoney', levelReq: 6 },
      { id: 'legal_shield', name: 'Legal Shield', desc: 'Reduce losses from police raids.', effect: 'raidProtection', valuePerLevel: 0.10, maxLevel: 5, baseCost: 25000, costGrowth: 2.5, currency: 'cleanMoney', levelReq: 10 },
      { id: 'evidence_cleanup', name: 'Evidence Cleanup', desc: 'Lower raid chance at high heat levels.', effect: 'raidChanceReduce', valuePerLevel: 0.15, maxLevel: 5, baseCost: 50000, costGrowth: 2.5, currency: 'cleanMoney', levelReq: 14 },
    ],
  },
  laundering: {
    title: 'Laundering',
    icon: 'launder',
    items: [
      { id: 'launder_rate', name: 'Faster Processing', desc: 'Increase laundering throughput.', effect: 'launderRate', valuePerLevel: 100, maxLevel: 20, baseCost: 5000, costGrowth: 1.6, currency: 'dirtyMoney', levelReq: 4 },
      { id: 'launder_eff', name: 'Better Conversion', desc: 'Less money lost during laundering.', effect: 'launderEfficiency', valuePerLevel: 0.02, maxLevel: 12, baseCost: 10000, costGrowth: 2.0, currency: 'dirtyMoney', levelReq: 6 },
      { id: 'auto_launder', name: 'Auto-Laundering', desc: 'Automatically launder at optimal rates.', effect: 'autoLaunder', valuePerLevel: 1, maxLevel: 1, baseCost: 100000, costGrowth: 1, currency: 'cleanMoney', levelReq: 12 },
    ],
  },
  empire: {
    title: 'Empire',
    icon: 'crown',
    items: [
      { id: 'passive_income', name: 'Passive Revenue', desc: 'Earn dirty money passively each second.', effect: 'passiveIncome', valuePerLevel: 50, maxLevel: 20, baseCost: 15000, costGrowth: 1.8, currency: 'dirtyMoney', levelReq: 8 },
      { id: 'influence_gen', name: 'Political Reach', desc: 'Generate influence passively.', effect: 'passiveInfluence', valuePerLevel: 0.2, maxLevel: 15, baseCost: 25000, costGrowth: 2.0, currency: 'cleanMoney', levelReq: 10 },
      { id: 'supply_gen', name: 'Supply Network', desc: 'Generate supplies passively.', effect: 'passiveSupplies', valuePerLevel: 0.5, maxLevel: 10, baseCost: 20000, costGrowth: 2.0, currency: 'dirtyMoney', levelReq: 6 },
      { id: 'territory_speed', name: 'Rapid Expansion', desc: 'Take over territory faster.', effect: 'territorySpeed', valuePerLevel: 0.10, maxLevel: 8, baseCost: 30000, costGrowth: 2.2, currency: 'cleanMoney', levelReq: 12 },
    ],
  },
};

export const FRONTS = [
  { id: 'laundromat', name: 'Laundromat', desc: 'Classic front. Slow but cheap.', cost: { cleanMoney: 5000 }, launderCapacity: 200, efficiency: 0.02, levelReq: 3 },
  { id: 'restaurant', name: 'Restaurant', desc: 'Cash-heavy business, good cover.', cost: { cleanMoney: 15000 }, launderCapacity: 500, efficiency: 0.03, levelReq: 6 },
  { id: 'car_wash', name: 'Car Wash', desc: 'Steady flow of cash transactions.', cost: { cleanMoney: 30000 }, launderCapacity: 800, efficiency: 0.03, levelReq: 9 },
  { id: 'nightclub', name: 'Nightclub', desc: 'High volume, difficult to audit.', cost: { cleanMoney: 80000 }, launderCapacity: 2000, efficiency: 0.05, levelReq: 13 },
  { id: 'real_estate', name: 'Real Estate Firm', desc: 'Major transactions, huge capacity.', cost: { cleanMoney: 250000 }, launderCapacity: 6000, efficiency: 0.05, levelReq: 18 },
  { id: 'crypto_exchange', name: 'Crypto Exchange', desc: 'Digital laundering at scale.', cost: { cleanMoney: 750000 }, launderCapacity: 15000, efficiency: 0.06, levelReq: 22 },
  { id: 'offshore_bank', name: 'Offshore Bank', desc: 'The ultimate money cleaning machine.', cost: { cleanMoney: 3000000 }, launderCapacity: 50000, efficiency: 0.08, levelReq: 27 },
];

export const EVENTS = [
  {
    id: 'police_raid',
    name: 'POLICE RAID',
    desc: 'The cops are kicking down doors! You lose some cash and supplies.',
    type: 'danger',
    condition: (state) => state.resources.heat >= 60,
    chance: 0.04,
    effect: (state) => {
      const raidProtection = 1 - getUpgradeEffect(state, 'raidProtection');
      const moneyLoss = Math.floor(state.resources.dirtyMoney * 0.15 * raidProtection);
      const supplyLoss = Math.floor(state.resources.supplies * 0.20 * raidProtection);
      state.resources.dirtyMoney -= moneyLoss;
      state.resources.supplies -= supplyLoss;
      state.resources.heat = Math.max(0, state.resources.heat - 25);
      return `Lost $${formatNum(moneyLoss)} and ${supplyLoss} supplies. Heat reduced.`;
    },
  },
  {
    id: 'informant',
    name: 'INFORMANT DISCOVERED',
    desc: 'One of your crew is talking to the feds. Heat spikes!',
    type: 'danger',
    condition: (state) => state.crew.length >= 2,
    chance: 0.02,
    effect: (state) => {
      state.resources.heat = Math.min(CONFIG.MAX_HEAT, state.resources.heat + 20);
      return 'Heat increased by 20! Watch your crew.';
    },
  },
  {
    id: 'turf_war',
    name: 'TURF WAR',
    desc: 'A rival gang is contesting your territory!',
    type: 'warning',
    condition: (state) => Object.values(state.territories).some(t => t.control > 30),
    chance: 0.03,
    effect: (state) => {
      const controlled = Object.entries(state.territories).filter(([, t]) => t.control > 20);
      if (controlled.length > 0) {
        const [key, terr] = controlled[Math.floor(Math.random() * controlled.length)];
        const loss = 10 + Math.floor(Math.random() * 15);
        state.territories[key].control = Math.max(0, terr.control - loss);
        const name = TERRITORIES.find(t => t.id === key)?.name || key;
        return `Lost ${loss}% control in ${name}.`;
      }
      return 'No territory affected.';
    },
  },
  {
    id: 'supply_shipment',
    name: 'SUPPLY WINDFALL',
    desc: 'A shipment fell off a truck. Free supplies!',
    type: 'money',
    condition: () => true,
    chance: 0.04,
    effect: (state) => {
      const amount = 5 + Math.floor(state.level * 2);
      state.resources.supplies += amount;
      return `Gained ${amount} supplies!`;
    },
  },
  {
    id: 'market_boom',
    name: 'MARKET BOOM',
    desc: 'Demand is up! Next few operations pay double.',
    type: 'money',
    condition: (state) => state.level >= 3,
    chance: 0.03,
    effect: (state) => {
      state.marketBoomTicks = 30;
      return 'All operation payouts doubled for 30 seconds!';
    },
  },
  {
    id: 'celebrity_client',
    name: 'CELEBRITY CLIENT',
    desc: 'A famous client wants a special delivery. Big payout!',
    type: 'money',
    condition: (state) => state.level >= 5,
    chance: 0.025,
    effect: (state) => {
      const bonus = Math.floor(state.level * 500 + 2000);
      state.resources.dirtyMoney += bonus;
      state.resources.influence += 3;
      return `Earned $${formatNum(bonus)} and 3 influence!`;
    },
  },
  {
    id: 'equipment_bust',
    name: 'EQUIPMENT SEIZED',
    desc: 'Authorities found one of your stashes.',
    type: 'danger',
    condition: (state) => state.resources.heat >= 40,
    chance: 0.03,
    effect: (state) => {
      const loss = Math.floor(state.resources.supplies * 0.3);
      state.resources.supplies = Math.max(0, state.resources.supplies - loss);
      return `Lost ${loss} supplies to seizure.`;
    },
  },
  {
    id: 'political_favor',
    name: 'POLITICAL FAVOR',
    desc: 'A corrupt politician owes you one. Heat drops significantly.',
    type: 'info',
    condition: (state) => state.resources.influence >= 10,
    chance: 0.025,
    effect: (state) => {
      state.resources.heat = Math.max(0, state.resources.heat - 30);
      return 'Heat reduced by 30 thanks to political connections.';
    },
  },
  {
    id: 'rival_offer',
    name: 'RIVAL PROPOSITION',
    desc: 'A rival boss offers a one-time trade deal.',
    type: 'info',
    condition: (state) => state.level >= 8,
    chance: 0.02,
    effect: (state) => {
      const cash = Math.floor(state.level * 1000);
      state.resources.dirtyMoney += cash;
      state.resources.heat += 5;
      return `Gained $${formatNum(cash)} from the deal. Heat +5.`;
    },
  },
  {
    id: 'crew_bonus',
    name: 'CREW MORALE BOOST',
    desc: 'Your crew is inspired. Everyone works harder!',
    type: 'info',
    condition: (state) => state.crew.length >= 1,
    chance: 0.03,
    effect: (state) => {
      state.crew.forEach(c => { c.loyalty = Math.min(100, c.loyalty + 10); });
      state.crewBoostTicks = 20;
      return 'All crew loyalty +10. Operations 25% faster for 20s!';
    },
  },
  {
    id: 'tax_investigation',
    name: 'TAX INVESTIGATION',
    desc: 'The IRS is sniffing around your finances.',
    type: 'warning',
    condition: (state) => state.resources.cleanMoney >= 10000,
    chance: 0.02,
    effect: (state) => {
      const loss = Math.floor(state.resources.cleanMoney * 0.10);
      state.resources.cleanMoney -= loss;
      state.resources.heat += 10;
      return `Lost $${formatNum(loss)} clean money. Heat +10.`;
    },
  },
  {
    id: 'black_market',
    name: 'BLACK MARKET ACCESS',
    desc: 'Special bulk deals on supplies!',
    type: 'money',
    condition: (state) => state.level >= 4,
    chance: 0.03,
    effect: (state) => {
      const amount = 10 + Math.floor(state.level * 3);
      const cost = Math.floor(amount * 20);
      if (state.resources.dirtyMoney >= cost) {
        state.resources.dirtyMoney -= cost;
        state.resources.supplies += amount;
        return `Bought ${amount} supplies for $${formatNum(cost)}!`;
      }
      return 'Not enough cash for the deal.';
    },
  },
];

// Helper used in events
function getUpgradeEffect(state, effectName) {
  for (const cat of Object.values(UPGRADES)) {
    for (const item of cat.items) {
      if (item.effect === effectName) {
        const level = state.upgrades[item.id] || 0;
        return level * item.valuePerLevel;
      }
    }
  }
  return 0;
}

function formatNum(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}
