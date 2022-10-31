const {ArgumentError} = require('lib/world/errors');

const LEGACY = {
    special: {
        'in': 'pull',
        'out': 'push'
    }
};

(class IceAndIronPlayer extends Component {
    attach(thang) {
        super.attach(thang);
        if (thang.id == 'Hero Placeholder') {
            thang.color = 'red';
        }
        else {
            thang.color = 'blue';
        }
        Object.defineProperty(thang, 'mana', {
            get: function() {
                return this._mana;
            }
        });
        thang._unblock = thang.unblock;
        thang.unblock = null;
        thang._block = thang.block;
        thang.block = null;
        thang.addActions({name: 'casting', cooldown: 999}, {name: 'summoning', cooldown: 999}, {name: 'waiting', cooldown: 900});
        thang._mana = 0;
        thang.movementSystem = this.world.getSystem('Movement');
        thang.specialReadyTimes = {};
        Object.defineProperty(thang, "towerTypes", {
            get: function() {
                return Object.keys(this._ref.towerParameters);
            }
        });
        Object.defineProperty(thang, "monsterTypes", {
            get: function() {
                return Object.keys(this._ref.monsterParameters);
            }
        });
        thang.build = this._build.bind(thang);
        thang.special = this._special.bind(thang);
        thang.wait = this._wait.bind(thang);
        thang.waitUntil = this._waitUntil.bind(thang);
        thang.setTargeting = this._setTargeting.bind(thang);
        thang.towerCounter = 1;
        thang.validEventTypes = ['spawn-guard'];
        thang.guards = {};
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
    
    _build(towerType, xOrSymb, y) {
        const params = this._ref.towerParameters[towerType];
        if (!params) {
            throw new ArgumentError('The wrong tower\'s type for the building. Check docs to find available tower types.');
        }
        params.cost = this._ref.towerParameters.cost;
        let x = xOrSymb;
        if (y == null) {
            const p = this._ref.getPointCoordinates(xOrSymb, this);
            if (!p) {
                throw new ArgumentError('The unknown point name. Use letter from A to I.');
            }
            x = p.x;
            y = p.y;
        }
        if (this.color == 'blue') {
            x = 120 - x;
        }
        const tile = this._ref.getTile(x, y, this);
        this.buildingTower = towerType;
        this.towerLevel = 1;
        if (!tile || ![this.color, 'purple'].includes(tile.color)) {
            return this.wait(this.world.dt);
        }
        if (tile.occupied && tile.occupied.color != this.color) {
            return this.wait(this.world.dt);
        }
        
        this.isBusy = true;
        this.buildingTile = tile;
        this.intention = 'building';
        this.setAction('summoning');
        this.act();
        if (this.mana < params.cost) {
            return this.waitUntil(params.cost, 'performBuildTower');
        }
        this.unblockTime = this.world.age + this.world.dt;
        this.performBuildTower();
        return this._block();
    }
    
    iaiBuildXY(toBuild, x, y) {
        this.setTargetPos(new Vector(x, y), 'buildXY');
        this.toBuild = this.buildables[toBuild];
    }
    
    performBuildTower() {
        const tile = this.buildingTile;
        let targetingType = 'close';
        let levelName = null;
        const occupant = tile.occupied;
        if (occupant && occupant.color == this.color) {
            this.towerLevel = occupant.level + 1;
            targetingType = occupant.targetingType;
            levelName = occupant.levelName;
            occupant.setExists(false);
        }
        const params = this.esper_getTowerParameters(this.buildingTower, this.towerLevel);
        if ((tile.occupied && tile.occupied.color != this.color) || !(tile.color == this.color || tile.color == 'purple')) {
            return;
        }
        this._mana -= params.cost;
        const buildingName = `${this.buildingTower}-tower`;
        this.buildables[buildingName].ids = [`${this.color}-${this.buildingTower}-${this.towerCounter}`];
        this.towerCounter += 1;
        this.iaiBuildXY(`${this.buildingTower}-tower`, tile.pos.x, tile.pos.y);
        const tower = this.performBuild(`${this.color}-${this.buildingTower}`);
        tower.isTower = true;
        tower.owner = this;
        tower.color = this.color;
        tower.level = this.towerLevel;
        tower.isAttackable = false;
        tower.type = this.buildingTower;
        tower.attackDamage = params.attackDamage;
        tower.attackRange = params.attackRange;
        tower.attackRangeSquared = params.attackRange * params.attackRange;
        // tower.leftRange = tower.pos.x - tower.attackRange;
        // tower.rightRange = tower.pos.x + tower.attackRange;
        // tower.topRange = tower.pos.y + tower.attackRange;
        // tower.bottomRange = tower.pos.y - tower.attackRange;
        tower.attackRangeSquared = params.attackRange * params.attackRange;
        tower.actions.attack.cooldown = params.attackCooldown;
        // tower.scaleFactor = 1 + (tower.level - 1) * 0.05;
        tower.keepTrackedProperty('scaleFactor');
        tower.updateRegistration();
        tile.occupied = tower;
        tower.tile = tile;
        tower.say = () => {};
        tower.sayWithDuration = () => {};
        if (levelName) {
            tower.levelName = levelName;
        }
        else {
            tower.levelName = this._ref.instabuild(`${this.color}-name`, tile.pos.x, tile.pos.y - 2);
        }
        tower.levelName.clearSpeech();
        tower.levelName.sayWithDuration(900, tower.level);
        this.performSetTargeting(tower, targetingType);
        this.lastTower = tower;
        const ref = this._ref;
        if (this.buildingTower == 'cannon') {
            tower.isMovable = false;
            this._ref.earthRingPoolCounter = this._ref.earthRingPoolCounter || 0;
            tower.appendMethod('performAttack', function() {
                this.lastMissileShot.blastRadiusSquared = params.blastRadius * params.blastRadius;
                this.lastMissileShot.blastRadius = params.blastRadius;
                const targetPos = this.targetPos || (this.target && this.target.pos);
                if (targetPos) {
                    const danger = ref.instabuild('danger', targetPos.x, targetPos.y);
                    danger.setScale(params.blastRadius / 6);
                    danger.lifespan = this.lastMissileShot.flightTime;
                }
                this.lastMissileShot.explode = function () {
                    const combat = this.world.getSystem("Combat");
                    for (let thang of combat.attackables) {
                        if (!thang.exists || thang.dead || thang.flying || thang.team == this.team) continue;
                        if (this.distanceSquared(thang) > this.blastRadiusSquared) continue;
                        this.shooter.performAttackOriginal(thang);
                    }
                    this.velocity.multiply(0);
                    this.exploded = true;
                    ref.earthRingPoolCounter = (ref.earthRingPoolCounter + 1) % 4;
                    const ring = ref.instabuild("earth-ring", this.pos.x, this.pos.y, `earth-ring-${ref.earthRingPoolCounter}`);
                    
                    ring.setScale(this.blastRadius / 4.9);
                    ring.lifespan = 0.5;
                    
                    // const args = [
                    //     parseFloat(this.pos.x.toFixed(2)),
                    //     parseFloat(this.pos.y.toFixed(2)),
                    //     parseFloat(this.blastRadius.toFixed(2)),
                    //     '#FF5A00', 0, Math.PI * 2];
                    // this.addCurrentEvent(`aoe-${JSON.stringify(args)}`);
                    this.setAction('die');
                    this.act();
                };
            });
        }
        if (this.buildingTower == 'frost') {
            this._ref.iceRingPoolCounter = this._ref.iceRingPoolCounter || 0;
            tower.combat = this.world.getSystem("Combat");
            tower.specialFactor = params.specialFactor;
            tower.specialDuration = params.specialDuration;
            tower.performAttack = (target) => {
                // debugger
                this._ref.iceRingPoolCounter = (this._ref.iceRingPoolCounter + 1) % 4;
                const ring = this._ref.instabuild("ice-ring", tower.pos.x, tower.pos.y, `ice-ring-${this._ref.iceRingPoolCounter}`);
                
                ring.setScale(tower.attackRange / 5);
                ring.lifespan = 0.5;
                // const args = [
                //     parseFloat(tower.pos.x.toFixed(2)),
                //     parseFloat(tower.pos.y.toFixed(2)),
                //     parseFloat(tower.attackRange.toFixed(2)),
                //     '#5A00FF', 0, Math.PI * 2];
                // this.addCurrentEvent(`aoe-${JSON.stringify(args)}`);
                
                for (let thang of tower.combat.attackables) {
                    if (!thang.exists || thang.dead || thang.team == tower.team) continue;
                    if (tower.distanceSquared(thang) > tower.attackRangeSquared) continue;
                    thang.takeDamage(tower.attackDamage, tower);
                    thang.effects = thang.effects.filter(e => e.name != 'slow');
                    thang.addEffect({name: 'slow', duration: tower.specialDuration, reverts: true, setTo: true, targetProperty: 'isSlowed'});
                    thang.addEffect({name: 'slow', duration: tower.specialDuration, reverts: true, factor: tower.specialFactor, targetProperty: 'maxSpeed'});
                }
            };
        }
        if (this.buildingTower == 'mage') {
            let flyingDamageRatio = params.flyingDamageRatio || 1;
            tower.appendMethod('performAttack', function() {
                // this is tower
                this.lastMissileShot.monsterHit = [];
                this.lastMissileShot.fixedZ = this.lastMissileShot.pos.z;
                this.lastMissileShot.lifespan = Math.ceil(10 * this.attackRange / this.lastMissileShot.maxSpeed) / 10;
                this.lastMissileShot.hitRangeSquared = this.lastMissileShot.width * this.lastMissileShot.width;
                this.lastMissileShot.appendMethod('update', function() {
                    // this is arrow
                    this.pos.z = this.fixedZ;
                    this.keepTrackedProperty('pos');
                    for (let m of ref.monsters) {
                        if (m.dead || !m.exists || m.markedDead) continue;
                        if (this.distanceSquared(m) > this.hitRangeSquared || this.monsterHit.includes(m.id)) continue;
                        this.monsterHit.push(m.id);
                        let damageRatio = m.flying ? flyingDamageRatio : 1;
                        this.shooter.performAttackOriginal(m, damageRatio);
                    }
                });
            });
            
        }
    }
    
    plasmaBall_update() {
        
    }
    
    
    
    esper_canBuildAt(x, y) {
        if (this.color == 'blue') {
            x = 120 - x;
        }
        const tile = this._ref.getTile(x, y, this);
        if (!tile || ![this.color, 'purple'].includes(tile.color)) {
            return false;
        }
        if (tile.occupied && tile.occupied.color != this.color) {
            return false;
        }
        return true;
    }
    
    _special(specialName, x, y) {
        if (!this.movementSystem) {
            this.movementSystem = this.world.getSystem('Movement');
        }
        if (LEGACY.special[specialName]) {
            specialName = LEGACY.special[specialName];
        }
        const params = this._ref.specialParameters[specialName];
        if (!params) {
            throw new ArgumentError('The wrong special\'s name. Check docs to find available special powers.');
        }
        if (this.color == 'blue') {
            x = 120 - x;
        }
        if (this.specialReadyTimes[specialName] && this.specialReadyTimes[specialName] > this.world.age) {
            return;
        }
        
        this.specialReadyTimes[specialName] = this.world.age + params.specificCooldown;
        if (specialName == 'teleport') {
            const minBase = 10;
            let toPos = this.esper_getEnemyHero().pos.copy();
            let pos = new Vector(x, y);
            let dir = toPos.copy().subtract(pos);
            let d = dir.magnitude();
            d = Math.min(params.distance, d - minBase);
            toPos = pos.copy().add(dir.normalize().multiply(d));
            dir = toPos.copy().subtract(pos);
            const scale = params.range / 6;
            const fteleport = this._ref.instabuild('from-teleport', x, y, 'from-teleport');
            fteleport.setScale(scale);
            if (this.color == 'blue') {
                fteleport.rotation = Math.PI;
                fteleport.keepTrackedProperty('rotation');
            }
            fteleport.lifespan = params.cooldown;
            const tteleport = this._ref.instabuild('to-teleport', toPos.x, toPos.y, 'to-teleport');
            tteleport.setScale(scale);
            tteleport.lifespan = params.cooldown;
            const rangeSq = params.range * params.range;
            for (let m of this._ref.monsters) {
                if (m.distanceSquared(pos) < rangeSq) {
                    m.pos = m.pos.add(dir);
                    m.keepTrackedProperty('pos');
                    m.stunTime = this.world.age + params.stunDuration;
                }
            }
            this._ref.anomalies.push({
                force: 0,
                x: x,
                y: y,
                endX: toPos.x,
                endY: toPos.y,
                name: specialName,
                duration: params.cooldown});
        }
        else {
            this.movementSystem.addMagneticField({
                force: params.force,
                radius: params.range,
                pos: Vector(x, y),
                attenuates: false,
                duration: params.duration,
                source: this
                });
            const effect = this._ref.instabuild(specialName, x, y);
            effect.setScaleX(params.range / 6);
            effect.setScaleY(0.75 * params.range / 6);
            effect.lifespan = params.duration;
            this._ref.anomalies.push({
                force: params.force,
                x: x,
                y: y,
                endX: x,
                endY: y,
                name: specialName,
                duration: params.duration});
        }
        this.unblockTime = this.world.age + params.cooldown;
        this.isBusy = true;
        this.intention = 'casting';
        this.setAction('casting');
        this.act();
        return this._block();
    }
    
    esper_isReady(specialName) {
        if (!specialName) {
            return false;
        }
        if (this.specialReadyTimes[specialName] && this.specialReadyTimes[specialName] > this.world.age) {
            return false;
        }
        return true;
    }
    
    esper_findTowers() {
        return this.world.thangs.filter((t) => t.exists && t.isTower);
    }
    
    esper_findMyTowers() {
        return this.world.thangs.filter((t) => t.exists && t.isTower && t.color == this.color);
    }
    
    esper_findEnemyTowers() {
        return this.world.thangs.filter((t) => t.exists && t.isTower && t.color != this.color);
    }
    
    esper_findMyGuards() {
        return this.world.thangs.filter((g) => g.exists && g.type == 'guard' && g.color == this.color);
    }
    
    esper_findEnemyGuards() {
        return this.world.thangs.filter((g) => g.exists && g.type == 'guard' && g.color != this.color);
    }
    
    esper_getEnemyHero() {
        if (this.color == 'red') {
            return this.world.getThangByID('Hero Placeholder 1');
        }
        else {
            return this.world.getThangByID('Hero Placeholder');
        }
    }
    
    esper_getWaveNumber() {
        return this._ref.waveNumber;
    }
    
    esper_getCurrentWave() {
        return this.esper_getWave(this._ref.waveNumber);
    }
    
    esper_getNextWave() {
        return this.esper_getWave(this._ref.waveNumber + 1);
    }
    
    esper_getWave(waveNumber) {
        return this.esper_getWaves()[waveNumber];
    }
    
    esper_getWaves() {
        return this._ref.getWaves();
    }
    
    esper_getTowerParameters(towerType, level=1) {
        level = Math.min(20, level);
        const params = this._ref.towerParameters[towerType];
        if (!params) {
            throw new ArgumentError('The wrong tower\'s type. Check docs to find available tower types.');
        }
        if (!level || level < 1) {
            throw new ArgumentError('The wrong tower\'s level. Try to use a natural number greater than 0.');
        }
        let attackDamage = Math.round(params.attackDamage * ( 1 + Math.log(level) / Math.log(this._ref.towerParameters.levelCoef)));
        let attackRange = params.attackRange;
        if (towerType == 'archer' || towerType == 'mage') {
            attackRange += params.levelAttackRange * (level - 1);
        }
        let attackCooldown = params.attackCooldown;
        let blastRadius = params.blastRadius;
        let flyingDamageRatio = params.flyingDamageRatio || 1;
        if (towerType == 'cannon') {
            blastRadius += params.levelBlastRadius * (level - 1);
        }
        let specialFactor = params.specialFactor;
        if (towerType == 'frost') {
            specialFactor += params.levelSpecialFactor * (level - 1);
        }
        let specialDuration = params.specialDuration;
        return {
            type: towerType,
            level,
            attackDamage,
            attackRange,
            attackCooldown,
            blastRadius,
            specialFactor,
            specialDuration,
            cost: this._ref.towerParameters.cost,
            flyingDamageRatio
        };
    }
    
    esper_findActiveAnomalies() {
        let anomalies = this._ref.anomalies.map((f) => {
            return {
                force: f.force,
                x: this.color == 'blue' ? 120 - f.x : f.x,
                y: f.y,
                endX: this.color == 'blue' ? 120 - f.endX : f.endX,
                endY: f.endY,
                name: f.name,
                type: f.name,
                duration: f.duration
            };
        });
        return anomalies;
    }
    
    esper_getMonsterParameters(monsterType) {
        const params = this._ref.monsterParameters[monsterType];
        if (!params) {
            throw new ArgumentError('The wrong monster\'s type.');
        }
        return {
            type: monsterType,
            attackDamage: params.attackDamage,
            attackRange: params.attackRange,
            mana: params.cost,
            maxSpeed: params.maxSpeed,
            flying: params.flying
        };
    }
    
    preCheckMonster(tower, monster) {
        
        const pos = monster.pos;
        return pos.x >= tower.leftRange && pos.x <= tower.rightRange && pos.y >= tower.bottomRange && pos.y <= tower.topRange;
    }
    
    distanceSq(tower, monster) {
        if (monster.dead || monster.markedDead) return Infinity;
        return tower.distanceSquared(monster);
    }
    
    _setTargeting(tower, targetType) {
        if (!tower.isTower) {
            throw new ArgumentError('The `tower` argument should be an actual tower.');
        }
        if (tower.color != this.color) {
            throw new ArgumentError('You can set targeting for your towers only.');
        }
        if (!['left', 'right', 'close', 'weak', 'strong'].includes(targetType)) {
            throw new ArgumentError("The targetting type should be one of: 'left', 'right', 'close', 'weak', 'strong'.");
        }
        this.performSetTargeting(tower, targetType);
    }
    
    performSetTargeting(tower, targetType) {
        if (targetType == 'close') {
            tower.chooseAction = this.tower_attackNearest.bind(this, tower);
        }
        else if (targetType == 'left' && this.color == 'red') {
            tower.chooseAction = this.tower_attackLeft.bind(this, tower);
        }
        else if (targetType == 'right' && this.color == 'red') {
            tower.chooseAction = this.tower_attackRight.bind(this, tower);
        }
        else if (targetType == 'right' && this.color == 'blue') {
            tower.chooseAction = this.tower_attackLeft.bind(this, tower);
        }
        else if (targetType == 'left' && this.color == 'blue') {
            tower.chooseAction = this.tower_attackRight.bind(this, tower);
        }
        else if (targetType == 'weak') {
            tower.chooseAction = this.tower_attackWeak.bind(this, tower);
        }
        else if (targetType == 'strong') {
            tower.chooseAction = this.tower_attackStrong.bind(this, tower);
        }
        tower.targetingType = targetType;
    }
    
    tower_attackNearest(tower) {
        let closest = null;
        let mind = Infinity;
        let d = 0;
        for (let m of this._ref.monsters) {
            d = this.distanceSq(tower, m);
            if (d <= tower.attackRangeSquared && d < mind) {
                closest = m;
                mind = d;
            }
        }
        return closest && tower.attack(closest);
    }
    
    tower_attackLeft(tower) {
        let leftest = null;
        let minX = Infinity;
        let d = 0;
        for (let m of this._ref.monsters) {
            d = this.distanceSq(tower, m);
            if (d > tower.attackRangeSquared) continue;
            if (m.pos.x > minX) continue;
            if (m.pos.x == minX && d > m.lastD) continue;
            minX = m.pos.x;
            leftest = m;
            m.lasdD = d;
        }
        return leftest && tower.attack(leftest);
    }
    
    tower_attackRight(tower) {
        let rightest = null;
        let maxX = -Infinity;
        let d = 0;
        for (let m of this._ref.monsters) {
            d = this.distanceSq(tower, m);
            if (d > tower.attackRangeSquared) continue;
            if (m.pos.x < maxX) continue;
            if (m.pos.x == maxX && d > m.lastD) continue;
            maxX = m.pos.x;
            rightest = m;
            m.lasdD = d;
        }
        return rightest && tower.attack(rightest);
    }
    
    tower_attackWeak(tower) {
        let weakest = null;
        let minH = Infinity;
        let d = 0;
        for (let m of this._ref.monsters) {
            d = this.distanceSq(tower, m);
            if (d > tower.attackRangeSquared) continue;
            if (m.health > minH) continue;
            if (m.health == minH && d > m.lastD) continue;
            minH = m.health;
            weakest = m;
            m.lasdD = d;
        }
        return weakest && tower.attack(weakest);
    }
    
    tower_attackStrong(tower) {
        let strongest = null;
        let maxH = -Infinity;
        let d = 0;
        for (let m of this._ref.monsters) {
            d = this.distanceSq(tower, m);
            if (d > tower.attackRangeSquared) continue;
            if (m.health < maxH) continue;
            if (m.health == maxH && d > m.lastD) continue;
            maxH = m.health;
            strongest = m;
            m.lasdD = d;
        }
        return strongest && tower.attack(strongest);
    }

    unblockHero() {
        this.unblockTime = null;
        this.isBusy = null;
        this.intention = null;
        this.setAction('idle');
        this.actionHeats.all = 0;
        if (this.lastTower) {
            let tower = this.lastTower;
            this.lastTower = null;
            this.waitingToUnblockReturnValue = tower;
            return this._unblock(tower);
        }
        else {
            return this._unblock();
        }
    }
    update() {
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
        if (this.intention == 'waiting' && this.nextMethod) {
            this[this.nextMethod].bind(this)();
            this.nextMethod = null;
        }
        this.unblockHero();
    }
    
    spawnGuard(place) {
        if (this.dead) {
            return;
        }
        const params = this._ref.guardParameters;
        let {x, y} = this._ref.getPointCoordinates(place, this);
        // x -= 5;
        if (this.color == 'blue') {
            x = 120 - x;
        }
        // debugger
        this.iaiBuildXY('yeti', x, y);
        const guard = this.performBuild(`${this.color}-yeti`);
        guard.commander = null;
        guard.owner = this;
        guard.sayWithoutBlocking = () => {};
        guard.homePos = {x, y};
        // colossus.type = colossusType;
        guard.actionsShouldBlock = true;
        guard.attackDamage = params.attackDamage;
        guard.actions.attack.cooldown = params.attackCooldown;
        guard.attackCooldown = params.attackCooldown;
        guard.attackRange = params.attackRange;
        guard.maxHealth = params.maxHealth;
        guard.health = params.maxHealth;
        guard.maxSpeed = params.maxSpeed;
        guard.keepTrackedProperty('maxSpeed');
        guard.keepTrackedProperty('maxHealth');
        guard.keepTrackedProperty('health');
        guard.keepTrackedProperty('attackDamage');
        guard.keepTrackedProperty('attackRange');
        guard.type = 'guard';
        if (this.color == 'blue') {
            guard.rotation = Math.PI;
            guard.keepTrackedProperty('rotation');
        }
        guard.color = this.color;
        guard.appendMethod('die', this.guardDie.bind(this, guard));
        this.triggerSpawnGuardEvent(guard, place);
        // console.log(this.world.age, this.eventHandlers[eName]);
        
        this.guards[place] = guard;
        this.setupGuardAPI(guard, place, params);
        return guard;
        
    }

    triggerSpawnGuardEvent(guard, place) {
        const eName = `spawn-guard`;
        if (this.eventHandlers[eName] && this.eventHandlers[eName][0]) {
            guard.on('spawn', this.eventHandlers[eName][0]);
            guard.trigger('spawn', {guard, place});
            guard.spawnTriggered = true;
        }
    }
    
    setupGuardAPI(guard, place, params) {
        guard.place = place;
        guard.isGuard = true;
        guard.color = this.color;
        guard.moveToward = function(x, y) {
            if (this.color == 'blue') {
                x = 120 - x;
            }
            return this.move(new Vector(x, y));
        };
        guard._moveXY = guard.moveXY;
        guard.moveTo = function(x, y) {
            if (this.color == 'blue') {
                x = 120 - x;
            }
            return this._moveXY(x, y);
        };
        guard.findMonsters = () => this._ref.monsters.filter((m) => m.exists && !m.dead && !m.markedDead);
        guard.findNearestMonster = function() {
            return this.findNearest(this.findMonsters());
        };
        guard.specialCooldowns = {};
        for (let sname of Object.keys(params.specialParams)) {
            guard.specialCooldowns[sname] = 0;
            guard.addActions({name: sname, cooldown: params.specialParams[sname].cooldown});
        }
        guard.specialParams = params.specialParams;
        guard.special = this.guardSpecial.bind(this, guard);
        guard.isReady = this.guardIsReady.bind(this, guard);
        guard.appendMethod('update', this.guardUpdate.bind(this, guard));
    }
    
    guardUpdate(guard) {
        if (guard.blockedTime && guard.blockedTime <= this.world.age) {
            guard.blockedTime = null;
            return guard.unblock();
        }
    }
    
    guardDie(guard) {
        let eColor = guard.color == 'red' ? 'blue' : 'red';
        // this._ref.addMana(eColor, colossus.cost);
        this._ref.setTimeout(() => {
            guard.setExists(false);
            this.spawnGuard(guard.place);
        }, this._ref.guardParameters.respawnTime || 2);
    }
    
    guardSpecial(guard, name, ...args) {
        const sParams = guard.specialParams[name];
        if (!sParams) {
            // TODO
            throw Error('TODO Wrong special name');
        }
        if (guard.specialCooldowns[name] && guard.specialCooldowns[name] > this.world.age) {
            guard.blockedTime = this.world.age + this.world.dt;
            console.log(this.world.age, "early blocked");
            return guard.block();
        }
        guard.specialCooldowns[name] = this.world.age + sParams.specificCooldown;
        guard.blockedTime = this.world.age + sParams.cooldown;
        this[`guardSpecial_${name}`](guard, sParams, ...args);
        return guard.block();
    }
    
    guardIsReady(guard, name, ...args) {
        const sParams = guard.specialParams[name];
        if (!sParams) {
            return false;
        }
        if (guard.specialCooldowns[name] && guard.specialCooldowns[name] > this.world.age) {
            return false;
        }
        return true;
    }
    
    guardSpecial_roar(guard, params) {
        const args = [
            parseFloat(guard.pos.x.toFixed(2)),
            parseFloat(guard.pos.y.toFixed(2)),
            parseFloat(params.range.toFixed(2)),
            '#5AFF00', 0, Math.PI * 2];
        this.addCurrentEvent(`aoe-${JSON.stringify(args)}`);
        guard.setAction('roar');
        for (let m of this._ref.monsters) {
            if (guard.distance(m) <= params.range) {
                m.aggro = guard;
                m.attack(guard);
            }
        }            
    }
    
    guardSpecial_hide(guard, params) {
        guard.setAlpha(0.3);
        guard.setAction('idle');
        for (let m of this._ref.monsters) {
            if (m.aggro == guard) {
                m.aggro = null;
                m.chooseAction();
            }
        }
        this._ref.setTimeout(() => guard.setAlpha(1), params.cooldown);
    }
    
    guardSpecial_home(guard, params) {
        guard.setAction('idle');
        guard.pos.x = guard.homePos.x;
        guard.pos.y = guard.homePos.y;
        guard.keepTrackedPos('pos');
        // this._ref.setTimeout(() => guard.setAlpha(1), params.cooldown);
    }
    
    guardSpecial_haste(guard, params) {
        guard.effects = guard.effects.filter((e) => e.name != 'haste');
        guard.addEffect({name: 'haste', duration: params.duration, reverts: true, factor: params.factor, targetProperty: 'maxSpeed'});
    }
}); 