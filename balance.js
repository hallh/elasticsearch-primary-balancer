'use strict'

const request = require('./src/http');
const parseArgs = require('./src/parseargs.js')
const Game_ES = require('./src/game-es.js')
const MonteCarlo = require('./src/monte-carlo.js')

// Setup
let refresh = 1000;
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
      process.stdout.clearLine();
      console.log();
      console.log("[-] No threshold specified, will try to achieve a perfect balance.");
    }

    console.log();
    console.log(`[+] Using threshold: ${game.threshold.toFixed(3)}`);
    console.log(`[+] Simulation time: ${args.simtime} seconds.`);
    console.log();
    console.log("[+] Current cluster state:");
    console.log(game.printCurrentClusterState(state.shards));
    console.log();
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
    moves = state.playHistory.length;
  }

  // Output result
  console.log(decideResult(args.action, winner, moves, conf, state, game));
}


function suggest(mcts, game, state, log) {
  // Don't suggest if nothing is to be done
  if (game.winner(state) !== null) {
    return state;
  }

  // Simulate moves
  mcts.runSearch(state, args.simtime);

  // Choose best play
  try {
    let play = mcts.bestPlay(state, "robust");

    // Print stats for move if log is true
    if (log) {
      console.log(play.pretty());
    }

    return game.nextState(state, play);
  } catch (e) {
    console.log(`[!] There wasn't enough time to simulate a solution to its completion, you need to increase the simulation time with the '--simulation-time' option.`);
    console.log();
    return process.exit(0);
  }
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

  if (!play) {
    return state;
  }

  // Submit move async
  submitMove(play.commands(), (error, body) => {
    let res = JSON.parse(body);

    if (error || res.acknowledged !== true) {
      console.log(error, res);
      throw new Error('RELOCATION REQUEST FAILED');
    }

    setTimeout(() => { process.nextTick(checkIfReady); }, refresh);
  });

  return state;
}


function decideResult(action, winner, moves, conf, state, game) {
  // No need for custom output if nothing was done
  if (winner === 1 && moves === 0) {
    return "\n\n[+] No moves needed, cluster already balanced.\n";
  }

  // Generate output

  if (action === 'dry-run') {
    return decideDryRunResult(state, winner, moves, conf, game);
  }

  if (action === 'suggest') {
    return decideSuggestResult(state, conf);
  }

  if (action === 'balance') {
    return decideBalanceResult(state, conf, game, winner);
  }
}


function decideDryRunResult(state, winner, moves, conf, game) {
  // Fail
  if (winner === -1) {
    const append = (moves > 0 ? `\n\nAchieved state:\n${game.printCurrentClusterState(state.shards)}\n` : '');
    return `\n[!] Impossible to achieve desired balance, try a higher threshold.${append}`;
  }
  // Success
  else {
    return `\n[+] Simulation succeeded in ${moves} moves, with an estimated ${conf}% chance of success.\n\nFinal state:\n${game.printCurrentClusterState(state.shards)}\n`;
  }
}


function decideSuggestResult(state, conf) {
  let play = state.playHistory[0];
  return `[+] Suggested move:\n${play.pretty()}\n\ncurl '${args.host}/_cluster/reroute' -X POST -H 'Content-Type: application/json' -H 'Authorization: Basic ${args.auth}' -d '${play.commands()}'\n`;
}


function decideBalanceResult(state, conf, game, winner) {
  if (winner === -1) {
    return `\n[!] Impossible to achieve desired balance, try a higher threshold.\n\nAchieved state:\n${game.printCurrentClusterState(state.shards)}\n`;
  } else if (winner === 0) {
    return `\n[+] Balance succeeded in ${moves} moves.\n\nFinal state:\n${game.printCurrentClusterState(state.shards)}\n`;
  } else {
    let play = state.playHistory[0];
    return `\r${play.pretty()}`;
  }
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
      return setTimeout(() => { process.nextTick(checkIfReady); }, refresh);
    }

    if (body.split('\n').find(line => line.match(/RELOCATING/))) {
      ellipse = (ellipse % 3) + 1;

      process.stdout.clearLine();
      process.stdout.write(`\r[-] Waiting for relocation to complete${".".repeat(ellipse)}`);

      return setTimeout(() => { process.nextTick(checkIfReady); }, refresh);
    }

    ellipse = 0;
    startRun();
  });
}


checkIfReady();
