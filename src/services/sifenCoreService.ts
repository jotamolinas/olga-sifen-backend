import xmlgen from 'facturacionelectronicapy-xmlgen';
import xmlsign from 'facturacionelectronicapy-xmlsign';
import qrgen from 'facturacionelectronicapy-qrgen';
import setApi from 'facturacionelectronicapy-setapi';
import { aplicarParcheCriptografico } from './cryptoFix.js';

// Ejecutar parches de compatibilidad de claves y ciphers
aplicarParcheCriptografico();

// Soporte bidireccional para interoperabilidad ESM / CommonJS
const xmlgenLib: any = (xmlgen as any)?.default || xmlgen;
const xmlsignLib: any = (xmlsign as any)?.default || xmlsign;
const qrgenLib: any = (qrgen as any)?.default || qrgen;
const setApiLib: any = (setApi as any)?.default || setApi;

export interface GenerarDocumentoResponse {
  cdc: string;
  xml: string;
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
    try {
      aplicarParcheCriptografico();
      // Intento 1: firma con nativeEncoding true
      const xmlFirmado: string = await xmlsignLib.signXML(xml, certBufferOrPath, password, true);
      return xmlFirmado;
    } catch (error: any) {
      try {
        aplicarParcheCriptografico();
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
   * Acceso directo a los métodos de comunicación de facturacionelectronicapy-setapi
   * (envío síncrono/asíncrono, consulta RUC, consulta lote, consulta CDC, eventos).
   */
  public static get setApi() {
    return setApiLib;
  }
}

export default SifenCoreService;
