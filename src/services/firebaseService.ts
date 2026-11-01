import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

/**
 * Servicio de inicialización y conexión segura a Firebase Admin SDK (Firestore y Cloud Storage).
 * Lee las credenciales dinámicamente desde variables de entorno o archivo de secretos protegido.
 * NUNCA almacena ni expone llaves privadas en el código fuente.
 */
let firestoreInstance: Firestore | null = null;
let storageInstance: Storage | null = null;

export class FirebaseService {
  private static inicializado = false;

  /**
   * Obtiene la credencial de autenticación de forma segura desde el entorno.
   * Parsea directamente las credenciales usando JSON.parse(process.env.FIREBASE_CREDENTIALS).
   */
  private static resolverCredencial(): admin.ServiceAccount | null {
    // 1. Parsear directamente las credenciales desde la variable de entorno FIREBASE_CREDENTIALS
    if (process.env.FIREBASE_CREDENTIALS) {
      try {
        const credencialesRaw = process.env.FIREBASE_CREDENTIALS.trim();
        const credencial = JSON.parse(credencialesRaw);
        return credencial;
      } catch (err: any) {
        console.error('❌ Error al parsear FIREBASE_CREDENTIALS directamente con JSON.parse:', err?.message || err);
      }
    }

    // 2. Variable GOOGLE_APPLICATION_CREDENTIALS estándar de Google Cloud
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      try {
        return JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
      } catch (err: any) {
        console.warn('⚠️ Error leyendo GOOGLE_APPLICATION_CREDENTIALS:', err?.message || err);
      }
    }

    // 3. Ubicación protegida local (secrets/firebase-adminsdk.json)
    const localSecretsPath = path.resolve(process.cwd(), 'secrets', 'firebase-adminsdk.json');
    if (fs.existsSync(localSecretsPath)) {
      try {
        return JSON.parse(fs.readFileSync(localSecretsPath, 'utf8'));
      } catch (err: any) {
        console.warn(`⚠️ Error leyendo credencial local en ${localSecretsPath}:`, err?.message || err);
      }
    }

    return null;
  }

  /**
   * Inicializa la aplicación Firebase Admin si aún no ha sido inicializada
   */
  public static inicializar(): void {
    if (this.inicializado || admin.apps.length > 0) {
      this.inicializado = true;
      return;
    }

    const credencialObj = this.resolverCredencial();

    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      (credencialObj?.projectId ? `${credencialObj.projectId}.appspot.com` : 'nipponguay.appspot.com');

    try {
      if (credencialObj) {
        admin.initializeApp({
          credential: admin.credential.cert(credencialObj),
          storageBucket
        });
        console.log(`🔥 [Firebase Admin] Inicializado exitosamente con proyecto: ${credencialObj.projectId}`);
      } else {
        // Fallback para Google Cloud Run (Application Default Credentials del contenedor)
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          storageBucket
        });
        console.log('🔥 [Firebase Admin] Inicializado con Application Default Credentials (GCP)');
      }
      this.inicializado = true;
    } catch (error: any) {
      console.error('❌ Error inicializando Firebase Admin SDK:', error?.message || error);
      throw error;
    }
  }

  /**
   * Instancia de Firestore
   */
  public static get db(): Firestore {
    this.inicializar();
    if (!firestoreInstance) {
      firestoreInstance = getFirestore();
    }
    return firestoreInstance;
  }

  /**
   * Instancia de Cloud Storage
   */
  public static get storage(): Storage {
    this.inicializar();
    if (!storageInstance) {
      storageInstance = getStorage();
    }
    return storageInstance;
  }

  /**
   * Bucket de almacenamiento predeterminado
   */
  public static get bucket() {
    return this.storage.bucket();
  }
}

export const db = FirebaseService.db;
export const storage = FirebaseService.storage;
export default FirebaseService;
