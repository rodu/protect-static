/* eslint-env mocha */
const { PasswordUtils } = require('../../utils/password');

const { expect } = require('chai');
const sinon = require('sinon');
const { before, after } = require('mocha');

const originalSettings = {
  sourceFolder: 'app',
  destFolder: 'app-protected',
  encryptExtensions: 'css,js',
  skipPrompt: true,
  hostUrl: 'http://localhost:8080',
};

describe('utils/password', () => {
  describe('When there is an env variable set for PROTECT_STATIC_KEY', () => {
    before(() => (process.env.PROTECT_STATIC_KEY = 'Passw0rd'));
    after(() => delete process.env.PROTECT_STATIC_KEY);

    it('should use the env variable value for the password', async () => {
      const passwordUtils = new PasswordUtils();
      const settings = await passwordUtils.getPassword({});

      expect(settings.password).to.equal('Passw0rd');
    });

    it('should leave original settings unchanged', async () => {
      const passwordUtils = new PasswordUtils();
      const settings = await passwordUtils.getPassword(originalSettings);
      // Deletes the password to verify unchanged original settings
      delete settings.password;

      expect(settings).to.eql(originalSettings);
    });
  });

  describe('When the env variable is not set', () => {
    let sandbox;
    let passwordUtils;

    before(() => {
      passwordUtils = new PasswordUtils();

      sandbox = sinon.createSandbox();
      sandbox
        .stub(passwordUtils, '_generatePassword')
        .returns('randomPassword');
    });
    after(() => sandbox.restore());

    it('should generate a random password', async () => {
      const settings = await passwordUtils.getPassword({});

      expect(settings.password).to.equal('randomPassword');
    });

    it('should leave original settings unchanged', async () => {
      const settings = await passwordUtils.getPassword(originalSettings);
      // Deletes the password to verify unchanged original settings
      delete settings.password;

      expect(settings).to.eql(originalSettings);
    });
  });
});
