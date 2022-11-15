const INIT_MAP = [
    ['G2', 'T2', 'E1', 'T1', 'E0', '00'],
    ['T1', 'E0', 'G1', 'E1', 'G0', 'T0'],
    ['E1', 'E0', 'E2', 'E2', 'E0', 'E0'],
    ['T0', 'G0', 'E1', 'G1', 'E0', 'T1'],
    ['00', 'E0', 'T1', 'E1', 'T2', 'G2'],
];

const TREASURE = 'treasure';
const GLORY = 'glory';
const MONSTER = 'monster';

const LEGEND = {
    'T': TREASURE,
    'G': GLORY,
    'E': MONSTER,
};


({
    setUpLevel () {
        this.buildMap();
        this.setupMap();
        this.setupHeroes();
        this.inventorySystem = this.world.getSystem('Inventory');
    },

    update() {
        this.checkMapState();
        this.gameWinner = this.checkWin();
        this.gameWinner && this.declareWinner(this.gameWinner);
        this.checkHeroes();
    },


    buildMap () {
        // build movement points
        this.points = [];
        const params = this.gameParameters.map;
        let counter = 0;
        for (let r  = 0; r < params.rows; r++) {
            for (let c = 0; c < params.columns; c++) {
                let x = params.cell0.x + c * params.cellSize;
                let y = params.cell0.y + r * params.cellSize;
                let marker = this.instabuild('pointMark', x, y, 0, String(counter));
                marker.phraseText = String(counter);
                marker.phraseHasSaid = false;
                marker.pointNumber = counter;
                counter++;
                this.points.push(marker);
            }
        }
        counter = 1000;
        for (let r  = params.rows - 1; r >= 0; r--) {
            for (let c = params.columns - 1; c >= 0; c--) {
                let x = params.cellSize - params.cell0.x + c * params.cellSize;
                let y = params.cellSize - params.cell0.y + r * params.cellSize;
                let marker = this.instabuild('pointMark', x, y, 0, String(counter));
                marker.phraseText = String(counter);
                // marker.phraseHasSaid = false;
                marker.pointNumber = counter;
                marker.clearSpeech();
                counter++;
                this.points.push(marker);
            }
        }
        // build vertical rivers
        for (let x=0; x <= params.maxX; x += params.cellSize) {
            this.instabuild('verticalFall', x, params.maxY / 2).initialize();
            for (let y = 0; y <= params.maxY; y += 4) {
                if (y % params.cellSize == 0) { continue; }
                this.instabuild('vriver', x, y);
            }
        }
        // build horizontal rivers
        for (let y=0; y <= params.maxY; y += params.cellSize) {
            // this.instabuild('horizontalRiver', params.maxX / 2, y);
            this.instabuild('horizontalFall', params.maxX / 2, y).initialize();
            for (let x = 0; x <= params.maxX; x += 4) {
                if (x % params.cellSize == 0) {
                    this.instabuild('xriver', x, y);    
                }
                else {
                    this.instabuild('hriver', x, y);
                }
            }
        }
        // build horizontal bridges
        for (let x=params.cellSize; x < params.maxX; x += params.cellSize) {
            for (let y=0; y < params.maxY; y += params.cellSize) {
                this.instabuild('bridge', x, y + params.cell0.y);
                this.instabuild('bridge', x, y + params.cellSize - params.cell0.y);
            }
        }
        // build vertical bridges
        for (let x=0; x < params.maxX; x += params.cellSize) {
            for (let y=params.cellSize; y < params.maxY; y += params.cellSize) {
                this.instabuild('bridge', x + params.cell0.x, y).setRotation(Math.PI / 2);
                this.instabuild('bridge', x + params.cellSize - params.cell0.x, y).setRotation(Math.PI / 2);
            }
        }
        this.heroRed.setPosition(this.getThangByID('0').pos);
        this.heroBlue.setPosition(this.getThangByID(`1000`).pos);
    },

    setupMap() {
        this.liveMap = [];
        let initMap = INIT_MAP;
        initMap = initMap.reverse();
        let k = 0;
        for (let r = 0; r < initMap.length; r++) {
            for (let c = 0; c < initMap[r].length; c++) {
                let cellValue = initMap[r][c];
                
                if (this.buildables[cellValue]) {
                    let thang = this.buildCell(cellValue, r, c);
                    this.liveMap.push(thang);
                }
                else {
                    this.liveMap.push(null);
                }
                k++;
            }
        }
        this.totalCells = this.liveMap.length;
    },

    buildCell (kind, r, c) {
        let [x, y] = [(c + 0.5) * this.gameParameters.map.cellSize, (r + 0.5) * this.gameParameters.map.cellSize];
        let thang = this.instabuild(kind, x, y);
        thang.kind = kind;
        thang.active = true;
        thang.type = LEGEND[kind[0]];
        thang.tier = Number(kind[1]);
        const params = this.gameParameters[thang.type][thang.tier];
        thang.value = params.value;
        thang.addTrackedProperties(['value', 'number']);
        thang.keepTrackedProperty('value');
        thang.cooldown = params.cooldown;
        thang.pointNumber = r * INIT_MAP[r].length + c;
        thang.point = thang.pointNumber;
        thang.addTrackedProperties(['point', 'number']);
        thang.keepTrackedProperty('point');
        thang.row = r;
        thang.column = c;
        if (thang.type == MONSTER) {
            this.setupMonster(thang);
        }
        if (thang.pos.x < 60) {
            thang.setRotation(Math.PI);
        }
        return thang;
    },

    setupMonster(monster) {
        // debugger
        const params = this.gameParameters.monster[monster.tier];
        monster.maxHealth = params.maxHealth;
        monster.health = params.maxHealth;
        monster.keepTrackedProperty('health');
        monster.keepTrackedProperty('maxHealth');
        monster.attackDamage = params.attackDamage;
        monster.attackRange = params.attackRange;
        monster.chooseAction = () => {
            let enemy = monster.findNearestEnemy();
            if (enemy && monster.distanceTo(enemy) <= monster.attackRange) {
                monster.attack(enemy);
            }
        }
        monster.appendMethod('die', () => {
            this.explored(monster.killer, monster);
        });
    },


    setupHeroes () {
        this.heroRed._currentPoint = 0;
        this.heroBlue._currentPoint = 1000;
        this.heroes = [this.heroRed, this.heroBlue];
        for (let h of this.heroes) {
            h.ref = this;
            h.maxHealth = this.gameParameters.hero.health[0];
            h.health = h.maxHealth;
            h.keepTrackedProperty('health');
            h.keepTrackedProperty('maxHealth');
            h.attackDamage = this.gameParameters.hero.attackDamage[0];
            h.actions.attack.cooldown = this.gameParameters.hero.attackCooldown;
            h.addTrackedProperties(['teamPower', 'number']);
            h.keepTrackedProperty('teamPower');
            h.teamPower = 0
            h.level = 0;
        }
    },

    checkMapState() {
        for (let thang of this.liveMap) {
            if (!thang) continue;
            if (((thang.health !== null && thang.health <= 0) || thang.consumed)
                && this.shouldRespawn(thang)) {
                let newThang = this.buildCell(thang.kind, thang.row, thang.column);
                thang.setExists(false);
                this.liveMap[thang.pointNumber] = newThang
            }
        }
    },

    checkWin () {
        if (this.gameWinner) return;
        if (this.heroRed.health <= 0 && this.heroBlue.health <= 0) {
            return this.processTie();
        }
        if (this.heroRed.dead) {
            return this.constants.BLUE;
        }
        if (this.heroBlue.dead) {
            return this.constants.RED;
        }
        if (this.heroRed.gold >= this.gameParameters.game.goldToWin &&
            this.heroRed.gold >= this.gameParameters.game.goldToWin) {
                return this.processTie();
        }
        if (this.heroRed.gold >= this.gameParameters.game.goldToWin) {
            return this.constants.RED;
        }
        if (this.heroBlue.gold >= this.gameParameters.game.goldToWin) {
            return this.constants.BLUE;
        }
        if (this.world.age >= this.gameParameters.game.maxTime) {
            return this.processTie();
        }

    },

    processTie () {
        if (this.heroRed.gold > this.heroBlue.gold) {
            return this.constants.RED;
        }
        if (this.heroBlue.gold > this.heroRed.gold) {
            return this.constants.BLUE;
        }
        if (this.heroRed.teamPower > this.heroBlue.teamPower) {
            return this.constants.RED;
        }
        if (this.heroBlue.teamPower > this.heroRed.teamPower) {
            return this.constants.BLUE;
        }
        return this.world.rand.choice([this.constants.RED, this.constants.BLUE]);
    },

    declareWinner (winner) {
        if (!winner) return;
        if (winner === this.constants.RED) {
            this.winGoal('red-win');
            this.failGoal('blue-win');
        }
        if (winner === this.constants.BLUE) {
            this.winGoal('blue-win');
            this.failGoal('red-win');
        }
    },

    checkHeroes() {
        for (let h of this.heroes) {
            if (h.teamPower >= this.gameParameters.hero.gloryForLevel[h.level]) {
                h.level += 1;
                h.maxHealth = this.gameParameters.hero.health[h.level];
                h.health = h.maxHealth;
                h.keepTrackedProperty('health');
                h.keepTrackedProperty('maxHealth');
                h.attackDamage = this.gameParameters.hero.attackDamage[h.level];
            }
        }
    },

    mirrorPointNumber(point) {
        if (point > 1000) {
            point = this.totalCells - 1 - (point - 1000);
        }
        
    },

    getThangByPoint(point) {
        if (point >= 1000) {
            point = this.totalCells - 1 - (point - 1000);
        }
        return this.liveMap[point]
    },

    attacked(who, thang) {
        // TODO: Check if boss
        thang.active = false;
        thang.consumed = world.age;
        this.inventorySystem.addGoldForTeam(who.team, this.gameParameters.treasure[thang.tier]);
        this.hero.teamPower += gloryPoints[MONSTER]
    },

    shouldRespawn(thang) {
        return thang.shouldRespawnAt &&  thang.shouldRespawnAt <= this.world.age;
    },

    explored(who, thang) {
        if (!who || !thang) {
            return
        }
        thang.active = false;
        thang.consumed = true;
        if (thang.type == TREASURE) {
            thang.setAlpha(0.3);
            this.inventorySystem.addGoldForTeam(who.team, thang.value);
            thang.shouldRespawnAt = world.age + thang.cooldown;
        } else if (thang.type == MONSTER) {
            // thang.setAlpha(0.3);
            this.inventorySystem.addGoldForTeam(who.team, thang.value);
            who.teamPower += thang.value;
            who.keepTrackedProperty('teamPower');
            thang.shouldRespawnAt = world.age + thang.cooldown;
        } else if (thang.type == GLORY) {
            thang.setAlpha(0.3);
            thang.shouldRespawnAt = world.age + thang.cooldown;
            who.teamPower += thang.value;
            who.keepTrackedProperty('teamPower');
        }
    }
});