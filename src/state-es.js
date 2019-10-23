'use strict'

/** Class representing a game state. */
class State_ES {

  constructor(playHistory, shards, player) {
    this.playHistory = playHistory
    this.shards = shards
    this.player = player
  }

  isPlayer(player) {
    return (player === this.player)
  }

  hash() {
    return "p," + this.playHistory.map(play => play.pretty()).join(',')
  }
}

module.exports = State_ES
