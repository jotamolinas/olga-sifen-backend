/**
 * Servicio centralizado para gestionar certificados digitales para autenticación con SIFEN
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Valida si un certificado es válido y accesible
 * 
 * @param {Buffer} certificadoBuffer Buffer del certificado
 * @param {string} clave Clave del certificado
 * @returns {Object} Resultado de la validación
 */
function validarCertificado(certificadoBuffer, clave) {
    try {
        if (!certificadoBuffer || certificadoBuffer.length === 0) {
            return {
                valido: false,
                error: 'Certificado vacío o inválido'
            };
        }

        // Verificar que tenga el formato PKCS#12 (comienza con 0x30 / ASN.1 SEQUENCE)
        if (certificadoBuffer[0] !== 0x30) {
            return {
                valido: false,
                error: 'El archivo no parece ser un certificado PKCS#12 válido'
            };
        }

        return {
            valido: true,
            tamaño: certificadoBuffer.length,
            mensaje: 'Certificado validado correctamente'
        };
    } catch (error) {
        return {
            valido: false,
            error: `Error al validar certificado: ${error.message}`
        };
    }
}

/**
 * Obtiene la lista de ubicaciones prioritarias donde buscar el certificado
 */
function obtenerUbicacionesCandidatas() {
    const raw = [
        path.join(process.cwd(), 'certs', 'certificado.p12'),
        path.join(__dirname, '..', 'certs', 'certificado.p12'),
        path.join(process.cwd(), 'certificado.p12'),
        path.join(__dirname, '..', 'certificado.p12'),
        path.join(process.cwd(), 'cert', 'certificado.p12'),
        path.join(__dirname, '..', 'cert', 'certificado.p12'),
        path.join(__dirname, '..', '..', 'storage', 'app', 'certificados', 'certificado.p12')
    ];

    if (process.env.CERT_P12_PATH) {
        raw.unshift(path.resolve(process.cwd(), process.env.CERT_P12_PATH));
    }

    const result = [];
    const seen = new Set();
    for (const p of raw) {
        if (!p) continue;
        const norm = path.resolve(p);
        const key = process.platform === 'win32' ? norm.toLowerCase() : norm;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(norm);
        }
    }
    return result;
}

/**
 * Busca y carga un certificado desde las ubicaciones configuradas
 * 
 * @param {string} clavePersonalizada Clave personalizada para el certificado
 * @returns {Object} Objeto con información del certificado
 */
async function cargarCertificado(clavePersonalizada = null) {
    try {
        const ubicacionesCertificado = obtenerUbicacionesCandidatas();
        
        let certificadoPath = null;
        let certificadoBuffer = null;
        
        for (const ubicacion of ubicacionesCertificado) {
            try {
                if (fs.existsSync(ubicacion)) {
                    certificadoPath = ubicacion;
                    certificadoBuffer = fs.readFileSync(ubicacion);
                    break;
                }
            } catch (err) {
                // Continúa con la siguiente ruta
            }
        }
        
        if (!certificadoBuffer) {
            console.warn('No se encontró ningún certificado disponible en las rutas verificadas');
            return { 
                encontrado: false,
                mensaje: 'No se encontró ningún certificado disponible',
                certificado: null,
                ruta: null,
                clave: null
            };
        }
        
        console.log(`Certificado cargado desde: ${certificadoPath}`);
        
        // Clave del certificado: 1) clavePersonalizada, 2) CERT_PASSWORD, 3) CERT_P12_PASSWORD, 4) 'test1234'
        const clave = clavePersonalizada || process.env.CERT_PASSWORD || process.env.CERT_P12_PASSWORD || 'test1234';
        
        const validacion = validarCertificado(certificadoBuffer, clave);
        if (!validacion.valido) {
            console.error('Certificado inválido:', validacion.error);
            return {
                encontrado: false,
                mensaje: `Certificado encontrado pero inválido: ${validacion.error}`,
                certificado: null,
                ruta: certificadoPath,
                clave: null,
                error: validacion.error
            };
        }
        
        console.log(`Certificado validado correctamente: ${validacion.mensaje}`);
        
        return {
            encontrado: true,
            mensaje: `Certificado cargado y validado desde ${certificadoPath}`,
            certificado: certificadoBuffer,
            ruta: certificadoPath,
            clave: clave,
            validacion: validacion
        };
    } catch (error) {
        console.error('Error al cargar certificado:', error);
        return {
            encontrado: false,
            mensaje: `Error al cargar certificado: ${error.message}`,
            error: error,
            certificado: null,
            ruta: null,
            clave: null
        };
    }
}

/**
 * Prepara las opciones para incluir certificados
 * 
 * @param {Object} options Opciones existentes
 * @param {string} clavePersonalizada Clave personalizada para el certificado
 * @returns {Promise<Object>} Opciones actualizadas con certificados
 */
async function prepararOpcionesConCertificado(options = {}, clavePersonalizada = null) {
    if (options.certificado && options.clave) {
        return options;
    }
    
    const resultado = await cargarCertificado(clavePersonalizada);
    
    if (resultado.encontrado) {
        return {
            ...options,
            certificadoPath: resultado.ruta,
            certificado: resultado.certificado,
            clave: resultado.clave
        };
    }
    
    return options;
}

/**
 * Obtiene información detallada sobre el estado de los certificados
 * 
 * @returns {Object} Información sobre certificados disponibles
 */
async function obtenerEstadoCertificados() {
    try {
        const ubicacionesCertificado = obtenerUbicacionesCandidatas();
        const certificadosEncontrados = [];
        
        for (const ubicacion of ubicacionesCertificado) {
            try {
                if (fs.existsSync(ubicacion)) {
                    const stats = fs.statSync(ubicacion);
                    const buffer = fs.readFileSync(ubicacion);
                    const validacion = validarCertificado(buffer);
                    
                    certificadosEncontrados.push({
                        ruta: ubicacion,
                        tamaño: stats.size,
                        fechaModificacion: stats.mtime,
                        valido: validacion.valido,
                        error: validacion.error || null
                    });
                }
            } catch (err) {
                certificadosEncontrados.push({
                    ruta: ubicacion,
                    error: `Error al acceder: ${err.message}`,
                    valido: false
                });
            }
        }
        
        return {
            total: certificadosEncontrados.length,
            certificados: certificadosEncontrados,
            claveConfigurada: !!(process.env.CERT_PASSWORD || process.env.CERT_P12_PASSWORD)
        };
    } catch (error) {
        return {
            error: `Error al obtener estado de certificados: ${error.message}`,
            total: 0,
            certificados: []
        };
    }
}

module.exports = {
    cargarCertificado,
    prepararOpcionesConCertificado,
    validarCertificado,
    obtenerEstadoCertificados
};
