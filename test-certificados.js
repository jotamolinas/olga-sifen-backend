/**
 * Script de prueba para el servicio de certificados centralizado
 */

const certificadosService = require('./services/certificados.service');

async function probarServicioCertificados() {
    console.log('=== PRUEBA DEL SERVICIO DE CERTIFICADOS ===\n');
    
    try {
        console.log('1. Probando cargarCertificado()...');
        const resultadoCarga = await certificadosService.cargarCertificado();
        console.log('Resultado de carga:', JSON.stringify({
            ...resultadoCarga,
            certificado: resultadoCarga.certificado ? `[Buffer: ${resultadoCarga.certificado.length} bytes]` : null
        }, null, 2));
        
        console.log('\n2. Probando obtenerEstadoCertificados()...');
        const estadoCertificados = await certificadosService.obtenerEstadoCertificados();
        console.log('Estado de certificados:', JSON.stringify(estadoCertificados, null, 2));
        
        console.log('\n3. Probando prepararOpcionesConCertificado()...');
        const options = { simular: false };
        const opcionesConCertificado = await certificadosService.prepararOpcionesConCertificado(options);
        console.log('Opciones preparadas:', JSON.stringify({
            ...opcionesConCertificado,
            certificado: opcionesConCertificado.certificado ? `[Buffer: ${opcionesConCertificado.certificado.length} bytes]` : 'NO_DISPONIBLE'
        }, null, 2));
        
        if (resultadoCarga.encontrado && resultadoCarga.certificado) {
            console.log('\n4. Probando validarCertificado()...');
            const validacion = certificadosService.validarCertificado(
                resultadoCarga.certificado, 
                resultadoCarga.clave
            );
            console.log('Resultado de validación:', JSON.stringify(validacion, null, 2));
        }
        
        console.log('\n=== PRUEBA COMPLETADA EXITOSAMENTE ===');
        return true;
    } catch (error) {
        console.error('ERROR EN LA PRUEBA:', error);
        console.log('\n=== PRUEBA FALLÓ ===');
        return false;
    }
}

// Ejecutar la prueba si se llama directamente
if (require.main === module) {
    probarServicioCertificados();
}

module.exports = probarServicioCertificados;
