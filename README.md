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
- **Datos de Prueba Oficiales SIFEN v150:** Normalizador inteligente `sifenDefaultTestData.ts` con catálogos geográficos paraguayos completos (departamento, distrito, ciudad), cliente no contribuyente válido y cálculo de `ivaProporcion`.
- **Feature Flag / Interruptor de Alcance:** Middleware `alcance.ts` que permite o bloquea el acceso a rutas operacionales de facturación mediante `ENABLE_SIFEN_MODULE` (por defecto habilitado).
- **Criptografía Robusta (AES-256-GCM):** Servicio de seguridad `certificadoService.ts` para encriptar y desencriptar contraseñas de certificados digitales `.p12` / `.pfx`.

---

## 📁 Estructura del Proyecto

```text
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
    │   ├── certificadoService.ts   # Servicio criptográfico AES-256-GCM
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

### 2. Prueba de Conexión SIFEN (No Bloqueada)
- **URL:** `GET /api/sifen/test-conexion` o `POST /api/sifen/test-conexion`
- Permite probar conectividad desde el navegador o consola sin errores 404 ni bloqueos 503.

---

### 3. Generación de XML de Prueba v150 (Factura Notarial / Escribanía)
- **URL:** `POST /api/sifen/generar-xml-prueba` o `GET /api/sifen/generar-xml-prueba`
- **Headers:** `Content-Type: application/json`
- **Body opcional:** Si se envía vacío `{}` o incompleto, el backend utiliza automáticamente la plantilla completa SIFEN v150 para evitar errores de validación.
- **Ejemplo de Response (200 OK):**
  ```json
  {
    "success": true,
    "mensaje": "Documento electrónico v150 generado exitosamente.",
    "cdc": "01800123456001001000000112026103112345678901",
    "version": 150,
    "datosUtilizados": {
      "emisor": {
        "ruc": "80012345-6",
        "razonSocial": "Escribanía Notarial Dra. Olga Benítez - Registro Notarial N° 12",
        "actividadesEconomicas": [
          { "codigo": "69101", "descripcion": "Actividades jurídicas y notariales" }
        ],
        "establecimiento": "001",
        "departamento": "CAPITAL",
        "ciudad": "ASUNCION (DISTRITO)"
      },
      "cliente": {
        "tipoOperacion": 2,
        "documento": "CI 1234567",
        "razonSocial": "Juan Carlos Pérez Gómez",
        "contribuyente": false
      },
      "items": [
        {
          "codigo": "HON-001",
          "descripcion": "Honorarios notariales por protocolización y escrituración pública",
          "cantidad": 1,
          "precioUnitario": 1500000,
          "ivaProporcion": 100,
          "ivaTasa": 10
        }
      ]
    },
    "xml_generado": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rDE xmlns=\"http://sifen.set.gov.py/sifen/xsd\">...</rDE>",
    "timestamp": "2026-10-31T12:50:00.000Z"
  }
  ```
