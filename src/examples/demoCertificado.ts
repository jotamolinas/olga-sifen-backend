import dotenv from 'dotenv';
dotenv.config();

import { CertificadoService } from '../services/certificadoService.js';

/**
 * Script de demostración para verificar el cifrado y descifrado AES-256-GCM
 * Ejecutar con: npx tsx src/examples/demoCertificado.ts
 */
function ejecutarDemo() {
  console.log('--- Demostración de CertificadoService (AES-256-GCM) ---');
  
  const passwordOriginal = 'ClaveFirmaDigital2026!';
  console.log(`Contraseña original: ${passwordOriginal}`);

  try {
    // 1. Encriptar
    const encryptedPayload = CertificadoService.encriptarPassword(passwordOriginal);
    console.log(`Payload cifrado (iv:authTag:data): \n${encryptedPayload}\n`);

    // 2. Desencriptar
    const decryptedPassword = CertificadoService.desencriptarPassword(encryptedPayload);
    console.log(`Contraseña desencriptada: ${decryptedPassword}`);

    if (passwordOriginal === decryptedPassword) {
      console.log('✅ Éxito: La contraseña coincide exactamente.');
    } else {
      console.error('❌ Error: Las contraseñas no coinciden.');
    }
  } catch (error: any) {
    console.error('Error durante la ejecución:', error.message);
  }
}

ejecutarDemo();
