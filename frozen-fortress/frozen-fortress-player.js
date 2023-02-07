const {ArgumentError} = require('lib/world/errors');

const FARM = 'farm';
const BARRACKS = 'barracks';


(class FrozenFortressPlayer extends Component {
    attach(thang) {
        super.attach(thang);
        thang.towers = {};
        thang.addTrackedProperties(['score', 'number'], ['teamPower', 'number']);
        thang.keepTrackedProperty('score');
        thang.keepTrackedProperty('teamPower');
        thang.score = 0;
        if (thang.id == 'Hero Placeholder') {
            thang.color = 'red';
        } else {
            thang.color = 'blue';
        }
        
        
        Object.defineProperty(thang, 'mana', {
            get: function() {
                return this._mana;
            },
        });
        thang._mana = 10;
        thang._manaIncome = 1;

        thang.getEnemyHero = this._getEnemyHero.bind(thang);
        
        thang._ref = this.world.getThangByID("Referee");
        thang._unblock = thang.unblock;
        thang.unblock = null;
        thang._block = thang.block;
        thang.block = null;
        thang.addActions({name: 'casting', cooldown: 999}, {name: 'summoning', cooldown: 999}, {name: 'waiting', cooldown: 900});
        thang.movementSystem = this.world.getSystem('Movement');
        thang.specialReadyTimes = {};
        Object.defineProperty(thang, "availableTowerTypes", {
            get: function() {
                return Object.keys(this._ref.parameters.towers);
            }
        });
        
        Object.defineProperty(thang, "monsterTypes", {
            get: function() {
                return Object.keys(this._ref.monsterParameters);
            }
        });
        
        
        thang.sell = this._sell.bind(thang);
        thang.getTowerAt = this._getTowerAt.bind(thang);
        thang.ability = this._ability.bind(thang);
        thang._summon = this._summon.bind(thang);
        thang._freeze = this._freeze.bind(thang);
        thang._shockwave = this._shockwave.bind(thang);
        
        thang.build = this._build.bind(thang);
        // thang.special = this._special.bind(thang);
        thang.wait = this._wait.bind(thang);
        thang.waitUntil = this._waitUntil.bind(thang);
        // thang.setTargeting = this._setTargeting.bind(thang);
        thang.towerCounter = 1;
        //thang.validEventTypes = ['spawn-guard'];
        //thang.guards = {};
    }
    _getEnemyHero() {
        if(this.color == "red") {
            return this.world.getThangByID("Hero Placeholder 1");
        } else {
            return this.world.getThangByID("Hero Placeholder");
        }
    }
    _ability(abilityName, args) {
        if(!abilityName.toLowerCase) {
            throw new ArgumentError('Unknown ability, please use "summon", "freeze", or "shockwave"');
        }
        if(abilityName.toLowerCase() === "summon") {
            return this._summon(args);
        } else if (abilityName.toLowerCase() == "freeze") {
            return this._freeze(args);
        } else if (abilityName.toLowerCase() == "shockwave") {
            return this._shockwave();
        } else {
            throw new ArgumentError('Unknown ability, please use "summon", "freeze", or "shockwave"');
        }
    }
    _summon(args) {
        if (this.isBusy) return false;
        if(!Number.isInteger(args)) {
            args = 10;
        }
        if(args < 10 || this._mana < args) {
            return;
        }
        
        this._mana -= args;
        this.score += args;
        
        if(this.team == "ogres") {
            this._ref.spawnLaneWave("top", args);
        } else if (this.team == "humans") {
            this._ref.spawnLaneWave("bottom", args);
        }
        
        return this.wait(this.world.dt);
    }
    _freeze(target) {
        if (this.isBusy) return false;
        if(!target || !target.hasEffects) throw new ArgumentError('Cannot apply freeze to provided target!');
        const powerRequired = Math.round(target.health / 10);
        if(this._mana < powerRequired) {
            return;
        } else {
            this._mana -= powerRequired;
            target.effects = target.effects.filter(e => e.name != 'slow');
            target.addEffect({name: 'slow', duration: 1, reverts: true, setTo: true, targetProperty: 'isSlowed'});
            target.addEffect({name: 'slow', duration: 1, reverts: true, factor: 0.5, targetProperty: 'maxSpeed'});
        }
        return this.wait(this.world.dt);
    }
    _shockwave() {
        if (this.isBusy) return false;
        
        const combat = this.world.getSystem("Combat");
        const attackRangeSquared = 50 * 50;
        const ring = this._ref.instabuild("ice-ring", this.pos.x, this.pos.y, `ice-ring`);
        ring.setScale(50 / 5);
        ring.lifespan = 0.5;
        
        let thangs = [];
        for (let thang of combat.attackables) {
            if (!thang.exists || thang.dead || thang.team == this.team) continue;
            if (this.distanceSquared(thang) > attackRangeSquared) continue;
            if (thang.team !== "neutral") continue;
            if (thang.enemyTeam !== this.team) continue;
            thangs.push(thang);
        }
        thangs.sort((thang1, thang2) => this.distanceSquared(thang1) - this.distanceSquared(thang2));
        
        const power = 10;
        for (const thang of thangs) {
            const powerRequired = Math.round(thang.health / 2);
            if(this._mana < powerRequired) {
                break;
            }
            this._mana -= powerRequired;
            const dir = thang.pos.copy().subtract(this.pos).normalize();
            dir.z = 5; // Prevent them from flying off into space
            dir.y *= power * 10;
            dir.x *= power * 10;
            thang.velocity = Vector(0, 0, 0);
            thang.velocity.add(dir, true);
        }

        return this.wait(this.world.dt);
    }

    _getTowerAt(place) {
        if (_.isString(place)) {
            place = place.toLowerCase();
        }
        if (!place || !this.towerSpots[place]) {
            throw new ArgumentError('Place should be a letter from "A" to "H"');
        }
        const tower = this.towers[place];
        return tower;
    }

    _sell(place) {
        if (this.isBusy) return;
        if (_.isString(place)) {
            place = place.toLowerCase();
        }
        if (!place || !this.towerSpots[place]) {
            throw new ArgumentError('Place should be a letter from "A" to "H"');
        }
        const location = this.towerSpots[place];
        const tower = this.towers[place];
        if (!tower) {
            throw new ArgumentError(`No tower at the place ${place} to sell.`);
        }
        const params = this._ref.parameters.towers[tower.type];
        
        let manaValue = params.cost * tower.level * (1 + tower.level) / 2;
        if (tower.type !== FARM && tower.type !== BARRACKS) {
            manaValue /= 2;
        }
        
        const peasant = this.world.getThangByID(`${this.color}-peasant`);
        peasant.setPosition({
            x: location.x - 5, 
            y: location.y - 5,
        });
        peasant.setAction('build');
        
        this._mana += manaValue;
        
        tower.setExists(false);
        this.towers[place] = null;
        this.unblockTime = this.world.age + this.world.dt;
        return this._block();
    }

    _wait(duration, nextMethod) {
        this.isBusy = true;
        this.intention = 'waiting';
        this.unblockTime = this.world.age + duration;
        this.nextMethod = nextMethod;
        if (!nextMethod) {
            this.setAction('waiting');
            this.act();
        }
        return this._block();
    }
    _waitUntil(mana, nextMethod) {
        this.isBusy = true;
        this.intention = 'waiting-until';
        this.unblockMana = mana;
        this.unblockTime = 9001;
        this.nextMethod = nextMethod;
        if (!nextMethod) {
            this.setAction('waiting');
            this.act();
        }
        return this._block();
    }
    unblockHero() {
        this.unblockTime = null;
        this.isBusy = null;
        this.intention = null;
        this.setAction('idle');
        this.actionHeats.all = 0;
        
        const peasant = this.world.getThangByID(`${this.color}-peasant`);
        peasant.setPosition({
            x: -10, 
            y: -10
        });
        
        if (this.lastTower) {
            let tower = this.lastTower;
            this.lastTower = null;
            this.waitingToUnblockReturnValue = tower;
            return this._unblock(tower);
        } else {
            return this._unblock();
        }
    }
    update() {
        let manaIncome = this._manaIncome;
        const farms = Object.values(this.towers).filter(e => e && e.type == "farm");
        for(let farm of farms) {
            manaIncome += farm.level;
        }
        this._mana += manaIncome;
        const manaOrb = this.world.getThangByID(`${this.color}-mana`);
        manaOrb.clearSpeech();
        manaOrb.sayWithDuration(90000, this._mana);
        
        if (this.intention == 'waiting-until') {
            if (this.mana >= this.unblockMana) {
                if (this.nextMethod) {
                    this[this.nextMethod].bind(this)();
                }
                this.nextMethod = null;
                return this.unblockHero();
            }
            return;
        }
        if (this.isBusy && this.world.age < this.unblockTime) {
            return;
        }
        if (this.intention == 'waiting') {
            if (this.nextMethod) {
                this[this.nextMethod].bind(this)();
            }
            this.nextMethod = null;
            return this.unblockHero();
        }
        this.unblockHero();
    }
    _build(towerType, place) {
        if (this.isBusy) return;
        if (_.isString(place)) {
            place = place.toLowerCase();
        }
        if (!place || !this.towerSpots[place]) {
            throw new ArgumentError('Place should be a letter from "A" to "H"');
        }
        if (_.isString(towerType)) {
            towerType = towerType.toLowerCase();
        }
        if (!towerType || !this._ref.parameters.towers[towerType]) {
            throw new ArgumentError('The wrong tower\'s type for the building. Check docs to find available tower types.');
        }
        const params = this._ref.parameters.towers[towerType];
        
        const location = this.towerSpots[place];
        const tower = this.towers[place];
        
        const peasant = this.world.getThangByID(`${this.color}-peasant`);
        peasant.setPosition({
            x: location.x - 5, 
            y: location.y - 5,
        });
        peasant.setAction('build');

        this.isBusy = true;
        this.buildingTile = {x: location.x, y: location.y};
        this.buildingType = towerType;
        this.symbol = place;
        this.intention = 'building';
        this.setAction('summoning');
        this.act();
        
        let expectedCost = params.cost;
        if (tower) {
            expectedCost *= (tower.level + 1);
        }
        if (this.mana < expectedCost) {
            return this.waitUntil(expectedCost, 'performBuildTower');
        }
        this.unblockTime = this.world.age + this.world.dt;
        this.performBuildTower();
        return this._block();
    }

    setTowerLevel(tower, level) {
        const params = this._ref.parameters.towers[tower.type];
        
        tower.clearSpeech();
        tower.sayWithDuration(90000, level);
    
        tower.level = level;
        
        tower.upgradeCost = params.cost * (level + 1);
        if (params.scales) {
            // damage => Linear scaling
            // range => range + range * 1-e^(-(0.25)level); asymptotically approaches double range (but the speed of growth slows significantly after ~10 levels)
            tower.attackRange = params.attackRange + params.attackRange * (1 - Math.pow(Math.E, -1 * 0.25 * (level - 1)));
            tower.attackRangeSquared = tower.attackRange * tower.attackRange;
            tower.attackDamage = params.attackDamage * level;
            tower.actions['attack'].cooldown = params.attackCooldown;
            if (params.specialFactor) {
                tower.specialFactor = params.specialFactor;
            }
            if (params.specialDuration) {
                tower.specialDuration = params.specialDuration;
            }
        }
    }


    performBuildTower() {
        const params = this._ref.parameters.towers[this.buildingType];
        const place = this.symbol;
        const tower = this.towers[place];
        if (tower) {
            this._mana -= params.cost * (tower.level + 1);
            this.setTowerLevel(tower, tower.level + 1);
            return tower;
        }
        
        let {x, y} = this.buildingTile;
        this.setTargetPos(new Vector(x, y), 'buildXY');
        this.toBuild = this.buildables[`${this.buildingType}`] || this.buildables[`${this.buildingType}-tower`];
        
        const newTower = this.performBuild(`${this.color}-${this.buildingType}`);
        if(this.buildingType == "ice") {
            iceTowerBehavior(this, newTower);
        }
        newTower.team = this.team;
        
        newTower.addTrackedProperties(['type', 'string']);
        newTower.keepTrackedProperty('type');
        
        newTower.type = this.buildingType;
        newTower.place = place;
        
        newTower.addTrackedProperties(['level', 'number']);
        newTower.keepTrackedProperty('level');
        this.setTowerLevel(newTower, 1);

        this._mana -= params.cost;
        this.lastTower = newTower;
        this.towers[place] = newTower;
        return newTower;
    }
});

function iceTowerBehavior(who, tower) {
    //this._ref.iceRingPoolCounter = this._ref.iceRingPoolCounter || 0;
    tower.combat = this.world.getSystem("Combat");
    tower.performAttack = (target) => {
        if (tower.distanceSquared(target) > tower.attackRangeSquared) {
            tower.specificAttackTarget = null;
            return;
        }
        const ring = who._ref.instabuild("ice-ring", tower.pos.x, tower.pos.y, `ice-ring`);
        
        ring.setScale(tower.attackRange / 5);
        ring.lifespan = 0.5;
        
        for (let thang of tower.combat.attackables) {
            if (!thang.exists || thang.dead || thang.team == tower.team) continue;
            if (tower.distanceSquared(thang) > tower.attackRangeSquared) continue;
            if (thang.team !== "neutral") continue;
            if (thang.enemyTeam !== tower.team) continue;
            thang.takeDamage(tower.attackDamage, tower);
            if(!thang.hasEffects) continue;
            thang.effects = thang.effects.filter(e => e.name != 'slow');
            thang.addEffect({name: 'slow', duration: tower.specialDuration, reverts: true, setTo: true, targetProperty: 'isSlowed'});
            thang.addEffect({name: 'slow', duration: tower.specialDuration, reverts: true, factor: tower.specialFactor, targetProperty: 'maxSpeed'});
        }
    };
}

