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

      if (split.length !== 6) {
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

    // Determine threshold for perfect balance automatically if not specified
    if (!this.threshold) {
      const hosts = getHosts(this.initial_state_shards);
      const num_primaries = hosts.total;
      const num_hosts = Object.keys(hosts.hosts).length;

      this.threshold = Math.ceil(num_primaries / num_hosts) / num_primaries;
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

    if (state.player === 1) {
      return getPossibleMovements(hosts, state.shards, this.threshold).map(s => new Play(state.player, s.moves));
    } else {
      const last_play = state.playHistory[state.playHistory.length - 1];

      // No more moves if previous player did nothing
      if (last_play.player === -1) {
        console.log("no more moves");
        return [];
      }

      const last_move = last_play.moves[last_play.moves.length - 1];
      const moved_shard = last_move.source.shard;
      const dest_host = last_move.dest.host;

      const replica_shards = state.shards.reduce((a, s) => (!s.primary && s.shard === moved_shard && s.host !== dest_host ? [...a, s] : a), []);
      const movements = replica_shards.map(s => new Play(state.player, [{
        source: s,
        dest: Object.assign({}, s, { primary: last_move.source.primary })
      }]));

      return movements;
    }
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
    const logger = [];


    // Process moves
    play.moves.forEach((m) => {
      const src_idx  = newShards.findIndex(s => s.shard === m.source.shard && s.host === m.source.host);
      const dst_idx  = newShards.findIndex(s => s.shard === m.dest.shard && s.host === m.dest.host);
      const src_host = newShards[src_idx].host;
      const dst_host = newShards[dst_idx].host;
      const dst_primary = m.dest.primary;

      // console.log(state.player === 1 ? `P[${m.source.primary},${m.dest.primary}][${m.source.shard}] : ${m.source.host} => ${m.dest.host}` : ` ^ U : ${m.source.host}`);

      // Move source to dest
      newShards[src_idx].primary = false;
      newShards[src_idx].host = dst_host;

      // Move dest to source
      newShards[dst_idx].primary = dst_primary;
      newShards[dst_idx].host = src_host;

      logger.push({
        osrc: state.shards[src_idx],
        odst: state.shards[dst_idx],
        nsrc: newShards[src_idx],
        ndst: newShards[dst_idx],
      });
    });

    if ((state.player === -1 && newShards.filter(s => s.primary).length === 39) || (state.player === 1 &&  newShards.filter(s => s.primary).length === 38)) {
      console.log("---")
      console.log(play.moves.length);
      console.log(logger.map(l => `[${l.osrc.shard}:${l.osrc.primary}-${l.odst.shard}:${l.odst.primary}}](${l.osrc.host}-${l.odst.host})`))
      console.log(logger.map(l => `[${l.nsrc.shard}:${l.nsrc.primary}-${l.ndst.shard}${l.ndst.primary}}](${l.nsrc.host}-${l.ndst.host})`))
      console.log("---")
      console.log( state.playHistory.map(p => "   - " + p.pretty()).join('\n'))
      console.log("---");
      console.log( newShards.filter(s => s.primary).length);
      console.log( play.pretty())
      console.log( getOverloadedHosts(newShards));
      throw new Error('invalid number of primaries');
    }

    let newPlayer = -state.player

    return new State(newHistory, newShards, newPlayer)
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

    if (state.player === 1 && this.legalPlays(state).length === 0) {
      return -1;
    }

    return null
  }
}


// FUNCTIONS


function getHosts(shards) {
  const set = shards.filter(s => s.primary);

  const init = {
    total: set.length,
    hosts: Object.assign({}, ...shards.map(h => ({ [h.host]: 0 })))
  };

  return set.reduce(reduceHosts, init);
}


function getOverloadedHosts(shards) {
  const hosts = getHosts(shards);
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

  // Map shards to hosts
  const replica_map = shards_copy.reduce(reduceReplicas, {});

  // Map hosts to shards
  const host_map = shards_copy.reduce(reduceHostMap, {});

  // Get list of shards currently on overloaded hosts
  const high_risk_shards = []; // primary_shards.filter(s => overloaded_hosts.indexOf(s.host) === -1).map(s => s.shard);

  // Save movements here
  const movements = [];

  // Perform checks
  target_shards.forEach((primary) => {
    // Set variable for the target shard
    let target_shard = primary;
    let available_shards = clone(shards_copy);
    let premoves = [];

    // Check if any replica host would go over threshold should their replica be promoted
    const bad_hosts = checkSafeReplicaPositions(target_shard, replica_map, hosts, primary_shards.length, threshold);

    // Don't proceed moving this primary if two or more replicas are on overloaded hosts
    if (bad_hosts.length >= 2) {
      return;
    }
    // // If only 1 replica is on a bad host, move the replica to low-load host first and then perform the move
    else if (bad_hosts.length === 1) {
      const bad_replica = available_shards.find(s => !s.primary && s.shard === primary.shard && s.host === bad_hosts[0]);
      const replica_swap_targets = findAllSwapTargets(bad_replica, available_shards, high_risk_shards, host_map);

      if (replica_swap_targets.length === 0) {
        return;
      }

      const replica_swap = replica_swap_targets[Math.floor(Math.random() * replica_swap_targets.length)];
      available_shards = available_shards.filter(s =>
        (s.shard !== replica_swap.shard && s.host !== replica_swap.host) &&
        (s.shard !== bad_replica.shard && s.host !== bad_replica.host)
      );

      premoves.push[{
        source: bad_replica,
        dest: replica_swap
      }];
    }

    // Check if there's a host we can safely swap replicas with
    const swap_targets = findAllSwapTargets(target_shard, available_shards, high_risk_shards, host_map);

    // Stop if we couldn't find a swap target
    if (swap_targets.length === 0) {
      return;
    }

    // Save potential moves to array
    swap_targets.forEach(st => movements.push({
      moves: [
        ...premoves,
        {
          source: target_shard,
          dest: st
        }
      ]
    }));
  });

  // Choose random moves to better support balancing a large number of shards
  return shuffle(movements).slice(0, 20);
}


function reduceReplicas(a, i) {
  // Don't count primaries
  if (i.primary) {
    return a;
  }

  if (!a[i.shard]) {
    a[i.shard] = [];
  }

  a[i.shard].push(i.host);
  return a;
}


function reduceHostMap(a, i) {
  if (!a[i.host]) {
    a[i.host] = [];
  }

  a[i.host].push(i.shard);
  return a;
}


function checkSafeReplicaPositions(primary, replica_map, hosts, num_primaries, threshold) {
  const host_map = Object.assign({}, ...hosts.map(h => ({ [h.h]: h.v })));

  // Stupid workaround: if primary has no replicas, consider all hosts to be bad
  if (!replica_map[primary.shard]) {
    return Object.keys(host_map);
  }

  const bad_hosts = replica_map[primary.shard].filter((host) => {
    return (host_map[host] + 1) > num_primaries * threshold;
  });

  return bad_hosts;
}


function findAllSwapTargets(primary, shards, high_risk_shards, host_map) {
  // Get all shards currently hosted on the primary's host
  const primary_host_shards = shards.filter(s => s.host === primary.host).map(s => s.shard);

  // Find shards in same AZ but on a different host
  const swap_candidates = shards.filter(s => s.az === primary.az && s.host !== primary.host);

  // Filter high-risk shards that are hosted on other overloaded instances
  const low_risk_shards = swap_candidates.filter(s => high_risk_shards.indexOf(s.shard) === -1);

  // Filter any shards we already have on the primary's host.
  const foreign_shards = low_risk_shards.filter(s => primary_host_shards.indexOf(s.shard) === -1);

  // Do not allow swapping with primary shards
  const replicas_only = foreign_shards.filter(s => !s.primary);

  // Do not allow sending a shard to a node that already has a replica of the same shard
  const non_conflicts = replicas_only.filter(s => host_map[s.host].indexOf(primary.shard) === -1);

  return non_conflicts;
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
