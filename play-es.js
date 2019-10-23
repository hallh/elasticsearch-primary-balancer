'use strict'

/** Class representing a state transition. */
class Play_ES {
  constructor(player, moves) {
    this.moves = moves.map(m => ({
      source: JSON.parse(JSON.stringify(m.source)),
      dest: JSON.parse(JSON.stringify(m.dest))
    }));

    this.player = player;
  }

  hash() {
    return "p," + this.pretty()
  }

  pretty() {
    return `(${this.player})=>` + this.moves.map(m => `[${m.source.shard},${m.source.primary}-${m.dest.primary}]:${m.source.host}-${m.dest.host}`).join(',');
  }
}

module.exports = Play_ES
