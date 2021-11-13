const rc = require('rc');
const { program } = require('commander');
const { version: versionNumber } = require('../package.json');

const defaultSettings = {
  sourceFolder: './app',
  destFolder: './app-protected',
  encryptExtensions: 'html,css,js',
  indexFile: 'index.html',
  skipPrompt: false,
  hostUrl: 'http://localhost:8080/',
  quiet: false,
};

class Settings {
  _readRcFile() {
    return rc('protectstatic', defaultSettings);
  }

  _parseOptions(argv) {
    const rcArgs = this._readRcFile();

    // Parsing of command line arguments with relative facilities
    program.version(versionNumber);

    // Command line arguments override the rc file values
    return program
      .option(
        '-s, --sourceFolder <path>',
        'folder containing assets to protect',
        rcArgs.sourceFolder
      )
      .option(
        '-d, --destFolder <path>',
        'folder where the login and protected assets will be',
        rcArgs.destFolder
      )
      .option(
        '-e, --encryptExtensions <string>',
        'comma separated list of file extensions to encrypt',
        rcArgs.encryptExtensions
      )
      .option(
        '-i, --indexFile <string>',
        'index file used for your app or website',
        rcArgs.indexFile
      )
      .option(
        '-y, --skipPrompt',
        'assumes yes answer for any prompt',
        rcArgs.skipPrompt
      )
      .option(
        '-u, --hostUrl <url>',
        'helper to generate protected app URL',
        rcArgs.hostUrl
      )
      .option(
        '-q, --quiet',
        'print only relevant messages to console',
        rcArgs.quiet
      )
      .parse(argv);
  }

  readSettings(argv = process.argv) {
    const options = this._parseOptions(argv).opts();

    if (options.sourceFolder === options.destFolder) {
      throw new Error(
        'sourceFolder and destFolder cannot be at the same path!'
      );
    }

    // Ensures extensions are in an Array format
    if (!Array.isArray(options.encryptExtensions)) {
      // We may have received the extensions as a parameter
      options.encryptExtensions = options.encryptExtensions
        .split(',')
        .map((s) => s.trim());
    }

    return Promise.resolve(options);
  }
}

module.exports = new Settings();
