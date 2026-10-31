import { inicializarMonkeyPatchXmlSign } from './xmlSignMonkeyPatch.js';

// Activar monkey patch en runtime antes de inicializar o invocar facturacionelectronicapy-xmlsign
inicializarMonkeyPatchXmlSign();

import xmlgen from 'facturacionelectronicapy-xmlgen';
import xmlsign from 'facturacionelectronicapy-xmlsign';
import qrgen from 'facturacionelectronicapy-qrgen';
import setApi from 'facturacionelectronicapy-setapi';

// Soporte bidireccional para interoperabilidad ESM / CommonJS
const xmlgenLib: any = (xmlgen as any)?.default || xmlgen;
const xmlsignLib: any = (xmlsign as any)?.default || xmlsign;
const qrgenLib: any = (qrgen as any)?.default || qrgen;
const setApiLib: any = (setApi as any)?.default || setApi;

export interface GenerarDocumentoResponse {
  cdc: string;
  xml: string;
}

export interface EnviarSetResponse {
  success: boolean;
  ambiente: 'test' | 'prod';
  cdc: string;
  idEnvio: number;
  codigoRespuesta?: string;
  mensajeRespuesta?: string;
  fechaProcesamiento?: string;
  numeroTicket?: string;
  numeroProtocolo?: string;
  estadoDocumento?: string;
  detallesSifen?: any;
  respuestaRaw?: any;
  xml_firmado?: string;
}

/**
 * Servicio central para la integración con las librerías oficiales de Facturación Electrónica SIFEN (Paraguay).
 * Encapsula:
 * - facturacionelectronicapy-xmlgen: Generación del XML DE v150 y cálculo del CDC (44 dígitos).
 * - facturacionelectronicapy-xmlsign: Firma digital XMLDSig con certificado .p12 / .pfx.
 * - facturacionelectronicapy-qrgen: Inserción del código QR oficial para el contribuyente.
 * - facturacionelectronicapy-setapi: Conexión con los Web Services de la DNIT / SET.
 */
export class SifenCoreService {
  /**
   * Genera el Documento Electrónico (DE) v150 a partir de parámetros del emisor y datos del documento.
   * Extrae automáticamente el CDC (Código de Control de 44 dígitos) del atributo Id del nodo <DE>.
   * 
   * @param params Parámetros generales y estáticos del contribuyente emisor (RUC, timbrado, etc.)
   * @param data Datos variables del documento (receptor, tipo factura, items, totales)
   * @returns Objeto con el CDC de 44 dígitos y el XML generado sin firmar
   */
  public static async generarDocumentoElectronico(params: any, data: any): Promise<GenerarDocumentoResponse> {
    try {
      const xml: string = await xmlgenLib.generateXMLDE(params, data);

      if (!xml || typeof xml !== 'string') {
        throw new Error('La librería xmlgen no retornó una cadena XML válida.');
      }

      // Extracción del CDC (44 dígitos) del atributo Id del elemento <DE>
      // Ej: <DE Id="01800699991001001000000122023101511234567890">
      const matchCdc = xml.match(/<DE\s+[^>]*Id="([0-9]{44})"/i) || xml.match(/Id="([0-9]{44})"/i);
      let cdc = matchCdc ? matchCdc[1] : '';

      // Si por estructura personalizada viniera con prefijo o diferente regex
      if (!cdc) {
        const fallbackMatch = xml.match(/<DE\s+[^>]*Id="([^"]+)"/i);
        if (fallbackMatch && fallbackMatch[1]) {
          cdc = fallbackMatch[1].replace(/\D/g, '');
        }
      }

      return {
        cdc,
        xml
      };
    } catch (error: any) {
      throw new Error(`Error al generar Documento Electrónico SIFEN (v150): ${error.message || error}`);
    }
  }

  /**
   * Firma digitalmente el archivo XML utilizando un certificado .p12 / .pfx y su contraseña.
   * 
   * @param xml Cadena XML sin firmar generada previamente
   * @param certBufferOrPath Ruta al archivo del certificado en disco o Buffer en memoria
   * @param password Contraseña desencriptada del certificado digital
   * @returns Cadena con el XML firmado digitalmente
   */
  public static async firmarDocumento(
    xml: string,
    certBufferOrPath: string | Buffer,
    password: string
  ): Promise<string> {
    inicializarMonkeyPatchXmlSign();
    try {
      // Intento 1: firma con nativeEncoding true
      const xmlFirmado: string = await xmlsignLib.signXML(xml, certBufferOrPath, password, true);
      return xmlFirmado;
    } catch (error: any) {
      try {
        // Intento 2: fallback sin el 4to parámetro
        const xmlFirmadoFallback: string = await xmlsignLib.signXML(xml, certBufferOrPath, password);
        return xmlFirmadoFallback;
      } catch (err2: any) {
        throw new Error(`Error al firmar documento XML con certificado: ${error.message || err2.message || error}`);
      }
    }
  }

  /**
   * Agrega el código QR oficial exigido por SIFEN a un documento XML previamente firmado.
   * 
   * @param xmlFirmado Documento XML firmado digitalmente
   * @param idCSC Identificador del Código Secreto del Contribuyente (otorgado por DNIT/SET)
   * @param csc Código Secreto del Contribuyente (CSC)
   * @param env Entorno ('test' o 'prod')
   * @returns Cadena XML con el nodo del código QR integrado
   */
  public static async agregarQR(
    xmlFirmado: string,
    idCSC: string | number,
    csc: string,
    env: 'test' | 'prod' = 'test'
  ): Promise<string> {
    try {
      const xmlConQR: string = await qrgenLib.generateQR(xmlFirmado, idCSC, csc, env);
      return xmlConQR;
    } catch (error: any) {
      throw new Error(`Error al generar código QR para el documento SIFEN: ${error.message || error}`);
    }
  }

  /**
   * Transmite un Documento Electrónico (DE) firmado a la SET / SIFEN mediante facturacionelectronicapy-setapi.
   * Encapsula la llamada a `setApi.recibe` con túnel mTLS y parsea la respuesta estructurada de SIFEN.
   * 
   * @param xmlFirmado Cadena XML del Documento Electrónico ya firmado
   * @param certPath Ruta al certificado digital (.p12 o .pem)
   * @param password Contraseña del certificado digital
   * @param env Entorno de destino ('test' o 'prod', por defecto 'test')
   * @param id Identificador numérico del envío (opcional)
   */
  public static async transmitirDocumentoElectronico(
    xmlFirmado: string,
    certPath: string,
    password: string,
    env: 'test' | 'prod' = 'test',
    id?: number
  ): Promise<EnviarSetResponse> {
    inicializarMonkeyPatchXmlSign();

    const idEnvio = id || Math.floor(Date.now() / 1000);

    // Extraer CDC del XML firmado
    const matchCdc = xmlFirmado.match(/<DE\s+[^>]*Id="([0-9]{44})"/i) || xmlFirmado.match(/Id="([0-9]{44})"/i);
    const cdc = matchCdc ? matchCdc[1] : '';

    try {
      console.log(`📡 Transmitiendo DE a la SET [Env: ${env}] [ID: ${idEnvio}] [CDC: ${cdc}]...`);

      const setConfig = {
        debug: true,
        timeout: 45000
      };

      const respuestaSet = await setApiLib.recibe(
        idEnvio,
        xmlFirmado,
        env,
        certPath,
        password,
        setConfig
      );

      console.log('📥 Respuesta recibida de SIFEN:', JSON.stringify(respuestaSet, null, 2));

      // Extraer datos del cuerpo de respuesta SOAP
      const bodyData = respuestaSet?.rRetEnviDe || respuestaSet?.['ns2:rRetEnviDe'] || respuestaSet;
      const resProc = bodyData?.rProtDe?.gResProc || bodyData?.gResProc;

      const dCodRes = bodyData?.dCodRes || resProc?.dCodRes || bodyData?.dCodResLot || 'DESCONOCIDO';
      const dMsgRes = bodyData?.dMsgRes || resProc?.dMsgRes || bodyData?.dMsgResLot || 'Sin mensaje de SIFEN';
      const dFecProc = bodyData?.dFecProc || bodyData?.rProtDe?.dFecProc;
      const dProtAut = bodyData?.rProtDe?.dProtAut || bodyData?.dProtAut || bodyData?.dId;
      const dEstRes = resProc?.dEstRes || (dCodRes === '0300' ? 'Aprobado' : (String(dCodRes).startsWith('0') ? 'Procesado' : 'Rechazado'));

      const isAprobado = dCodRes === '0300' || dEstRes === 'Aprobado';

      return {
        success: isAprobado,
        ambiente: env,
        cdc,
        idEnvio,
        codigoRespuesta: dCodRes,
        mensajeRespuesta: dMsgRes,
        fechaProcesamiento: dFecProc,
        numeroTicket: dProtAut ? String(dProtAut) : undefined,
        numeroProtocolo: dProtAut ? String(dProtAut) : undefined,
        estadoDocumento: dEstRes,
        detallesSifen: resProc || bodyData,
        respuestaRaw: respuestaSet,
        xml_firmado: xmlFirmado
      };
    } catch (error: any) {
      console.error('❌ Error de comunicación con la SET/SIFEN:', error?.message || error);
      throw error;
    }
  }

  /**
   * Acceso directo a los métodos de comunicación de facturacionelectronicapy-setapi
   * (envío síncrono/asíncrono, consulta RUC, consulta lote, consulta CDC, eventos).
   */
  public static get setApi() {
    return setApiLib;
  }
}

export default SifenCoreService;
