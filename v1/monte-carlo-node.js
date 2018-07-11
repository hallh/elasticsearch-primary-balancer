'use strict'

/** Class representing a node in the search tree. */
class MonteCarloNode {
  
  constructor(parent, play, state, unexpandedPlays) {

    this.play = play
    this.state = state

    // Monte Carlo stuff
    this.n_plays = 0
    this.n_wins = 0

    // Tree stuff
    this.parent = parent
    this.children = new Map()
    for (let play of unexpandedPlays) {
      this.children.set(play.hash(), { play: play, node: null })
    }
  }
}

module.exports = MonteCarloNode
