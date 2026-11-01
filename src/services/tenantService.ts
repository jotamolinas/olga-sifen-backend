import fs from 'fs';
import path from 'path';
import os from 'os';
import { FirebaseService } from './firebaseService.js';

/**
 * Interfaz que define el modelo de documento de la colección 'empresas' en Firestore.
 * Representa la configuración fiscal y credenciales SIFEN de un cliente/inquilino (Tenant SaaS).
 */
export interface EmpresaTenant {
  ruc: string;
  razonSocial: string;
  csc: string;
  idCsc: string;
  rutaCertificadoStorage: string;
  claveCertificado: string;
  ambiente?: 'test' | 'prod';
  timbradoNumero?: string;
  timbradoFecha?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  nombreFantasia?: string;
  actividadesEconomicas?: Array<{ codigo: string; descripcion: string }>;
  activo?: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

/**
 * Resultado completo de la resolución de un inquilino
 */
export interface TenantConfig {
  empresa: EmpresaTenant;
  certificadoBuffer: Buffer;
  rutaLocalCertificado: string;
  tamanioBytes: number;
}

/**
 * Cache en memoria de certificados descargados para optimizar el rendimiento multi-inquilino.
 */
interface CacheEntry {
  config: TenantConfig;
  expiraEn: number;
}

const cacheTenants = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de cache

export class TenantService {
  /**
   * Colección en Firestore donde residen los datos de los inquilinos
   */
  private static readonly COLECCION_EMPRESAS = 'empresas';

  /**
   * Normaliza un RUC quitando espacios en blanco para búsquedas consistentes
   */
  private static normalizarRuc(ruc: string): string {
    return (ruc || '').trim();
  }

  /**
   * Consulta Firestore para obtener la información de la empresa por su RUC
   * @param ruc RUC de la empresa (inquilino)
   */
  public static async consultarEmpresaPorRuc(ruc: string): Promise<EmpresaTenant> {
    const rucNormalizado = this.normalizarRuc(ruc);
    if (!rucNormalizado) {
      throw new Error('Debe proporcionar un RUC válido para consultar la empresa.');
    }

    const firestore = FirebaseService.db;
    const coleccion = firestore.collection(this.COLECCION_EMPRESAS);

    // 1. Intentar buscar por ID de documento (clave primaria: RUC)
    const docSnapshot = await coleccion.doc(rucNormalizado).get();
    if (docSnapshot.exists) {
      const data = docSnapshot.data() as EmpresaTenant;
      return { ...data, ruc: data.ruc || rucNormalizado };
    }

    // 2. Intentar buscar por el campo 'ruc'
    const querySnapshot = await coleccion.where('ruc', '==', rucNormalizado).limit(1).get();
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data() as EmpresaTenant;
      return { ...data, ruc: data.ruc || rucNormalizado };
    }

    // 3. Fallback: buscar sin dígito verificador si vino con guion
    if (rucNormalizado.includes('-')) {
      const rucSinDv = rucNormalizado.split('-')[0].trim();
      const querySinDv = await coleccion.where('ruc', '==', rucSinDv).limit(1).get();
      if (!querySinDv.empty) {
        const doc = querySinDv.docs[0];
        const data = doc.data() as EmpresaTenant;
        return { ...data, ruc: data.ruc || rucNormalizado };
      }
    }

    throw new Error(`Empresa no encontrada en Firestore para el RUC: "${rucNormalizado}". Verifique la colección "${this.COLECCION_EMPRESAS}".`);
  }

  /**
   * Descarga el archivo del certificado digital (.p12) desde Cloud Storage a un Buffer en memoria
   * @param rutaStorage Ruta del objeto en el bucket (ej. 'certificados/80012345-6/certificado.p12' o URL gs://)
   */
  public static async descargarCertificadoStorage(rutaStorage: string): Promise<Buffer> {
    if (!rutaStorage || rutaStorage.trim() === '') {
      throw new Error('La empresa no tiene configurada la ruta del certificado en Cloud Storage (rutaCertificadoStorage vacía).');
    }

    let bucket = FirebaseService.bucket;
    let rutaObjeto = rutaStorage.trim();

    // Soporte para rutas con prefijo gs://bucket-name/ruta/archivo.p12
    if (rutaObjeto.startsWith('gs://')) {
      const sinPrefijo = rutaObjeto.replace('gs://', '');
      const partes = sinPrefijo.split('/');
      const bucketName = partes[0];
      rutaObjeto = partes.slice(1).join('/');
      bucket = FirebaseService.storage.bucket(bucketName);
    }

    console.log(`📥 [Cloud Storage] Descargando certificado: gs://${bucket.name}/${rutaObjeto}...`);

    const file = bucket.file(rutaObjeto);
    const [existe] = await file.exists();

    if (!existe) {
      throw new Error(`El archivo de certificado no existe en Cloud Storage: gs://${bucket.name}/${rutaObjeto}`);
    }

    const [archivoBuffer] = await file.download();
    console.log(`✅ [Cloud Storage] Certificado descargado con éxito (${archivoBuffer.length} bytes).`);

    return archivoBuffer;
  }

  /**
   * Obtiene la configuración completa del inquilino: datos en Firestore y certificado .p12
   * descargado dinámicamente desde Cloud Storage hacia la memoria y el directorio temporal /tmp/.
   * 
   * @param ruc RUC de la empresa inquilina
   * @param forzarDescarga Si es true, ignora el cache en memoria y descarga de nuevo
   */
  public static async obtenerTenantPorRuc(ruc: string, forzarDescarga = false): Promise<TenantConfig> {
    const rucNormalizado = this.normalizarRuc(ruc);

    // Verificar cache en memoria si no se fuerza la recarga
    if (!forzarDescarga) {
      const cacheado = cacheTenants.get(rucNormalizado);
      if (cacheado && cacheado.expiraEn > Date.now()) {
        if (fs.existsSync(cacheado.config.rutaLocalCertificado)) {
          return cacheado.config;
        }
      }
    }

    // 1. Consultar documento en Firestore
    const empresa = await this.consultarEmpresaPorRuc(rucNormalizado);

    // 2. Descargar certificado desde Cloud Storage a Buffer
    const certificadoBuffer = await this.descargarCertificadoStorage(empresa.rutaCertificadoStorage);

    // 3. Persistir dinámicamente hacia /tmp/cert_{ruc}.p12
    const sanitizedRuc = rucNormalizado.replace(/[^a-zA-Z0-9-]/g, '_');
    const tempDir = (process.platform === 'win32' && !fs.existsSync('/tmp')) ? os.tmpdir() : '/tmp';
    if (!fs.existsSync(tempDir)) {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
      } catch (_) {}
    }
    const rutaLocalCertificado = path.join(tempDir, `cert_${sanitizedRuc}.p12`);

    fs.writeFileSync(rutaLocalCertificado, certificadoBuffer);
    console.log(`💾 [Tenant SaaS] Certificado guardado en: ${rutaLocalCertificado}`);

    const config: TenantConfig = {
      empresa,
      certificadoBuffer,
      rutaLocalCertificado,
      tamanioBytes: certificadoBuffer.length
    };

    // Guardar en cache
    cacheTenants.set(rucNormalizado, {
      config,
      expiraEn: Date.now() + CACHE_TTL_MS
    });

    return config;
  }

  /**
   * Limpia manualmente el cache de un inquilino (útil cuando actualiza su certificado en Storage)
   */
  public static invalidarCache(ruc: string): void {
    const rucNormalizado = this.normalizarRuc(ruc);
    const item = cacheTenants.get(rucNormalizado);
    if (item && fs.existsSync(item.config.rutaLocalCertificado)) {
      try {
        fs.unlinkSync(item.config.rutaLocalCertificado);
      } catch {}
    }
    cacheTenants.delete(rucNormalizado);
  }
}

export default TenantService;
