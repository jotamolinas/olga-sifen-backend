import crypto from 'crypto';

/**
 * Parche criptográfico y configuración de seguridad para compatibilidad con certificados .p12
 * en Node.js y node-forge.
 * 
 * Resuelve:
 * 1. "Only 8, 16, 24, or 32 bits supported: 40" en node-forge ByteStringBuffer al procesar
 *    longitudes ASN.1 de 5 bytes (40 bits) o claves derivadas PBES1/PBE-RC2-40.
 * 2. Deshabilita restricciones estrictas en node-forge pkcs12FromAsn1 (strict: false).
 * 3. Habilita compatibilidad con proveedores y algoritmos de cifrado legacy/AES en Node.js.
 */
export function aplicarParcheCriptografico(): void {
  // 1. Configurar opciones globales de cifrado en Node.js
  try {
    if ((crypto as any).setDefaultCipherOptions) {
      (crypto as any).setDefaultCipherOptions({
        legacyProvider: true
      });
    }
  } catch {
    // Ignorar si no está soportado en la versión actual de Node
  }

  // 2. Parche en memoria para node-forge
  try {
    const forge = require('node-forge');

    // Parche para ByteStringBuffer.prototype.getInt (soporta 40, 48, 56 y 64 bits)
    if (forge?.util?.ByteStringBuffer) {
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
        // Si strict es string, se pasó como (asn1, password)
        if (typeof strict === 'string') {
          password = strict;
          strict = false;
        }
        return origPkcs12FromAsn1.call(this, asn1, false, password);
      };
    }
  } catch {
    // node-forge se cargará dinámicamente cuando lo invoque facturacionelectronicapy-xmlsign
  }
}

// Ejecutar inmediatamente al importar
aplicarParcheCriptografico();
