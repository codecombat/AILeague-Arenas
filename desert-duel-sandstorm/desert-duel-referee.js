const Vector = require('lib/world/vector');

const RED = 'red';
const BLUE = 'blue';
const TEAMS = [RED, BLUE];

({
    setUpLevel () {
        this.heroes = [this.hero, this.hero1];
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
    },
    
    checkGoals() {
        if (this.world.age > this.maxTime) {
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
    
    updateScore() {
        for (let h of this.heroes) {
            this.scoreUI[h.color].sayWithDuration(99, h.score);
            h.health = this.winScore - h.opponent.score;
            h.keepTrackedProperty('health');
        }
    },
    
    chooseAction() {
        this.updateScore();
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
                    .multiply(un.push * un.mass * this.bumpCoef / nearestEnemy.mass)
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