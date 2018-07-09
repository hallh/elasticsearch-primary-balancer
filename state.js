'use strict'

/** Class representing a game state. */
class State {

  constructor(board, player) {
    // this.playHistory = playHistory
    this.board = board
    this.player = player
  }

  hash() {
    return JSON.stringify(this.board)
  }
}

module.exports = State
