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
    return `(${this.player})=>` + this.moves.map(m => `[${m.source.shard}:${m.source.primary}-${m.dest.shard}:${m.dest.primary}]:${m.source.host}-${m.dest.host}`).join(',');
  }

  commands() {
    return {
      "commands": [].concat.apply([], this.moves.map((m) => [
        {
          "move": {
            "index": m.source.index,
            "shard": m.source.shard.split(':')[1],
            "from_node": "elasticsearch-data-v5-" + m.source.host,
            "to_node":"elasticsearch-data-v5-" + m.dest.host
          }
        },
        {
          "move": {
            "index": m.dest.index,
            "shard": m.dest.shard.split(':')[1],
            "from_node": "elasticsearch-data-v5-" + m.dest.host,
            "to_node":"elasticsearch-data-v5-" + m.source.host
          }
        }
      ]))
    };
  }
}

module.exports = Play_ES
