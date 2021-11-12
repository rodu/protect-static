'use strict';
const { Crypto } = require('node-webcrypto-ossl');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const del = require('del');
const glob = promisify(require('glob'));
const mkdirp = require('mkdirp');
const copy = require('recursive-copy');
const through = require('through2');
const md5 = require('md5');
const chalk = require('chalk');
const terminalLink = require('terminal-link');
const { version: versionNumber } = require('./package.json');
const prompt = require('prompt');
const settings = require('./utils/settings');
const { PasswordUtils } = require('./utils/password');
const { pipeline } = require('stream');

prompt.start();
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

function getPassword(settings) {
  const passwordUtils = new PasswordUtils();

  return passwordUtils.getPassword(settings);
}

/**
 * The protect task will make a copy of contents while encrypting the
 * files with the extensions matching the given list
 */
async function protect(settings) {
  const outputPath = path.join(appBasePath, settings.destFolder);
  const expr = new RegExp(`\\.(${settings.encryptExtensions.join('|')})$`);

  const copyFile = async (filePath) => {
    if (!fs.existsSync(filePath)) {
      terminateWithMessage(`Cannot find source file at:\n${filePath}`);
    }

    if (!fs.existsSync(outputPath)) {
      terminateWithMessage(`Cannot find destination folder at:\n${outputPath}`);
    }

    const destination = path.join(outputPath, filePath);

    const readable = fs.createReadStream(filePath);
    const writable = fs.createWriteStream(destination);

    if (expr.test(filePath)) {
      const chunks = [];
      for await (const chunk of readable) {
        chunks.push(chunk);
      }

      const content = chunks.join('');
      logCopy('Encrypting', filePath);
      const cyphertext = await aesGcmEncrypt(content, settings.password);

      return new Promise((resolve, reject) => {
        writable.on('finish', resolve);

        writable.write(cyphertext, (err) => {
          if (err) reject(err);
        });

        writable.end();
      });
    } else {
      logCopy('Copying (non encrypted)', filePath);
      const asyncPipeline = promisify(pipeline);

      return asyncPipeline(readable, writable);
    }
  };

  const matches = await glob(path.join(settings.sourceFolder, '**'));
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

  return Promise.all(files.map(copyFile))
    .then(() => settings)
    .catch((err) => console.error(err));
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
                .replace(/__INDEX_FILE__/, settings.indexFile)
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
  return settings
    .readSettings()
    .then(clean)
    .then(getPassword)
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
