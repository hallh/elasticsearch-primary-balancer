# Elasticsearch Primary Shard Balancer

This is a tool to balance the primary shards on an Elasticsearch cluster. It does so by swapping primary shards on "overloaded" nodes with replica shards from other nodes by using the [Cluster Reroute API](https://www.elastic.co/guide/en/elasticsearch/reference/current/cluster-reroute.html). It'll simulate random swaps with a Monte Carlo Tree Search algorithm, then choose the move with the highest chance of successfully balancing the primaries. After each move the cluster state is reprocessed and the next move is made. This continues until the cluster is balanced.

### Who should use this?

If you're upserting documents in ES there's a disproportional load on the primary shards compared to the replica shards. See [this thread](https://discuss.elastic.co/t/how-to-rebalance-primary-shards-on-elastic-cluster/176060/2) for more. If all your primaries are hosted on a few nodes, you'll experience reduced indexing capacity and possibly write rejections. Additionally, if you're using custom routing, individual shards may also be disproportionally large and require more CPU to process causing further imbalance.

This tool will only address the issue with primary shards being bunched up on a few nodes, though it could be extended to take the shard sizes into account as well.

### Notable features

1. Given a map of Node => Availability Zone, the tool will only perform swaps within the same AZ to not incur data transfer costs.
2. Only one swap will be performed at a time. With large shards and a high amount of required shuffling, it may take a while for the tool to complete. On a 40-primary / 10 GB shard / 9 nodes cluster it took about an hour and a half to run.
    - You can start and stop the tool as you please. It'll reconsider the state of the cluster after each move, and it won't start any moves until all active relocations are completed.
    - You also can use the `suggest` mode if you don't want it messing around on your cluster on it's own :)
3. The tool will swap primaries with replicas of other shards in order to keep the cluster state balanced and not risk any disk or shard allocation skew. Currently it doesn't take shard sizes into account, and just assumes that they're all similarly sized.
4. No NPM dependencies.
5. Pretty output :)

### Running (standalone)

The tool can be run as follows:

```sh
$ node balance.js \
    [-h, --help] \
    [dry-run|suggest|balance] \
    [--map H0#AZ1,HN#AZN] \
    [--simulation-time N] \
    [--index index1,...,indexN] \
    [--threshold N] \
    [--auth user:password] \
    HOST[:PORT]
```

**Actions**

You must select one of the below actions:

| Action | Description |
| --- | --- |
| dry-run |Will simulate the shard movement and output the moves necessary to complete the balancing. This will only read the current state of the cluster's primaries, **no actions will be performed on the cluster**. |
| suggest |Instead of performing actual swaps on the cluster, it'll suggest a move and print the equivalent `curl` command. If you're nervous about running this tool on your cluster, you can use this to make the moves yourself and then simply consult the tool again once the move is complete. |
| balance |Will simulate the shard movement and perform the move with the highest probability of success. It'll wait while relocations are in progress and then make the next move until it achieves a balanced cluster, or until no more improvement can be made within the selected parameters. |

**Options**

All of the options below are optional except for the `HOST[:PORT]` URI of your ES cluster.

| Option | Required? | Description |
| --- | --- | --- |
| -h,&nbsp;--help | No |Will print help message and exit. |
| --map&nbsp;H0#AZ1,HN#AZN | No |Will use this mapping to only swap shards with nodes in the same AZ. |
| --simulation-time&nbsp;N | No |Before each move, the MCTS algorithm will spend `N` seconds to run simulations of random moves and choose the move with the best chance of success. **Default: 10**. |
| --index&nbsp;INDECES | No |Comma-separated list of indexes to consider. Not all indexes on a cluster are necessarily upserted, so this will limit the balancing to only consider the primaries of the desired indexes. |
| --threshold&nbsp;N | No |This will set a custom allocation threshold. Use this option if your cluster cannot achieve a perfect balance. If that is the case, the `dry-run` mode will state so and suggest a possible value for you. **Default**: Perfect balance. |
| --auth&nbsp;user:password | No |Necessary if you have security plugins set up. |
| HOST[:PORT] | **Yes** |Where to connect to Elasticsearch. |

### Running (docker)

A docker image can be build using

```sh
docker build -t elasticsearch-primary-balancer .
```

Then the balancer can be run using

```sh
docker run --rm elasticsearch-primary-balancer:latest <options>
```
with `<options>` as for `node balance.js` above.


### How to run it?

It's recommended that you disable all shard balancing before running the tool in `balance` mode. Moving shards around will likely trigger ES' built-in balancer. After the tool has run to completion you can re-enable the setting to its previous value. If your shards are similarly sized, the cluster won't need to do any additional balancing after the tool has run.

**`NOTE`**: You should always run the `dry-run` first. It'll output the current distribution of primaries as well as the percentage of shards each node should hold to be perfectly balanced. Some clusters may be impossible to balance depending on the number of shards, where they are located, and other factors that the tool may not be considering right now. You will either get a message saying the dry-run was successful, or an error message if it's deemed impossible to perfectly balance the primaries. If it does turn out to be impossible to get a perfect balance, you can use the `--threshold` option to adjust the max percentage of primaries each node is allowed to host. See more about this under the **Imperfect balance** section.

**Disabling Shard Balancing**

```
curl localhost:9200/_cluster/settings \
  -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"persistent":{"cluster.routing.rebalance.enable":"none"}}'
```

**Doing a dry-run/simulation**

```sh
$ node balance.js dry-run --simulation-time 3 --map es-data-0#1a,es-data-1#1b,es-data-2#1c,es-data-3#1a,...,es-data-8#1b localhost:9200
[-] No threshold specified, will try to achieve perfect balance.

[+] Using threshold: 0.112
[+] Simulation time: 3 seconds.

[+] Current cluster state:
 es-data-0:	11	(0.088)
 es-data-1:	14	(0.112)
 es-data-2:	12	(0.096)
 es-data-3:	9	(0.072)
 es-data-4:	19	(0.152)
 es-data-5:	15	(0.120)
 es-data-6:	18	(0.144)
 es-data-7:	19	(0.152)
 es-data-8:	8	(0.064)

 SWAPPING [PRIMARY] es-data-4/rollup_2019.10:6 [REPLICA] es-data-8/appv4:20
 SWAPPING [PRIMARY] es-data-7/staging_appv3:21 [REPLICA] es-data-3/rollup_2019.12:4
 SWAPPING [PRIMARY] es-data-4/rollup_2019.11:5 [REPLICA] es-data-8/rollup_2019.10:2
 SWAPPING [PRIMARY] es-data-7/appv4:4 [REPLICA] es-data-8/appv4:25
 SWAPPING [PRIMARY] es-data-6/staging_appv3:28 [REPLICA] es-data-3/appv4:23
 SWAPPING [PRIMARY] es-data-4/rollup_2019.11:6 [REPLICA] es-data-8/rollup_2019.12:1
 SWAPPING [PRIMARY] es-data-7/rollup_2019.07:7 [REPLICA] es-data-8/rollup_2019.09:0
 SWAPPING [PRIMARY] es-data-6/rollup_2019.11:1 [REPLICA] es-data-2/appv4:16
 SWAPPING [PRIMARY] es-data-4/rollup_2019.08:3 [REPLICA] es-data-3/appv4:7
 SWAPPING [PRIMARY] es-data-7/rollup_2019.07:6 [REPLICA] es-data-3/rollup_2019.09:7
 SWAPPING [PRIMARY] es-data-6/staging_appv4:0 [REPLICA] es-data-0/rollup_2019.08:6
 SWAPPING [PRIMARY] es-data-4/appv4:19 [REPLICA] es-data-0/rollup_2019.08:1

[!] Impossible to achieve desired balance, try a higher threshold.

Achieved state:
 es-data-0:	13	(0.104)
 es-data-1:	14	(0.112)
 es-data-2:	13	(0.104)
 es-data-3:	13	(0.104)
 es-data-4:	14	(0.112)
 es-data-5:	15	(0.120)
 es-data-6:	15	(0.120)
 es-data-7:	15	(0.120)
 es-data-8:	13	(0.104)
```

In this case we couldn't get a perfectly balanced cluster, but close to it. If we want to proceed to balance the cluster, we should run the `balance` command with a threshold of `0.12`.

**Doing a real run**

```sh
$ node balance.js balance --index appv4,rollup_2019.11 --simulation-time 2 localhost:9200

[-] No threshold specified, will try to achieve perfect balance.

[+] Using threshold: 0.125
[+] Simulation time: 2 seconds.

[+] Current cluster state:
 es-data-0:	6	(0.150)
 es-data-1:	5	(0.125)
 es-data-2:	2	(0.050)
 es-data-3:	5	(0.125)
 es-data-4:	5	(0.125)
 es-data-5:	4	(0.100)
 es-data-6:	3	(0.075)
 es-data-7:	6	(0.150)
 es-data-8:	4	(0.100)

 SWAPPING [PRIMARY] es-data-0/rollup_2019.11:9 [REPLICA] es-data-2/appv4:8
 SWAPPING [PRIMARY] es-data-7/appv4:5 [REPLICA] es-data-2/appv4:26
 SWAPPING [PRIMARY] es-data-7/appv4:3 [REPLICA] es-data-2/rollup_2019.11:6
[-] Waiting for relocation to complete...
```

### Imperfect balance

Say you have `40` primaries spread across `9` instances. This would put the perfect balance to be max `5` primaries per node, or `12.5%` of the primaries on each node. If it's impossible to reach a perfect balance, you can adjust the target balance to `15%` by specifying the following flag: `--threshold 0.15`. This way the balancer might be able to find a successful balancing strategy.

### Future work

1. Might add support to balance based on shard sizes.
2. Should probably add unit tests.
3. Could add some logic to the move selector so that it chose the play with the fastest path to completion, instead of the highest probability of success. Reason being that if you're not greedy with the threshold, you'll likely have ~100% chance of success in achieving imperfect balance. However, the fastest path vs. the highest confidence path might have a significant difference in the amount of moves needed to complete.
4. Issues and pull requests are welcome.

### Credits

This repo was originally cloned from [https://github.com/quasimik/medium-mcts](https://github.com/quasimik/medium-mcts) so I could borrow the MCTS implementation. The associated [Medium article](https://medium.com/@quasimik/implementing-monte-carlo-tree-search-in-node-js-5f07595104df) was also very helpful. Original inspiration for this tool was [Tempest](https://github.com/datarank/tempest), which does the shard-size balancing mentioned above, but it is pretty outdated now.

### Notes

This was tested on ES v6.3.2 and node v10.15.0.
