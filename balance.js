'use strict'

const parseArgs = require('./src/parseargs.js')
const Game_ES = require('./src/game-es.js')
const MonteCarlo = require('./src/monte-carlo.js')

// Setup

const args = new parseArgs(process.argv);

console.log(args);

function run() {
  let game = new Game_ES()
  let mcts = new MonteCarlo(game)

  let state = game.start()
  let winner = game.winner(state)
  let play;

  console.log("calculating next move")

  // Only run play for player, choose random for adversary
  state.player = 1;
  mcts.runSearch(state, 30)

  let stats = mcts.getStats(state)
  console.log(" > stats:", stats.n_plays, stats.n_wins)

  play = mcts.bestPlay(state, "robust")

  console.log(" > chosen play:", (play ? play.pretty() : null))

  submitMove(play.commands(), (error, res) => {
    if (error || res.acknowledged !== true) {
      console.log(JSON.stringify(error || res, null, 2));
      throw new Error('RELOCATION REQUEST FAILED');
    }

    console.log("SUCCESS, waiting to next check")

    setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
  });
}


function submitMove(cmds, cb) {
  const prep = {
    url: 'http://localhost:9200/_cluster/reroute',
    method: 'POST',
    body: cmds,
    json: true,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  request(prep, (error, res, body) => {
    if (error) {
      return cb(error);
    }

    cb(null, body);
  });
}


function checkIfReady() {
  request('http://localhost:9200/_cat/shards', (error, res, body) => {
    if (error || body.split('\n').find(line => line.match(/RELOCATING/))) {
      console.log("relocating - wait")
      return setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
    }

    console.log("not relocating - GO!")
    run();
  });
}


// checkIfReady();
