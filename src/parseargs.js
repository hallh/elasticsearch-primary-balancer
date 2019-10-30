'use strict'

const DRYRUN    = 'dryrun';
const SUGGEST   = 'suggest';
const MAP       = 'map';
const AZMAP     = 'azmap';
const SIMTIME   = 'simtime';
const INDEX     = 'index';
const THRESHOLD = 'threshold';
const AUTH      = 'auth';

class parseArgs {
  constructor(args) {
    const wargs = args.slice(2);

    if (!Array.isArray(args)) {
      throw new Error('Unexpected input, expecting an array.');
    }

    if (args.length === 0) {
      throw new Error('Missing required option: HOST[:PORT].');
    }

    // Define flags
    this.flags = {
      '--dry-run': DRYRUN,
      '--suggest': SUGGEST
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

    // Get ES host and create options object
    this.host = wargs.splice(-1).pop();

    // Parse opts
    for (let i = 0; i < wargs.length; i++) {
      if (this.isOption(wargs[i])) {
        if (!wargs[i+1]) {
          throw new Error(`Missing value for option: ${wargs[i]}.`);
        }

        this[this.options[wargs[i]]] = wargs[i+1];
        i++;
      }

      else if (this.isFlag(wargs[i])) {
        this[this.flags[wargs[i]]] = true;
      }

      else {
        throw new Error(`Unknown option: ${wargs[i]}`);
      }
    }

    // Validate options
    this.validate();
  }

  isFlag(value) {
    return Object.keys(this.flags).indexOf(value) > -1;
  }

  isOption(value) {
    return Object.keys(this.options).indexOf(value) > -1;
  }

  validate() {
    // Delete unnecessary objects
    delete this.flags;
    delete this.options;

    // Make sure we have an endpoint for ES
    if (!this.host) {
      throw new Error(`Invalid ES host option: ${this.host}`);
    }

    // Dryrun and suggest don't go hand in hand
    if (this[DRYRUN] && this[SUGGEST]) {
      throw new Error('You cannot run dry-run and suggest together');
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
    }

    // Split index list into array
    if (this.hasOwnProperty(INDEX)) {
      this[INDEX] = this[INDEX].split(',');
    }

    // Validate threshold is a float < 1.0
    if (this.hasOwnProperty(THRESHOLD)) {
      if (this[THRESHOLD].match(/^0\.[0-9]+$/) === null) {
        throw new Error('Threshold must be a value below 1.0');
      }

      this[THRESHOLD] = parseFloat(this[THRESHOLD]);
    }

    // Don't validate auth
  }
}

module.exports = parseArgs;