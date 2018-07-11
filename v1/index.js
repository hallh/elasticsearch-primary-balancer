'use strict'

const Game = require('./game-c4.js')
const MonteCarlo = require('./monte-carlo.js')

let game = new Game()
let mcts = new MonteCarlo(game)

let state = game.start()
let winner = game.winner(state)

// From initial state, take turns to play game until someone wins
while (winner === null) {
  mcts.runSearch(state, 1)
  let play = mcts.bestPlay(state)
  state = game.nextState(state, play)
  winner = game.winner(state)
}

console.log(winner)
