'use strict'

const DRYRUN    = 'dryrun';
const SUGGEST   = 'suggest';
const BALANCE   = 'balance';
const MAP       = 'map';
const AZMAP     = 'azmap';
const SIMTIME   = 'simtime';
const INDEX     = 'index';
const THRESHOLD = 'threshold';
const AUTH      = 'auth';

class parseArgs {
  constructor(args) {
    if (!Array.isArray(args)) {
      throw new Error('Unexpected input, expecting an array.');
    }

    // Define actions
    this.actions = {
      'dry-run': DRYRUN,
      'suggest': SUGGEST,
      'balance': BALANCE
    };

    // Define options
    this.options = {
      '--map': MAP,
      '--simulation-time': SIMTIME,
      '--index': INDEX,
      '--threshold': THRESHOLD,
      '--auth': AUTH
    };

    // Set defaults
    this[SIMTIME] = "10";

    // Remove default process args
    const wargs = args.slice(2);

    // Check whether to show help page
    if (wargs.length === 0 || args.some(a => a === '-h' || a === '--help')) {
      return this.showHelp();
    }

    // Parse opts
    for (let i = 0; i < wargs.length; i++) {
      if (this.isOption(wargs[i])) {
        if (!wargs[i+1]) {
          throw new Error(`Missing value for option: ${wargs[i]}.`);
        }

        this[this.options[wargs[i]]] = wargs[i+1];
        i++;
      }

      else if (this.isAction(wargs[i])) {
        this[this.actions[wargs[i]]] = wargs[i];
      }

      else if (!this.host) {
        this.host = wargs[i];
      }

      else {
        throw new Error(`Unknown option: ${wargs[i]}`);
      }
    }

    // Validate options
    this.validate();
  }

  isAction(value) {
    return Object.keys(this.actions).indexOf(value) > -1;
  }

  isOption(value) {
    return Object.keys(this.options).indexOf(value) > -1;
  }

  validate() {
    // Make sure we have an endpoint for ES
    if (!this.host) {
      throw new Error(`Invalid ES host option: ${this.host}`);
    }

    // Can only perform one action
    const actions = [
      this[DRYRUN],
      this[SUGGEST],
      this[BALANCE]
    ];

    if (actions.filter(a => !!a).length !== 1) {
      throw new Error(`You must select one these actions: ${Object.keys(this.actions).join(', ')}`);
    } else {
      this.action = this[DRYRUN] || this[SUGGEST] || this[BALANCE];
    }

    // Validate the AZ map if specified
    if (this.hasOwnProperty(MAP)) {
      const rows = this[MAP].split(',').map(entry => entry.split('#'));

      if (rows.find(row => row.length !== 2)) {
        throw new Error('Invalid AZ mapping, too many "#" found.');
      }

      this[AZMAP] = {};

      rows.forEach(row => {
        this[AZMAP][row[0]] = row[1];
      });
    }

    // Make sure the simulation time is a number
    if (this.hasOwnProperty(SIMTIME)) {
      if (this[SIMTIME].match(/^[0-9]+$/) === null) {
        throw new Error('Simulation time must be an integer.');
      }

      this[SIMTIME] = parseInt(this[SIMTIME]);
    } else {
      this[SIMTIME] = 10; // Default to 10s
    }

    // Split index list into array
    if (this.hasOwnProperty(INDEX)) {
      if (this[INDEX].match(/\*/) !== null) {
        throw new Error('Wildcards are not supported in the index filter, please state each index explicitly in a comma-separated list.');
      }

      this[INDEX] = this[INDEX].split(',');
    }

    // Validate threshold is a float < 1.0
    if (this.hasOwnProperty(THRESHOLD)) {
      if (this[THRESHOLD].match(/^0\.[0-9]+$/) === null) {
        throw new Error('Threshold must be a value below 1.0');
      }

      this[THRESHOLD] = parseFloat(this[THRESHOLD]);
    }

    // Validate auth is in user:password format
    if (this.hasOwnProperty(AUTH)) {
      if (this[AUTH].match(/^.+:.+$/) === null) {
        throw new Error('Auth must be passed as "user:password"');
      }

      this[AUTH] = Buffer.from(this[AUTH]).toString('base64');
    }


    // Delete unneeded objects
    delete this.actions;
    delete this.options;
  }

  showHelp() {
    const usage = "\nUsage: node balance.js [dry-run|suggest|balance] [options] host[:port]\n" +
                "\nActions:\n" +
                "  dry-run                Simulate all the steps necessary to achieve balance. No changes will be made to the cluster in this mode.\n" +
                "  suggest                Suggest the best move and print corresponding cURL command. No changes will be made to the cluster in this mode.\n" +
                "  balance                Perform the balancing automatically. Will wait between each relocation before performing the next.\n" +
                "                         - It's strongly suggested to disable cluster allocation in this mode. See README for details.\n" +
                "\nOptions:\n" +
                "  --map H1#A1,H2#A2      A comma-separated list of HOSTNAME#ZONE pairs. Setting this will only allow shard relocations within the same\n" +
                "                         zone to prevent regional data transfer costs.\n" +
                "  --simulation-time N    Override the default 10s simulation time. Setting a higher simulation time is sometimes necessary on very large\n" +
                "                         clusters.\n" +
                "  --index a,b,c          A comma-separated list of indexes to include for balancing. Index names must be typed explicitly. Wildcards are\n" +
                "                         not supported.\n" +
                "  --threshold N          This will set a custom allocation threshold. Use this option if your cluster cannot achieve a perfect balance.\n" +
                "  --auth user:pwd        Necessary if you have security enabled on your cluster.\n" +
                "  -h, --help             Show help message and exit.\n";

    console.log(usage);
    process.exit(1);
  }
}

module.exports = parseArgs;
