const rc = require('rc');
const { program } = require('commander');
const { version: versionNumber } = require('../package.json');

const defaultSettings = {
  sourceFolder: './app',
  destFolder: './app-protected',
  encryptExtensions: 'html,css,js',
  skipPrompt: false,
  hostUrl: 'http://localhost:8080/',
};

module.exports = {
  readRcFile() {
    return rc('protectstatic', defaultSettings);
  },

  parseCLIOptions(argv) {
    const rcArgs = this.readRcFile();

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
        '-y, --skipPrompt',
        'assumes yes answer for any prompt',
        rcArgs.skipPrompt
      )
      .option(
        '-u, --hostUrl <url>',
        'helper to generate protected app URL',
        rcArgs.hostUrl
      )
      .parse(argv)
      .opts();
  },

  readSettings(argv = process.argv) {
    return Promise.resolve(this.parseCLIOptions(argv));
  },
};
