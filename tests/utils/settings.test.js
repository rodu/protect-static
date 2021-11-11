/* eslint-env mocha */
const settings = require('../../utils/settings');
const { expect } = require('chai');
const sinon = require('sinon');

const mockDefaults = {
  sourceFolder: 'abc',
  destFolder: 'def',
};

describe('utils/settings', () => {
  describe('When there is no rc file', () => {
    let sandbox;

    before(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(settings, 'readRcFile').returns(mockDefaults);
    });
    after(() => sandbox.restore());

    it('should return the default settings', async () => {
      const argv = ['', ''];
      const result = await settings.readSettings(argv);

      expect(result.sourceFolder).to.equal('abc');
      expect(result.destFolder).to.equal('def');
    });
  });

  describe('When there is an rc file', () => {
    let sandbox;

    before(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(settings, 'readRcFile').returns({
        sourceFolder: 'source',
        destFolder: 'destination',
      });
    });
    after(() => sandbox.restore());

    it('should inherit the rc settings in the command line options', async () => {
      const argv = ['', ''];
      const result = await settings.readSettings(argv);

      expect(result.sourceFolder).to.equal('source');
      expect(result.destFolder).to.equal('destination');
    });

    describe('When there are command line options', () => {
      it('should override the default settings', async () => {
        const argv = ['', '', '--sourceFolder=app'];
        const result = await settings.readSettings(argv);

        expect(result.sourceFolder).to.equal('app');
        expect(result.destFolder).to.equal('destination');
      });

      it('should throw when source and destination are the same', () => {
        const argv = ['', '', '--sourceFolder=app', '--destFolder=app'];

        expect(() => settings.readSettings(argv)).to.throw();
      });
    });
  });
});
