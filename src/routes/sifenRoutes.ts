import { Router, Request, Response } from 'express';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { verificarAlcanceSifen } from '../middlewares/alcance.js';
import { CertificadoService } from '../services/certificadoService.js';

const router = Router();

// Aplicar el middleware de feature flag a todas las rutas de este router
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

  // Comprobar conectividad básica vía Axios (con timeout preventivo)
  let sifenEndpointStatus = 'UNKNOWN';
  let latencyMs = 0;

  try {
    const startTime = Date.now();
    const response = await axios.get(targetUrl, {
      timeout: 5000,
      validateStatus: () => true // Acepta cualquier código HTTP como respuesta válida del servidor
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
      seguridadCertificados: 'AES-256-GCM'
    },
    certificadoDigital: {
      rutaConfigurada: certPath,
      archivoEncontrado: certExists
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
