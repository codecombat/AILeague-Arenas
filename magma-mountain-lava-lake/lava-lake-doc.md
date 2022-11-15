# Descriptiom

![Codecombat magma mountain banner 01b](/file/db/level/62f9f6506428860025b15a8b/Codecombat-Magma-Mountain-Banner-01b.jpg)

Do you think that snails are cute and slow creatures? What about the race of Magma Snails on Volcano Island,

# Intro

Welcome to the Volcano Race. Magma snails are the only creatures that can survive in volcanoes long enough.

You control a Magma snail that leaves a lava trail behind and never stops.
Your goal is to collect more items on the volcano island and survive. You win if your opponent breaks before you or on the final time if you have more score points. Collected orbs and remaining health points define the score points.

You can move Left/Right/Up/Down and use different special abilities to overrun your opponent. Your and the opponent's snails are leaving a lava trail behind always. If you or your opponent touch lava, they get damaged.

```javascript
hero.moveRight();
hero.moveUp(3);
hero.moveRight();
hero.moveDown(3);
```

```python
hero.moveRight()
hero.moveUp(3)
hero.moveRight()
hero.moveDown(3)
```

Items (glowing orbs) give you score points and additional bonuses. Green orbs are healing, and blue - reduces abilities' cooldowns.

You can use various abilities on different cooldowns.

```javascript
if (hero.isReady('dash')) {
    hero.dash();
}
```

```python
if hero.isReady('dash'):
    hero.dash()
```

# Field

Walls surround the game arena, and if your avatar gets to any wall, then instant death.
The island can be represented as a grid where each cell is `2` meters. So when your avatar moves `1` time (ex: `moveRight(1)`), it moves for 4 meters or 2 cells.

Avatars are leaving magma trails behind them, where each "lava cell" exists for `6 + score * 1` seconds (on the moment when it was created).

Snail can move through lava, but if it touches lava, it gets damaged. The damage depends on the lava color.

If you or your opponent get into your lava, then you get `5` damage per second while you are in lava.
For the opposite color, you get `0` damage per second.

## Map API

You can check if there is a lava cell at any point with the method `lavaAtXY(x, y)`, 
it returns a number that means how long lava stays on that point, or `0` if it's clear ground.
If it's you color, then it returns a positive number, if it's your opponent's color, then it returns a negative number.

To get the entire map of lava, you can use `getLavaMap()` method that returns a 2d array (34 rows to 40 columns), where each cell is a lava/ground patch with the size of 2x2 meters.
Each cell contains a number: `0` if it's clear or a number (positive or negative) - lava lifespan.

For negative numbers, you need to get an absolute value to get the lifespan.


# Special abilities

Your avatar can use different abilities, and they are used in the direction of the last movement.
Each ability has its own cooldown when the ability can be used again. Cooldowns can be reduced with collected items.

- `jump` - the avatar jumps up and ignores lava in the air.
    - `cooldown`: 4s
    - `distance`: 8m
- `dash` - the avatar moves forward with increased speed.
    - `cooldown`: 4s
    - `distance`: 12m
    - `speed ratio`: 3
- `fire` - shoots a fireball that leaves a wide trail of lava.
    - `cooldown`: 12s
- `throw` - throws a lava bulb at a point `{x, y}` that explodes leaves a wide trail of lava.
    - `cooldown`: 12s

# Items

The glowing orbs appear on the island in each `2` seconds. Each item gives bonuses and +1 score point.
You can find them with `findNearestItem()` and `findItems()` methods.
Each item has the next properties: `x`, `y` and `type`.

- `type`: `"heal"` -- heals the avatar for `1` hp
- `type`: `"cooldown"` -- reduces abilities cooldowns for 0.5 seconds (for abilities that are on cooldown)
- `type`: `"speed"` -- speeds up the avatar 1.5 times for 1.5 seconds;

# Tips

Nothing? Hmmm? Look in orbs.