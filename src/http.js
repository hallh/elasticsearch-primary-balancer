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
      this.encoded = (typeof this.body === 'string' ? this.body : JSON.stringify(this.body));
    }
  }

  submit(callback) {
    let client = http;

    // Prepare request
    const options = {
      hostname: this.parsed.hostname,
      port: this.parsed.port || '80',
      path: this.parsed.path,
      method: this.method
    };

    // Use HTTPS client if specified
    if (this.parsed.protocol === 'https:') {
      client = https;
      options.port = '443';
      options.minVersion = 'TLSv1'; // Defaults to TLSv1.2 which may not be supported by whichever endpoint
    }

    // Set body headers if necessary
    if (this.encoded) {
      options.headers = {
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
      const chunks = [];

      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const response = Buffer.concat(chunks).toString();
        let body;

        try {
          body = JSON.parse(response);
        } catch (e) {
          body = response;
        }

        if (res.statusCode !== 200) {
          return callback(new Error('Non-200 Code'), body);
        }

        callback(null, body);
      });

    });

    // Handle errors
    req.on('error', error => {
      callback(error);
    });

    // Write body if applicable
    if (this.encoded) {
      req.write(this.encoded);
    }

    // Flush
    req.end();
  }
}

module.exports = request;
