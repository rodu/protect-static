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

    it('should return the default settings', () => {
      const argv = ['', ''];
      const result = settings.readSettings(argv);

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

    it('should inherit the rc settings in the command line options', () => {
      const argv = ['', ''];
      const result = settings.readSettings(argv);

      expect(result.sourceFolder).to.equal('source');
      expect(result.destFolder).to.equal('destination');
    });

    describe('When there are command line options', () => {
      it('should override the default settings', () => {
        const argv = ['', '', '--sourceFolder=app'];
        const result = settings.readSettings(argv);

        expect(result.sourceFolder).to.equal('app');
        expect(result.destFolder).to.equal('destination');
      });
    });
  });
});
