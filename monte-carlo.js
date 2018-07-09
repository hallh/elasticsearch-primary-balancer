'use strict'

const MonteCarloNode = require('./monte-carlo-node.js')

/** Class representing the Monte Carlo search tree. */
class MonteCarlo {

  /**
   * Create a Monte Carlo search tree.
   * @param {Game} game - The game to query regarding legal moves and state advancement.
   * @param {number} UCB1ExploreParam - The square of the bias parameter in the UCB1 algorithm, defaults to 2.
   */
  constructor(game, UCB1ExploreParam = 2) {
    this.game = game
    this.UCB1ExploreParam = UCB1ExploreParam
    this.nodes = new Map() // map: hash(State) => MonteCarloNode
  }

  /**
   * If state does not exist, create dangling node
   * @param {State} state - The state to make a node for; its parent is set to null.
   */
  makeNode(state) {
    if (!this.nodes.has(state.hash())) {
      let unexpandedPlays = this.game.legalPlays(state).slice()
      let node = new MonteCarloNode(null, null, state, unexpandedPlays)
      this.nodes.set(state.hash(), node)
    }
  }

  /**
   * From given state, run as many simulations as possible until the time limit, building statistics.
   * @param {number} timeout - The time to run the simulations for, in seconds.
   */
  runSims(state, timeout) {

    this.makeNode(state)

    let draws = 0
    let totalSims = 0
    
    let start = Date.now()
    let end = start + timeout * 1000

    while (Date.now() < end) {

      let node = this.select(state)
      if (!node.isLeaf()) {
        node = this.expand(node)
      }
      let winner = this.simulate(node)
      this.backpropagate(node, winner)

      if (winner === 0) draws++
      totalSims++
    }

    console.log('time(s) ' + timeout + '/' + timeout + ' (FINISHED)')
    console.log('total sims : ' + totalSims)
    console.log('total rate(sims/s) : ' + (totalSims/timeout).toFixed(1))
    console.log('draws : ' + draws) // no winner
  }

  /**
   * From the available statistics, calculate the best move from the given state.
   * @return {Play} The best play from the current state.
   */
  getPlay(state, policy = "robust") {

    this.makeNode(state)

    // If not all children are expanded, not enough information
    if (this.nodes.get(state.hash()).isFullyExpanded() === false)
      return null

    let node = this.nodes.get(state.hash())
    let allPlays = node.allPlays()
    let bestPlay

    // Most visits (Chaslot's robust child)
    if (policy === "robust") {
      let max = 0
      for (let play of allPlays) {
        let childNode = node.childNode(play)
        if (childNode.n_plays > max) {
          bestPlay = play
          max = childNode.n_plays
        }
      }
    }
    // Highest winrate (Best child)
    else if (policy === "best") {
      let max = 0
      for (let play of allPlays) {
        let childNode = node.childNode(play)
        let ratio = childNode.n_wins / childNode.n_plays
        if (ratio > max) {
          bestPlay = play
          max = ratio
        }
      }
    }

    return bestPlay
  }

  /**
   * Phase 1: Selection
   * Select until EITHER not fully expanded OR leaf node
   */
  select(state) {
    let node = this.nodes.get(state.hash())
    while(node.isFullyExpanded() && !node.isLeaf()) {
      let plays = node.allPlays()
      let bestPlay
      let bestUCB1 = 0
      for (let play of plays) {
        let childUCB1 = node.childNode(play).getUCB1(this.UCB1ExploreParam)
        if (childUCB1 > bestUCB1) {
          bestPlay = play
          bestUCB1 = childUCB1
        }
      }
      node = node.childNode(bestPlay)
    }
    return node
  }

  /**
   * Phase 2: Expansion
   * Of the given node, expand a random unexpanded child node
   * Assume given node is not a leaf
   */
  expand(node) {
    let plays = node.unexpandedPlays()
    let index = Math.floor(Math.random() * plays.length)
    let play = plays[index]

    let childState = this.game.nextState(node.state, play)
    let childUnexpandedPlays = this.game.legalPlays(childState)
    // let node = new MonteCarloNode(node, play, childState, childUnexpandedPlays)
    let childNode = node.expand(play, childState, childUnexpandedPlays)
    this.nodes.set(childState.hash(), childNode)

    return childNode
  }

  /**
   * Phase 3: Simulation
   * From given node, play the game until a terminal state, then return winner
   */
  simulate(node) {
    let state = node.state
    let winner = this.game.winner(state)
    while (winner === null) {
      let plays = this.game.legalPlays(state)
      let play = plays[Math.floor(Math.random() * plays.length)]
      state = this.game.nextState(state, play)
      winner = this.game.winner(state)
    }
    return winner
  }

  /**
   * Phase 4: Backpropagation
   * From given node, propagate winner to ancestors' statistics
   */
  backpropagate(node, winner) {
    while (node !== null) {
      node.n_plays += 1
      // Flip for parent's choice
      if (node.state.player === -winner) {
        node.n_wins += 1
      }
      node = node.parent
    }
  }



}

module.exports = MonteCarlo
