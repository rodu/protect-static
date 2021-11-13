'use strict';
const { Crypto } = require('node-webcrypto-ossl');
const path = require('path');
const fs = require('fs');
const del = require('del');
const copy = require('recursive-copy');
const md5 = require('md5');
const chalk = require('chalk');
const terminalLink = require('terminal-link');
const { version: versionNumber } = require('./package.json');
const prompt = require('prompt');
const settings = require('./utils/settings');
const { PasswordUtils } = require('./utils/password');
const { Transform } = require('stream');

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
const counters = {
  copiedFiles: 0,
  encryptedFiles: 0,
};

async function clean(settings) {
  const { destFolder } = settings;

  // Reset the counters
  counters.copiedFiles = counters.encryptedFiles = 0;

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
  const { sourceFolder } = settings;

  if (!fs.existsSync(sourceFolder)) {
    terminateWithMessage(`Cannot find source folder: ${sourceFolder}`);
  }
  /**
   * Encrypts plaintext using AES-GCM with supplied password, for decryption
   * with aesGcmDecrypt(). (c) Chris Veness MIT Licence
   *
   * @link
   * https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a
   */
  const pwUtf8 = new TextEncoder().encode(settings.password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password
  const iv = crypto.getRandomValues(new Uint8Array(12)); // get 96-bit random iv
  const alg = { name: 'AES-GCM', iv }; // specify algorithm to use
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, [
    'encrypt',
  ]); // generate key from pw
  const ivBase64 = Buffer.from(iv).toString('base64');
  const expr = new RegExp(`\\.(${settings.encryptExtensions.join('|')})$`);
  const transform = (filePath) => {
    if (expr.test(filePath)) {
      if (!settings.quiet) logCopy('Encrypting', filePath);
      counters.encryptedFiles += 1;

      return new Transform({
        async transform(chunk, enc, done) {
          const plaintext = chunk.toString();
          const ptUint8 = new TextEncoder().encode(plaintext); // encode plaintext as UTF-8
          const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8);
          let cipherChunk = Buffer.from(new Uint8Array(ctBuffer)).toString(
            'base64'
          );

          // Prepends the iv string to the first chunk only
          done(null, ivBase64 + cipherChunk);
        },
      });
    }

    if (!settings.quiet) logCopy('Copying (non-encrypted)', filePath);
    counters.copiedFiles += 1;

    return null;
  };
  const outputPath = path.join(appBasePath, settings.destFolder, sourceFolder);

  console.log('\nProtecting assets');
  await copy(sourceFolder, outputPath, { transform });

  return settings;
}

async function addLogin(settings) {
  const outputPath = path.join(appBasePath, settings.destFolder);
  const modulePath = getModulePath();
  const sources = ['index.html', 'service-worker.js'];
  const transform = (src) => {
    if (!settings.quiet) logCopy('Copying', src);

    return new Transform({
      transform(chunk, enc, done) {
        const content = chunk.toString();
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
      },
    });
  };

  console.log('\nAdding login page');
  for (const source of sources) {
    await copy(
      path.join(modulePath, 'login', source),
      path.join(outputPath, source),
      { transform }
    );
  }

  return settings;
}

function showCompletionInfo(settings) {
  console.log('\nCredentials');

  const previewUrl = `${settings.hostUrl}#${md5(settings.password)}`;
  console.log(
    '\tHost URL:',
    chalk.yellow.bold(terminalLink(previewUrl, previewUrl))
  );

  console.log('\tPassword:', chalk.yellow.bold(settings.password));
  console.log(chalk.white.bold(`\nEncrypted: ${counters.encryptedFiles}`));
  console.log(
    chalk.white.bold(`Copied (non-encrypted): ${counters.copiedFiles}`)
  );
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
