'use strict'

const request = require('./src/http');
const parseArgs = require('./src/parseargs.js')
const Game_ES = require('./src/game-es.js')
const MonteCarlo = require('./src/monte-carlo.js')

// Setup

const args = new parseArgs(process.argv);
let ellipse = 0;

// Funcs

function startRun() {
  const req = new request('http://localhost:9200/_cat/shards?h=index,shard,prirep,state,store,node', (error, body) => {
    if (error) {
      throw error;
    }

    run(body);
  });
}

function run(initial_state) {
  let game = new Game_ES(initial_state, args)
  let mcts = new MonteCarlo(game)

  let state = game.start();
  let root_hash = state.hash();
  let winner = game.winner(state);
  let play;

  console.log(`[+] Using threshold: ${game.threshold.toFixed(3)}`)

  // state.player = 1;

  while (winner === null) {
    console.log(`\n[+] Calculating next move, simulation time: ${args.simtime} seconds.`);
    mcts.runSearch(state, args.simtime || 10);

    let stats = mcts.getStats(state)

    console.log("  > stats:", stats.n_plays, stats.n_wins)

    play = mcts.bestPlay(state, "robust")

    console.log("  > chosen play:", (play ? play.pretty() : null))

    state = game.nextState(state, play)
    winner = game.winner(state)
  }

  // Completed, output result
  if (winner === -1) {
    console.log("[!] Impossible to achieve desired balance, try a higher threshold.");
  } else {
    let moves = state.playHistory.filter(p => p.player === 1).length;

    if (moves === 0) {
      console.log("[+] No moves made, cluster already balanced.");
    } else {
      let stats = mcts.getStats(mcts.nodes.get(root_hash).state);
      let conf = (stats.n_wins / stats.n_plays * 100).toFixed(2);

      console.log(`[+] Simulation succeeded in ${moves} moves, with an estimated ${conf}% probability of success.`);
    }
  }

  // submitMove(play.commands(), (error, body) => {
  //   let res = JSON.parse(body);
  //
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
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = new request(prep, cb);
}


function checkIfReady() {
  const req = new request('http://localhost:9200/_cat/shards', (error, body) => {
    if (error) {
      console.log("[!] Failed to get state, trying again in 5s:", error);
      return setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
    }

    if (body.split('\n').find(line => line.match(/RELOCATING/))) {
      ellipse = (ellipse % 3) + 1;

      process.stdout.clearLine();
      process.stdout.write(`\r[-] Waiting for relocation to complete${".".repeat(ellipse)}`);

      return setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
    }

    console.log("\n[+] Not relocating - GO!")
    startRun();
  });
}


checkIfReady();
