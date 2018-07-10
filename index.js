'use strict'

const util = require('util')
const Game_C4 = require('./game-c4.js')
const MonteCarlo = require('./monte-carlo.js')

// Setup

let game = new Game_C4()
let mc = new MonteCarlo(game)

let state = game.start()
let winner = game.winner(state)

// From initial state, play games until end

while (winner === null) {

  console.log()
  console.log("player: " + (state.player === 1 ? 1 : 2))
  console.log(state.board.map((row) => row.map((cell) => cell === -1 ? 2 : cell)))

  mc.runSearch(state, 1)

  let stats = mc.getStats(state)
  console.log(util.inspect(stats, {showHidden: false, depth: null}))

  let play = mc.bestPlay(state, "robust")
  console.log(play)

  state = game.nextState(state, play)
  winner = game.winner(state)
}

console.log()
console.log("winner: " + (winner === 1 ? 1 : 2))
console.log(state.board.map((row) => row.map((cell) => cell === -1 ? 2 : cell)))
