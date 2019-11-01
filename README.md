# Elasticsearch Primary Balancer

This is a tool to balance the primaries on an Elasticsearch cluster. It does so by swapping primary shards on "overloaded" nodes with replica shards from other nodes, using the [Cluster Reroute API](https://www.elastic.co/guide/en/elasticsearch/reference/current/cluster-reroute.html). ES will react by promoting a replica as the new primary. If you have multiple replicas, a random replica will be promoted. Due to the nature of this behaviour, it can be hard to plan an optimal set of moves that'll achieve a set of balanced primaries. To deal with this randomness, the tool will simulate every swap using a Monte Carlo Search Tree algorithm and choose the most optimal move.

### Who should use this?

If you're using upserts with ES, there's a disproportional load on the primary shards compared to the replica shards. See [this thread](https://discuss.elastic.co/t/how-to-rebalance-primary-shards-on-elastic-cluster/176060/2) for more. If all your primaries are hosted on a few nodes, you'll experience reduced indexing capacity and possibly write rejections. Additionally, if you're using custom routing, individual shards may also be disproportionally large and require more CPU to process causing further imbalance.

This tool will only address the issue with primary shards being bunched up on a few nodes, though it could be extended to take the shard sizes into account as well.

### Notable features

1. Given a map of Node => Availability Zones, the tool will only perform swaps within the same AZ to not incur data transfer costs.
2. Only one swap will be performed at a time. With large shards and a high amount of required shuffling, it may take a while for the tool to complete. On a 40-primary / 10 GB shard / 9 nodes cluster it took about an hour and a half.
    - You can start and stop the tool as you please. It'll reconsider the state of the cluster after each move, and it won't start any moves until all active relocations are completed.
    - Or you can use the `suggest` mode if you don't trust it :)
3. The tool will ensure that all moves will not further imbalance other "overloaded" nodes. Meaning it'll prioritise swapping primaries with replicas located on low-load nodes, or secondly, attempt to move replicas from high-load to low-load nodes before moving the primary.
4. The tool will swap primaries with replicas of other shards in order to keep the cluster state balanced and not risk any disk or shard allocation skew.
5. No NPM dependencies.
6. Pretty output.

### Running

The tool can be run as follows:

```sh
$ node index.js \
    [dry-run|suggest|balance] \
    [--map H0#AZ1,HN#AZN] \
    [--simulation-time N] \
    [--index index1,...,indexN] \
    [--threshold N] \
    [--auth AUTH] \
    HOST[:PORT]
```

**Actions**

You must select one of the below actions:

| Action | Description |
| --- | --- |
| dry-run | Will simulate the shard movement and list out the probability of success as well as the number of moves necessary to complete the balancing. This will only read the current state of the cluster's primaries, **no actions will be performed on the cluster.** |
| suggest | Instead of performing actual swaps on the cluster, it'll suggest a move and print the equivalent `curl` command. If you're nervous about running this tool on your cluster, you can use this to make the moves yourself and then simply consult the tool again once the move is complete. |
| balance | Will simulate the shard movement and perform the move with the highest probability of success. It'll wait while relocations are in progress and then make the next move until it achieves a balanced cluster, or until no more improvement can be made within the selected parameters. |

**Options**

All of the options below are optional except for the `HOST[:PORT]` URI of your ES cluster.

| Option | Required? | Description |
| --- | --- | --- |
| --map&nbsp;H0#AZ1,HN#AZN | No | Will use this mapping to only swap replicas with nodes in the same AZ. |
| --simulation-time&nbsp;N | No | After each move, the MCST algorithm will spend `N` seconds to run simulations of random moves and the subsequent probability of success. **Default: 30**. |
| --index&nbsp;INDECES | No | Comma-separated list of indexes to consider. Not all indexes on a cluster are necessarily upserted, so this will limit the balancing to only consider the primaries of the listed indexes. |
| --auth&nbsp;AUTH | No | Base64 encoded HTTP Basic Auth string to use. Only necessary if you have basic auth set up. |
| --threshold&nbsp;N | No | This will set a custom allocation threshold. Use this option if your cluster cannot achieve a perfect balance. If that is the case, the `dry-run` mode will state so and suggest a possible value for you. **Default**: Perfect balance. |
| HOST[:PORT] | **Yes** | Where to connect to Elasticsearch. |

### How to run it?

It's recommended that you disable all shard balancing before running the tool. Moving shards around will likely trigger ES' built-in balancer. After the tool has completed running you can re-enable the setting to its previous value. The cluster won't usually need to do any additional balancing after it has run.

You should always run the dry-run first. It'll output the current distribution of primaries as well as the percentage of shards each node should hold to be perfectly balanced. Some clusters may be impossible to balance completely depending on the number of shards, the where they are positioned, and other factors I may not be considering right now. You will either get a `SUCCESS` along with the probability of success or a `FAIL` if it's deemed impossible to perfectly balance the primaries. If it does turn out to be impossible to get a perfect balance, you can use the `--threshold` flag to adjust the max percentage of primaries each node is allowed to host. See more about this under **Imperfect balance** section.

**Disabling Shard Balancing**

```
curl localhost:9200/_cluster/settings \
  -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"persistent":{"cluster.routing.rebalance.enable":"none"}}'
```

**Doing a dry-run/simulation**

```sh
$ node balance.js dry-run --map es-data-0#1a,es-data-1#1b,es-data-2#1c,es-data-3#1a,es-data-4#1b --index myindex,yourindex localhost:9200
```

**Doing a real run**

```sh
$ node balance.js balance --map es-data-0#1a,es-data-1#1b,es-data-2#1c,es-data-3#1a,es-data-4#1b --index myindex,yourindex localhost:9200
```

### Imperfect balance

Say you have `40` primaries spread across `9` instances. This would put the perfect balance to be max `5` primaries per node, or `12.5%` of the primaries on each node. If it's impossible to reach a perfect balance, you can adjust the target balance to `15%` by specifying the following flag: `--threshold 0.15`. This way the balancer might be able to find a successful balancing strategy.

### Future work

1. Might dockerize this so people don't need to install `node` to use it.
2. Might add support to balance based on shard sizes.
3. Should probably add unit tests.
3. Could add some logic to the move selector so that it chose the play with the fastest path to completion, instead of the highest probability of success. Reason being that if you're not greedy with the threshold, you'll likely have ~100% chance of success in achieving imperfect balance. However, the fastest path vs. the highest confidence path might be have a significant difference in the amount of moves needed to complete.
4. Issues and pull requests are welcome.

### Credits

This repo was originally cloned from [https://github.com/quasimik/medium-mcts](https://github.com/quasimik/medium-mcts) so I could borrow the MCTS implementation. The associated [Medium article](https://medium.com/@quasimik/implementing-monte-carlo-tree-search-in-node-js-5f07595104df) was also very helpful. Original inspiration for this tool is [Tempest](https://github.com/datarank/tempest), which does the shard-size balancing mentioned above, but it is pretty outdated now.

### Notes

This was tested on ES v6.3.2 and node v10.15.0.
