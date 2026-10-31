import { Router, Request, Response } from 'express';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { verificarAlcanceSifen } from '../middlewares/alcance.js';
import { CertificadoService } from '../services/certificadoService.js';
import { SifenCoreService } from '../services/sifenCoreService.js';

const router = Router();

// Aplicar el middleware de feature flag (alcance) a todas las rutas de este router
router.use(verificarAlcanceSifen);

/**
 * GET /api/sifen/test-conexion
 * Ruta protegida para comprobar conectividad y operatividad del microservicio SIFEN.
 */
router.get('/test-conexion', async (req: Request, res: Response) => {
  const sifenEnv = (process.env.SIFEN_ENV || 'test').toLowerCase();
  const targetUrl = sifenEnv === 'prod'
    ? process.env.SIFEN_URL_PROD || 'https://sifen.set.gov.py/de/ws/consultas/consulta-ruc.wsdl'
    : process.env.SIFEN_URL_TEST || 'https://sifen-test.set.gov.py/de/ws/consultas/consulta-ruc.wsdl';

  const certPath = process.env.CERT_P12_PATH || './certs/certificado.p12';
  const certExists = CertificadoService.existeCertificado(certPath);

  // Demostración de capacidades de fast-xml-parser para payloads SIFEN
  const sampleSifenXml = `
    <rEnviDe xmlns="http://sifen.set.gov.py/sifen/xsd">
      <dId>1</dId>
      <dFecFirma>${new Date().toISOString()}</dFecFirma>
    </rEnviDe>
  `;

  let xmlParserOk = false;
  try {
    const parser = new XMLParser();
    const parsedObj = parser.parse(sampleSifenXml);
    xmlParserOk = parsedObj?.rEnviDe?.dId === 1;
  } catch (err) {
    xmlParserOk = false;
  }

  // Comprobar conectividad básica vía Axios
  let sifenEndpointStatus = 'UNKNOWN';
  let latencyMs = 0;

  try {
    const startTime = Date.now();
    const response = await axios.get(targetUrl, {
      timeout: 5000,
      validateStatus: () => true
    });
    latencyMs = Date.now() - startTime;
    sifenEndpointStatus = `HTTP_${response.status}`;
  } catch (error: any) {
    sifenEndpointStatus = error.code || 'CONNECTION_TIMEOUT';
  }

  res.status(200).json({
    success: true,
    microservice: 'sifen-backend-microservice',
    status: 'ONLINE',
    ambienteSifen: sifenEnv,
    endpointConsultado: targetUrl,
    estadoConexionSifen: sifenEndpointStatus,
    latenciaMs: latencyMs,
    herramientas: {
      xmlEngine: 'fast-xml-parser (v4)',
      xmlEngineStatus: xmlParserOk ? 'READY' : 'ERROR',
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
});

/**
 * POST /api/sifen/generar-xml-prueba
 * Protegido por verificarAlcanceSifen (Feature Flag).
 * 
 * Recibe un JSON con los datos de una factura de escribanía (emisor, cliente, items de honorarios notariales)
 * o directamente los objetos `params` y `data` de SIFEN v150.
 * 
 * Ejecuta generarDocumentoElectronico y devuelve en el JSON de respuesta el CDC de 44 dígitos
 * y el xml_generado sin firmar para validar que el mapeo v150 funciona correctamente.
 */
router.post('/generar-xml-prueba', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    let params: any;
    let data: any;

    if (body.params && body.data) {
      // Estructura directa para facturacionelectronicapy-xmlgen
      params = body.params;
      data = body.data;
    } else {
      // Mapeo flexible de factura de escribanía (notarial)
      const emisor = body.emisor || {};
      const cliente = body.cliente || {};
      const items = Array.isArray(body.items) && body.items.length > 0 ? body.items : [
        {
          codigo: 'HON-001',
          descripcion: 'Honorarios notariales por protocolización y escrituración pública',
          observacion: 'Acto Notarial de Compraventa Inmueble',
          partidaArancelaria: 0,
          ncm: 0,
          unidadMedida: 77, // UNI (Unidad)
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
          ivaTipo: 1, // Gravado IVA
          ivaBase: 100,
          iva: 10 // 10%
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

      // Parámetros del contribuyente emisor (Escribanía)
      params = {
        version: 150,
        sincronico: 'S',
        tipoContribuyente: emisor.tipoContribuyente || 2, // Persona Jurídica / Física con RUC
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

      // Datos de la factura electrónica (DE)
      data = {
        tipoDocumento: 1, // 1: Factura Electrónica
        establecimiento: emisor.establecimiento || '001',
        punto: emisor.punto || '001',
        numero: emisor.numero || 1,
        descripcion: 'Servicios Notariales Profesionales',
        observacion: body.observacion || 'Facturación Electrónica SIFEN v150',
        fecha: fechaHoy,
        tipoEmision: 1, // 1: Normal | 2: Contingencia
        tipoTransaccion: 1, // Venta de servicios
        tipoImpuesto: 1, // IVA
        moneda: 'PYG',
        cliente: {
          contribuyente: cliente.contribuyente !== undefined ? cliente.contribuyente : true,
          ruc: cliente.ruc || '44444401-7',
          razonSocial: cliente.razonSocial || 'Cliente Escribanía S.A.',
          nombreFantasia: cliente.nombreFantasia || '',
          tipoOperacion: cliente.tipoOperacion || 1, // B2B
          direccion: cliente.direccion || 'Avda. Mariscal López 1234',
          numeroCasa: cliente.numeroCasa || '1234',
          departamento: cliente.departamento || 11, // Central
          distrito: cliente.distrito || 1,
          ciudad: cliente.ciudad || 1,
          pais: cliente.pais || 'PRY',
          tipoContribuyente: cliente.tipoContribuyente || 2,
          documentoTipo: cliente.documentoTipo || 1,
          documentoNumero: cliente.documentoNumero || ''
        },
        condicion: {
          tipo: 1, // 1: Contado | 2: Crédito
          entregas: [
            {
              tipo: 1, // Efectivo
              monto: 1800000,
              moneda: 'PYG'
            }
          ]
        },
        items: items
      };
    }

    // Ejecutar generación del Documento Electrónico v150 y extracción de CDC
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
    res.status(500).json({
      success: false,
      codigo: 'SIFEN_XML_GENERATION_ERROR',
      mensaje: error.message || 'Error al generar el XML v150 de SIFEN',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
