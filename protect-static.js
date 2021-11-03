'use strict';
const { Crypto } = require('node-webcrypto-ossl');
const fs = require('fs');
const path = require('path');
const del = require('del');
const glob = require('glob');
const mkdirp = require('mkdirp');
const { ncp } = require('ncp');
const rc = require('rc');
const tap = require('gulp-tap');
const pwGenerator = require('generate-password');

const crypto = new Crypto();

function readSettings() {
  const settingsDefaults = {
    appBasePath: '.',
    appDistFolder: 'app',
    protectedDistFolder: 'dist-protected',
    encryptExtensions: ['js', 'css', 'html'],
  };
  const settings = rc('protectstatic', settingsDefaults);

  if (settings.appDistFolder === settings.protectedDistFolder) {
    throw new Error('appFolder and destFolder cannot have the same value!');
  }

  const sources = `${settings.appBasePath}/${settings.appDistFolder}/**`;

  return Promise.resolve({ ...settings, sources });
}

function clean(settings) {
  return del(settings.protectedDistFolder).then(() => settings);
}

function generateKey(settings) {
  return Promise.resolve({
    settings,
    key:
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
function protect({ settings, key }) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      settings.appBasePath,
      settings.protectedDistFolder
    );
    const extRegExp = new RegExp(
      `${settings.appDistFolder}/.+\\.(${settings.encryptExtensions.join(
        '|'
      )})$`
    );

    const copyFile = (filePath) => {
      return new Promise((resolve, reject) => {
        const options = {
          clobber: true,
          transform: (readable, writable) => {
            if (extRegExp.test(filePath)) {
              const chunks = [];

              readable.on('readable', () => {
                let chunk;
                while (null !== (chunk = readable.read())) {
                  chunks.push(chunk);
                }
              });

              readable.on('end', async () => {
                const content = chunks.join('');

                console.log('Encrypting:', filePath);
                const cyphertext = await aesGcmEncrypt(content, key);

                writable.write(cyphertext, 'utf8', resolve);
              });
            } else {
              console.log('Copying (non encrypted):', filePath);
              readable.pipe(writable);

              resolve();
            }
          },
        };

        const destination = path.join(outputPath, filePath);
        ncp(filePath, destination, options, (err) => {
          if (err) return reject(err);

          resolve();
        });
      });
    };

    glob(settings.sources, (err, matches) => {
      if (err) return reject(err);
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

      folders.forEach((folder) => mkdirp.sync(path.join(outputPath, folder)));

      Promise.all(files.map(copyFile)).then(resolve).catch(reject);
    });
  });
}

function protectStatic() {
  return readSettings()
    .then(clean)
    .then(generateKey)
    .then(protect)
    .then(() => console.log('Done!'))
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
