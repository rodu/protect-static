const gulp = require('gulp');
const gulpClean = require('gulp-clean');
const messenger = require('gulp-messenger');
const tap = require('gulp-tap');
const md5 = require('md5');
const projectSettings = require('./package.json').project_settings || {};

const { Crypto } = require('node-webcrypto-ossl');

const crypto = new Crypto();

messenger.init();

const appBasePath = projectSettings.appBasePath || '.';
const appDistFolder = projectSettings.appDistFolder || 'app';
const protectedDistFolder =
  projectSettings.protectedDistFolder || 'dist-protected';
// Specify a list of files extensions whose content is to be encrypted
const encryptExtensions = projectSettings.encryptExtensions || [
  'js',
  'css',
  'html',
];

if (appDistFolder === protectedDistFolder) {
  throw new Error('appFolder and destFolder cannot have the same value!');
}

const sources = `${appBasePath}/${appDistFolder}/**/*`;

function clean() {
  return gulp
    .src(protectedDistFolder, { read: false, allowEmpty: true })
    .pipe(gulpClean());
}

/**
 * The protect task will make a copy of contents while encrypting the
 * files with the extensions matching the given list
 */
function protect() {
  const key = process.env.PROTECT_STATIC_KEY;

  if (!key) {
    return Promise.reject(
      'Please set a PROTECT_STATIC_KEY environment variable with the password to use for encryption'
    );
  }

  return new Promise((resolve, reject) => {
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
  );
}

function copyLogin() {
  return gulp
    .src(['index.html', 'service-worker.js'])
    .pipe(
      tap((file) => {
        // Replaces the RegExp to match GET requests in the service worker
        // based on the project settings
        const replacedContent = file.contents
          .toString()
          .replace(/__APP_FOLDER__/, appDistFolder)
          .replace(/__ENCRYPT_EXTENSIONS__/, encryptExtensions.join('|'));

        file.contents = Buffer.from(replacedContent);
      })
    )
    .pipe(gulp.dest(`${appBasePath}/${protectedDistFolder}`));
}

function giveInfo(done) {
  const key = process.env.PROTECT_STATIC_KEY;
  const keyHash = md5(key);

  messenger.note(`Output generated in: ${appBasePath}/${protectedDistFolder}`);
  messenger.note(`Unlock key: ${key}`);
  messenger.note(`Add this hash to the public URL: #${keyHash}`);

  done();
}

exports.protect = protect;
exports.default = gulp.series(clean, protect, copyLogin, giveInfo);

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
