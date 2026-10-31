import crypto from 'crypto';
import fs from 'fs';

/**
 * Servicio de seguridad para el manejo y protección de certificados digitales .p12 / .pfx
 * requeridos por la DNIT / SET para la firma de Documentos Electrónicos (DE) en SIFEN.
 * 
 * Implementa cifrado simétrico AES-256-GCM (Galois/Counter Mode), el cual provee
 * confidencialidad e integridad autenticada mediante Authentication Tag.
 */
export class CertificadoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits recomendado para GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits

  /**
   * Obtiene la clave de 32 bytes (256 bits) requerida para AES-256
   * desde la variable de entorno AES_SECRET_KEY o un fallback derivado con SHA-256.
   */
  private static getKey(): Buffer {
    const secret = process.env.AES_SECRET_KEY;
    if (!secret) {
      throw new Error('La variable de entorno AES_SECRET_KEY no está configurada.');
    }

    // Si viene en formato HEX de 64 caracteres (32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(secret)) {
      return Buffer.from(secret, 'hex');
    }

    // Si tiene exactamente 32 caracteres
    if (Buffer.byteLength(secret, 'utf8') === 32) {
      return Buffer.from(secret, 'utf8');
    }

    // Para cualquier otra longitud, derivamos de forma consistente a 32 bytes usando SHA-256
    return crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Encripta la contraseña de un certificado .p12 con AES-256-GCM
   * @param password Contraseña en texto plano
   * @returns Cadena con formato: {iv_hex}:{authTag_hex}:{encryptedData_hex}
   */
  public static encriptarPassword(password: string): string {
    if (!password) {
      throw new Error('La contraseña a encriptar no puede estar vacía.');
    }

    const key = this.getKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH
    });

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Desencripta el payload cifrado de la contraseña
   * @param payload Cadena con formato: {iv_hex}:{authTag_hex}:{encryptedData_hex}
   * @returns Contraseña original en texto plano
   */
  public static desencriptarPassword(payload: string): string {
    if (!payload || !payload.includes(':')) {
      throw new Error('Formato de carga cifrada inválido. Se esperaba iv:authTag:contenido');
    }

    const [ivHex, authTagHex, encryptedHex] = payload.split(':');

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Partes de cifrado incompletas en el payload.');
    }

    const key = this.getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH
    });

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Valida si el archivo de certificado .p12 existe en la ruta especificada
   */
  public static existeCertificado(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
