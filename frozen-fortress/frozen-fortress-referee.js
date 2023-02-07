const RED = "red";
const BLUE = "blue";

const COLOR_PAIRS = {
    [RED]: BLUE,
    [BLUE]: RED
};

const BARRACKS = 'barracks';

function getBuildableName(key, params, world) {
    if (params.gendered) {
        return key + world.rand.choice(["-m", "-f"]);
    } else {
        return key;
    }
}



;({
    setUpLevel () {
        this.heroes = {
            [RED]: this.heroRed,
            [BLUE]: this.heroBlue
        };
        this.hero2 = this.heroes[BLUE];
        for (let h of Object.values(this.heroes)) {
            this.setupHero(h);
        }
        this.monsterParameters = this.parameters.monsters;
        this.valueToMonster = [];
        for (let [key, params] of Object.entries(this.monsterParameters)) {
            this.valueToMonster.push([params.value, key]);
        }
        this.valueToMonster.sort((a, b) => b[0] - a[0]);
        // clear out the bottom of the map
        this.world.thangs.filter(t => t.team && t.pos.y < 0).forEach(t => t.setExists(false));
    },

    setupHero (hero) {
        hero._ref = this;
        hero.health = this.parameters.hero.maxHealth;
        hero.maxHealth = this.parameters.hero.maxHealth;
        hero.keepTrackedProperty('health');
        hero.keepTrackedProperty('maxHealth');
        hero.enemyColor = COLOR_PAIRS[hero.color];
    },

    onFirstFrame() {
        this.spawnWaves();
        this.setInterval(this.spawnWaves.bind(this), 1);
    },

    clearCorpses() {
        for (let thang of this.world.getSystem("Combat").corpses) {
            if(thang.team !== 'neutral' || !thang.enemyTeam) continue;
            if(!thang.exists) continue;
            
            if(thang.scaleFactor <= 0) {
                thang.setExists(false);
                continue;
            }
            thang.scaleFactor -= 0.1;
            thang.keepTrackedProperty('scaleFactor');
        }
    },

    keepHeroAlive(hero) {
        hero.health = Math.max(1, hero.health);
        hero.keepTrackedProperty('health');
        this.hero2.setAction('idle');
    },

    winGame(hero) {
        this.world.setGoalState(`${hero.color}-win`, 'success');
        this.world.setGoalState(`${hero.enemyColor}-win`, 'failure');
        this.gameEnd = true;
        if (hero.color === 'blue') {
            this.blueWin = true;
        }
        if (hero.color === 'red') {
            this.redWin = true;
        }
        this.keepHeroAlive(hero);
    },

    resolveTie() {
        if(this.heroRed.health > this.heroBlue.health) {
            this.winGame(this.heroRed);
        }
        else if (this.hero.health > this.hero2.health) {
            this.winGame(this.heroBlue);
        }
        else if (this.heroRed.score < this.heroBlue.score) {
            this.winGame(this.heroBlue);
        }
        else if (this.heroRed.score > this.heroBlue.score) {
            this.winGame(this.heroRed);
        }
        else if (this.world.rand.randf() < 0.5) {
            this.winGame(this.heroRed);
        }
        else {
            this.winGame(this.heroBlue);
        }
    },

    update() {
        this.clearCorpses();
        for (let hero of Object.values(this.heroes)) {
            hero.teamPower = hero.score;
            hero.keepTrackedProperty('teamPower');
        }
    },

    chooseAction() {
        
        if (this.gameEnd) {
            if (this.blueWin) {
                this.keepHeroAlive(this.heroBlue);
            }
            if (this.redWin) {
                this.keepHeroAlive(this.heroRed);
            }
            return; 
        }
        if (this.heroBlue.health <= 0 && this.heroRed.health <= 0) {
            return this.resolveTie();
        }
        else if (this.heroRed.health <= 0) {
            return this.winGame(this.heroBlue);
        }
        else if (this.hero2.health <= 0) {
            return this.winGame(this.heroRed);
        }
        if((this.world.age >= this.parameters.game.maxTime)) {
            this.resolveTie();
        }
    },
    getTile(x, y, who) {
    },

    spawnMonster(lane, who, name, power, behavior) {
        let x = 130;
        let y;
        if(lane == "top") {
            y = 17.75;
        } else {
            y = 65.75;
        }
        const monster = this.instabuild(name, x, y + 0.5 - this.world.rand.randf());
        monster.commander = this;
        monster.startsPeaceful = true;
        monster.health = monster.maxHealth = power;
        monster.keepTrackedProperty('health');
        monster.keepTrackedProperty('maxHealth');
        monster.chooseAction = behavior.bind(monster);
        monster.actions['attack'].cooldown = 1;
        monster.attackDamage = 5;
        monster.maxSpeed = 15;
        monster.attackRange = 5;
        monster.mass = 50;
        monster.enemyTeam = lane === "top" ? "humans" : "ogres";
        monster.disabledSuicide = true;
        return monster;
    },

    getBudgetedMonster(budget) {
        for(let [value, monster] of this.valueToMonster) {
            if(value <= budget) return [value, monster];
            // if (MONSTER_VALUES[i][1] <= budget) return MONSTER_VALUES[i];
        }
        return [0, null];
    },

    spawnLaneWave(where, budget) {
        let monsterArray = [];
        while(budget >= 10) {
            const [value, monsterType] = this.getBudgetedMonster(budget);
            if (!monsterType) break;
            budget -= value;
            monsterArray.push(monsterType);
        }
        for (let monsterType of monsterArray) {
            // const monsterKey = monsterArray[i];
            const monsterTemplate = this.parameters.monsters[monsterType];
            const monsterBuildName = getBuildableName(monsterType, monsterTemplate, this.world);
            this.spawnMonster(where, this, monsterBuildName, monsterTemplate.health, this.monster_chooseAction);
        }
    },
    spawnWaves() {
        // 130, 17.75
        // 130, 65.75
        
        // Power scales by 10hp per second (then scales exponentially after 30 seconds)
        // +10 hp per barracks x barracks level
        let wavePower = this.world.age * 10;
        if(this.world.age >= 30) {
            wavePower += ((this.world.age - 30) * (this.world.age - 30)) * 6;
        }
        
        {
            let topWavePower = wavePower;
            const barracks = Object.values(this.heroRed.towers).filter(e => e && e.type == BARRACKS);
            for (let barrack of barracks) {
                topWavePower += barrack.level * 10;
            }
            this.heroRed.score += topWavePower;
            this.spawnLaneWave("bottom", topWavePower);
        }
        {
            let bottomWavePower = wavePower;
            const barracks = Object.values(this.heroBlue.towers).filter(e => e && e.type == BARRACKS);;
            for (let barrack of barracks) {
                bottomWavePower += barrack.level * 10;
            }
            this.heroBlue.score += bottomWavePower;
            this.spawnLaneWave("top", bottomWavePower);
        }
    },
    monster_chooseAction() {
        if (this.markedDead || (this.stunTime  && this.stunTime >= this.world.age)) {
            this.setTarget(null);
            this.setTargetPos(null);
            this.setAction('idle');
            this.brake();
            return;
        }
        let en;
        if(this.pos.y < 45) {
            en = this.world.getThangByID("Hero Placeholder")
        } else {
            en = this.world.getThangByID("Hero Placeholder 1")
        }
        if (this.target != en) {
            this.attack(en);
        } else if (this.action == "idle" && this.target) {
            this.attack(this.target);
        }
        
    },
});