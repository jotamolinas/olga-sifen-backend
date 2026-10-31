import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface InfoCertificadoLocalizado {
  ruta: string | null;
  password: string;
  existe: boolean;
  rutasBuscadas: string[];
  tamanioBytes?: number;
}

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
    const secret = process.env.AES_SECRET_KEY || 'sifen_paraguay_secret_fallback_key_2026';

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
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Localiza automáticamente el certificado .p12 / .pfx y su contraseña en el entorno.
   * Busca en las rutas configuradas y en el directorio ./certs/
   */
  public static localizarCertificadoYPassword(
    inputCertPath?: string,
    inputPassword?: string
  ): InfoCertificadoLocalizado {
    const rutasBuscadas: string[] = [];

    // 1. Determinar posibles rutas del certificado
    const posiblesRutas: string[] = [];
    if (inputCertPath) posiblesRutas.push(inputCertPath);
    if (process.env.CERT_P12_PATH) posiblesRutas.push(process.env.CERT_P12_PATH);
    posiblesRutas.push(path.resolve(process.cwd(), 'certs', 'certificado.p12'));
    posiblesRutas.push(path.resolve(process.cwd(), 'certs', 'test.p12'));
    posiblesRutas.push(path.resolve(process.cwd(), 'certs', 'certificado.pfx'));

    // Buscar también cualquier archivo .p12 o .pfx presente en ./certs/
    const certsDir = path.resolve(process.cwd(), 'certs');
    if (fs.existsSync(certsDir)) {
      try {
        const archivos = fs.readdirSync(certsDir);
        for (const file of archivos) {
          if (file.endsWith('.p12') || file.endsWith('.pfx')) {
            posiblesRutas.push(path.join(certsDir, file));
          }
        }
      } catch {
        // Ignorar error de lectura de directorio
      }
    }

    let rutaEncontrada: string | null = null;
    let tamanioBytes: number | undefined;

    for (const p of posiblesRutas) {
      const rutaAbsoluta = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      if (!rutasBuscadas.includes(rutaAbsoluta)) {
        rutasBuscadas.push(rutaAbsoluta);
      }
      if (fs.existsSync(rutaAbsoluta)) {
        rutaEncontrada = rutaAbsoluta;
        try {
          tamanioBytes = fs.statSync(rutaAbsoluta).size;
        } catch {
          tamanioBytes = undefined;
        }
        break;
      }
    }

    // 2. Determinar la contraseña del certificado (prioriza CERT_PASSWORD o CERT_P12_PASSWORD, fallback test1234)
    let passwordFinal = inputPassword || process.env.CERT_PASSWORD || process.env.CERT_P12_PASSWORD || 'test1234';

    // Si viene encriptada con AES-256
    if (process.env.CERT_P12_PASSWORD_ENCRYPTED) {
      try {
        passwordFinal = this.desencriptarPassword(process.env.CERT_P12_PASSWORD_ENCRYPTED);
      } catch {
        // Fallback a password plana
      }
    }

    return {
      ruta: rutaEncontrada,
      password: passwordFinal,
      existe: !!rutaEncontrada,
      rutasBuscadas,
      tamanioBytes
    };
  }
}
