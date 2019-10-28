# Elasticsearch Primary Balancer

This is a tool to balance the primaries on an Elasticsearch cluster. It does so by swapping primary shards on "overloaded" hosts with replica shards from other hosts. ES will respond by promoting a replica as the new primary. If you have multiple replicas, a random replica will be promoted. Due to the nature of this behaviour, it can be hard to plan an optimal set of moves that'd achieved a balanced cluster. To deal with this randomness, the tool will simulate every swap using a Monte Carlo Search Tree algorithm and choose the most optimal move.

### Who should use this?

If you're using upserts with ES, there's a disproportional load on the primary shard compared to the replica shards. See [this thread](https://discuss.elastic.co/t/how-to-rebalance-primary-shards-on-elastic-cluster/176060/2) for more. Additionally, if you're using custom routing, individual shards may also be disproportionally large and require more CPU to process causing further imbalance.

This tool will only address the issue with primary shards being located on the same host, though it could be extended to take the shard sizes into account as well.

### Notable features

1. Given a map of Host => Availability Zones, the tool will only perform swaps within the same AZ to not incur data transfer costs.
2. Only one swap will be performed at a time. With large shards and a high amount of shuffling, it may take a while for the tool to complete.
  - You can however start it and stop it as you please. It'll reconsider the state of the cluster after each move, and it won't start any moves until all active relocations are completed.
3. The tool will ensure that all moves will not further imbalance other "overloaded" hosts. Meaning it'll prioritise swapping primaries with replicas located on low-load hosts, or secondly, attempt to move replicas from high-load to low-load hosts before moving the primary.
4. The tool will swap primaries with replicas of other shards in order to keep the cluster state balanced and not risk any disk or shard allocation skew.

### Running

The tool can be run as follows:

```sh
$ node index.js \
    [--dry-run] \
    [--map H0:AZ1,HN:AZN] \
    [--simulation-time N] \
    [--index index1,...,indexN] \
    [--auth AUTH] \
    HOST[:PORT]
```

| Option | Required? | Description |
| --- | --- | --- |
| --dry-run | No | Will simulate the shard movement and list out the probability of success as well as the number of moves necessary to complete the balancing. This will only read and print the current state of your cluster primaries, **no actions will be performed on your cluster.** |
| --map&nbsp;H0:AZ1,HN:AZN | No | Will use this mapping to only swap replicas with hosts in the same AZ. |
| --simulation-time&nbsp;N | No | After each move, the MCST algorithm will spend `N` seconds to run simulations of random moves and the subsequent probability of success. **Default: 30**. |
| --index&nbsp;INDECES | No | Comma-separated list of indexes to consider. Not all indexes on a cluster are necessarily upserted, so this will limit the balancing to only consider the primaries of the listed indexes. |
| --auth&nbsp;AUTH | No | Base64 encoded HTTP Basic Auth string to use. Only necessary if you have basic auth set up. |
| HOST[:PORT] | **Yes** | Where to connect to ES. |

### How to run it?

It's recommended that you disable all shard balancing before running the tool. Moving shards around will likely trigger ES' built-in balancer. After the tool has completed running you can re-enable the setting to its previous value. The cluster won't usually need to do any additional balancing after it has run.

**Disabling Shard Balancing**

```
curl localhost:9200/_cluster/settings \
  -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"persistent":{"cluster.routing.rebalance.enable":"none"}}'
```

**Doing a dry-run/simulation**

```sh
$ node balance.js --dry-run --map es-data-0:1a,es-data-1:1b,es-data-2:1c,es-data-3:1a,es-data-4:1b --index myindex,yourindex localhost:9200
```

**Doing a real run**

```sh
$ node balance.js --map es-data-0:1a,es-data-1:1b,es-data-2:1c,es-data-3:1a,es-data-4:1b --index myindex,yourindex localhost:9200
```

### Credits

This repo was originally cloned from [https://github.com/quasimik/medium-mcts](https://github.com/quasimik/medium-mcts) in order to borrow the MCTS implementation. The associated [Medium article](https://medium.com/@quasimik/implementing-monte-carlo-tree-search-in-node-js-5f07595104df) was also very interesting.
