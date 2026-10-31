# SIFEN Paraguay - Microservicio Backend

Microservicio aislado y de alto rendimiento en **Node.js** y **TypeScript** diseñado para interactuar con la infraestructura del **SIFEN (Sistema Integrado de Facturación Electrónica Nacional de Paraguay - DNIT / SET)**.

---

## 🚀 Características Principales

- **Arquitectura Limpia & Modular:** Preparado para despliegue directo en contenedores (Docker), plataformas Cloud (GCP Cloud Run, AWS, Railway, Render) y repositorios GitHub.
- **Ecosistema Oficial SIFEN Integrado:**
  - `facturacionelectronicapy-xmlgen`: Generación oficial de XML para Documentos Electrónicos (DE v150) y cálculo automático del CDC (44 dígitos).
  - `facturacionelectronicapy-xmlsign`: Firma digital XMLDSig sobre el elemento `<DE>` con certificados `.p12` / `.pfx`.
  - `facturacionelectronicapy-qrgen`: Integración del código QR y campo `AA002` para consulta en la DNIT.
  - `facturacionelectronicapy-setapi`: Comunicación síncrona/asíncrona y consultas RUC con los Web Services de la SET.
- **Firma Digital Segura:** Endpoint dedicado `/api/sifen/firmar-xml-prueba` con localización automática de certificados `.p12`, desencriptación de claves y manejo robusto de excepciones criptográficas.
- **Datos de Prueba Oficiales SIFEN v150:** Normalizador inteligente `sifenDefaultTestData.ts` con catálogos geográficos paraguayos completos, cliente no contribuyente válido y cálculo de `ivaProporcion`.
- **Feature Flag / Interruptor de Alcance:** Middleware `alcance.ts` que permite o bloquea el acceso a rutas operacionales de facturación mediante `ENABLE_SIFEN_MODULE` (por defecto habilitado).
- **Criptografía Robusta (AES-256-GCM):** Servicio de seguridad `certificadoService.ts` para encriptar y desencriptar contraseñas de certificados digitales `.p12` / `.pfx`.

---

## 📁 Estructura del Proyecto

```text
├── certs/
│   └── .gitkeep                # Directorio para certificados .p12 (ignorado por git)
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Exclusiones de Git (previene filtrado de certificados .p12)
├── package.json                # Dependencias y scripts del proyecto
├── tsconfig.json               # Configuración del compilador TypeScript
├── README.md                   # Documentación oficial
└── src/
    ├── @types/
    │   └── facturacionelectronicapy.d.ts # Tipos para las librerías oficiales SIFEN
    ├── server.ts               # Punto de entrada y configuración de Express
    ├── middlewares/
    │   └── alcance.ts          # Middleware Feature Flag (ENABLE_SIFEN_MODULE)
    ├── services/
    │   ├── certificadoService.ts   # Servicio criptográfico AES-256-GCM y localización .p12
    │   ├── sifenCoreService.ts     # Core SIFEN (xmlgen, xmlsign, qrgen, setapi)
    │   └── sifenDefaultTestData.ts # Plantilla y normalizador de prueba v150
    ├── routes/
    │   └── sifenRoutes.ts      # Rutas del módulo SIFEN (/api/sifen/*)
    └── examples/
        └── demoCertificado.ts  # Demostración de encriptación/desencriptación
```

---

## 📡 Endpoints del Microservicio

### 1. Diagnóstico General
- **URL:** `GET /health`

---

### 2. Prueba de Conexión SIFEN
- **URL:** `GET /api/sifen/test-conexion` o `POST /api/sifen/test-conexion`

---

### 3. Generación de XML de Prueba v150 (Sin firmar)
- **URL:** `POST /api/sifen/generar-xml-prueba` o `GET /api/sifen/generar-xml-prueba`
- Genera el XML oficial v150 con CDC de 44 dígitos a partir de la plantilla notarial oficial.

---

### 4. Firma Digital de Prueba v150
- **URL:** `POST /api/sifen/firmar-xml-prueba` o `GET /api/sifen/firmar-xml-prueba`
- **Headers:** `Content-Type: application/json`
- **Body opcional:** 
  - Si se envía `{}` o se llama por `GET`, genera automáticamente el XML v150 y lo firma con el certificado en `./certs/`.
  - Opcionalmente puede recibir `{ "xml": "...", "certPath": "./certs/mi-certificado.p12", "password": "..." }`.
- **Ejemplo de Response (200 OK con Certificado Localizado y Firmado):**
  ```json
  {
    "success": true,
    "mensaje": "Documento electrónico v150 firmado digitalmente con éxito.",
    "cdc": "01800123456001001000000112026103112345678901",
    "version": 150,
    "certificado": {
      "archivo": "certificado.p12",
      "tamanioBytes": 4096,
      "algoritmo": "XMLDSig-RSA-SHA256"
    },
    "xml_firmado": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rDE xmlns=\"http://sifen.set.gov.py/sifen/xsd\"><DE Id=\"...\"><Signature xmlns=\"http://www.w3.org/2000/09/xmldsig#\">...</Signature></DE></rDE>",
    "timestamp": "2026-10-31T13:40:00.000Z"
  }
  ```
