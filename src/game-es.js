'use strict'

const State = require('./state-es.js');
const Play = require('./play-es.js');

/** Class representing the game. */
class Game_ES {

  /** Save the shard dist. */
  constructor(initial_state, options) {
    if (!initial_state) {
      throw new Error('Shard data is required on startup.');
    }

    this.target_index = options.index   || null;
    this.az_mapping = options.azmap     || {};
    this.threshold = options.threshold  || null;

    // Parse initial state
    const rows = initial_state.split('\n').map(l => {
      const split = l.split(/\s+/);

      // Filter invalid rows
      if (split.length < 6) {
        return null;
      }

      const index   = split[0];
      const shard   = `${split[0]}:${split[1]}`;
      const primary = (split[2] === 'p');
      const host    = split[5];
      const az      = this.az_mapping[host] || null;

      return {
        index,
        shard,
        primary,
        host,
        az
      };
    });

    // Save initial state
    this.initital_state = initial_state;

    // Save target shards, ignore system indeces
    this.initial_state_shards = rows.filter(r => !!r && !r.index.startsWith('.') && (!this.target_index || this.target_index.indexOf(r.index) > -1));

    // Save the number of primaries
    const hosts = getHostToPrimaryMap(this.initial_state_shards);
    this.num_primaries = hosts.total;

    // Determine threshold for perfect balance automatically if not specified
    if (!this.threshold) {
      const num_hosts = Object.keys(hosts.hosts).length;
      this.threshold = Math.ceil(this.num_primaries / num_hosts) / this.num_primaries;
    }
  }

  /** Generate and return the initial game state. */
  start() {
    return new State([], this.initial_state_shards, 1)
  }

  /** Return the current player's legal plays from given state. */
  legalPlays(ori_state) {
    const state = {
      playHistory: ori_state.playHistory.slice(),
      shards: clone(ori_state.shards),
      player: ori_state.player
    };

    const hosts = getOverloadedHosts(state.shards);
    const actually_overloaded_hosts = hosts.filter(h => h.v > (state.shards.filter(s => s.primary).length * this.threshold));

    if (actually_overloaded_hosts.length === 0) {
      return [];
    }

    return getPossibleMovements(hosts, state.shards, this.threshold).map(s => new Play(state.player, s.moves));
  }

  /** Advance the given state and return it. */
  nextState(ori_state, play) {
    const state = {
      playHistory: ori_state.playHistory.slice(),
      shards: clone(ori_state.shards),
      player: ori_state.player
    };

    let newHistory = state.playHistory.slice(); // 1-deep copy
    newHistory.push(play)

    let newShards = clone(state.shards);

    // Process moves
    play.moves.forEach((m) => {
      const src_idx  = newShards.findIndex(s => s.shard === m.source.shard && s.host === m.source.host);
      const dst_idx  = newShards.findIndex(s => s.shard === m.dest.shard && s.host === m.dest.host);
      const src_host = newShards[src_idx].host;
      const dst_host = newShards[dst_idx].host;

      // Move source to dest and vice versa
      newShards[src_idx].host = dst_host;
      newShards[dst_idx].host = src_host;
    });

    return new State(newHistory, newShards, state.player);
  }

  /** Return the winner of the game. */
  winner(ori_state) {
    const state = {
      playHistory: ori_state.playHistory.slice(),
      shards: clone(ori_state.shards),
      player: ori_state.player
    };

    const hosts = getOverloadedHosts(state.shards);
    const actually_overloaded_hosts = hosts.filter(h => h.v > (state.shards.filter(s => s.primary).length * this.threshold));

    if (actually_overloaded_hosts.length === 0) {
      return 1;
    }

    if (this.legalPlays(state).length === 0) {
      return -1;
    }

    return null;
  }

  /** Pretty print overloaded hosts */
  printCurrentClusterState(shards) {
    const primary_hosts = getHostToPrimaryMap(shards);

    const rows = Object.keys(primary_hosts.hosts).sort().map((p) => {
      const current_threshold = (primary_hosts.hosts[p] / primary_hosts.total);
      let color = "\x1b[2m";

      if (current_threshold > this.threshold) {
        color = "\x1b[31m";
      }

      return ` ${color}${p}:\t${primary_hosts.hosts[p]}\t(${current_threshold.toFixed(3)})\x1b[0m`;
    });

    return rows.join('\n');
  }
}


// FUNCTIONS


function getHostToPrimaryMap(shards) {
  const set = shards.filter(s => s.primary);

  const init = {
    total: set.length,
    hosts: Object.assign({}, ...shards.map(h => ({ [h.host]: 0 })))
  };

  return set.reduce(reduceHosts, init);
}


function getOverloadedHosts(shards) {
  const hosts = getHostToPrimaryMap(shards);
  const target_hosts = Object.keys(hosts.hosts).map(h => ({ h: h, v: hosts.hosts[h] }));

  return target_hosts;
}


function reduceHosts(a, i) {
  a.hosts[i.host] += 1;
  return a;
}


function getPossibleMovements(hosts, shards, threshold) {
  const shards_copy       = clone(shards);
  const primary_shards    = shards_copy.filter(s => s.primary);
  const overloaded_hosts  = hosts.filter(h => h.v > (primary_shards.length * threshold)).sort((a, b) => b.v - a.v).map(h => h.h);
  const target_shards     = primary_shards.filter(s => overloaded_hosts[0] === s.host); // Only move on most affected host

  // Map primarues to hosts
  const primary_map = getHostToPrimaryMap(shards_copy);

  // Map hosts to shards
  const host_map = shards_copy.reduce(reduceHostMap, {});

  // Save movements here
  const movements = [];

  // Perform checks
  target_shards.forEach((primary) => {
    // Check if there's a host we can safely swap replicas with
    const swap_targets = findAllSwapTargets(primary, shards_copy, host_map, primary_map, threshold);

    // Stop if we couldn't find a swap target
    if (swap_targets.length === 0) {
      return;
    }

    // Save potential moves to array
    swap_targets.forEach(st => movements.push({
      moves: [{
          source: primary,
          dest: st
      }]
    }));
  });

  // Choose random moves to better support balancing a large number of shards
  // return movements;
  return shuffle(movements).slice(0, 20);
}


function reduceHostMap(a, i) {
  if (!a[i.host]) {
    a[i.host] = [];
  }

  a[i.host].push(i.shard);
  return a;
}


function findAllSwapTargets(primary, shards, host_map, primary_map, threshold) {
  // Find shards in same AZ but on a different host
  const swap_candidates = shards.filter(s => s.az === primary.az && s.host !== primary.host);

  // Filter any shards we already have on the primary's host.
  const primary_host_shards = shards.filter(s => s.host === primary.host).map(s => s.shard);
  const foreign_shards = swap_candidates.filter(s => primary_host_shards.indexOf(s.shard) === -1 && s.host !== primary.host);

  // Do not allow swapping with primary shards
  const replicas_only = foreign_shards.filter(s => !s.primary);

  // Do not allow sending a shard to a node that already has a replica of the same shard
  const non_conflicts = replicas_only.filter(s => host_map[s.host].indexOf(primary.shard) === -1);

  // Do not send primary to a host that'll be overloaded by it
  const low_load_nodes = non_conflicts.filter(s => (primary_map.hosts[s.host] + 1) <= primary_map.total * threshold);

  return low_load_nodes;
}


function clone(a) {
   return JSON.parse(JSON.stringify(a));
}


function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}


module.exports = Game_ES
