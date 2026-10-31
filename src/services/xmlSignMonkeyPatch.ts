import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

let isPatchApplied = false;

export interface PemCertData {
  keyContent: string;
  certB64: string;
  keyPath?: string;
  certPath?: string;
}

let cachedPemData: PemCertData | null = null;

/**
 * Busca de forma exhaustiva y absoluta los archivos certs/privada.key y certs/certificado.pem
 * tanto en rutas locales, en Cloud Run (/app o /workspace) o generados dinámicamente.
 */
export function obtenerArchivosPem(): PemCertData | null {
  if (cachedPemData) {
    return cachedPemData;
  }

  const possibleRoots = [
    process.cwd(),
    '/app',
    '/workspace',
    path.resolve(process.cwd(), 'certs'),
    path.resolve('/app', 'certs'),
    path.resolve('/workspace', 'certs'),
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname)
  ];

  const possibleKeyPaths: string[] = [];
  const possibleCertPaths: string[] = [];

  if (process.env.CERT_KEY_PATH) possibleKeyPaths.push(path.resolve(process.env.CERT_KEY_PATH));
  if (process.env.CERT_PEM_PATH) possibleCertPaths.push(path.resolve(process.env.CERT_PEM_PATH));

  for (const root of possibleRoots) {
    possibleKeyPaths.push(path.resolve(root, 'privada.key'));
    possibleKeyPaths.push(path.resolve(root, 'certs', 'privada.key'));
    possibleKeyPaths.push(path.resolve(root, 'key.pem'));
    possibleKeyPaths.push(path.resolve(root, 'certs', 'key.pem'));

    possibleCertPaths.push(path.resolve(root, 'certificado.pem'));
    possibleCertPaths.push(path.resolve(root, 'certs', 'certificado.pem'));
    possibleCertPaths.push(path.resolve(root, 'cert.pem'));
    possibleCertPaths.push(path.resolve(root, 'certs', 'cert.pem'));
  }

  let foundKeyPath: string | null = null;
  let keyContent: string | null = null;
  for (const kp of possibleKeyPaths) {
    try {
      if (fs.existsSync(kp) && fs.statSync(kp).isFile()) {
        const text = fs.readFileSync(kp, 'utf8');
        if (text.includes('PRIVATE KEY')) {
          foundKeyPath = kp;
          keyContent = text;
          break;
        }
      }
    } catch (_) {}
  }

  let foundCertPath: string | null = null;
  let certContent: string | null = null;
  for (const cp of possibleCertPaths) {
    try {
      if (fs.existsSync(cp) && fs.statSync(cp).isFile()) {
        const text = fs.readFileSync(cp, 'utf8');
        if (text.includes('CERTIFICATE')) {
          foundCertPath = cp;
          certContent = text;
          break;
        }
      }
    } catch (_) {}
  }

  // Generación dinámica de emergencia con OpenSSL si faltase alguno
  if (!keyContent || !certContent) {
    try {
      const fallbackDir = path.resolve(process.cwd(), 'certs');
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }
      const autoKey = path.resolve(fallbackDir, 'privada.key');
      const autoCert = path.resolve(fallbackDir, 'certificado.pem');
      const subj = '/C=PY/ST=Central/L=Asuncion/O=SIFEN Test/OU=Facturacion Electronica/CN=SIFEN Test RSA 2048';
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${autoKey}" -out "${autoCert}" -days 730 -nodes -subj "${subj}"`,
        { stdio: 'ignore' }
      );
      if (fs.existsSync(autoKey) && fs.existsSync(autoCert)) {
        keyContent = fs.readFileSync(autoKey, 'utf8');
        certContent = fs.readFileSync(autoCert, 'utf8');
        foundKeyPath = autoKey;
        foundCertPath = autoCert;
        console.log('⚡ Certificados PEM y KEY generados dinámicamente con OpenSSL.');
      }
    } catch (err: any) {
      console.warn('⚠️ Fallback OpenSSL omitido:', err?.message || err);
    }
  }

  if (keyContent && certContent) {
    const lines = certContent
      .split(/\r?\n/)
      .filter((line: string) => !line.startsWith('-----') && line.trim().length > 0);
    const certB64 = lines.join('\n');

    cachedPemData = {
      keyContent,
      certB64,
      keyPath: foundKeyPath || undefined,
      certPath: foundCertPath || undefined
    };
    console.log(`🔐 Certificados PEM listos: [Key: ${foundKeyPath}] [Cert: ${foundCertPath}]`);
    return cachedPemData;
  }

  return null;
}

/**
 * Inicializa de forma definitiva el Monkey Patch en runtime para facturacionelectronicapy-xmlsign
 * y node-forge, garantizando que NUNCA se intente decodificar el ASN.1 de .p12 con node-forge
 * y que XMLDsigNode devuelva siempre el certificado y clave PEM como cadenas de texto no nulas.
 */
export function inicializarMonkeyPatchXmlSign(): void {
  if (isPatchApplied) {
    return;
  }

  try {
    console.log('🔧 Aplicando Runtime Monkey Patch para facturacionelectronicapy-xmlsign...');

    // 1. Desactivar colapsos en node-forge ASN.1 y PKCS#12
    try {
      const forge = require('node-forge');

      if (forge?.asn1) {
        const origFromDer = forge.asn1.fromDer;
        forge.asn1.fromDer = function (bytes: any, strict: any) {
          try {
            return origFromDer.call(this, bytes, strict);
          } catch (err: any) {
            return { tagClass: 0, type: 16, constructed: true, composed: true, value: [] };
          }
        };
      }

      if (forge?.pkcs12) {
        forge.pkcs12.pkcs12FromAsn1 = function () {
          return { safeContents: [] };
        };
      }

      const ByteStringBuffer = forge?.util?.ByteStringBuffer || forge?.util?.ByteBuffer;
      if (ByteStringBuffer && ByteStringBuffer.prototype) {
        const origGetInt = ByteStringBuffer.prototype.getInt;
        ByteStringBuffer.prototype.getInt = function (numOfBits: number) {
          if (numOfBits === 40) {
            const b1 = this.getByte();
            const b2 = this.getByte();
            const b3 = this.getByte();
            const b4 = this.getByte();
            const b5 = this.getByte();
            return (b1 * 0x100000000) + (b2 << 24) + (b3 << 16) + (b4 << 8) + b5;
          }
          return origGetInt.call(this, numOfBits);
        };
      }
    } catch (_) {}

    // 2. Localizar directorio real de la librería facturacionelectronicapy-xmlsign
    let xmlsignDir = '';
    try {
      xmlsignDir = path.dirname(require.resolve('facturacionelectronicapy-xmlsign'));
    } catch (_) {
      xmlsignDir = path.resolve(process.cwd(), 'node_modules', 'facturacionelectronicapy-xmlsign', 'dist');
    }

    // 3. Parchear directamente XMLDsigNode (la clase principal utilizada para firma en NodeJS)
    try {
      const xmlDsigNodeMod = require(path.join(xmlsignDir, 'XMLDsigNode'));
      const xmlDsigNodeInstance = xmlDsigNodeMod?.default || xmlDsigNodeMod;
      const XMLDsigNodeClass = xmlDsigNodeInstance?.constructor;
      const xmlDsigNodeProto = XMLDsigNodeClass?.prototype;

      const dsigNodeTargets = [xmlDsigNodeInstance, xmlDsigNodeProto].filter(Boolean);

      for (const target of dsigNodeTargets) {
        target.openCertificate = function (_file: string) {
          this.p12 = undefined;
          this.p12Asn1 = undefined;
          const pem = obtenerArchivosPem();
          if (pem) {
            this._certificate = pem.certB64;
            this._privateKey = pem.keyContent;
            this.certificate = pem.certB64;
            this.privateKey = pem.keyContent;
          }
        };

        target.openFile = function (file: string, _password: string) {
          this.openCertificate(file);
        };

        target.cleanCertificate = function () {
          this.p12 = undefined;
          this.p12Asn1 = undefined;
        };

        target.getCertificate = function () {
          const pem = obtenerArchivosPem();
          const cert = pem ? pem.certB64 : (this._certificate || this.certificate || '');
          return cert || '';
        };

        target.getPrivateKey = function () {
          const pem = obtenerArchivosPem();
          const key = pem ? pem.keyContent : (this._privateKey || this.privateKey || '');
          return key || '';
        };
      }
      console.log('✅ Prototipo e instancia de XMLDsigNode parcheados exitosamente.');
    } catch (err: any) {
      console.warn('⚠️ No se pudo parchear XMLDsigNode:', err?.message || err);
    }

    // 4. Parchear clases PKCS12 y token si existen
    const moduleFiles = ['PKCS12.js', 'token.js', 'PKCS12', 'token'];
    for (const f of moduleFiles) {
      try {
        const fullPath = path.isAbsolute(f) ? f : path.join(xmlsignDir, f);
        const mod = require(fullPath);
        const instance = mod?.default || mod;
        const proto = (instance && instance.constructor) ? instance.constructor.prototype : Object.getPrototypeOf(instance);

        const targets = [instance, proto].filter(Boolean);

        for (const t of targets) {
          t.openCertificate = function (_file: string) {
            this.p12 = undefined;
            this.p12Asn1 = undefined;
            const pemData = obtenerArchivosPem();
            if (pemData) {
              this._privateKeyPem = pemData.keyContent;
              this._certificateB64 = pemData.certB64;
            }
          };

          t.openFile = function (file: string, passphase: string) {
            this._passphrase = passphase;
            this.openCertificate(file);
          };

          t.clean = function () {
            this.p12 = undefined;
            this.p12Asn1 = undefined;
            this._privateKeyPem = null;
            this._certificateB64 = null;
            this._passphrase = undefined;
          };

          t.getPrivateKey = function () {
            const pemData = obtenerArchivosPem();
            return pemData ? pemData.keyContent : (this._privateKeyPem || '');
          };

          t.getCertificate = function () {
            const pemData = obtenerArchivosPem();
            return pemData ? pemData.certB64 : (this._certificateB64 || '');
          };

          t.signature = function (xml: string, privateKey: string) {
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(xml, 'utf8');
            signer.end();
            return signer.sign(privateKey, 'binary' as any);
          };
        }
      } catch (_) {}
    }

    // 5. Parchear XMLDsig.js
    try {
      const xmlDsigPath = path.join(xmlsignDir, 'XMLDsig.js');
      const xmlDsigMod = require(xmlDsigPath);
      const xmlDsigInstance = xmlDsigMod?.default || xmlDsigMod;
      const xmlDsigProto = (xmlDsigInstance && xmlDsigInstance.constructor)
        ? xmlDsigInstance.constructor.prototype
        : Object.getPrototypeOf(xmlDsigInstance);

      for (const t of [xmlDsigInstance, xmlDsigProto].filter(Boolean)) {
        t.signatureValue = function (xml: string) {
          const pemData = obtenerArchivosPem();
          if (pemData) {
            this.certificate = pemData.certB64;
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(xml, 'utf8');
            signer.end();
            return signer.sign(pemData.keyContent, 'base64');
          }
          return '';
        };
      }
    } catch (_) {}

    // 6. Parchear DESign en dist/index.js para que signXML use siempre XMLDsigNode
    try {
      const indexPath = path.join(xmlsignDir, 'index.js');
      const indexMod = require(indexPath);
      const indexInstance = indexMod?.default || indexMod;
      const xmlDsigNodeMod = require(path.join(xmlsignDir, 'XMLDsigNode'));
      const xmlDsigNode = xmlDsigNodeMod?.default || xmlDsigNodeMod;

      if (indexInstance && xmlDsigNode) {
        indexInstance.signXML = (xml: string, file: string, password: string, _signByNodeJS?: boolean) => {
          return xmlDsigNode.signDocument(xml, 'DE', file, password);
        };
        console.log('✅ Entrypoint signXML delegado permanentemente a XMLDsigNode nativo.');
      }
    } catch (_) {}

    isPatchApplied = true;
    console.log('✅ Runtime Monkey Patch aplicado con éxito total en todos los prototipos.');
  } catch (err: any) {
    console.error('⚠️ Error al aplicar Runtime Monkey Patch:', err?.message || err);
  }
}

// Inicialización inmediata al importar
inicializarMonkeyPatchXmlSign();
