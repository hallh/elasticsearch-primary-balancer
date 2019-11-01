'use strict'

const request = require('./src/http');
const parseArgs = require('./src/parseargs.js')
const Game_ES = require('./src/game-es.js')
const MonteCarlo = require('./src/monte-carlo.js')

// Setup
let args;
let ellipse = 0;
let didprintvars = false;

try {
  args = new parseArgs(process.argv);
} catch (e) {
  console.log(`[!] ${e.message}\n`);
  return process.exit(-1);
}

// Funcs

function startRun() {
  const opts = {
    url: `${args.host}/_cat/shards?h=index,shard,prirep,state,store,node`
  };

  if (args.auth) {
    opts.headers = {
      'Authorization': `Basic ${args.auth}`
    };
  }

  const req = new request(opts, (error, body) => {
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
  let stats, conf, moves = 0;

  if (!didprintvars) {
    didprintvars = true;

    if (!args.threshold) {
      console.log("[-] No threshold specified, will try to achieve perfect balance.");
    }

    console.log();
    console.log(`[+] Using threshold: ${game.threshold.toFixed(3)}`);
    console.log(`[+] Simulation time: ${args.simtime} seconds.`);
    console.log();
    console.log("[+] Current cluster state:");
    game.printCurrentClusterState(state.shards);
  }

  // Run command
  switch (args.action) {
    case 'dry-run':
      state = dryRun(mcts, game, state);
      break;
    case 'suggest':
      state = suggest(mcts, game, state);
      break;
    case 'balance':
      state = balance(mcts, game, state);
      break;
    default:
      throw new Error('Unsupported action.');
  }

  // Prepare stats output
  let winner = game.winner(state);
  let root_node = mcts.nodes.get(root_hash);

  if (root_node) {
    stats = mcts.getStats(root_node.state);
    conf = (stats.n_wins / stats.n_plays * 100).toFixed(2);
    moves = state.playHistory.filter(p => p.player === 1).length;
  }

  // Output result
  console.log("\n" + decideResult(args.action, winner, moves, conf, state) + "\n");

  if (args.action !== 'suggest') {
    console.log("Achieved cluster state:");
    game.printCurrentClusterState(state.shards);
  }
}


function suggest(mcts, game, state, log) {
  // Don't suggest if nothing is to be done
  if (game.winner(state) !== null) {
    return state;
  }

  // Don't loop, only the first move will be simulated
  mcts.runSearch(state, args.simtime);

  // Get stats and best play
  let stats = mcts.getStats(state);
  let play = mcts.bestPlay(state, "robust");

  // Print stats for move if log is true
  if (log) {
    console.log((state.player === 1 ? "\n" : ""), play.pretty());
  }

  return game.nextState(state, play);
}


function dryRun(mcts, game, state) {
  let winner = null;

  // Continue until solution is found or there are no more moves to be made
  while (winner === null) {
    state = suggest(mcts, game, state, true);
    winner = game.winner(state);
  }

  return state;
}


function balance(mcts, game, state) {
  state = suggest(mcts, game, state);
  let play = state.playHistory[0];

  // Submit move async
  submitMove(play.commands(), (error, body) => {
    let res = JSON.parse(body);

    if (error || res.acknowledged !== true) {
      console.log(error, res);
      throw new Error('RELOCATION REQUEST FAILED');
    }

    setTimeout(() => { process.nextTick(checkIfReady); }, 5000);
  });

  return state;
}


function decideResult(action, winner, moves, conf, state) {
  // No need for custom output if nothing was done
  if (winner === 1 && moves === 0) {
    return "[+] No moves made, cluster already balanced.";
  }

  // Generate output

  if (action === 'dry-run') {
    return decideDryRunResult(state, winner, moves, conf);
  }

  if (action === 'suggest') {
    return decideSuggestResult(state, conf);
  }

  if (action === 'balance') {
    return decideBalanceResult(state, conf);
  }
}


function decideDryRunResult(state, winner, moves, conf) {
  // Fail
  if (winner === -1) {
    return "[!] Impossible to achieve desired balance, try a higher threshold.";
  }
  // Success
  else {
    return `[+] Simulation succeeded in ${moves} moves, with an estimated ${conf}% chance of success.`;
  }
}


function decideSuggestResult(state, conf) {
  let play = state.playHistory[0];
  return `Play:\n ${play.pretty()}\n\ncurl '${args.host}/_cluster/reroute' -X POST -H 'Content-Type: application/json' -d '${play.commands()}'\n`;
}


function decideBalanceResult(state, conf) {
  let play = state.playHistory[0];
  return ` ${play.pretty()}`;
}


function submitMove(cmds, cb) {
  const opts = {
    url: `${args.host}/_cluster/reroute`,
    method: 'POST',
    body: cmds,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (args.auth) {
    opts.headers.Authorization = `Basic ${args.auth}`
  }

  const req = new request(opts, cb);
}


function checkIfReady() {
  // Only wait if we're actively balancing. No need to wait when simulating.
  if (args.action !== 'balance') {
    return startRun();
  }

  // Prep request
  const opts = {
    url: `${args.host}/_cat/shards`
  };

  // Add auth if configured
  if (args.auth) {
    opts.headers = {
      'Authorization': `Basic ${args.auth}`
    }
  }

  const req = new request(opts, (error, body) => {
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
