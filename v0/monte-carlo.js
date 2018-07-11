'use strict'

const MonteCarloNode = require('./monte-carlo-node.js')

class MonteCarlo {

  constructor(game, UCB1ExploreParam = 2) {
    this.game = game
    this.UCB1ExploreParam = UCB1ExploreParam
    this.nodes = new Map() // map: hash(State) => MonteCarloNode
  }

  /** From given state, repeatedly run MCTS to build statistics. */
  runSearch(state, timeout) {
    // TODO
  }

  /** Get the best move from available statistics. */
  bestPlay(state) {
    // TODO
    // return play
  }
}

module.exports = MonteCarlo
