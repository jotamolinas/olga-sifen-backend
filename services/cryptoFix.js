const crypto = require('crypto');

function aplicarParcheCriptografico() {
  try {
    if (crypto.setDefaultCipherOptions) {
      crypto.setDefaultCipherOptions({
        legacyProvider: true
      });
    }
  } catch (e) {}

  try {
    const forge = require('node-forge');

    if (forge && forge.util && forge.util.ByteStringBuffer) {
      const origGetInt = forge.util.ByteStringBuffer.prototype.getInt;
      forge.util.ByteStringBuffer.prototype.getInt = function (numOfBits) {
        const numOfBytes = numOfBits / 8;
        if (numOfBytes > 4 && numOfBytes <= 8) {
          let value = 0;
          for (let i = 0; i < numOfBytes; i++) {
            value = value * 256 + this.getByte();
          }
          return value;
        }
        return origGetInt.call(this, numOfBits);
      };
    }

    if (forge && forge.pkcs12 && forge.pkcs12.pkcs12FromAsn1) {
      const origPkcs12FromAsn1 = forge.pkcs12.pkcs12FromAsn1;
      forge.pkcs12.pkcs12FromAsn1 = function (asn1, strict, password) {
        if (typeof strict === 'string') {
          password = strict;
          strict = false;
        }
        return origPkcs12FromAsn1.call(this, asn1, false, password);
      };
    }
  } catch (e) {}
}

aplicarParcheCriptografico();

module.exports = { aplicarParcheCriptografico };
