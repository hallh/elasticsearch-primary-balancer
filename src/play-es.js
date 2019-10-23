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

  pretty(conf) {
    const colors = {
     reset: "\x1b[0m",
     bright: "\x1b[2m",
     dim: "\x1b[1m",
     fg: {
      green: "\x1b[32m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m"
     }
    };

    return this.moves.map((m) => {
      const stype = (m.source.primary ? "PRIMARY" : "REPLICA");
      const dtype = (m.dest.primary ? "PRIMARY" : "REPLICA");
      const est = (conf ? ` with ${conf}% confidence` : '');

      return ` ${colors.fg.cyan}SWAPPING${colors.reset} ${colors.bright}[${stype}]${colors.reset} ${colors.fg.green}${m.source.host}/${colors.dim}${m.source.shard}${colors.reset} ${colors.bright}[${dtype}]${colors.reset} ${colors.fg.blue}${m.dest.host}/${colors.dim}${m.dest.shard}${colors.reset} ${est}`
    }).join('\n');
  }

  commands() {
    return JSON.stringify({
      "commands": [].concat.apply([], this.moves.map((m) => [
        {
          "move": {
            "index": m.source.index,
            "shard": m.source.shard.split(':')[1],
            "from_node": m.source.host,
            "to_node": m.dest.host
          }
        },
        {
          "move": {
            "index": m.dest.index,
            "shard": m.dest.shard.split(':')[1],
            "from_node": m.dest.host,
            "to_node": m.source.host
          }
        }
      ]))
    });
  }
}

module.exports = Play_ES
