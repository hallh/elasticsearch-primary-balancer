'use strict'

const MonteCarloNode = require('./monte-carlo-node.js')

/** Class representing the Monte Carlo search tree. */
class MonteCarlo {

  constructor(game, UCB1ExploreParam = 2) {
    this.game = game
    this.UCB1ExploreParam = UCB1ExploreParam
    this.nodes = new Map() // map: State.hash() => MonteCarloNode
  }

  /** If given state does not exist, create dangling node. */
  makeNode(state) {
    if (!this.nodes.has(state.hash())) {
      let unexpandedPlays = this.game.legalPlays(state).slice()
      let node = new MonteCarloNode(null, null, state, unexpandedPlays)
      this.nodes.set(state.hash(), node)
    }
  }

  /** From given state, repeatedly run MCTS to build statistics. */
  runSearch(state, timeout = 3) {

    this.makeNode(state)

    let end = Date.now() + timeout * 1000
    while (Date.now() < end) {

      let node = this.select(state)
      let winner = this.game.winner(node.state)

      if (node.isLeaf() === false && winner === null) {
        node = this.expand(node)
        winner = this.simulate(node)
      }
      this.backpropagate(node, winner)
    }
  }

  /** Get the best move from available statistics. */
  bestPlay(state) {
    // TODO
    // return play
  }

  /** Phase 1, Selection: Select until not fully expanded OR leaf */
  select(state) {
    // TODO
    // return node
  }

  /** Phase 2, Expansion: Expand a random unexpanded child node */
  expand(node) {
    // TODO
    // return childNode
  }

  /** Phase 3, Simulation: Play game to terminal state, return winner */
  simulate(node) {
    // TODO
    // return winner
  }

  /** Phase 4, Backpropagation: Update ancestor statistics */
  backpropagate(node, winner) {
    // TODO
  }
}

module.exports = MonteCarlo
