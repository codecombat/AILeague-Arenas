const {ArgumentError} = require('lib/world/errors');

const RED = 'red';
const BLUE = 'blue';

const TREASURE = 'treasure';
const STATUE = 'statue';
const MONSTER = 'monster';

const exploreTime = {
    [TREASURE]: 1,
    [STATUE]: 1,
    [MONSTER]: 1,
};

(class GoblinsAndGloryPlayerAPI extends Component {
    attach(thang) {
        super.attach(thang);
        thang.color = thang.id == 'Hero Placeholder' ? RED : BLUE;


        // Player API
        thang.oMoveTo = thang.moveTo;
        thang.oAttack = thang.attack;
        thang.oSay = thang.say;
        
        thang.moveTo = this._moveTo.bind(thang);
        thang.explore = this._explore.bind(thang);
        thang.wait = this._wait.bind(thang);
        thang.whatAtPoint = this._whatAtPoint.bind(thang);
        thang.home = this._home.bind(thang);
        // thang.attack = this._attack.bind(thang);
        
        // For the direct control of
        thang._unblock = thang.unblock;
        thang.unblock = () => {};
        thang._block = thang.block;
        thang.block = () => {};
        thang.unblockingTime = 0;
        
        Object.defineProperty(thang, 'currentPoint', {
            get: () => {
                let points = thang.ref.points;
                if (thang.color == BLUE) {
                    points = points.filter(p => p.pointNumber >= 1000);
                }
                if (thang.color == RED) {
                    points = points.filter(p => p.pointNumber < 1000);
                }
                return thang.getNearest(points).pointNumber;
            }
        });
        
        
        Object.defineProperty(thang, 'targetPoint', {
            get: () => {
                if (thang.color == BLUE) {
                    return thang.ref.mirrorPointNumber(thang._targetPoint) || null;
                }
                return thang._targetPoint || null;
            }
        });

        Object.defineProperty(thang, 'opponent', {
            get: () => {
                return thang.ref.heroesByColor[thang.color == RED ? BLUE : RED];
            }
        });

        Object.defineProperty(thang, 'speed', {
            get: () => {
                return thang.maxSpeed;
            }
        });
        Object.defineProperty(thang, 'time', {
            get: () => {
                return thang.world.age;
            }
        });

        Object.defineProperty(thang, 'attackCooldown', {
            get: () => {
                return thang.actions.attack.cooldown;
            }
        });

        Object.defineProperty(thang, 'dps', {
            get: () => {
                return thang.attackDamage / thang.attackCooldown;
            }
        });

        Object.defineProperty(thang, 'glory', {
            get: () => {
                return thang.teamPower;
            }
        });

        thang.appendMethod('takeDamage', this._takeDamage.bind(thang));
        thang.addAction('power-up', 0);
        thang.addAction('power-up-armor', 0);
    }
    
    // performAttack(who) {
    //     this.ref.attacked(this, who);
    //     return this._unblock();
    // }
    
    clearSpeech() {
        return this._unblock();
    }

    _takeDamage (damage, attacker) {
        // this.tell("sda")
        this.enemy = attacker;
        this.brake();
        this.setAction('idle');
        this.setTargetPos(null);
        this.setTarget(null);
        this.moveToTarget = null;
        this.intention = "fighting";
        // this.endMultiFrameMove();
        // this.velocity = new Vector(0, 0);
        this.setAction('attack');
        this.act();
        this.performAttack(attacker);
        return this._block();
    }

    stopMoveTo() {
        this.setTargetPos(null);
        this._targetPoint = null;
        return this.heroUnblock();
    }

    _moveTo(point) {
        if (point == null) {
            throw new ArgumentError('moveTo requires a point argument');
        }
        // todo check it's number and trying to move a point less than 1000

        if (this.color == BLUE) {
            point += 1000;
        }
        this.intention = 'moveTo';
        
        const mresult = this.oMoveTo(point);
        this._targetPoint = this.moveToTarget;
        return this._block();
    }
    
    
    _explore() {
        const thang = this.ref.getThangByPoint(this.currentPoint);
        if (thang && thang.active && !thang.blocked) {
            if (thang.type == TREASURE) {
                return this.exploreTreasure(thang);
            } else if (thang.type == MONSTER) {
                // return this.exploreMonster(thang);
            } else if (thang.type == STATUE) {
                return this.exploreGlory(thang);
            }
        } 
        else {
            return this.tell("Nothing is here.");
        }
    }
    
    _attack(who) {
        return this.oAttack(who);
    }

    _whatAtPoint(point) {
        if (this.color == BLUE) {
            point += 1000;
        }
        const thang = this.ref.getThangByPoint(point);
        return thang || null;
    }

    _home() {
        this.intention = 'home';
        this.unblockingTime = this.time + this.ref.gameParameters.hero.teleportTime;
        this.setAction('power-up-armor');
        this.setAlpha(0.5);
        return this._block();
    }

    exploreTreasure(thang) {
        // if(thang.active) {
        //     this.say("A chest! Wowee!");
        // } else {
        //     //this.say("This chest has been looted");
        // }
        this.setRotation(thang.pos.copy().subtract(this.pos).heading());
        this.setAction('attack');
        this.intention = 'explore';
        thang.blocked = true;
        this.exploring = thang;
        this.unblockingTime = this.world.age + exploreTime[TREASURE];
        return this._block();
    }

    exploreMonster(thang) {
        if (thang.health > 0) {
            this.say("I see an enemy!");
        } else {
            this.say("This area is clear");
        }
    }

    exploreGlory(thang) {
        // if(thang.active) {
        //     this.say("I see a shrine!");
        // } else {
        //     //this.say("This shrine is out of glory")
        // }
        this.setRotation(thang.pos.copy().subtract(this.pos).heading());
        this.setAction('power-up');
        this.intention = 'explore';
        thang.blocked = true;
        this.exploring = thang;
        this.unblockingTime = this.world.age + exploreTime[STATUE];
        return this._block();
    }
    
    tell(phrase) {
        this.unblockingTime = this.world.age + 1;
        this.sayWithoutBlocking(phrase);
        this.intention = 'tell';
        return this._block();
    }
    
    _wait(time) {
        this.intention = 'wait';
        this.unblockingTime = this.world.age + time;
        this.setAction('idle');
        return this._block();
    }
    
    heroUnblock() {
        this.setAction('idle');
        this.intention = null;
        return this._unblock();
    }
    
    update() {
        if (this.unblockingTime && this.unblockingTime > this.world.age) {
            return;
        }
        if (this.intention == 'fighting' && this.enemy) {
            if (this.actionHeats && this.actionHeats.all > 0) {
                return;
            }
            if (this.enemy.dead) {
                this.enemy = null;
                this.intention = 'moveTo';
                if (this._targetPoint != null) {
                    let target = this._targetPoint;
                    const thresholdSq = target.moveToDistanceSquared || this.moveToDistanceSquared;
                    if (this.distanceSquared(target) <= thresholdSq) {
                        return this._unblock();
                    }
                    else {
                        this.oMoveTo(target.id);
                        return this._block();
                    }
                }
                else {
                    return this._unblock();
                }
            }
        }
        if (this.intention == 'tell') {
            this.clearSpeech();
            return this.heroUnblock();
        }
        if (this.intention == 'explore') {
            this.intention = null;
            this.ref.explored(this, this.exploring);
            this.setAction('idle');
            return this.heroUnblock();
        }
        if (this.intention == 'wait') {
            this.intention = null;
            return this.heroUnblock();
        }
        if (this.intention == 'home') {
            this.intention = null;
            this.ref.teleportHome(this);
            this.setAction('idle');
            this.setAlpha(1);
            return this.heroUnblock();
        }
        
    }

});