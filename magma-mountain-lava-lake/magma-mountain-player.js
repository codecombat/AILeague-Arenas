const {ArgumentError} = require('lib/world/errors');

const RED = 'red';
const BLUE = 'blue';
const LEFT = 'left';
const RIGHT = 'right';
const DOWN = 'down';
const UP = 'up';
const DIR_PAIRS = {
    [LEFT]: RIGHT,
    [RIGHT]: LEFT,
    [DOWN]: UP,
    [UP]: DOWN
};

const DIRECTIONS = [LEFT, RIGHT, DOWN, UP];
const DIRECTION_DIFFS = {
    [LEFT]: {x: -1, y: 0},
    [RIGHT]: {x: 1, y: 0},
    [DOWN]: {x: 0, y:-1},
    [UP]: {x: 0, y: 1}
};

const DIRECTION_ROTATION = {
    [LEFT]: 0,
    [RIGHT]: Math.PI,
    [DOWN]: Math.PI * 1.5,
    [UP]: Math.PI * 0.5
};

const JUMP = 'jump';
const DASH = 'dash';
const FIRE = 'fire';
const THROW = 'throw';

(class MagmaBugPlayer extends Component {
    constructor(config) {
        super(config);
    }

    attach(thang) {
        super.attach(thang);
        thang.contextMM = this.getCodeContext() || {};
        thang.color = thang.id == 'Hero Placeholder' ? RED : BLUE;
        thang.sign = thang.id == 'Hero Placeholder' ? 1 : -1;

        thang.moveRight = this._moveDirection.bind(thang, 'right');
        thang.moveLeft = this._moveDirection.bind(thang, 'left');
        thang.moveDown = this._moveDirection.bind(thang, 'down');
        thang.moveUp = this._moveDirection.bind(thang, 'up');
        thang.moveDirection = this._moveDirection.bind(thang);
        thang.moveForward = this._moveForward.bind(thang);
        thang.isReady = this._isReady.bind(thang);
        thang.turn = this._turn.bind(thang);
        
        thang.jump = this._jump.bind(thang);
        thang.dash = this._dash.bind(thang);
        thang.fire = this._fire.bind(thang);
        thang.throw = this._throw.bind(thang);

        thang.abilityCooldowns = {
            [JUMP]: 0,
            [DASH]: 0,
            [FIRE]: 0,
            [THROW]: 0
        };
        thang.isReady = this._isReady.bind(thang);
        thang.lastDirection = thang.color == RED ? RIGHT : LEFT;
        Object.defineProperty(thang, 'speed', {
            get: () => thang.maxSpeed
        });
        thang.findItems = this._findItems.bind(thang);
        thang.findNearestItem = this._findNearestItem.bind(thang);
        thang.getLavaMap = this._getLavaMap.bind(thang);
        thang.lavaAtXY = this._lavaAtXY.bind(thang);
        Object.defineProperty(thang, 'angle', {
            get: function() {
                if (!this.hero1) {
                    this.hero1 = this.world.getThangByID('Hero Placeholder');
                }
                if (!this.hero2) {
                    this.hero2 = this.world.getThangByID('Hero Placeholder 1');
                }
                if (this.hero2._aetherAPIOwnMethodsAllowed) {
                    return (this.rotation + Math.PI) % (2 * Math.PI);
                }
                return this.rotation;
            }
        });
        Object.defineProperty(thang, 'direction', {
            get: function() {
                if (!this.hero1) {
                    this.hero1 = this.world.getThangByID('Hero Placeholder');
                }
                if (!this.hero2) {
                    this.hero2 = this.world.getThangByID('Hero Placeholder 1');
                }
                if (this.hero2._aetherAPIOwnMethodsAllowed) {
                    return DIR_PAIRS[this.lastDirection];
                }
                return this.lastDirection;
            }
        });
        // thang._setAction = thang.setAction;
        // thang.setAction = (action) => {
        //     if (thang.color == RED) {
        //         debugger;
        //     }
        //     return thang._setAction(action);
        // }
    }



    _moveDirection(direction, steps=1, compensateFrame=false) {
        if (steps == null || typeof(steps) !== 'number' || steps <= 0) {
            throw new ArgumentError("Steps should be a positive number", `move${_.string.capitalize(direction)}`, "steps", "number", steps);
        }
        if (this.color == BLUE) {
            direction = DIR_PAIRS[direction];
        }
        
        const diff = DIRECTION_DIFFS[direction];
        this.lastDirection = direction;
        steps = Math.ceil(steps);
        if (compensateFrame) {
            const frameStep = this.maxSpeed * this.world.dt;
            this.pos.x = this.pos.x + diff.x * frameStep;
            this.pos.y = this.pos.y + diff.y * frameStep;
            return this.moveXY(this.pos.x + 2 * this.ref.step * diff.x * steps - frameStep * diff.x,
                this.pos.y + 2 * this.ref.step * diff.y * steps - frameStep * diff.y);
        }
        else {
            return this.moveXY(this.pos.x + 2 * this.ref.step * diff.x * steps, this.pos.y + 2 * this.ref.step * diff.y * steps);
        }
        
    }

    _moveForward(steps=1) {
        if (steps == null || typeof(steps) !== 'number' || steps <= 0) {
            throw new ArgumentError("Steps should be a positive number", `move${_.string.capitalize(direction)}`, "steps", "number", steps);
        }
        let direction = this.lastDirection;
        if (this.color == BLUE) {
            direction = DIR_PAIRS[direction];
        }
        return this.moveDirection(direction, steps);
    }

    _turn(direction) {
        if (!direction || !DIRECTIONS.includes(direction)) {
            throw new ArgumentError("Direction should be one of 'left', 'right', 'down', 'up'", "turn", "direction", "string", direction);
        }
        if (this.color == BLUE) {
            direction = DIR_PAIRS[direction];
        }
        this.lastDirection = direction;
        this.setRotation(DIRECTION_ROTATION[direction]);
    }

    _isReady(abilityName) {
        
        if (this.abilityCooldowns[abilityName] == null) {
            throw new Error(`There is not an ability ${abilityName}.`);
        }
        return this.abilityCooldowns[abilityName] <= this.world.age;
    }

    _findItems() {
        return this.ref.items.filter(item => item.exists);
    }

    _findNearestItem() {
        return this.findNearest(this.findItems());
    }

    _jump() {
        if (!this.isReady('jump')) {
            
            return false;
        }
        this.abilityCooldowns.jump = this.world.age + this.ref.special.jump.specificCooldown;
        const diff = DIRECTION_DIFFS[this.lastDirection];
        const jumpDistance = this.ref.step * 2 * this.ref.special.jump.steps;
        this.jumpDuration = jumpDistance / this.maxSpeed;
        this.jumpStart = this.world.age;
        return this.moveXY(this.pos.x + jumpDistance * diff.x, this.pos.y + jumpDistance * diff.y);
    }

    _dash() {
        if (!this.isReady('dash')) {
            return false;
        }
        this.abilityCooldowns.dash = this.world.age + this.ref.special.dash.specificCooldown;
        const diff = DIRECTION_DIFFS[this.lastDirection];
        const dashDistance = this.ref.step * 2 * this.ref.special.dash.steps;
        this.maxSpeed *= this.ref.special.dash.speedRatio;
        this.dashDuration = dashDistance / this.maxSpeed;
        this.dashEnd = this.world.age + this.dashDuration;
        return this.moveXY(this.pos.x + dashDistance * diff.x, this.pos.y + dashDistance * diff.y);
    }

    _fire() {
        if (!this.isReady('fire')) {
            return false;
        }
        this.abilityCooldowns.fire = this.world.age + this.ref.special.fire.specificCooldown;
        const diff = DIRECTION_DIFFS[this.lastDirection];
        const firePos = new Vector(this.pos.x + this.ref.step * 2 * diff.x, this.pos.y + this.ref.step * 2 * diff.y);
        const fireball = this.ref.instabuild(this.fireballAsset || 'fireball', firePos.x, firePos.y);
        fireball.color = this.color;
        fireball.maxSpeed = this.maxSpeed * 3;
        fireball.moveXY(firePos.x + 99 * diff.x, firePos.y + 99 * diff.y);
        fireball.appendMethod('update', this.ref.fireballUpdate.bind(this.ref, fireball, this));
        fireball.creator = this;
        fireball.lastDirection = this.lastDirection;
        fireball.power = this.score * this.ref.scoreLavaCoef + this.ref.lavaLifespan;
    }

    _throw(x, y) {
        if (!this.isReady('throw')) {
            return false;
        }
        this.abilityCooldowns.throw = this.world.age + this.ref.special.throw.specificCooldown;
        let throwPos = new Vector(x, y);
        if (this.color == BLUE) {
            throwPos = new Vector(this.maxCoordinateX - x, this.maxCoordinateY - y);
        }
        this.targetPos = throwPos.copy();
        const blob = this.ref.instabuild(`${this.color}-blob`, throwPos.x, throwPos.y);
        const rock = this.ref.instabuild(this.rockAsset || 'rock', throwPos.x, throwPos.y);
        blob.color = this.color;
        blob.targetPos = throwPos;
        const dist = this.distance(throwPos);
        blob.flightTime = dist / this.ref.special.throw.speed;
        blob.lifespan = blob.flightTime + this.world.dt * 2;
        // blob.maxSpeed = this.ref.blobSpeed || 10;
        blob.launch(this);
        this.targetPos = null;
        blob.explode = () => {
            this.ref.explodeBlob(blob, this);
        };
        blob.power = this.score * this.ref.scoreLavaCoef + this.ref.lavaLifespan;
    }

    _getLavaMap() {
        const origMap = this.ref.lavaMap;
        const lavaMap = [];
        // const repeat = this.ref.step;
        const repeat = 1;
        const sign = this.mirrorLavaValues ? -1 : 1;
        for (let row of origMap) {
            for (let i = 0; i < repeat; i++) {
                let newRow = [];
                for (let cell of row) {
                    for (let j = 0; j < repeat; j++) {
                        newRow.push(cell * sign);
                    }
                }
                lavaMap.push(newRow);
            }
        }
        if (this.color == BLUE) {
            lavaMap.reverse();
            lavaMap.forEach(row => row.reverse());
        }
        
        return lavaMap;
    }

    _lavaAtXY(x, y) {
        const lavaMap = this.ref.lavaMap;
        const {step} = this.ref;
        if (this.color == BLUE) {
            x = this.maxCoordinateX - x;
            y = this.maxCoordinateY - y;
        }
        const row = Math.floor(y / step);
        const col = Math.floor(x / step);
        if (row < 0 || row >= lavaMap.length || col < 0 || col >= lavaMap[row].length) {
            return 9999;
        }
        const sign = this.mirrorLavaValues ? -1 : 1;
        return lavaMap[row][col] * sign;
    }
    
    hookOnEndMultiFrameMove() {
        if (this.plansDisabled) {
            // this.prevAction = 'idle';
            this.plansDisabled = false;
        }
    }

    update() {
        if (this.health <= 0) { return; }
        
        
        
        if (this.jumpStart != null) {
            const elapsed = this.world.age - this.jumpStart;
            let z = 10 * elapsed * (this.jumpDuration - elapsed) / Math.pow(this.jumpDuration / 2, 2);
            this.pos.z = Math.max(this.depth / 2, z + this.depth / 2);
            this.keepTrackedProperty('pos');
            if (elapsed >= this.jumpDuration) {
                this.jumpStart = null;
                this.jumpCell = null;
            }
        }
        if (this.dashEnd && this.world.age >= this.dashEnd) {
            this.maxSpeed /= this.ref.special.dash.speedRatio;
            this.dashEnd = null;
        }
        if ((this.plansAreFinished && !this.plansDisabled) || (this.action == 'idle' && this.prevAction == 'idle')) {
            this.prevAction = this.action;
            // return this.moveRight(1);
            // 
            let direction = this.lastDirection;
            if (this.color == BLUE) {
                direction = DIR_PAIRS[direction];
            }
            const compensateFrame = this.prevPos && this.pos.x == this.prevPos.x && this.pos.y == this.prevPos.y;
            // this.moveXY(40, 40);
            // this.commander = null;
            // this.appliedVelocity = new Vector(DIRECTION_DIFFS[direction].x * this.maxSpeed, DIRECTION_DIFFS[direction].y * this.maxSpeed);
            // this.plannifiedMethodsActive = false;
            // this.plansAreFinished = false;
            this.plansDisabled = true;
            return this[`protected__move${_.string.capitalize(direction)}`](1, compensateFrame);
        }
        this.prevAction = this.action;
        this.prevPos = this.pos.copy();
    }
});