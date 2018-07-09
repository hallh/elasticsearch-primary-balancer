'use strict'

const Game = require('./game.js')
const MonteCarlo = require('./monte-carlo.js')

let game = new Game()
let state = game.start()
console.log(state.board)

let monteCarlo = new MonteCarlo(game)

let winner = game.winner(state)
while (winner === null) {

  monteCarlo.runSims(state, 1)
  let play = monteCarlo.getPlay(state, "best") // Timeout = 5 seconds

  state = game.nextState(state, play)
  let printBoard = state.board.map((row) => row.map((cell) => cell == -1 ? 2 : cell))
  console.log(printBoard)

  winner = game.winner(state)
}
console.log(winner)
