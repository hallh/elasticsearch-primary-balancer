'use strict'

const util = require('util')
const State = require('./state.js')
const Game = require('./game.js')
const MonteCarlo = require('./monte-carlo.js')

// Setup

let game = new Game()
let mc = new MonteCarlo(game)




// From initial state, play games until end

let state = game.start()
// let state = new State([],
//                       [ [ 0, 0, 0, 0, 0, 0, 0 ],
//                         [ 0, 0, 0, 0, 0, 0, 0 ],
//                         [ 0, 0, 0, 0, 0, 0, 0 ],
//                         [ 0, 0, 0,-1, 0, 0, 0 ],
//                         [ 0, 0, 0, 1, 1, 0, 0 ],
//                         [ 0, 0, 0, 1,-1, 0, 0 ] ], 
//                       -1)

let winner = game.winner(state)

// mc.runSearch(state, 10)

while (winner === null) {

  console.log()
  console.log("player: " + (state.player === 1 ? 1 : 2))
  console.log(state.board.map((row) => row.map((cell) => cell === -1 ? 2 : cell)))

  mc.runSearch(state, 1)
  let stats = mc.getStats(state)
  console.log(util.inspect(stats, {showHidden: false, depth: null}))

  let play = mc.bestPlay(state, "robust")
  state = game.nextState(state, play)
  winner = game.winner(state)
  console.log(play)
}

console.log()
console.log("winner: " + (winner === 1 ? 1 : 2))
console.log(state.board.map((row) => row.map((cell) => cell === -1 ? 2 : cell)))


// console.log('time(s) ' + timeout + '/' + timeout + ' (FINISHED)')
// console.log('total sims : ' + totalSims)
// console.log('total rate(sims/s) : ' + (totalSims/timeout).toFixed(1))
// console.log('draws : ' + draws) // no winner
