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

function readSettings() {
  const settingsDefaults = {
    appDistFolder: 'app',
    protectedDistFolder: 'dist-protected',
    encryptExtensions: ['js', 'css', 'html'],
  };
  const settings = rc('protectstatic', settingsDefaults);

  if (settings.appDistFolder === settings.protectedDistFolder) {
    throw new Error('appFolder and destFolder cannot have the same value!');
  }

  const sources = `./${settings.appDistFolder}/**`;

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
async function protect(settings) {
  const outputPath = path.join(appBasePath, settings.protectedDistFolder);
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

  folders.forEach((folder) => mkdirp.sync(path.join(outputPath, folder)));
  console.log('\nProtecting assets:');
  await Promise.all(files.map(copyFile));

  return settings;
}

function addLogin(settings) {
  const outputPath = path.join(appBasePath, settings.protectedDistFolder);
  const modulePath = getModulePath();
  const sources = ['./index.html', './service-worker.js'];
  console.log('\nAdding login page:');

  return Promise.all(
    sources.map((source) => {
      return copy(
        path.join(modulePath, source),
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
                .replace(/__APP_FOLDER__/, settings.appDistFolder)
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
  console.log('\tURL hash:', chalk.yellow.bold(`#${md5(settings.password)}`));
  console.log('\tPassword:', chalk.yellow.bold(settings.password));
  console.log(chalk.white.bold('\nDone!\n'));

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
