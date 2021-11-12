const pwGenerator = require('generate-password');

const pwOptions = {
  length: 30,
  numbers: true,
  symbols: true,
};

class PasswordUtils {
  constructor() {
    this.envPassword = process.env.PROTECT_STATIC_KEY;
  }

  _generatePassword() {
    return pwGenerator.generate(pwOptions);
  }

  getPassword(settings) {
    return Promise.resolve({
      ...settings,
      password: this.envPassword || this._generatePassword(),
    });
  }
}

module.exports = { PasswordUtils };
