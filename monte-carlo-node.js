'use strict'

/**
 * Class representing a node in the search tree.
 * Stores tree search stats for UCB1.
 */
class MonteCarloNode {
  /**
   * Create a new MonteCarloNode in the search tree.
   * @param {MonteCarloNode} parent - The parent node.
   * @param {Play} play - Last play played to get to this state.
   * @param {State} state - The corresponding state.
   * @param {Play[]} unexpandedPlays - The node's unexpanded child plays.
   */
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
   * Expand the specified child play and return the new child node.
   * Add the node to the array of children nodes.
   * Remove the play from the array of unexpanded plays.
   * @param {Play} play - The play to expand.
   * @param {State} childState - The child state corresponding to the given play.
   * @param {Play[]} unexpandedPlays - The given child's unexpanded child plays; typically all of them.
   * @return {MonteCarloNode} The new child node.
   */
  expand(play, childState, unexpandedPlays) {
    if (!this.children.has(play.hash())) throw new Error("No such play!")
    let childNode = new MonteCarloNode(this, play, childState, unexpandedPlays)
    this.children.set(play.hash(), { play: play, node: childNode })
    return childNode
  }

  /**
   * Get all legal plays from this node.
   * @return {Play[]} All plays.
   */
  allPlays() {
    let ret = []
    for (let child of this.children.values()) {
      ret.push(child.play)
    }
    return ret
  }

  /**
   * Get all unexpanded legal plays from this node.
   * @return {Play[]} All unexpanded plays.
   */
  unexpandedPlays() {
    let ret = []
    for (let child of this.children.values()) {
      if (child.node === null) ret.push(child.play)
    }
    return ret
  }

  /**
   * Whether this node is fully expanded.
   * @return {boolean} Whether this node is fully expanded.
   */
  isFullyExpanded() {
    for (let child of this.children.values()) {
      if (child.node === null) return false
    }
    return true
  }

  /**
   * Whether this node is terminal in the game tree, NOT INCLUSIVE of termination due to winning.
   * @return {boolean} Whether this node is a leaf in the tree.
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
    return (this.n_wins / this.n_plays) + Math.sqrt(biasParam * Math.log(this.parent.n_plays) / this.n_plays);
  }

}

module.exports = MonteCarloNode
