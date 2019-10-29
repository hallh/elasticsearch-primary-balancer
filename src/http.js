'use strict'

const url = require('url');
const http = require('http');
const https = require('https');

class request {
  constructor(params, callback) {
    if (!params) {
      throw new Error('Invalid params for HTTP client');
    }

    if (typeof params === 'string') {
      this.url = params;
      this.method = 'GET';
      this.body = null;
      this.headers = null;
    } else {
      this.url = params.url || null;
      this.method = params.method || 'GET';
      this.body = params.body || null;
      this.headers = params.headers || null;
    }

    // Validate inputs
    this.validate();

    // Perform request
    this.submit(callback);
  }

  validate() {
    if (!this.url || (this.method === 'POST' && !this.body) || (this.method === 'GET' && this.body)) {
      throw new Error('Invalid request.');
    }

    // Prefix protocol if missing
    this.url = (this.url.match(/^https?:/) === null ? `http://${this.url}`: this.url);

    // Parse URL into object
    try {
      this.parsed = url.parse(this.url);
    } catch (e) {
      throw e;
    }

    // Parse body
    if (this.body) {
      this.encoded = (typeof body === 'string' ? body : JSON.stringify(this.body));
    }
  }

  submit(callback) {
    let client = http;

    if (this.parsed.protocol === 'https:') {
      client = https;
    }

    // Prepare request
    const options = {
      hostname: this.parsed.hostname,
      port: this.parsed.port || '80',
      path: this.parsed.path,
      method: this.method
    };

    // Set body headers if necessary
    if (this.encoded) {
      this.headers = {
        'Content-Type': 'application/json',
        'Content-Length': this.encoded.length
      };
    }

    // Set headers if needed
    if (this.headers) {
      options.headers = Object.assign({}, options.headers, this.headers);
    }

    // Make request
    const req = client.request(options, res => {
      let chunks = [];

      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        let response = Buffer.concat(chunks).toString();

        if (res.statusCode !== 200) {
          return callback(new Error('Non-200 Code'), response);
        }

        callback(null, response);
      });

    });

    // Handle errors
    req.on('error', error => {
      callback(error);
    });

    // Flush
    req.end();
  }
}

module.exports = request;
