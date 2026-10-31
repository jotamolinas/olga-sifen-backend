import crypto from 'crypto';
import { createRequire } from 'module';

/**
 * Parche criptográfico y configuración de seguridad para compatibilidad con certificados .p12
 * en Node.js y node-forge.
 * 
 * Diseñado a prueba de fallos: Cualquier excepción interna es capturada silenciosamente
 * para garantizar que el servidor Express arranque sin interrupciones.
 */
export function aplicarParcheCriptografico(): void {
  try {
    if ((crypto as any).setDefaultCipherOptions) {
      (crypto as any).setDefaultCipherOptions({
        legacyProvider: true
      });
    }
  } catch {
    // No bloqueante
  }

  try {
    const require = createRequire(import.meta.url);
    const forge = require('node-forge');

    // Parche para ByteStringBuffer.prototype.getInt (soporta longitudes de 40 bits en adelante)
    if (forge?.util?.ByteStringBuffer?.prototype) {
      const origGetInt = forge.util.ByteStringBuffer.prototype.getInt;
      forge.util.ByteStringBuffer.prototype.getInt = function (numOfBits: number) {
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

    // Parche para pkcs12FromAsn1: desactivar modo estricto
    if (forge?.pkcs12?.pkcs12FromAsn1) {
      const origPkcs12FromAsn1 = forge.pkcs12.pkcs12FromAsn1;
      forge.pkcs12.pkcs12FromAsn1 = function (asn1: any, strict: any, password: any) {
        if (typeof strict === 'string') {
          password = strict;
          strict = false;
        }
        return origPkcs12FromAsn1.call(this, asn1, false, password);
      };
    }
  } catch {
    // No bloqueante: node-forge puede no estar disponible o usar imports diferentes
  }
}

// Ejecución segura no bloqueante
try {
  aplicarParcheCriptografico();
} catch {
  // Ignorar cualquier fallo durante la carga inicial del módulo
}
