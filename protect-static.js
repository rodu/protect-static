'use strict';
const { Crypto } = require('node-webcrypto-ossl');
const path = require('path');
const del = require('del');
const through = require('through2');
const copy = require('recursive-copy');
const rc = require('rc');
const md5 = require('md5');
const pwGenerator = require('generate-password');

const crypto = new Crypto();
const appBasePath = process.cwd();

function readSettings() {
  const settingsDefaults = {
    appDistFolder: 'app',
    protectedDistFolder: 'dist-protected',
    encryptExtensions: ['js', 'css', 'html'],
  };
  const settings = rc('protectstatic', settingsDefaults);
  console.dir(settings);
  if (settings.appDistFolder === settings.protectedDistFolder) {
    throw new Error('appFolder and destFolder cannot have the same value!');
  }

  const sources = `${appBasePath}/${settings.appDistFolder}`;

  return Promise.resolve({ ...settings, sources });
}

function clean(settings) {
  return del(settings.protectedDistFolder).then(() => settings);
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
function protect(settings) {
  const outputPath = path.join(
    appBasePath,
    settings.protectedDistFolder,
    settings.appDistFolder
  );
  const expr = new RegExp(`\\.(${settings.encryptExtensions.join('|')})$`);
  const logCopy = (message, src) => {
    console.log(`\t${message}: ${src.replace(appBasePath, '')}`);
  };

  console.log('\nProtecting assets:');
  return copy(settings.sources, outputPath, {
    transform: (src) => {
      if (expr.test(path.extname(src))) {
        return through(async (chunk, enc, done) => {
          const content = chunk.toString();

          logCopy('Encrypting', src);
          const cyphertext = await aesGcmEncrypt(content, settings.password);

          done(null, cyphertext);
        });
      }

      logCopy('Copying (non encrypted)', src);
      return null;
    },
  }).then(() => settings);
}

function addLogin(settings) {
  const outputPath = path.join(appBasePath, settings.protectedDistFolder);
  const sources = ['./index.html', './service-worker.js'];
  console.log('\nAdding login page:');

  return Promise.all(
    sources.map((source) => {
      return copy(source, path.join(outputPath, source), {
        transform: (src) => {
          return through(async (chunk, enc, done) => {
            const content = chunk.toString();

            console.log('\tCopying:', src);
            // Replaces the RegExp to match GET requests in the service worker
            // based on the project settings
            const replacedContent = content
              .toString()
              .replace(/__APP_FOLDER__/, settings.appDistFolder)
              .replace(
                /__ENCRYPT_EXTENSIONS__/,
                settings.encryptExtensions.join('|')
              );

            done(null, replacedContent);
          });
        },
      });
    })
  ).then(() => settings);
}

function showCompletionInfo(settings) {
  console.log('\nUnlock password:', settings.password);
  console.log(`Add this hash to the login URL: #${md5(settings.password)}`);
  console.log('\nDone!');

  return Promise.resolve(settings);
}

function protectStatic() {
  return readSettings()
    .then(clean)
    .then(generatePassword)
    .then(protect)
    .then(addLogin)
    .then(showCompletionInfo)
    .catch((error) => console.error(error));
}

module.exports = protectStatic;

/**
 * Encrypts plaintext using AES-GCM with supplied password, for decryption with aesGcmDecrypt().
 *                                                                      (c) Chris Veness MIT Licence
 *
 * @param   {String} plaintext - Plaintext to be encrypted.
 * @param   {String} password - Password to use to encrypt plaintext.
 * @returns {String} Encrypted ciphertext.
 *
 * @example
 *   const ciphertext = await aesGcmEncrypt('my secret text', 'pw');
 *   aesGcmEncrypt('my secret text', 'pw').then(function(ciphertext) { console.log(ciphertext); });
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
