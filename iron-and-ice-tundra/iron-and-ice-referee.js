const X0 = 18;
const X1 = 110;
const Y0 = 15;
const Y1 = 102;
const STEP = 12;
const COLORS = {B: 'blue', R: 'red', N: null, P: 'purple'};
const MAP = [
    'RPRNNBPB',
    'PPPNNPPP',
    'RPRNNBPB',
    'RPPNNPPB',
    'RPRNNBPB',
    'PPPNNPPP',
    'RPRNNBPB'
    ];
const SPAWNS = [
    Vector(50, 15),
    Vector(58, 39),
    Vector(58, 63),
    Vector(50, 87),
    ];
    
const WAVE_INTERVAL = 0.5;
const WAVE_CHANGE_INTERVAL = 12;

const TIERS = [
    ['munchkin'],
    ['ogre', 'orb', 'thrower'],
    ['troll', 'bird', 'shaman'],
    ['brawler', 'rider', 'warlock'],
    ['elemental'],
    ];

const WAVES = [
    [['orb']],
    [['munchkin', 'ogre', 'munchkin'], ['munchkin', 'thrower'], ['munchkin', 'orb']],
    [['munchkin', 'ogre', 'thrower'], ['munchkin', 'ogre', 'ogre'], ['munchkin', 'thrower', 'thrower']],
    [['thrower', 'orb', 'orb'], ['orb', 'ogre', 'orb'], ['orb', 'orb', 'orb']],
    [['thrower', 'thrower', 'troll'], ['ogre', 'thrower', 'shaman'], ['bird', 'ogre', 'orb'], ['shaman', 'thrower', 'thrower'], ['ogre', 'ogre', 'troll'], ['ogre', 'bird', 'thrower']],
    [['troll', 'thrower', 'troll'], ['shaman', 'thrower', 'shaman'], ['troll', 'ogre', 'troll'], ['bird', 'shaman', 'orb'], ['shaman', 'ogre', 'troll'], ['shaman', 'bird', 'ogre']],
    [['troll', 'troll', 'troll'], ['shaman', 'shaman', 'shaman'], ['troll', 'shaman', 'troll'], ['shaman', 'shaman', 'troll']],
    [['bird', 'bird', 'troll'], ['bird', 'shaman', 'bird'], ['bird', 'bird', 'bird']],
    [
        ['brawler', 'troll', 'troll'], ['brawler', 'shaman', 'shaman'], ['brawler', 'troll', 'shaman'], 
        ['rider', 'troll', 'troll'], ['rider', 'shaman', 'shaman'], ['rider', 'troll', 'shaman'],
        ['warlock', 'troll', 'troll'], ['warlock', 'shaman', 'shaman'], ['warlock', 'troll', 'shaman']
        ],
    [
        ['brawler', 'bird', 'troll'], ['brawler', 'bird', 'shaman'], ['brawler', 'bird', 'bird'], 
        ['rider', 'bird', 'troll'], ['rider', 'bird', 'shaman'], ['rider', 'bird', 'bird'],
        ['warlock', 'bird', 'troll'], ['warlock', 'bird', 'shaman'], ['warlock', 'bird', 'bird']
        ],
    [
        ['brawler', 'troll', 'brawler'], ['brawler', 'shaman', 'brawler'], ['brawler', 'bird', 'brawler'], 
        ['rider', 'troll', 'rider'], ['rider', 'shaman', 'rider'], ['rider', 'bird', 'rider'], 
        ['warlock', 'troll', 'warlock'], ['warlock', 'shaman', 'warlock'], ['warlock', 'bird', 'warlock'], 
        ],
    [
        ['brawler', 'brawler', 'brawler'], ['brawler', 'warlock', 'brawler'], ['brawler', 'rider', 'brawler'], 
        ['warlock', 'warlock', 'warlock'], ['warlock', 'brawler', 'warlock'], ['warlock', 'rider', 'warlock'], 
        ],
    [
        ['rider', 'rider', 'brawler'], ['rider', 'rider', 'warlock'], ['rider', 'rider', 'rider'], 
        ],
    [
        ['brawler', 'brawler', 'elemental'], ['brawler', 'warlock', 'elemental'], ['brawler', 'rider', 'elemental'],  ['warlock', 'rider', 'elemental'] 
        ],
    [
        ['rider', 'rider', 'elemental']
        ],
    [['elemental', 'elemental', 'elemental']],
    [['elemental', 'elemental', 'elemental']],
    [['elemental', 'elemental', 'elemental']],
    [['elemental', 'elemental', 'elemental']]
    ];

({ 
    setUpLevel(){
        this.setupField();
        this.setupHeroes();
        // this.world.getThangByID('Shell').blastRadius = this.towerParameters.cannon.blastRadius;
        this.monsters = [];
        this.setWaves();
        this.anomalies = [];
    }, 
    
    setupHeroes() {
        this.inventory = this.world.getSystem('Inventory');
        this.movement = this.world.getSystem('Movement');
        this.heroes = [this.hero, this.hero2];
        for (let h of this.heroes) {
            h._takeDamage = h.takeDamage;
            h.takeDamage = (damage, who) => {
                if (who.isTower) return;
                if (who.attackRange > 20) {
                    who.die();
                }
                else {
                    who.markedDead = true;
                    this.setTimeout(() => who.die(), 0.5);
                }
                h._takeDamage(damage, who);
            };
            h._ref = this;
            h.health = h.maxHealth = this.heroParameters.maxHealth;
            h.keepTrackedProperty('health');
            h.keepTrackedProperty('maxHealth');
            h._mana = this.heroParameters.manaStart;
            h._manaIncome = this.heroParameters.manaIncome * this.world.dt;
            h._manaMax = this.heroParameters.manaMax;
            h.manaUI = this.world.getThangByID(`${h.color}-mana`);
        }
        if (this.DEBUG_MODE) {
            this.hero.esper_enemyDebug = (fn) => {
                this.hero2.didTriggerSpawnEvent = true;
                this.hero2._aetherAPIOwnMethodsAllowed = 1;
                this.hero2.on('spawn', fn);
            };
        }
    },
    
    setupField() {
        this.tiles = [];
        for (let r = 0; r < MAP.length; r++) {
            for (let c = 0; c < MAP[r].length; c++) {
                let symb = MAP[r][c];
                if (symb == 'N') continue;
                let tile = this.instabuild(`${symb}tile`, X0 + c * STEP, Y0 + r * STEP, `${symb}tile`);
                this.tiles.push(tile);
                tile.color = COLORS[symb];
            }
        }
        this.spawnPoints = [];
        for (let p of SPAWNS) {
            const spawnPoint = this.instabuild('spawn', p.x, p.y);
            this.instabuild('spawn', 120 - p.x, p.y);
            this.spawnPoints.push(spawnPoint);
        }
    },
    
    shuffleTiers() {
        for (let i = 0; i < 10; i++) {
            for (let ti = 0; ti < TIERS.length; ti++) {
                TIERS[ti] = this.world.rand.shuffle(TIERS[ti]);
            }
        }
    },
    
    setWaves() {
        this.waves = [];
        for (let options of WAVES) {
            let wave = [];
            for (let i = 0; i < 10; i++) {
                this.world.rand.shuffle(options);
            }
            // for (let t = 0; t < tiersInWave.length; t++) {
            //     let unitTier = tiersInWave[t];
            //     let tier = TIERS[unitTier];
            //     // wave.push(tier[t % tier.length]);
            //     wave.push(this.world.rand.choice(tier));
                
            // }
            this.waves.push(options[0].slice());
        }
        Object.defineProperty(this, 'waveNumber', {
            get: function() {
                return this.waveChangeCounter;
            }
        });
    },
    
    getPointCoordinates(symb) {
        const point = this.points[symb];
        return point;
    },
    
    onFirstFrame(){
        for (let th of this.world.thangs) {
            if (th.pos.y < 0 && th.health) {
                th.setExists(false);
            }
        }
        
        this.waveChangeCounter = -1;
        this.changeWave();
        this.setInterval(this.changeWave.bind(this), WAVE_CHANGE_INTERVAL);
        this.spawnWave();
        this.setInterval(this.spawnWave.bind(this), WAVE_INTERVAL);
    },
    
    changeWave() {
        this.waveChangeCounter++;
        this.wave = this.waves[this.waveChangeCounter];
        if (!this.wave) {
            this.waveChangeCounter -= 2;
            return this.changeWave();
        }
        this.waveCounter = 0;
        this.maxWaveCounter = this.wave.length;
    },
    getWaves() {
        return this.waves.map((w) => w.slice());
    },
    
    spawnWave() {
        let monster = this.wave[this.waveCounter];
        this.waveCounter = (this.waveCounter + 1) % this.maxWaveCounter;
        for (let p of this.spawnPoints) {
            let dy = this.world.rand.rand2(1, 11) - 5;
            this.setupMonster(this.instabuild(monster, p.pos.x, p.pos.y + dy), monster);
            this.setupMonster(this.instabuild(monster, 120 - p.pos.x, p.pos.y + dy), monster);
        }
    },
    
    setupMonster(monster, type) {
        const params = this.monsterParameters[type];
        monster.startsPeaceful = true;
        monster.health = monster.maxHealth = params.maxHealth;
        monster.keepTrackedProperty('health');
        monster.keepTrackedProperty('maxHealth');
        monster.maxSpeed = params.maxSpeed;
        monster.attackDamage = params.attackDamage;
        monster.attackRange = params.attackRange || monster.attackRange;
        monster.flying = params.flying;
        monster.cost = params.cost;
        monster.mass = Math.pow(params.maxHealth / 10, 0.33) * 10;
        monster.appendMethod('die', () => {
            if (monster.killer && monster.killer.owner) {
                monster.killer.owner._mana += monster.cost;
            }
        });
        monster.chooseAction = this.monster_chooseAction.bind(monster);
        monster.bases = this.heroes;
        this.monsters.push(monster);
    },
    
    // this is a monster
    monster_chooseAction() {
        
        if (this.markedDead || (this.stunTime  && this.stunTime >= this.world.age)) {
            this.setTarget(null);
            this.setTargetPos(null);
            this.setAction('idle');
            this.brake();
            return;
        }
        let en = this.bases[+(this.pos.x > 60)];
        if (this.target != en) {
            this.attack(en);
        }
        
    },
    // chooseAction(){}, 
    checkVictory(){
        if (this.hero.dead || this.hero2.dead) {
            this.world.endWorld(true, 0.5);
        }
    },
    
    
    getTile(x, y, who) {
        const pos = new Vector(x, y);
        for (let tile of this.tiles) {
            if (tile.getShape().containsPoint(pos)) {
                return tile;
            }
        }
    },
    
    update() {
        for (let anomaly of this.anomalies) {
            anomaly.duration -= this.world.dt;
        }
        this.anomalies = this.anomalies.filter((a) => a.duration > 0);
        for (let h of this.heroes) {
            h._mana += h._manaIncome;
            h._mana = Math.min(h._manaMax, h._mana);
            h.manaUI.scaleFactorY = Math.max(1.5 * h._mana / h._manaMax, 0.01);
            h.manaUI.keepTrackedProperty('scaleFactorY');
        }
    },
    
    chooseAction() {
        this.monsters = this.monsters.filter(m => m.exists && !m.dead && !m.markedDead);
        if (this.gameEnd) {
            if (this.blueWin) {
                this.hero2.health = Math.max(1, this.hero2.health);
                this.hero2.keepTrackedProperty('health');
                this.hero2.setAction('idle');
            }
            if (this.redWin) {
                this.hero.health = Math.max(1, this.hero.health);
                this.hero.keepTrackedProperty('health');
                this.hero.setAction('idle');
            }
            return; 
        };
        if (this.hero.health <= 0 && this.hero2.health <= 0) {
            let flip = this.world.rand.randf() > 0.5;
            if (this.hero2.health < this.hero.health) {
                flip = 1;
            }
            if (this.hero2.health > this.hero.health) {
                flip = 0;
            }
            if (flip) {
                this.hero.health = 1;
                this.hero.keepTrackedProperty('health');
            }
            else {
                this.hero2.health = 1;
                this.hero2.keepTrackedProperty('health');
            }
        }
        if (this.hero.health <= 0) {
            this.world.setGoalState('blue-win', 'success');
            this.world.setGoalState('red-win', 'failure');
            this.gameEnd = true;
            this.blueWin = true;
            this.hero.realDead = true;
        }
        else if (this.hero2.health <= 0) {
            this.world.setGoalState('blue-win', 'failure');
            this.world.setGoalState('red-win', 'success');
            this.gameEnd = true;
            this.redWin = true;
            this.hero.realDead = true;
        }
    }
    
});