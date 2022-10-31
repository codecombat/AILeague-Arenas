const GREEN_ITEM = 'heal';
const RED_ITEM = 'speed';
const BLUE_ITEM = 'cooldown';



const RED = 'red';
const BLUE = 'blue';
const COLORS = [RED, BLUE];


const ITEM_TYPES = [GREEN_ITEM, BLUE_ITEM, RED_ITEM];

({
    setUpLevel() {
        // this.world.mirrorPlayers = true;
        this.heroes = [this.hero, this.hero1];
        this.heroesByColor = {
            [RED]: this.hero,
            [BLUE]: this.hero1
        };
        this.heroes.forEach((h) => {
            h.ref = this;
            h.hookOnHasMoved = this.heroOnHasMoved.bind(this, h);
            let row = Math.floor((h.pos.y) / this.step);
            let col = Math.floor((h.pos.x) / this.step);
            h.prevCell = {row, col};
            h.score = 0;
            h.addTrackedProperties(['score', 'number'], ['teamPower', 'number']);
            h.collectRange = this.heroCollectRange;
            h.collectRangeSquared = this.heroCollectRange * this.heroCollectRange;
            h.maxSpeed = this.heroBaseSpeed;
            h.health = this.heroHealth;
            h.maxHealth = this.heroHealth;
            h.keepTrackedProperty('health');
            h.keepTrackedProperty('maxHealth');
            debugger
            h.rangeThang = this.getByID(`range-${h.color}`);
            h.rangeThang.setScale(0.17 * this.heroCollectRange);
            h.canCollect = (item) => {
                return !h.dead && h.distanceSquared(item, false) < h.collectRangeSquared;
            };
  
        });
        this.hero.opponent = this.hero1;
        this.hero1.opponent = this.hero;
        this.lavaThangMap = null;
        this.items = [];
        this.lavaMap = [];
        this.lavas = [];
        this.lavaMapThangs = [];
        for (let y = 0; y < this.maxRows; y++) {
            this.lavaMap[y] = [];
            this.lavaMapThangs[y] = [];
            for (let x = 0; x < this.maxCols; x++) {
                if (y == 0 || y == this.maxRows - 1 || x == 0 || x == this.maxCols - 1) {
                    this.lavaMap[y][x] = 9999;
                }
                else {
                    this.lavaMap[y][x] = 0;

                }
                this.lavaMapThangs[y].push(null);
            }
        }
        this.hero.S = "Red clouds above their head...";
        this.hero.addTrackedProperties(['S', 'string']);
        this.hero.keepTrackedProperty('S');
        this.hero1.S = "Blue sky in their dreams...";
        this.hero1.addTrackedProperties(['S', 'string']);
        this.hero1.keepTrackedProperty('S');
    },

    onFirstFrame() {
        this.createItems();
        this.setInterval(this.createItems.bind(this), this.itemInterval);
    },

    createItems() {
        let poss = null;
        for (let i = 0; i < 900; i++) {
            poss = this.findItemPos();
            if (poss) break;
        }
        if (!poss) return;
        let itemType = this.world.rand.choice(ITEM_TYPES);
        for (let i = 0; i < 2; i++) {
            let item = this.instabuild(itemType, poss[i].x, poss[i].y);
            item.lifespan = this.itemLifespan;
            item.onCollect = this.itemOnCollect.bind(this, item);
            item.type = itemType;
            this.items.push(item);
            if (item.type == RED_ITEM && this.hero.contextMM) {
                let n = this.world.rand.rand2(1, 9);
                n = n.toString();
                let m = this.hero.contextMM['r' + n];
                // item.hudProperties = item.hudProperties || [];
                // item.hudProperties.push('O');
                item['_'] = n + ': ' + m;
                item.addTrackedProperties(['_', 'string']);
                item.keepTrackedProperty('_');
            }
            
        }
    },
    

    findItemPos() {
        let pos = this.pickPointFromRegion(this.rectangles.item);
        pos = new Vector(Math.round(pos.x), Math.round(pos.y));
        let posM = new Vector(this.maxX - pos.x, this.maxY - pos.y);
        for (let h of this.heroes) {
            for (let p of [pos, posM]) {
                if (h.distanceTo(p) < 20) {
                    return false;
                }
            }
        }
        return [pos, posM];
    },

    heroOnHasMoved(h, prevPos, newPos) {
        let dxy;
        if (h.pos.x < 3 || h.pos.x >= this.maxX - 3 || h.pos.y < 3 || h.pos.y >= this.maxY - 3) {
            h.brake();
            h.setTargetPos(null);
            h.setAction('idle');
            h.die();
            // if (h.targetPos) {
            //     dxy = {x: h.targetPos.x - h.pos.x, y: h.targetPos.y - h.pos.y};

            // }
            // if (h.pos.x < 0 || h.pos.x >= this.maxX || h.pos.y < 0 || h.pos.y >= this.maxY) {
            //     h.wasWrapped = true;
            // }
            // h.pos.x = (h.pos.x + 80) % 80;
            // h.pos.y = (h.pos.y + 68) % 68;
            // h.keepTrackedProperty('pos');
            // if (dxy) {
            //     h.targetPos.x = h.pos.x + dxy.x;
            //     h.targetPos.y = h.pos.y + dxy.y;
            //     h.keepTrackedProperty('targetPos');
            // }
        }

        let row = Math.floor((h.pos.y) / this.step);
        let col = Math.floor((h.pos.x) / this.step);
        
        if (this.lavaMap[row][col] != 0 && !this.winner && !h.jumpStart) {
            const damage = Math.sign(this.lavaMap[row][col]) == h.sign ? this.lavaDamage : this.lavaDamageOpposite;
            h.takeDamage(damage * this.world.dt);
        }
        h.currentCell = {row, col};
        if (!h.prevCell) {
            h.prevCell = {row, col};
        }
        if (h.jumpStart != null && !h.jumpCell) {
            h.jumpCell = {row: h.prevCell.row, col: h.prevCell.col};
        }
        if (h.prevCell.row != row || h.prevCell.col != col) {            
            if (!h.jumpCell || (h.jumpCell.row == h.prevCell.row && h.jumpCell.col == h.prevCell.col)) {
                let lavaLifespan = h.score * this.scoreLavaCoef + this.lavaLifespan;
                let [fromRow, toRow] = [h.prevCell.row, h.currentCell.row];
                let [fromCol, toCol] = [h.prevCell.col, h.currentCell.col];
                if (h.lastDirection == 'up') {
                    if (h.wasWrapped) {
                        toRow += this.maxRows;
                    }
                    for (let r = fromRow; r < toRow; r++) {
                        this.createLavaCell(r % this.maxRows, h.currentCell.col, lavaLifespan, h.color);
                    }
                }
                else if (h.lastDirection == 'down') {
                    if (h.wasWrapped) {
                        toRow -= this.maxRows;
                    }
                    else {
                        for (let r = fromRow; r > toRow; r--) {
                            this.createLavaCell((r + this.maxRows) % this.maxRows, h.currentCell.col, lavaLifespan, h.color);
                        }
                    }
                }
                else if (h.lastDirection == 'right') {
                    if (h.wasWrapped) {
                        toCol += this.maxCols;
                    }
                    else {
                        for (let c = fromCol; c < toCol; c++) {
                            this.createLavaCell(h.currentCell.row, c % this.maxCols, lavaLifespan, h.color);
                        }
                    }
                }
                else if (h.lastDirection == 'left') {
                    if (h.wasWrapped) {
                        toCol -= this.maxCols;
                    }
                    else {
                        for (let c = fromCol; c > toCol; c--) {
                            this.createLavaCell(h.currentCell.row, (c + this.maxCols) % this.maxCols, lavaLifespan, h.color);
                        }
                    }
                }
            }
            h.prevCell = {row, col};
            h.wasWrapped = false;
        }
    },

    createLavaCell(row, col, lifespan, color) {
        if (row <= 0 || row >= this.maxRows - 1 || col <= 0 || col >= this.maxCols - 1) return;
        // if (this.lavaMap[row][col] <= 0) {
        //     // let lava = this.instabuild('lava', col * this.step + this.step / 2, row * this.step + this.step / 2);
        //     lava.row = row;
        //     lava.col = col;
        //     this.lavas.push(lava);
        // }
        if (color == BLUE) {
            this.lavaMap[row][col] = Math.min(this.lavaMap[row][col], -lifespan);
        }
        else {
            this.lavaMap[row][col] = Math.max(this.lavaMap[row][col], lifespan);
        }
    },

    itemOnCollect(item, hero) {
        if (!this.winner) {
            hero.score += this.itemScore;
        }
        hero.keepTrackedProperty('score');
        if (item.type == GREEN_ITEM) {
            hero.health = Math.min(hero.health + this.itemHealth, hero.maxHealth);
        }
        if (item.type == BLUE_ITEM) {
            for (let k of Object.keys(hero.abilityCooldowns)) {
                hero.abilityCooldowns[k] = Math.max(hero.abilityCooldowns[k] - this.itemReducingCooldown, 0);
            }
        }
        if (item.type == RED_ITEM) {
            hero.effects = hero.effects.filter(e => e.name != 'haste');
            
            hero.addEffect({name: 'haste', duration: this.itemSpeedRatioDuration,
                            reverts: true, factor: this.itemSpeedRatio, targetProperty: 'maxSpeed'});
        }
        hero.rangeThang.effects = hero.rangeThang.effects.filter(e => e.name != 'visible');
        hero.rangeThang.addEffect({name: 'visible', duration: 0.2, reverts: true, setTo: 0.5, targetProperty: 'alpha'});
        hero.rangeThang.updateEffects();
    },

    checkWinners() {
        if (this.hero.health <= 0 && this.hero1.health >= 0) {
            this.winner = this.hero1;
            this.hero.setAlpha(0.3);
            this.winGoal('blue-win');
            return true;
        }
        else if (this.hero.health >= 0 && this.hero1.health <= 0) {
            this.winner = this.hero;
            this.hero1.setAlpha(0.3);
            this.winGoal('red-win');
            return true;
        }
        if ((this.hero.health <= 0 && this.hero1.health <= 0) || this.world.age > this.maxTime) {
            // for (let h of this.heroes) {
            //     h.score += h.health * this.healthToScoreCoef;
            // }
            if (this.hero.teamPower == this.hero1.teamPower) {
                if (this.world.rand.randf() < 0.5) {
                    this.hero.score += 1;
                }
                else {
                    this.hero1.score += 1;
                }
                for (let h of this.heroes) {
                    h.teamPower = h.score + h.health * this.healthToScoreCoef;
                    
                    h.keepTrackedProperty('teamPower');
                }
            }
            if (this.hero.teamPower > this.hero1.teamPower) {
                this.winner = this.hero;
                this.winGoal('red-win');
            }
            else {
                this.winner = this.hero1;
                this.winGoal('blue-win');
            }
        }
        
    },

    fireballUpdate(fireball) {
        if (fireball.pos.x < 0 || fireball.pos.x >= this.maxX ||
                fireball.pos.y < 0 || fireball.pos.y >= this.maxY) {
            fireball.setExists(false);
            return;
        }
        let row = Math.floor((fireball.pos.y) / this.step);
        let col = Math.floor((fireball.pos.x) / this.step);
        fireball.currentCell = {row, col};
        if (!fireball.prevCell) {
            fireball.prevCell = {row, col};
        }
        if (fireball.prevCell.row != row || fireball.prevCell.col != col) {            
            let [fromRow, toRow] = [fireball.prevCell.row, fireball.currentCell.row];
            let [fromCol, toCol] = [fireball.prevCell.col, fireball.currentCell.col];
            if (fireball.lastDirection == 'up') {
                for (let r = fromRow; r < toRow; r++) {
                    for (let i = -1; i <= 1; i++) {
                        this.createLavaCell(r, fireball.currentCell.col + i, fireball.power, fireball.color);
                    }
                }
            }
            else if (fireball.lastDirection == 'down') {
                for (let r = fromRow; r > toRow; r--) {
                    for (let i = -1; i <= 1; i++) {
                        this.createLavaCell(r, fireball.currentCell.col + i, fireball.power, fireball.color);
                    }
                }
            }
            else if (fireball.lastDirection == 'right') {
                for (let c = fromCol; c < toCol; c++) {
                    for (let i = -1; i <= 1; i++) {
                        this.createLavaCell(fireball.currentCell.row + i, c, fireball.power, fireball.color);
                    }
                }
            }
            else if (fireball.lastDirection == 'left') {
                for (let c = fromCol; c > toCol; c--) {
                    for (let i = -1; i <= 1; i++) {
                        this.createLavaCell(fireball.currentCell.row + i, c, fireball.power, fireball.color);
                    }
                }
            }
            fireball.prevCell = {row, col};
        }
    },

    rebuildLavaField() {
        const actualLavaMapStr = [];
        for (let i = 0; i < this.maxRows; i++) {
            let row = [];
            for (let j = 0; j < this.maxCols; j++) {
                row.push(this.detectLavaType(i, j));
            }
            actualLavaMapStr.push(row);
        }
        for (let i = 1; i < this.maxRows - 1; i++) {
            for (let j = 1; j < this.maxCols - 1; j++) {
                let shouldBeName = actualLavaMapStr[i][j];
                let currentName = this.lavaMapThangs[i][j] && this.lavaMapThangs[i][j].name;
                if (shouldBeName != currentName) {
                    if (this.lavaMapThangs[i][j]) {
                        this.lavaMapThangs[i][j].setExists(false);
                        this.lavaMapThangs[i][j] = null;
                    }
                    if (shouldBeName) {
                        let lava = this.instabuild(shouldBeName, j * this.step + this.step / 2, i * this.step + this.step / 2);
                        this.lavaMapThangs[i][j] = lava;
                        lava.name = shouldBeName;
                    }
                }
            }
        }
        
    },

    detectLavaType(r, c) {
        if (this.lavaMap[r][c] == 0 || r == 0 || r == this.maxRows - 1 || c == 0 || c == this.maxCols - 1) {
            return null;
        }
        const sign = Math.sign(this.lavaMap[r][c]);
        let code = "lava";
        if (sign == -1) {
            code = 'blava';
        }
        if (r == this.maxRows - 2 || sign == Math.sign(this.lavaMap[r + 1][c])) {
            code += '0';
        }
        else {
            code += '1';
        }

        if (c == this.maxCols - 2 || sign == Math.sign(this.lavaMap[r][c + 1])) {
            code += '0';
        }
        else {
            code += '1';
        }
        
        if (r == 1 || sign == Math.sign(this.lavaMap[r - 1][c])) {
            code += '0';
        }
        else {
            code += '1';
        }

        
        if (c == 1 || sign == Math.sign(this.lavaMap[r][c - 1])) {
            code += '0';
        }
        else {
            code += '1';
        }
        
        return code;
    },


    update() {
        
        for (let h of this.heroes) {
            h.teamPower = h.score + h.health * this.healthToScoreCoef;
            h.teamPower = Math.round(h.teamPower * 100) / 100;
            h.keepTrackedProperty('teamPower');
        }
        if (!this.winner) {
            this.checkWinners();
        }
        this.items = this.items.filter(item => item.exists);
        
        for (let y = 1; y < this.maxRows - 1; y++) {
            for (let x = 1; x < this.maxCols - 1; x++) {
                if (this.lavaMap[y][x] > 0) {
                    this.lavaMap[y][x] -= this.world.dt;
                    if (this.lavaMap[y][x] <= 0) {
                        this.lavaMap[y][x] = 0;
                    }
                }
                if (this.lavaMap[y][x] < 0) {
                    this.lavaMap[y][x] += this.world.dt;
                    if (this.lavaMap[y][x] >= 0) {
                        this.lavaMap[y][x] = 0;
                    }
                }
            }
        }
        this.rebuildLavaField();
    }
});