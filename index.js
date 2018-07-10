'use strict'

const util = require('util')
const State = require('./state.js')
const Game = require('./game.js')
const MonteCarlo = require('./monte-carlo.js')

// Setup

let game = new Game()
let mc = new MonteCarlo(game)

// Run MCTS for specific state for inspection

let state = new State([ [  0,  0,  0, -1,  0,  0,  0 ],
                        [ -1,  0,  1,  1,  0,  0,  0 ],
                        [  1,  0, -1, -1,  0,  1,  0 ],
                        [ -1,  0, -1, -1,  0, -1,  0 ],
                        [  1,  0,  1,  1,  0, -1,  0 ],
                        [  1,  1, -1,  1, -1,  1,  0 ] ],
                      1)

mc.runSearch(state, 1)
let stats = mc.getStats(state)
console.log(util.inspect(stats, {showHidden: false, depth: null}))
console.log(mc.bestPlay(state, "robust"))

// // From initial state, play games until end

// let state = game.start()
// console.log(state.board)

// let winner = game.winner(state)
// while (winner === null) {

//   mc.runSearch(state, 1)
//   let play = mc.bestPlay(state, "best") // Timeout = 5 seconds

//   state = game.nextState(state, play)
//   let printBoard = state.board.map((row) => row.map((cell) => cell == -1 ? 2 : cell))
//   console.log(printBoard)

//   winner = game.winner(state)
// }
// console.log("winner: " + winner)



// console.log('time(s) ' + timeout + '/' + timeout + ' (FINISHED)')
// console.log('total sims : ' + totalSims)
// console.log('total rate(sims/s) : ' + (totalSims/timeout).toFixed(1))
// console.log('draws : ' + draws) // no winner
