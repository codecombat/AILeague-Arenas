const {ArgumentError} = require('lib/world/errors');

const RED = 'red';
const BLUE = 'blue';
const SUMMON = 'summon';
const SPELL = 'play';
const IDLE = 'idle';
const BASKET = 'basket';
const STORM = 'storm';
const SANDSTORM = 'sandstorm';
const LAUNCH = 'launch';
const BASKETS = 
    {[RED]:   Vector(14, 50),
    [BLUE]:  Vector(106, 50)
};

(class SandBasketBallPlayer extends Component {
    attach(thang) {
        super.attach(thang);
        if (thang.id == 'Hero Placeholder') {
            thang.color = RED;
            thang.opColor = BLUE;
        }
        else {
            thang.color = BLUE;
            thang.opColor = RED;
        }
        // For the direct control of
        thang._unblock = thang.unblock;
        thang.unblock = null;
        thang._block = thang.block;
        thang.block = null;
        // Player API
        thang.summon = this._summon.bind(thang);
        thang.play = this._special.bind(thang);
        thang.findPlayers = this._findPlayers.bind(thang);
        thang.findMyPlayers = this._findPlayers.bind(thang, thang.color);
        thang.findTheirPlayers = this._findPlayers.bind(thang, thang.opColor);
        thang.orig_distanceTo = thang.distanceTo.bind(thang);
        thang.distanceTo = this._distanceTo.bind(thang, thang);
        thang._distanceTo = this._distanceTo;
        thang.findByType = this._findByType.bind(thang);
        thang.launch = this._launch.bind(thang);
        thang.findStorms = this._findStorms.bind(thang);
        thang.findItems = this._findItems.bind(thang);
        // Utility fields
        thang.isHero = true;
        thang.units = [];
        thang.unitCounter = 0;
        thang.score = 0;
        thang.specialReadyTimes = {};
        thang.addActions({name: 'attack', cooldown: 1});
        
    }
    
    // Player methods
    _summon(playerType, lane) {
        if (this.isBusy) { return }
        if (_.isNaN(lane) || lane < 0 || lane > 2) {
            throw Error("TODO, wrong lane number");
        }
        const params = this._ref.unitParameters[playerType];
        if (!params) {
            throw new ArgumentError(`Wrong player type ${playerType}. Check the docs to find available player types.`);
        }
        const unitsByType = this.units.filter(u => u.type == playerType && !u.isOut && !u.dead);
        let level = -1;
        for (let i = 0; i <= this._ref.unitMaxLevel; i++) {
            if (!unitsByType.filter(u => u.level == i).length) {
                level = i;
                break;
            }
        }
        if (level == -1) {
            this.unblockTime = this.world.age + this.world.dt;
            this.intention = IDLE;
            return this._block();
        }
        this.intention = SUMMON;
        this.isBusy = true;
        this.unblockTime = this.world.age + (params.cost || this._ref.defaultUnitCost);
        this.summonUnitData = {};
        this.summonUnitData.type = playerType;
        this.summonUnitData.lane = lane;
        this.summonUnitData.pos = this._ref.points[`${this.color}${lane}`];
        this.summonUnitData.params = params;
        this.summonUnitData.level = level;
        return this._block();
    }

    _launch(x, y) {
        if (this.isBusy) { return }
        if (this.unblockStormTime && this.unblockStormTime > this.world.age) { return }
        if (_.isNaN(x) || _.isNaN(y)) {
            throw new ArgumentError('The launch requires coordinates `x` and `y` which should be numbers.');
        }
        if (this.color == BLUE) {
            x = this.maxCoordinateX - x;
        }
        this.intention = STORM;
        this.isBusy = true;
        const params = this._ref.stormParams;
        this.unblockTime = this.world.age + params.cooldown;
        this.unblockStormTime = this.world.age + params.specificCooldown;
        // this.stormLaunched = true;
        const launchPos = BASKETS[this.color];
        const pos = Vector(x, y);
        this.arenaBuildXY('storm', BASKETS[this.color].x, BASKETS[this.color].y);
        const storm = this.performBuild(`${this.color}-storm`);
        const dir = pos.copy().subtract(storm.pos);
        storm.maxSpeed = params.speed;
        Object.defineProperty(storm, 'speed', {
            get: function() { return this.maxSpeed; }
        });
        storm.lifespan = params.duration;
        storm.color = this.color;
        storm.type = STORM;
        storm.moveDirection(dir);
        storm.damageSqRange = params.damageRange * params.damageRange;
        storm.range = params.damageRange;
        storm.damage = params.damage;
        storm.appendMethod("update", ()  => {
            for (let unit of this._ref.units) {
                if (unit.dead || unit.isOut) { continue; }
                if (storm.distanceSquared(unit) <= storm.damageSqRange) {
                    unit.takeDamage(params.damage, storm);
                }
            }
        });
        return this._block();
    }

    _findStorms() {
        const storms = this.world.thangs.filter(t => t.type === STORM && t.exists);
        return storms;
    }

    _findItems() {
        const items = this.world.thangs.filter((th) => th.exists && th.isCollectable && !th.caught);
        return items;
    }
    
    _special(specialName, lane) {
        if (this.isBusy) { return }
        const params = this._ref.specialParameters[specialName];
        if (!params) {
            throw new ArgumentError(`Wrong play name \`${specialName}\`. Check the docs to find available play names.`);
        }
        // if (isNaN(x) || !y || isNaN(y)) {
        //     throw new ArgumentError('The special requires coordinates `x` and `y` which should be numbers.');
        // }
        // if (this.color == 'blue') {
        //     x = 120 - x;
        // }
        if (this.specialReadyTimes[specialName] && this.specialReadyTimes[specialName] > this.world.age) {
            return;
        }
        this.intention = SPELL;
        this.isBusy = true;
        this.unblockTime = this.world.age + params.cooldown;
        this.specialReadyTimes[specialName] = this.world.age + params.specificCooldown;
        this[`spell_${specialName}`](lane, params);
        return this._block();
    }

    esper_isReady(specialName) {
        if (!specialName) {
            return false;
        }
        if (specialName == SANDSTORM || specialName == LAUNCH) {
            if (this.unblockStormTime && this.unblockStormTime > this.world.age) {
                return false;
            }
        }
        if (this.specialReadyTimes[specialName] && this.specialReadyTimes[specialName] > this.world.age) {
            return false;
        }
        return true;
    }
    
    _findPlayers(color, lane) {
        let result = this._ref.units.filter(u => !u.isOut && u.exists && !u.dead && (!color || u.color === color) && (typeof lane === 'undefined' || u.lane === lane));
        return result;
    }
    
    _distanceTo(fromThang, toThang) {
        if (!toThang || !toThang.pos) {
            throw new ArgumentError(`The \`distanceTo\` argument should be a player or a hero or a game object with position.`);
        }
        if (fromThang.ishero) {
            fromThang = this._ref.baskets[fromThang.color];
        }
        if (toThang.ishero) {
            toThang = this._ref.baskets[toThang.color];
        }
        return fromThang.orig_distanceTo(toThang);
    }
    
    _findByType(playerType) {
        return this._ref.units.filter((u) => !u.isOut && !u.dead && u.exists && u.type == playerType);
    }
    
    spell_switch(lane, params) {
        const m = 2 * this._ref.middleY;
        for (let u of this.units) {
            if (u.isOut || u.dead) { continue }
            if (u.lane != 0) {
                u.markedToSwap = true;
            }
        }
        let phrase = this.world.rand.choice([
            "Pick and roll!",
            "Switch!",
            "Swap!",
            ]);
        this.sayWithoutBlocking(phrase);
    }
    
    spell_quicksand(lane, params) {
        for (let u of this._ref.units) {
            if (u.isOut || u.dead || u.lane != lane) { continue }
            u.takenDamage = 9999;
        }
        let phrase = this.world.rand.choice([
            "You Shall Not Pass!",
            "Get that outta here!",
            "Cookies!",
            "Block Party!"
            ]);
        this.sayWithoutBlocking(phrase);
        this._ref.createSands(lane);
    }
    
    spell_boost(lane, params) {
        for (let u of this.units) {
            if (!u.isOut && !u.dead && u.lane == lane) {
                
                if (u.hasEffect('slow')) {
                    u.effects.forEach((e) => {
                        if (e.name == 'slow') {
                            e.timeSinceStart = 9999;
                        }
                    });
                    u.updateEffects();
                }
                else {
                    u.effects = u.effects.filter((e) => e.name != 'haste');
                    u.addEffect({
                        name: 'haste',
                        duration: params.duration,
                        reverts: true,
                        factor: params.ratio,
                        targetProperty: 'maxSpeed'});
                }
            }
        }
        let phrase = this.world.rand.choice([
            "Wheels!",
            "Fast Break!",
            "Go Go Go!",
            "Turn on the burners!"
            ]);
        this.sayWithoutBlocking(phrase);
        this._ref.createWind(lane, this.color);
    }
    
    spell_press(lane, params) {
        for (let u of this._ref.units) {
            if (!u.isOut && !u.dead && u.color != this.color && u.lane == lane) {
                if (u.hasEffect('haste')) {
                    u.effects.forEach((e) => {
                        if (e.name == 'haste') {
                            e.timeSinceStart = 9999;
                        }
                    });
                    u.updateEffects();
                }
                else {
                    u.effects = u.effects.filter((e) => e.name != 'slow');
                    u.addEffect({
                        name: 'slow',
                        duration: params.duration,
                        reverts: true,
                        factor: params.ratio,
                        targetProperty: 'maxSpeed'});
                }
            }
        }
        let phrase = this.world.rand.choice([
            "Press Them!",
            "Pressure! Pressure!",
            "Slow down the rock!"
            ]);
        this.sayWithoutBlocking(phrase);
        this._ref.createPalm(lane, this.color);
    }
    
    spell_goliath(lane, params) {
        let f = this.color == RED ? ((u) => u.pos.x) : ((u) => -1 * u.pos.x);
        const units = this.units.filter((u) => !u.isOut && !u.dead && u.lane == lane && !u.isGoliath);
        if (!units.length) { return; }
        const farUnit = _.max(units, f);
        if (farUnit) {
            farUnit.addEffect({
                        name: 'grow',
                        duration: 900,
                        reverts: false,
                        setTo: true,
                        targetProperty: 'isGoliath'});
            
            farUnit.setScale(farUnit.scaleFactor * Math.sqrt(params.ratio));
            farUnit.maxHealth *= params.ratio;
            farUnit.health *= params.ratio;
            farUnit.keepTrackedProperty('health');
            farUnit.keepTrackedProperty('maxHealth');
            let f = this._ref.instabuild('grow', farUnit.pos.x, farUnit.pos.y);
            f.clingTo(farUnit);
            f.followOffset = new Vector(0, 0, -farUnit.depth / 2);
        }
        let phrase = this.world.rand.choice([
            "Show the bounce!",
            "GOAT it!",
            "Clutch up",
            "And one!"
            ]);
        this.sayWithoutBlocking(phrase);
    }
    
    spell_hot(lane, params) {
        let f = this.color == RED ? ((u) => u.pos.x) : ((u) => -1 * u.pos.x);
        const units = this.units.filter((u) => !u.isOut && !u.dead && u.lane == lane && !u.isHot);
        if (!units.length) { return; }
        const farUnit = _.max(units, f);
        if (farUnit) {
            farUnit.addEffect({
                        name: 'fire',
                        duration: 900,
                        reverts: false,
                        setTo: params.ratio,
                        targetProperty: 'isHot'});
            farUnit.maxSpeed *= params.ratio;
            farUnit.attackRange = params.throwRange;
            farUnit.attackRangeSquared = params.throwRange * params.throwRange;
            let f = this._ref.instabuild('fire', farUnit.pos.x, farUnit.pos.y);
            f.clingTo(farUnit);
            f.followOffset = new Vector(0, 0, -farUnit.depth / 2);
        }
        let phrase = this.world.rand.choice([
            "On fire!",
            "En Fuego!",
            "Make it rain!",
            "Nothing but net!",
            "Heat check!"
            ]);
        this.sayWithoutBlocking(phrase);
        
    }
    
    
    
    performSummon() {
        this.unitCounter += 1;
        const pos = this.summonUnitData.pos;
        const unitType = this.summonUnitData.type;
        const unitID = `${this.color}-${unitType}-${this.unitCounter}`;
        this.buildables[unitType].ids = [unitID];
        this.arenaBuildXY(unitType, pos.x, pos.y);
        const unit = this.performBuild(`${this.color}-${unitType}`);
        unit.setRotation(this.color == RED ? 0 : Math.PI);
        unit.type = unitType;
        unit.lane = this.summonUnitData.lane;
        unit.enemy = this.enemy;
        unit.level = this.summonUnitData.level;
        this.setupUnit(unit, this.summonUnitData.params, this._ref.unitCoefs[unit.level]);
        
        unit.setScale(unit.scaleFactor * this._ref.unitScale[unit.level]);
        unit.bPos = new Vector(this.opponentBasket.x,this.opponentBasket.y);
        this._ref.units.push(unit);
        this.units.push(unit);
    }
    
    setupUnit(unit, params, coef) {
        unit.maxSpeed = params.speed * coef;
        Object.defineProperty(unit, 'speed', {
            get: function() { return this.maxSpeed; }
        });
        unit.health = params.stamina * coef;
        unit.maxHealth = params.stamina * coef;
        unit.mass = unit.health;
        unit.keepTrackedProperty('health');
        unit.keepTrackedProperty('maxHealth');
        unit.attackDamage = params.attack * coef;
        Object.defineProperty(unit, 'damage', {
            get: function() { return this.attackDamage; }
        });
        unit.push = params.push * coef;
        unit.actions.attack.cooldown = 1;
        unit.actions.attack.specificCooldown = 99;
        unit.color = this.color;
        unit.commander = this;
        unit.isUnit = true;
        unit.attackRange = params.range;
        unit.attackRangeSquared = params.range * params.range;
        unit.route = this._ref.routes[unit.lane].slice();
        if (this.color == BLUE) { unit.route.reverse() }
        unit.route.shift();
        unit.basketPos = unit.route[unit.route.length - 1];
        unit.chooseAction = this.unit_chooseAction.bind(this, unit);
        // unit.findNearestOpponent = this.unit_findNearestEnemy.bind(this, unit);
        unit.orig_distanceTo = this.distanceTo.bind(unit);
        unit.distanceTo = this._distanceTo.bind(this, unit);
        unit.appendMethod('setExists', (state) => {
            if (!state && unit.hasSticked) {
                unit.hasSticked.setExists(false);
            }
        });
    }
    
    arenaBuildXY(toBuild, x, y) {
        this.setTargetPos(new Vector(x, y), 'buildXY');
        this.toBuild = this.buildables[toBuild];
    }
    
    unit_findNearestEnemy(unit) {
        let nearest = null;
        let minDistSq = Infinity;
        let distSq = null;
        for (let en of unit.enemy.units) {
            if (en.isOut || en.lane != unit.lane) { continue }
            if (unit.color == RED && unit.pos.x > en.pos.x) { continue }
            if (unit.color == BLUE && unit.pos.x < en.pos.x) { continue }
            distSq = unit.distanceSquared(en);
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = en;
            }
        }
        return nearest;
    }
    
    unit_chooseAction(unit) {
        if (unit.dead || unit.isOut) { return }
        if (this._ref.gameWon) {
            if (this._ref.gameWon == unit.color) {
                unit.setTargetPos(null);
                unit.actions.attack.cooldown = 0.5;
                unit.setAction("attack");
                unit.act();
            }
            else {
                unit.die();
            }
            return;
        }
        if (unit.basketPos && unit.distanceSquared(unit.basketPos) <= unit.attackRangeSquared) {
            const bPos = unit.bPos;
            unit.appendMethod('performAttack', () => {
                // TODO real math? 
                const ball = unit.lastMissileShot;
                ball.velocity.divide(1.5);
                ball.velocity.z = 20;
                // ball.lifespan = 4;
                ball.appendMethod('update', () => {
                    if (!ball.inBasket && ball.distanceSquared(bPos) < 0.5) {
                        ball.inBasket = true;
                        ball.pos.x = bPos.x;
                        ball.pos.y = bPos.y;
                        ball.hasMoved = true;
                        ball.velocity = Vector(0, 0, -20);
                        ball.lifespan = 0.5;
                    }
                });
            });
            unit.attackXY(bPos.x, bPos.y, 13);
            unit.isOut = true;
            unit.alpha = 0.5;
            unit.keepTrackedProperty('alpha');
            unit.lifespan = 1;
            this.setTimeout(() => unit.brake(), this.world.dt);
            this.setTimeout(() => {
                if (!this._ref.gameWon) {
                    this.score += (unit.attackRange > 25 ? 3 : 2);
                }
            }, 3.3); // TODO
            unit.brake();
        }
        if (!unit.targetPos && unit.route && unit.route.length) {
            let pos;
            if (unit.nextTargetPos && unit.distance(unit.nextTargetPos) > 10) {
                pos = unit.nextTargetPos;
            }
            else {
                pos = unit.route.shift();
            }
            if (pos) {
                unit.moveXY(pos.x, pos.y);
                unit.nextTargetPos = unit.targetPos;
            }
            
        }
    }
    
    unblockHero() {
        this.unblockTime = null;
        this.isBusy = null;
        this.intention = null;
        this.summonUnitData = null;
        this.setAction('idle');
        this.actionHeats.all = 0;
        // if (this.lastTower) {
        //     let tower = this.lastTower;
        //     this.lastTower = null;
        //     this.waitingToUnblockReturnValue = tower;
        //     return this._unblock(tower);
        // }
        // else {
        return this._unblock();
    }
    
    update() {
        if (this.isBusy && this.unblockTime && this.unblockTime > this.world.age) {
            return;
        }
        if (this.intention == SUMMON) {
            this.performSummon();
            return this.unblockHero();
        }
        if (this.intention) {
            return this.unblockHero();
        }
    }
});