const Vector = require('lib/world/vector');

const RED = 'red';
const BLUE = 'blue';
const TEAMS = [RED, BLUE];
const HEAL = 'heal';
const COOLDOWN = 'cooldown';
const ITEM_TYPES = [HEAL, COOLDOWN];
const STORM = 'storm';

({
    setUpLevel () {
        this.heroes = [this.hero, this.hero1];
        this.heroesByColor = {
            [RED]: this.hero,
            [BLUE]: this.hero1
        };
        this.hero.enemy = this.hero1;
        this.hero1.enemy = this.hero;
        this.hero.opponent = this.hero1;
        this.hero1.opponent = this.hero;
        this.heroes.forEach((h) => {
            h._ref = this;
            h.health = this.winScore;
            h.maxHealth = this.winScore;
            h.keepTrackedProperty('health');
            h.keepTrackedProperty('maxHealth');
        });
        this.units = [];
        if (this.DEBUG_MODE) {
            this.hero.esper_enemyDebug = (fn) => {
                this.hero1.didTriggerSpawnEvent = true;
                this.hero1._aetherAPIOwnMethodsAllowed = 1;
                this.hero1.on('spawn', fn);
            };
        }
        this.scoreUI = {
            [RED]: this.getByID(`${RED}-score`),
            [BLUE]: this.getByID(`${BLUE}-score`)
        };
        this.baskets = {
            [RED]: this.getByID(`${RED}-basket`),
            [BLUE]: this.getByID(`${BLUE}-basket`)
        };
        this.unitBumpRangeSquared = this.unitBumpRange * this.unitBumpRange;
        
    },
    onFirstFrame() {
        
        this.setInterval(this.createItem.bind(this), this.itemParams.spawnInterval);
    },
    
    checkGoals() {
        if (this.world.age > this.maxTime) {
            debugger
            if (this.hero.score == this.hero1.score) {
                if (this.world.rand.randf() > 0.5) {
                    this.hero.score += 1;
                }
                else {
                    this.hero1.score += 1;
                }
            }
            if (this.hero.score > this.hero1.score) {
                this.winGoal('red-win');
                this.failGoal('blue-win');
                return 'red';
            }
            else if (this.hero1.score > this.hero.score) {
                this.winGoal('blue-win');
                this.failGoal('red-win');
                return 'blue';
            }
        }
        else if (this.world.age > this.resolveTime) {
            if (this.hero.score > this.hero1.score) {
                this.winGoal('red-win');
                this.failGoal('blue-win');
                return 'red';
            }
            else if (this.hero1.score > this.hero.score) {
                this.winGoal('blue-win');
                this.failGoal('red-win');
                return 'blue';
            }
        }
        else if (this.hero.score >= this.winScore && this.hero.score > this.hero1.score) {
            this.winGoal('red-win');
            this.failGoal('blue-win');
            return 'red';
        }
        else if (this.hero1.score >= this.winScore && this.hero1.score > this.hero.score) {
            this.winGoal('blue-win');
            this.failGoal('red-win');
            return 'blue';
        }
        return null;
    },
    
    swapUnits() {
        const m = this.middleY * 2;
        for (let u of this.units) {
            if (!u.markedToSwap) { continue }
            u.lane = u.lane == 1 ? 2 : 1;
            u.pos = Vector(u.pos.x, m - u.pos.y, u.pos.z);
            u.keepTrackedProperty('pos');
            if (u.targetPos) {
                u.targetPos = Vector(u.targetPos.x, m - u.targetPos.y, u.targetPos.z);
                u.nextTargetPos = u.targetPos.copy();
            }
            else {
                u.nextTargetPos = null;
            }
            if (u.route) {
                u.route = u.route.map(r => Vector(r.x, m - r.y));
            }
            u.markedToSwap = false;
        }
    },

    createSands(lane) {
        const points = this.sandPoints[lane];
        for (let p of points) {
            let qs = this.instabuild('quicksand', p[0], p[1]);
            qs.lifespan = this.specialParameters.quicksand.cooldown;
        }
    },
    
    createPalm(lane, color) {
        const points = this.palmPoints[lane];
        let sp, ep;
        if (color == RED) {
            sp = points[0];
            ep = points[1];
        }
        else {
            sp = points[1];
            ep = points[0];
        }
        let palm = this.instabuild('palm', sp[0], sp[1]);
        palm.lifespan = (ep[0] - sp[0]) / palm.maxSpeed;
        palm.moveXY(ep[0], ep[1]);
    },
    
    createWind(lane, color) {
        const points = this.palmPoints[lane];
        const sp = points[0];
        const ep = points[1];
        let dir;
        if (color == RED) {
            dir = 0;
        }
        else {
            dir = Math.PI;
        }
        for (let x = sp[0]; x <= ep[0]; x += 10) {
            let wind = this.instabuild('wind', x, sp[1]);
            wind.lifespan = 0.5;
            wind.rotation = dir;
            wind.keepTrackedProperty('rotation');
        }
    },
    
    createItem(mirroredItem=null) {
        const rect = this.rectangles[`item${this.world.rand.rand(4)}`];
        const pos = this.pickPointFromRegion(rect);
        const itemType = this.world.rand.choice(ITEM_TYPES);
        const item = this.instabuild(`item-${itemType}`, pos.x, pos.y);
        item.lifespan = this.itemParams.lifespan;
        item.type = itemType;
        this.createMirroredItem(item);
    },
    
    createMirroredItem(mirroredItem) {
        const mirrorItem = this.instabuild(`item-${mirroredItem.type}`, 120 - mirroredItem.pos.x, mirroredItem.pos.y);
        mirrorItem.lifespan = mirroredItem.lifespan;
        mirrorItem.type = mirroredItem.type;
    },

    updateScore() {
        for (let h of this.heroes) {
            this.scoreUI[h.color].sayWithDuration(99, h.score);
            h.health = this.winScore - h.opponent.score;
            h.keepTrackedProperty('health');
        }
    },
    
    checkItems() {
        const sandstorms = this.world.thangs.filter((th) => th.exists && th.type == STORM);
        const items = this.world.thangs.filter((th) => th.exists && th.isCollectable && !th.caught);
        for (let item of items) {
            let ss = item.findNearest(sandstorms);
            if (!ss) { continue };
            if (ss.distanceSquared(item) <= ss.damageSqRange) {
                item.caught = true;
                let h = this.heroesByColor[ss.color];
                item.moveXY(h.pos.x, h.pos.y);
                item.onCollect = this.onItemCollect.bind(this, item);
            }
        }
    },

    onItemCollect(item, hero) {
        if (item.type == COOLDOWN) {
            for (let special in hero.specialReadyTimes) {
                if (hero.specialReadyTimes[special]) {
                    // let prev = hero.specialReadyTimes[special];
                    hero.specialReadyTimes[special] -= this.itemParams.reduceCooldowns;
                    // console.log(this.world.age, `hero ${hero.color} cooldown ${special} was reduced from ${prev} to ${hero.specialReadyTimes[special]}`);
                }
            }
        }
        if (item.type == HEAL) {
            for (let unit of hero.units) {
                if (!unit.exists || unit.dead || unit.isOut || unit.health <= 0) { continue }
                unit.health = Math.min(unit.health + this.itemParams.healAmount, unit.maxHealth);
                unit.keepTrackedProperty('health');
                if (unit.effects) {
                    unit.effects = unit.effects.filter((e) => e.name != 'heal');
                    unit.addEffect({name: 'heal', duration: 0.2, reverts: true, setTo: true, targetProperty: 'beingHealed'});
                }
            }
        }
    },

    chooseAction() {
        this.updateScore();
        this.checkItems();
        this.gameWon = this.checkGoals();

        if (this.gameWon) { return }
        this.units = this.units.filter(u => u.exists && !u.dead && !u.isOut);
        for (let h of this.heroes) {
            h.units = h.units.filter(u => u.exists && !u.dead && !u.isOut);

        }
        
        this.swapUnits();
        
        for (let un of this.units) {
            let nearestEnemy = un.findNearestEnemy();
            if (nearestEnemy && un.distanceSquared(nearestEnemy) <= this.unitBumpRangeSquared) {
                
                nearestEnemy.takenDamage = (nearestEnemy.takenDamage || 0) + un.attackDamage;
                nearestEnemy.damageAttacker = un;
                nearestEnemy.appliedVelocity = nearestEnemy.pos.copy()
                    .subtract(un.pos).normalize()
                    .multiply(un.push * un.maxHealth * this.bumpCoef / nearestEnemy.maxHealth)
                    .limit(this.bumpLimit);
                
            }
        }
        for (let un of this.units) {
            if (un.takenDamage) {
                un.takeDamage(un.takenDamage, un.damageAttacker);
                
                un.takenDamage = 0;
            }
        }
        
    }
    });