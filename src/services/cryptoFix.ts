/**
 * Parche criptográfico seguro y no bloqueante para compatibilidad con certificados PKCS#12
 * en node-forge y Node.js.
 * 
 * Intercepta de forma segura el método getInt de ByteStringBuffer en node-forge
 * para dar soporte a lecturas de 40 bits (5 bytes) y múltiplos requeridos por ciertos
 * algoritmos legados (p. ej. RC2-40 en contenedores PKCS#12).
 * 
 * Diseñado con protección total contra excepciones para que no afecte el arranque
 * de la aplicación en Cloud Run ni cause colapsos con error 503.
 */
import crypto from 'crypto';
import { createRequire } from 'module';

export function aplicarParcheCriptografico(): void {
  // 1. Configuración de ciphers heredados en Node.js (OpenSSL legacy provider)
  try {
    if ((crypto as any).setDefaultCipherOptions) {
      (crypto as any).setDefaultCipherOptions({
        legacyProvider: true
      });
    }
  } catch {
    // Silencioso y seguro
  }

  // 2. Parche selectivo a ByteStringBuffer.prototype.getInt en node-forge
  try {
    const require = createRequire(import.meta.url);
    const forge = require('node-forge');

    const ByteStringBuffer = forge?.util?.ByteStringBuffer;
    if (ByteStringBuffer && ByteStringBuffer.prototype) {
      const origGetInt = ByteStringBuffer.prototype.getInt;

      // Si aún no está parchado
      if (origGetInt && !(origGetInt as any).__patched40) {
        ByteStringBuffer.prototype.getInt = function (n: number) {
          // Si el tamaño solicitado es 40 bits (5 bytes) u otro múltiplo de 8 soportado en JS (hasta 53 bits seguros)
          if (n === 40 || (n > 32 && n <= 53 && n % 8 === 0)) {
            let rval = 0;
            do {
              rval = (rval * 0x100) + this.data.charCodeAt(this.read++);
              n -= 8;
            } while (n > 0);
            return rval;
          }

          // Para tamaños estándar (8, 16, 24, 32 bits), invocar la implementación original
          return origGetInt.call(this, n);
        };

        (ByteStringBuffer.prototype.getInt as any).__patched40 = true;
      }
    }
  } catch {
    // Si node-forge no se encuentra disponible durante la importación inicial,
    // se captura silenciosamente para no impedir el arranque de Express
  }
}

// Ejecución preventiva envuelta en try/catch seguro
try {
  aplicarParcheCriptografico();
} catch {
  // Ignorar cualquier fallo durante la carga inicial del módulo
}
