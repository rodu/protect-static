'use strict';
const { Crypto } = require('node-webcrypto-ossl');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const del = require('del');
const glob = promisify(require('glob'));
const mkdirp = require('mkdirp');
const copy = require('recursive-copy');
const { ncp } = require('ncp');
const rc = require('rc');
const through = require('through2');
const md5 = require('md5');
const pwGenerator = require('generate-password');
const chalk = require('chalk');
const terminalLink = require('terminal-link');
const { version: versionNumber } = require('./package.json');
const { program } = require('commander');
const prompt = require('prompt');

// Defines the default argument values the program will fall-back to in absence
// of coomand line arguments or values in the rc file
const rcArgs = rc('protectstatic', {
  sourceFolder: './app',
  destFolder: './app-protected',
  encryptExtensions: 'html,css,js',
  skipPrompt: false,
  hostUrl: 'http://localhost:8080/',
});

prompt.start();
// Parsing of command line arguments with relative facilities
program.version(versionNumber);

// Command line arguments override the rc file values
program
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
  .parse();

const crypto = new Crypto();
const appBasePath = process.cwd();

const getModulePath = () => {
  const cwd = process.cwd();
  const expectedPath = path.join(cwd, 'node_modules/protect-static');

  return fs.existsSync(expectedPath) ? expectedPath : cwd;
};
const logCopy = (message, src) => {
  console.log(chalk.green(`\t${message}: ${src.replace(appBasePath, '')}`));
};
const terminateWithMessage = (message) => {
  console.log(chalk.red(message));
  process.exit(0);
};

function readSettings() {
  const settings = program.opts();

  if (settings.sourceFolder === settings.destFolder) {
    throw new Error('sourceFolder and destFolder cannot be at the same path!');
  }

  // Ensures extensions are in an Array format
  if (!Array.isArray(settings.encryptExtensions)) {
    // We may have received the extensions as a parameter
    settings.encryptExtensions = settings.encryptExtensions
      .split(',')
      .map((s) => s.trim());
  }

  const sources = path.join(settings.sourceFolder, '**');
  console.log(settings);
  return Promise.resolve({ ...settings, sources });
}

async function clean(settings) {
  const { destFolder } = settings;

  if (fs.existsSync(destFolder)) {
    if (settings.skipPrompt) {
      console.log(chalk.green(`Deleting destination: ${destFolder}`));
      await del(destFolder);
    } else {
      console.log(chalk.green(`About to delete destination: ${destFolder}`));

      const { answer } = await prompt.get({
        description: 'Delete folder?',
        name: 'answer',
        default: 'y/N',
      });

      if (/^y$/i.test(answer)) {
        await del(destFolder);
      } else {
        terminateWithMessage('Will stop there.');
      }
    }
  }

  return settings;
}

function generatePassword(settings) {
  return Promise.resolve({
    ...settings,
    password:
      process.env.PROTECT_STATIC_KEY ||
      pwGenerator.generate({
        length: 30,
        numbers: true,
        symbols: true,
      }),
  });
}

/**
 * The protect task will make a copy of contents while encrypting the
 * files with the extensions matching the given list
 */
async function protect(settings) {
  const outputPath = path.join(appBasePath, settings.destFolder);
  const expr = new RegExp(`\\.(${settings.encryptExtensions.join('|')})$`);

  const copyFile = (filePath) => {
    return new Promise((resolve, reject) => {
      const options = {
        clobber: true,
        transform: (readable, writable) => {
          if (expr.test(filePath)) {
            const chunks = [];

            readable.on('readable', () => {
              let chunk;
              while (null !== (chunk = readable.read())) {
                chunks.push(chunk);
              }
            });

            readable.on('end', async () => {
              const content = chunks.join('');

              logCopy('Encrypting', filePath);
              const cyphertext = await aesGcmEncrypt(
                content,
                settings.password
              );

              writable.write(cyphertext, 'utf8', resolve);
            });
          } else {
            logCopy('Copying (non encrypted)', filePath);
            readable.pipe(writable).on('end', resolve);
          }
        },
      };

      if (!fs.existsSync(filePath)) {
        terminateWithMessage(`Cannot find source file at:\n${filePath}`);
      }

      if (!fs.existsSync(outputPath)) {
        terminateWithMessage(
          `Cannot find destination folder at:\n${outputPath}`
        );
      }

      const destination = path.join(outputPath, filePath);
      ncp(filePath, destination, options, (err) => {
        if (err) return reject(err);

        resolve();
      });
    });
  };

  const matches = await glob(settings.sources);
  // Creates two separate lists of file and folder paths
  const { folders, files } = matches.reduce(
    (paths, path) => {
      const stats = fs.statSync(path);

      if (stats.isDirectory()) {
        paths.folders.push(path);
      }

      if (stats.isFile()) {
        paths.files.push(path);
      }

      return paths;
    },
    {
      folders: [],
      files: [],
    }
  );

  if (files.length === 0) {
    terminateWithMessage('There are no files to protect!');
  }

  console.log('\nProtecting assets:');
  folders.forEach((folder) => mkdirp.sync(path.join(outputPath, folder)));
  await Promise.all(files.map(copyFile));

  return settings;
}

function addLogin(settings) {
  const outputPath = path.join(appBasePath, settings.destFolder);
  const modulePath = getModulePath();
  const sources = ['index.html', 'service-worker.js'];
  console.log('\nAdding login page:');

  return Promise.all(
    sources.map((source) => {
      return copy(
        path.join(modulePath, 'login', source),
        path.join(outputPath, source),
        {
          transform: (src) => {
            return through((chunk, enc, done) => {
              const content = chunk.toString();

              logCopy('Copying', src);
              // Replaces the RegExp to match GET requests in the service worker
              // based on the project settings
              const replacedContent = content
                .toString()
                .replace(/__APP_FOLDER__/, settings.sourceFolder)
                .replace(/__VERSION_NUMBER__/, versionNumber)
                .replace(
                  /__ENCRYPT_EXTENSIONS__/,
                  settings.encryptExtensions.join('|')
                );

              done(null, replacedContent);
            });
          },
        }
      );
    })
  ).then(() => settings);
}

function showCompletionInfo(settings) {
  console.log('\nCredentials:');

  const previewUrl = `${settings.hostUrl}#${md5(settings.password)}`;
  console.log(
    '\tHost URL:',
    chalk.yellow.bold(terminalLink(previewUrl, previewUrl))
  );

  console.log('\tPassword:', chalk.yellow.bold(settings.password));
  console.log(chalk.white.bold('\nDone!\n'));

  return Promise.resolve(settings);
}

function main() {
  return readSettings()
    .then(clean)
    .then(generatePassword)
    .then(protect)
    .then(addLogin)
    .then(showCompletionInfo)
    .catch((error) => console.error(error));
}

module.exports = main;

/**
 * Encrypts plaintext using AES-GCM with supplied password, for decryption with aesGcmDecrypt().
 * (c) Chris Veness MIT Licence
 *
 * @param   {String} plaintext - Plaintext to be encrypted.
 * @param   {String} password - Password to use to encrypt plaintext.
 * @returns {String} Encrypted ciphertext.
 *
 * @example
 *   const ciphertext = await aesGcmEncrypt('my secret text', 'pw');
 *   aesGcmEncrypt('my secret text', 'pw').then(function(ciphertext) { console.log(ciphertext); });
 *
 * @link https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a
 */
async function aesGcmEncrypt(plaintext, password) {
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password

  const iv = crypto.getRandomValues(new Uint8Array(12)); // get 96-bit random iv
  const alg = { name: 'AES-GCM', iv: iv }; // specify algorithm to use
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, [
    'encrypt',
  ]); // generate key from pw

  const ptUint8 = new TextEncoder().encode(plaintext); // encode plaintext as UTF-8
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8); // encrypt plaintext using key

  return (
    Buffer.from(iv).toString('base64') +
    Buffer.from(new Uint8Array(ctBuffer)).toString('base64')
  );
}
