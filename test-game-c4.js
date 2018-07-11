'use strict'

const N_GAMES = 1000

const Game = require('./game-c4.js')

let game = new Game()

let state = game.start()
let winner = null

let ngames = 0
let playerOneWins = 0
let haveDisplayed = false

while (ngames < N_GAMES) {

  let plays = game.legalPlays(state)
  let play = plays[Math.floor(Math.random() * plays.length)]
  state = game.nextState(state, play)
  winner = game.winner(state)

  // If there's a winner, reset
  if (winner != null) {

    // display one board
    if (!haveDisplayed) {
      let printBoard = state.board.map(
        (row) => row.map(
          (cell) => cell == -1 ? 2 : cell
        )
      )
      console.log(printBoard)
      haveDisplayed = true
    }

    ngames += 1
    playerOneWins += (winner == 1)
    state = game.start()
    winner = null
  }
}

console.log(playerOneWins / ngames)
