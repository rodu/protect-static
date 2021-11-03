'use strict';
const { Crypto } = require('node-webcrypto-ossl');
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

  const sources = `${settings.appBasePath}/${settings.appDistFolder}/**/*`;

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
    const destination = `${settings.appBasePath}/${settings.protectedDistFolder}/${settings.appDistFolder}`;
    const extRegExp = new RegExp(
      `\\.(${settings.encryptExtensions.join('|')})$`
    );

    const copyFile = (source) => {
      return new Promise((resolve, reject) => {
        const options = {};

        if (extRegExp.test(source)) {
          options.transform = (readable, writable) => {
            const chunks = [];

            readable.on('readable', () => {
              let chunk;
              while (null !== (chunk = readable.read())) {
                chunks.push(chunk);
              }
            });

            readable.on('end', () => {
              const content = chunks.join('');

              writable.write(content, 'utf8', resolve);
            });
          };
        }

        ncp(source, destination, options, (err) => {
          if (err) return reject(err);

          resolve();
        });
      });
    };

    mkdirp.sync(destination);

    glob(settings.sources, (err, files) => {
      if (err) return reject(err);

      Promise.all(files.map(copyFile)).then(resolve).catch(reject);
    });

    /* const stream = gulp.src(sources).pipe(
      tap(async (file) => {
        const extension = file.extname.substring(1); // skips the dot (.)

        if (encryptExtensions.includes(extension)) {
          file.contents = Buffer.from(
            await aesGcmEncrypt(file.contents.toString(), key)
          );

          resolve(stream);
        } else {
          resolve(stream);
        }
      })
    );
  }).then((stream) =>
    stream.pipe(
      gulp.dest(`${appBasePath}/${protectedDistFolder}/${appDistFolder}`)
    )*/
  });
}

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

function protectStatic() {
  readSettings()
    .then(clean)
    .then(generateKey)
    .then(protect)
    .catch((error) => console.error(error));
}

module.exports = protectStatic;
