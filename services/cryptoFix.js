/**
 * Parche criptográfico CommonJS para node-forge ByteStringBuffer.getInt (soporta 40 bits).
 */
const crypto = require('crypto');

function aplicarParcheCriptografico() {
  try {
    if (crypto.setDefaultCipherOptions) {
      crypto.setDefaultCipherOptions({ legacyProvider: true });
    }
  } catch {}

  try {
    const forge = require('node-forge');
    const ByteStringBuffer = forge?.util?.ByteStringBuffer;
    if (ByteStringBuffer && ByteStringBuffer.prototype) {
      const origGetInt = ByteStringBuffer.prototype.getInt;
      if (origGetInt && !origGetInt.__patched40) {
        ByteStringBuffer.prototype.getInt = function (n) {
          if (n === 40 || (n > 32 && n <= 53 && n % 8 === 0)) {
            let rval = 0;
            do {
              rval = (rval * 0x100) + this.data.charCodeAt(this.read++);
              n -= 8;
            } while (n > 0);
            return rval;
          }
          return origGetInt.call(this, n);
        };
        ByteStringBuffer.prototype.getInt.__patched40 = true;
      }
    }
  } catch {}
}

try {
  aplicarParcheCriptografico();
} catch {}

module.exports = { aplicarParcheCriptografico };
