'use strict';
const { Crypto } = require('node-webcrypto-ossl');
const del = require('del');
const settings = require('rc')('protectstatic', {
  appBasePath: '.',
  appDistFolder: 'app',
  protectedDistFolder: 'dist-protected',
  encryptExtensions: ['js', 'css', 'html'],
});
const pwGenerator = require('generate-password');

const { appBasePath, appDistFolder, protectedDistFolder, encryptExtensions } =
  settings;

if (appDistFolder === protectedDistFolder) {
  throw new Error('appFolder and destFolder cannot have the same value!');
}

const sources = `${appBasePath}/${appDistFolder}/**/*`;
const crypto = new Crypto();

function clean() {
  return del(protectedDistFolder);
}

/**
 * The protect task will make a copy of contents while encrypting the
 * files with the extensions matching the given list
 */
function protect() {
  const key =
    process.env.PROTECT_STATIC_KEY ||
    pwGenerator.generate({
      length: 30,
      numbers: true,
      symbols: true,
    });

  console.log(key);
  /* return new Promise((resolve, reject) => {
    const stream = gulp.src(sources).pipe(
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
    )
  ); */
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

async function protectStatic() {
  await clean();
  protect();
}

module.exports = protectStatic;
