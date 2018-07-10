'use strict'

/** Class representing a game state. */
class State {

  constructor(playHistory, board, player) {
    this.playHistory = playHistory
    this.board = board
    this.player = player
  }

  hash() {
    return JSON.stringify(this.playHistory)
  }

  // Note: If hash uses board, multiple parents possible
}

module.exports = State
