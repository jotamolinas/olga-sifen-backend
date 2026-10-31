import { Router, Request, Response } from 'express';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { verificarAlcanceSifen } from '../middlewares/alcance.js';
import { CertificadoService } from '../services/certificadoService.js';
import { SifenCoreService } from '../services/sifenCoreService.js';

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
    } catch (certError: any) {
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
        validateStatus: () => true // Acepta cualquier código HTTP devuelto por SET
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
    // Si ocurre un error inesperado, devuelve JSON estructurado con status 200/500 en lugar de tumbar el servidor
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
 * (navegador, cURL, Postman o scripts de frontend)
 */
router.get('/test-conexion', testConexionHandler);
router.post('/test-conexion', testConexionHandler);

/**
 * Middleware Feature Flag (alcance):
 * Protege las rutas operacionales de facturación (generación, firma y emisión)
 */
router.use(verificarAlcanceSifen);

/**
 * POST /api/sifen/generar-xml-prueba
 * Protegido por verificarAlcanceSifen.
 * Envuelto en try/catch robusto para garantizar respuestas JSON estructuradas ante cualquier eventualidad.
 */
router.post('/generar-xml-prueba', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    let params: any;
    let data: any;

    if (body.params && body.data) {
      params = body.params;
      data = body.data;
    } else {
      const emisor = body.emisor || {};
      const cliente = body.cliente || {};
      const items = Array.isArray(body.items) && body.items.length > 0 ? body.items : [
        {
          codigo: 'HON-001',
          descripcion: 'Honorarios notariales por protocolización y escrituración pública',
          observacion: 'Acto Notarial de Compraventa Inmueble',
          partidaArancelaria: 0,
          ncm: 0,
          unidadMedida: 77,
          cantidad: 1,
          precioUnitario: 1500000,
          cambio: 0,
          descuento: 0,
          anticipo: 0,
          pais: 'PRY',
          tolerancia: 0,
          toleranciaCantidad: 0,
          toleranciaPorcentaje: 0,
          cdcAnticipo: 0,
          ivaTipo: 1,
          ivaBase: 100,
          iva: 10
        },
        {
          codigo: 'CERT-002',
          descripcion: 'Certificación notarial de firmas y documentos',
          observacion: 'Firmas en contrato privado',
          partidaArancelaria: 0,
          ncm: 0,
          unidadMedida: 77,
          cantidad: 2,
          precioUnitario: 150000,
          cambio: 0,
          descuento: 0,
          anticipo: 0,
          pais: 'PRY',
          tolerancia: 0,
          toleranciaCantidad: 0,
          toleranciaPorcentaje: 0,
          cdcAnticipo: 0,
          ivaTipo: 1,
          ivaBase: 100,
          iva: 10
        }
      ];

      const fechaHoy = new Date().toISOString().split('T')[0];

      params = {
        version: 150,
        sincronico: 'S',
        tipoContribuyente: emisor.tipoContribuyente || 2,
        ruc: emisor.ruc || '80012345-6',
        razonSocial: emisor.razonSocial || 'Escribanía Notarial y Registro Público',
        nombreFantasia: emisor.nombreFantasia || 'Escribanía Notarial Olga',
        actividadesEconomicas: emisor.actividadesEconomicas || [
          {
            codigo: 69101,
            descripcion: 'Actividades notariales y servicios jurídicos'
          }
        ],
        timbradoNumero: emisor.timbradoNumero || '12567890',
        timbradoFecha: emisor.timbradoFecha || fechaHoy
      };

      data = {
        tipoDocumento: 1,
        establecimiento: emisor.establecimiento || '001',
        punto: emisor.punto || '001',
        numero: emisor.numero || 1,
        descripcion: 'Servicios Notariales Profesionales',
        observacion: body.observacion || 'Facturación Electrónica SIFEN v150',
        fecha: fechaHoy,
        tipoEmision: 1,
        tipoTransaccion: 1,
        tipoImpuesto: 1,
        moneda: 'PYG',
        cliente: {
          contribuyente: cliente.contribuyente !== undefined ? cliente.contribuyente : true,
          ruc: cliente.ruc || '44444401-7',
          razonSocial: cliente.razonSocial || 'Cliente Escribanía S.A.',
          nombreFantasia: cliente.nombreFantasia || '',
          tipoOperacion: cliente.tipoOperacion || 1,
          direccion: cliente.direccion || 'Avda. Mariscal López 1234',
          numeroCasa: cliente.numeroCasa || '1234',
          departamento: cliente.departamento || 11,
          distrito: cliente.distrito || 1,
          ciudad: cliente.ciudad || 1,
          pais: cliente.pais || 'PRY',
          tipoContribuyente: cliente.tipoContribuyente || 2,
          documentoTipo: cliente.documentoTipo || 1,
          documentoNumero: cliente.documentoNumero || ''
        },
        condicion: {
          tipo: 1,
          entregas: [
            {
              tipo: 1,
              monto: 1800000,
              moneda: 'PYG'
            }
          ]
        },
        items: items
      };
    }

    const resultado = await SifenCoreService.generarDocumentoElectronico(params, data);

    res.status(200).json({
      success: true,
      mensaje: 'Documento electrónico v150 generado exitosamente.',
      cdc: resultado.cdc,
      xml_generado: resultado.xml,
      version: 150,
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
});

export default router;
