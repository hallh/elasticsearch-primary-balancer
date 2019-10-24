'use strict'

const util = require('util')
const Game_ES = require('./game-es.js')
const MonteCarlo = require('./monte-carlo.js')

// Setup

let game = new Game_ES()
let mcts = new MonteCarlo(game)

let state = game.start()
let winner = game.winner(state)

// From initial state, play games until end

while (winner === null) {

  console.log()
  console.log("player: " + (state.player === 1 ? 1 : 2))
  let play;

  // Only run play for player, choose random for adversary
  if (state.player === 1) {
    mcts.runSearch(state, 30)

    let stats = mcts.getStats(state)
    console.log(" > stats:", stats.n_plays, stats.n_wins)

    play = mcts.bestPlay(state, "robust")
  } else {
    play = game.legalPlays(state)[0];
  }

  console.log(" > chosen play:", (play ? play.commands() : null))

  state = game.nextState(state, play)
  winner = game.winner(state)
}

console.log()
console.log("winner: " + (winner === 1 ? 1 : 2))
