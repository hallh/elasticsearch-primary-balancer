'use strict'

/**
 * Class representing a node in the search tree.
 * Stores UCB1 wins/simulations stats.
 */
class MonteCarloNode {
  /**
   * Create a new MonteCarloNode in the search tree.
   * @param {MonteCarloNode} parent - The parent node.
   * @param {number[][]} unexpandedPlays - An array of unexpanded play hashes.
   */
  constructor(parent, play, state, unexpandedPlays) {
    this.play = play // Last play played to get to this state
    this.state = state // Corresponding state

    // Monte Carlo stuff
    this.n_plays = 0
    this.n_wins = 0

    // Tree stuff
    this.parent = parent // Parent MonteCarloNode
    this.children = new Map() // Map: hash(play) => { Play, child MonteCarloNode }
    for (let play of unexpandedPlays) {
      this.children.set(play.hash(), { play: play, node: null })
    }
  }

  /**
   * Get the MonteCarloNode corresponding to the given play.
   * @param {number} play - The play leading to the child node.
   * @return {MonteCarloNode} The child node corresponding to the play given.
   */
  childNode(play) {
    let child = this.children.get(play.hash())
    if (child === undefined) {
      throw new Error('No such play!')
    }
    else if (child.node === null) {
      throw new Error("Child is not expanded!")
    }
    return child.node
  }

  /**
   * Expand the child play at the specified index and return it.
   * Add the node to the array of children nodes.
   * Remove the play from the array of unexpanded plays.
   * @param {Play} play - The play to expand.
   * @param {State} childState - The child state corresponding to the given play.
   * @param {Play[]} childPlays - Legal plays of given child.
   * @return {MonteCarloNode} The new child node.
   */
  expand(play, childState, childUnexpandedPlays) {
    if (!this.children.has(play.hash())) throw new Error("No such play!")
    let childNode = new MonteCarloNode(this, play, childState, childUnexpandedPlays)
    this.children.set(play.hash(), { play: play, node: childNode })
    return childNode
  }

  allPlays() {
    let ret = []
    for (let child of this.children.values()) {
      ret.push(child.play)
    }
    return ret
  }

  unexpandedPlays() {
    let ret = []
    for (let child of this.children.values()) {
      if (child.node === null) ret.push(child.play)
    }
    return ret
  }

  /**
   * @return {boolean} Whether all the children plays have expanded nodes
   */
  isFullyExpanded() {
    for (let child of this.children.values()) {
      if (child.node === null) return false
    }
    return true
  }

  /**
   * @return {boolean} Whether this node is terminal in the game tree
   */
  isLeaf() {
    if (this.children.size === 0) return true
    else return false
  }
  
  /**
   * Get the UCB1 value for this node.
   * @param {number} biasParam - The square of the bias parameter in the UCB1 algorithm, defaults to 2.
   * @return {number} The UCB1 value of this node.
   */
  getUCB1(biasParam) {
    // console.log(this.n_wins / this.n_plays)
    // console.log(Math.sqrt(biasParam * Math.log(this.parent.plays) / this.n_plays))
    return (this.n_wins / this.n_plays) + Math.sqrt(biasParam * Math.log(this.parent.n_plays) / this.n_plays);
  }

}

module.exports = MonteCarloNode
