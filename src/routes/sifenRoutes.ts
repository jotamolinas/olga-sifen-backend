import { Router, Request, Response } from 'express';
import axios from 'axios';
import path from 'path';
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

    // Localizar certificado en el entorno
    const infoCert = CertificadoService.localizarCertificadoYPassword();

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
        encontrado: infoCert.existe,
        archivo: infoCert.ruta ? path.basename(infoCert.ruta) : (infoCert.rutaPem ? path.basename(infoCert.rutaPem) : null),
        rutaCompleta: infoCert.ruta || infoCert.rutaPem,
        tamanioBytes: infoCert.tamanioBytes,
        clavePrivadaPem: infoCert.rutaKey ? path.basename(infoCert.rutaKey) : null,
        certificadoPem: infoCert.rutaPem ? path.basename(infoCert.rutaPem) : null
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
 * Rutas de prueba de conexión
 */
router.get('/test-conexion', testConexionHandler);
router.post('/test-conexion', testConexionHandler);

/**
 * Middleware Feature Flag (alcance):
 * Protege las rutas operacionales de facturación (generación, firma y emisión)
 */
router.use(verificarAlcanceSifen);

/**
 * Controlador para la generación del Documento Electrónico (DE) XML v150 de prueba (sin firmar).
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
 * Controlador para la firma digital de prueba de Documentos Electrónicos con facturacionelectronicapy-xmlsign.
 * 
 * 1. Genera el XML v150 (o usa el provisto en req.body.xml).
 * 2. Localiza el certificado .p12 en ./certs/ o rutas configuradas.
 * 3. Aplica la firma digital XMLDSig sobre el nodo <DE>.
 * 4. Devuelve el XML firmado junto con el CDC de 44 dígitos.
 */
const firmarXmlPruebaHandler = async (req: Request, res: Response): Promise<void> => {
  let cdc = '';
  let xmlBase = '';

  try {
    const inputBody = req.body || {};

    // 1. Obtener o generar el XML base v150
    if (inputBody.xml && typeof inputBody.xml === 'string' && inputBody.xml.includes('<DE')) {
      xmlBase = inputBody.xml;
      const matchCdc = xmlBase.match(/<DE\s+[^>]*Id="([0-9]{44})"/i) || xmlBase.match(/Id="([0-9]{44})"/i);
      cdc = matchCdc ? matchCdc[1] : '';
    } else {
      const { params, data } = obtenerDatosPruebaSifenV150(inputBody);
      const resGen = await SifenCoreService.generarDocumentoElectronico(params, data);
      xmlBase = resGen.xml;
      cdc = resGen.cdc;
    }

    // 2. Localizar archivo de certificado .p12 y clave
    const infoCert = CertificadoService.localizarCertificadoYPassword(inputBody.certPath, inputBody.password);

    const rutaParaFirma = infoCert.ruta || infoCert.rutaPem;
    if (!infoCert.existe || !rutaParaFirma) {
      res.status(200).json({
        success: false,
        codigo: 'CERTIFICADO_NO_ENCONTRADO',
        mensaje: 'No se encontró el archivo de certificado digital (.p12, .pem) en el servidor.',
        cdc: cdc,
        rutasBuscadas: infoCert.rutasBuscadas,
        sugerencia: 'Coloque el archivo de certificado de prueba en ./certs/ (ej: ./certs/certificado.p12 o ./certs/certificado.pem) o configure la variable de entorno CERT_P12_PATH.',
        xml_sin_firmar: xmlBase,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 3. Ejecutar la firma digital con facturacionelectronicapy-xmlsign
    let xmlFirmado = '';
    try {
      xmlFirmado = await SifenCoreService.firmarDocumento(xmlBase, rutaParaFirma, infoCert.password);
    } catch (cryptoError: any) {
      res.status(200).json({
        success: false,
        codigo: 'ERROR_CRIPTOGRAFICO_FIRMA',
        mensaje: 'El certificado fue localizado pero ocurrió un error durante el proceso de firma digital.',
        errorDetalle: cryptoError.message || String(cryptoError),
        cdc: cdc,
        certificado: {
          archivo: path.basename(rutaParaFirma),
          ruta: rutaParaFirma,
          tamanioBytes: infoCert.tamanioBytes
        },
        sugerencia: 'Verifique que la contraseña (CERT_P12_PASSWORD) coincida con la clave del certificado.',
        xml_sin_firmar: xmlBase,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 4. Retornar XML firmado exitosamente
    res.status(200).json({
      success: true,
      mensaje: 'Documento electrónico v150 firmado digitalmente con éxito.',
      cdc: cdc,
      version: 150,
      certificado: {
        archivo: path.basename(rutaParaFirma),
        ruta: rutaParaFirma,
        tamanioBytes: infoCert.tamanioBytes,
        algoritmo: 'XMLDSig-RSA-SHA256'
      },
      xml_firmado: xmlFirmado,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      codigo: 'ERROR_GENERAL_FIRMA',
      mensaje: error.message || 'Error general en el proceso de firma de prueba',
      cdc: cdc || undefined,
      xml_sin_firmar: xmlBase || undefined,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Controlador para la transmisión de Documentos Electrónicos (DE) de prueba a la SET / SIFEN.
 * 
 * 1. Genera o toma el XML (req.body.xml).
 * 2. Si no viene firmado, aplica la firma digital con el certificado localizado.
 * 3. Se conecta al endpoint oficial de prueba de la SET (https://sifen-test.set.gov.py/de/ws/sync/recibe.wsdl)
 *    estableciendo el túnel mTLS mediante facturacionelectronicapy-setapi y nuestros certificados PEM nativos.
 * 4. Devuelve la respuesta estructurada de SIFEN: estado, dCodRes, dMsgRes, número de ticket/protocolo.
 */
const enviarSetPruebaHandler = async (req: Request, res: Response): Promise<void> => {
  let cdc = '';
  let xmlFirmado = '';
  const sifenEnv: 'test' | 'prod' = ((req.body?.env || process.env.SIFEN_ENV || 'test').toLowerCase() === 'prod') ? 'prod' : 'test';

  try {
    const inputBody = req.body || {};

    // 1. Localizar archivo de certificado digital (.p12 o .pem)
    const infoCert = CertificadoService.localizarCertificadoYPassword(inputBody.certPath, inputBody.password);
    const rutaParaFirma = infoCert.ruta || infoCert.rutaPem;

    if (!infoCert.existe || !rutaParaFirma) {
      res.status(200).json({
        success: false,
        codigo: 'CERTIFICADO_NO_ENCONTRADO',
        mensaje: 'No se encontró el archivo de certificado digital (.p12, .pem) en el servidor para transmitir a SIFEN.',
        rutasBuscadas: infoCert.rutasBuscadas,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 2. Obtener o generar XML y firmarlo
    if (inputBody.xml && typeof inputBody.xml === 'string' && inputBody.xml.includes('Signature')) {
      // El XML ya viene firmado
      xmlFirmado = inputBody.xml;
      const matchCdc = xmlFirmado.match(/<DE\s+[^>]*Id="([0-9]{44})"/i) || xmlFirmado.match(/Id="([0-9]{44})"/i);
      cdc = matchCdc ? matchCdc[1] : '';
    } else {
      let xmlBase = '';
      if (inputBody.xml && typeof inputBody.xml === 'string' && inputBody.xml.includes('<DE')) {
        xmlBase = inputBody.xml;
        const matchCdc = xmlBase.match(/<DE\s+[^>]*Id="([0-9]{44})"/i) || xmlBase.match(/Id="([0-9]{44})"/i);
        cdc = matchCdc ? matchCdc[1] : '';
      } else {
        const { params, data } = obtenerDatosPruebaSifenV150(inputBody);
        const resGen = await SifenCoreService.generarDocumentoElectronico(params, data);
        xmlBase = resGen.xml;
        cdc = resGen.cdc;
      }

      // Firmar el documento digitalmente
      xmlFirmado = await SifenCoreService.firmarDocumento(xmlBase, rutaParaFirma, infoCert.password);
    }

    // 3. Transmitir el documento a SIFEN (SET) mediante facturacionelectronicapy-setapi (o simulador de Fase 2)
    const idEnvio = inputBody.id ? Number(inputBody.id) : Math.floor(Date.now() / 1000);
    const mockResponse = inputBody.mockResponse !== undefined ? Boolean(inputBody.mockResponse) : undefined;
    const idCSC = inputBody.idCSC || inputBody.IdCSC;
    const csc = inputBody.csc || inputBody.CSC;

    const resultadoTransmision = await SifenCoreService.transmitirDocumentoElectronico(
      xmlFirmado,
      rutaParaFirma,
      infoCert.password,
      sifenEnv,
      idEnvio,
      {
        mockResponse,
        idCSC,
        csc
      }
    );

    res.status(200).json({
      success: resultadoTransmision.success,
      esMock: resultadoTransmision.esMock,
      mensaje: resultadoTransmision.success
        ? (resultadoTransmision.esMock
            ? 'Documento procesado exitosamente (Simulación SIFEN / Fase 2 activa: QR y KUDE listos).'
            : 'Documento Electrónico transmitido y procesado exitosamente por la SET/SIFEN.')
        : `La SET/SIFEN respondió con código ${resultadoTransmision.codigoRespuesta}: ${resultadoTransmision.mensajeRespuesta}`,
      ambiente: sifenEnv,
      cdc: resultadoTransmision.cdc || cdc,
      transmision: {
        idEnvio: resultadoTransmision.idEnvio,
        codigoRespuesta: resultadoTransmision.codigoRespuesta,
        mensajeRespuesta: resultadoTransmision.mensajeRespuesta,
        fechaProcesamiento: resultadoTransmision.fechaProcesamiento,
        numeroTicket: resultadoTransmision.numeroTicket,
        numeroProtocolo: resultadoTransmision.numeroProtocolo,
        estado: resultadoTransmision.estadoDocumento
      },
      qr: resultadoTransmision.qr,
      kudeData: resultadoTransmision.kudeData,
      detallesSifen: resultadoTransmision.detallesSifen,
      xml_firmado: xmlFirmado,
      xml_con_qr: resultadoTransmision.xml_con_qr,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(200).json({
      success: false,
      codigo: 'ERROR_TRANSMISION_SET',
      mensaje: 'Ocurrió un error al transmitir el Documento Electrónico a la SET/SIFEN.',
      errorDetalle: error.message || String(error),
      ambiente: sifenEnv,
      cdc: cdc || undefined,
      xml_firmado: xmlFirmado || undefined,
      sugerencia: 'Verifique si el certificado digital de prueba está registrado en el ambiente test de la DNIT/SET y que el endpoint https://sifen-test.set.gov.py sea accesible.',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Endpoints registrados
 */
router.post('/generar-xml-prueba', generarXmlPruebaHandler);
router.get('/generar-xml-prueba', generarXmlPruebaHandler);

router.post('/firmar-xml-prueba', firmarXmlPruebaHandler);
router.get('/firmar-xml-prueba', firmarXmlPruebaHandler);

router.post('/enviar-set-prueba', enviarSetPruebaHandler);
router.get('/enviar-set-prueba', enviarSetPruebaHandler);

export default router;
