import { Router, Request, Response } from 'express';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { verificarAlcanceSifen } from '../middlewares/alcance.js';
import { CertificadoService } from '../services/certificadoService.js';
import { SifenCoreService } from '../services/sifenCoreService.js';
import { obtenerDatosPruebaSifenV150 } from '../services/sifenDefaultTestData.js';

const router = Router();

/**
 * Controlador para la prueba de conexión y diagnóstico del microservicio SIFEN.
 * Responde tanto a GET como a POST para evitar errores 404 o rechazos de método.
 * No se bloquea por el Feature Flag para permitir diagnóstico en todo momento.
 */
const testConexionHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const sifenEnv = (process.env.SIFEN_ENV || 'test').toLowerCase();
    const targetUrl = sifenEnv === 'prod'
      ? process.env.SIFEN_URL_PROD || 'https://sifen.set.gov.py/de/ws/consultas/consulta-ruc.wsdl'
      : process.env.SIFEN_URL_TEST || 'https://sifen-test.set.gov.py/de/ws/consultas/consulta-ruc.wsdl';

    const certPath = process.env.CERT_P12_PATH || './certs/certificado.p12';
    let certExists = false;

    try {
      certExists = CertificadoService.existeCertificado(certPath);
    } catch {
      certExists = false;
    }

    // Demostración segura del motor XML
    let xmlEngineStatus = 'READY';
    try {
      const sampleSifenXml = `
        <rEnviDe xmlns="http://sifen.set.gov.py/sifen/xsd">
          <dId>1</dId>
          <dFecFirma>${new Date().toISOString()}</dFecFirma>
        </rEnviDe>
      `;
      const parser = new XMLParser();
      const parsedObj = parser.parse(sampleSifenXml);
      if (parsedObj?.rEnviDe?.dId !== 1) {
        xmlEngineStatus = 'PARSE_MISMATCH';
      }
    } catch (xmlError: any) {
      xmlEngineStatus = `ERROR: ${xmlError.message || xmlError}`;
    }

    // Comprobación de conectividad segura con timeout
    let sifenEndpointStatus = 'UNKNOWN';
    let latencyMs = 0;
    let endpointDetalle = 'Conexión verificada';

    try {
      const startTime = Date.now();
      const response = await axios.get(targetUrl, {
        timeout: 4000,
        validateStatus: () => true
      });
      latencyMs = Date.now() - startTime;
      sifenEndpointStatus = `HTTP_${response.status}`;
    } catch (netError: any) {
      latencyMs = 0;
      sifenEndpointStatus = netError.code || 'CONNECTION_TIMEOUT';
      endpointDetalle = netError.message || 'No se pudo contactar el endpoint exterior';
    }

    const isSifenModuleEnabled = process.env.ENABLE_SIFEN_MODULE?.trim().toLowerCase() !== 'false';

    res.status(200).json({
      success: true,
      microservice: 'sifen-backend-microservice',
      metodoPeticion: req.method,
      status: 'ONLINE',
      ambienteSifen: sifenEnv,
      moduloSifenHabilitado: isSifenModuleEnabled,
      endpointConsultado: targetUrl,
      estadoConexionSifen: sifenEndpointStatus,
      latenciaMs: latencyMs,
      detalleConexion: endpointDetalle,
      herramientas: {
        xmlEngine: 'fast-xml-parser (v4)',
        xmlEngineStatus: xmlEngineStatus,
        httpClient: 'Axios (v1)',
        seguridadCertificados: 'AES-256-GCM',
        libreriasSifenOficiales: [
          'facturacionelectronicapy-xmlgen',
          'facturacionelectronicapy-xmlsign',
          'facturacionelectronicapy-qrgen',
          'facturacionelectronicapy-setapi'
        ]
      },
      certificadoDigital: {
        rutaConfigurada: certPath,
        archivoEncontrado: certExists
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(200).json({
      success: false,
      codigo: 'TEST_CONEXION_DIAGNOSTIC_ERROR',
      mensaje: error.message || 'Error al ejecutar diagnóstico de conexión SIFEN',
      detalles: String(error),
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Rutas de prueba de conexión: admiten GET y POST para mayor facilidad de consumo
 */
router.get('/test-conexion', testConexionHandler);
router.post('/test-conexion', testConexionHandler);

/**
 * Middleware Feature Flag (alcance):
 * Protege las rutas operacionales de facturación (generación, firma y emisión)
 */
router.use(verificarAlcanceSifen);

/**
 * Controlador para la generación del Documento Electrónico (DE) XML v150 de prueba.
 * 
 * Si el usuario envía un cuerpo vacío {} o incompleto, toma automáticamente
 * el objeto de prueba completo, geográficamente correcto y estructurado para SIFEN v150
 * (actividadesEconomicas, establecimientos, cliente no contribuyente, e items con ivaProporcion).
 */
const generarXmlPruebaHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const inputBody = req.body || {};

    // Obtener parámetros y datos completos con fallbacks oficiales para SIFEN v150
    const { params, data } = obtenerDatosPruebaSifenV150(inputBody);

    // Ejecutar generación del Documento Electrónico v150 y extracción de CDC
    const resultado = await SifenCoreService.generarDocumentoElectronico(params, data);

    res.status(200).json({
      success: true,
      mensaje: 'Documento electrónico v150 generado exitosamente.',
      cdc: resultado.cdc,
      version: 150,
      datosUtilizados: {
        emisor: {
          ruc: params.ruc,
          razonSocial: params.razonSocial,
          actividadesEconomicas: params.actividadesEconomicas,
          establecimiento: params.establecimientos[0]?.codigo,
          departamento: params.establecimientos[0]?.departamentoDescripcion,
          ciudad: params.establecimientos[0]?.ciudadDescripcion
        },
        factura: {
          presencia: data.factura?.presencia,
          fechaFactura: data.fecha,
          fechaEnvioFirma: data.factura?.fechaEnvio,
          desfaseMinutos: 10
        },
        cliente: {
          tipoOperacion: data.cliente?.tipoOperacion,
          documentoTipo: data.cliente?.documentoTipo,
          documentoNumero: data.cliente?.documentoNumero,
          ruc: data.cliente?.ruc,
          razonSocial: data.cliente?.razonSocial,
          contribuyente: data.cliente?.contribuyente
        },
        items: data.items.map((it: any) => ({
          codigo: it.codigo,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          ivaProporcion: it.ivaProporcion,
          ivaTasa: it.iva
        }))
      },
      xml_generado: resultado.xml,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      codigo: 'SIFEN_XML_GENERATION_ERROR',
      mensaje: error.message || 'Error al generar el XML v150 de SIFEN',
      detalles: error.stack && process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Endpoint de prueba para generar XML DE v150:
 * Admite POST (para enviar datos personalizados) y GET (para prueba rápida inmediata)
 */
router.post('/generar-xml-prueba', generarXmlPruebaHandler);
router.get('/generar-xml-prueba', generarXmlPruebaHandler);

export default router;
