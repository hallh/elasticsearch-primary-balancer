'use strict'

const request = require('./src/http');
const parseArgs = require('./src/parseargs.js')
const Game_ES = require('./src/game-es.js')
const MonteCarlo = require('./src/monte-carlo.js')

// Setup

const args = new parseArgs(process.argv);

console.log(args);

function startRun() {
  const req = new request('http://localhost:9200/_cat/shards?h=index,shard,prirep,state,store,node', (error, body) => {
    if (error) {
      throw error;
    }

    run(body);
  });
}

function run(initial_state) {
  let game = new Game_ES(initial_state)
  let mcts = new MonteCarlo(game)

  let state = game.start()
  let winner = game.winner(state)
  let play;

  console.log("calculating next move")

  // Only run play for player, choose random for adversary
  // state.player = 1;

  while (winner === null) {
    mcts.runSearch(state, 10)

    let stats = mcts.getStats(state)

    console.log(" > stats:", stats.n_plays, stats.n_wins)

    play = mcts.bestPlay(state, "robust")

    console.log(" > chosen play:", (play ? play.pretty() : null))

    state = game.nextState(state, play)
    winner = game.winner(state)
  }

  console.log()

  if (winner === -1) {
    console.log("[!] Impossible to achieve desired balance, try a higher threshold.");
  } else {
    let moves = state.playHistory.filter(p => p.player === 1).length;
    let stats = mcts.getStats(mcts.nodes.get('p,').state);
    let conf = (stats.n_wins / stats.n_plays * 100).toFixed(2);

    console.log(`[+] Simulation succeeded in ${moves} moves, with an estimated ${conf}% probability of success.`);
  }

  // submitMove(play.commands(), (error, res) => {
  //   if (error || res.acknowledged !== true) {
  //     console.log(JSON.stringify(error || res, null, 2));
  //     throw new Error('RELOCATION REQUEST FAILED');
  //   }
  //
  //   console.log("SUCCESS, waiting to next check")
  //
  //   setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
  // });
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

  // const req = new request(prep, (error, res, body) => {
  //   if (error) {
  //     return cb(error);
  //   }
  //
  //   cb(null, body);
  // });
}


function checkIfReady() {
  const req = new request('http://localhost:9200/_cat/shards', (error, body) => {
    if (error) {
      console.log("Faied to get state, trying again in 5s:", error);
      return setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
    }

    if (body.split('\n').find(line => line.match(/RELOCATING/))) {
      console.log("relocating - wait")
      return setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
    }

    console.log("not relocating - GO!")
    startRun();
  });
}


checkIfReady();
