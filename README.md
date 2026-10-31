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
- **Feature Flag / Interruptor de Alcance:** Middleware `alcance.ts` que habilita o bloquea el acceso a todas las rutas de facturación mediante la variable `ENABLE_SIFEN_MODULE`.
- **Criptografía Robusta (AES-256-GCM):** Servicio de seguridad `certificadoService.ts` para encriptar y desencriptar contraseñas de certificados digitales `.p12` / `.pfx` con vector de inicialización (IV) dinámico y autenticación de integridad (Auth Tag).
- **Herramientas XML de Alta Velocidad:** Soporte nativo con `fast-xml-parser` y `axios`.

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
    │   ├── certificadoService.ts # Servicio criptográfico AES-256-GCM
    │   └── sifenCoreService.ts   # Core SIFEN (xmlgen, xmlsign, qrgen, setapi)
    ├── routes/
    │   └── sifenRoutes.ts      # Rutas del módulo SIFEN (/api/sifen/*)
    └── examples/
        └── demoCertificado.ts  # Demostración de encriptación/desencriptación
```

---

## ⚙️ Instalación y Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Variables clave en `.env`:**

   | Variable | Descripción | Valor por defecto / Ejemplo |
   | :--- | :--- | :--- |
   | `PORT` | Puerto de escucha de Express | `3000` |
   | `ENABLE_SIFEN_MODULE` | Interruptor del módulo SIFEN (`true` / `false`) | `true` |
   | `AES_SECRET_KEY` | Clave secreta para cifrado AES-256 (64 hex o 32 chars) | Generar aleatoria de 32 bytes |
   | `SIFEN_ENV` | Entorno de facturación | `test` o `prod` |
   | `CERT_P12_PATH` | Ruta al certificado digital | `./certs/certificado.p12` |

---

## 📡 Endpoints del Microservicio

### 1. Diagnóstico General
- **URL:** `GET /health`

---

### 2. Prueba de Conexión SIFEN (Protegida)
- **URL:** `GET /api/sifen/test-conexion`

---

### 3. Generación de XML de Prueba v150 (Factura de Escribanía)
- **URL:** `POST /api/sifen/generar-xml-prueba`
- **Headers:** `Content-Type: application/json`
- **Body opcional:** Datos de la factura notarial (si se envía `{}` usa valores válidos de prueba para honorarios notariales y escrituración).
- **Ejemplo de Request:**
  ```json
  {
    "emisor": {
      "ruc": "80012345-6",
      "razonSocial": "Escribanía Notarial y Registro Público",
      "timbradoNumero": "12567890"
    },
    "cliente": {
      "ruc": "44444401-7",
      "razonSocial": "Cliente Escribanía S.A."
    },
    "items": [
      {
        "codigo": "HON-001",
        "descripcion": "Honorarios notariales por protocolización y escrituración pública",
        "cantidad": 1,
        "precioUnitario": 1500000,
        "ivaTipo": 1,
        "ivaBase": 100,
        "iva": 10
      }
    ]
  }
  ```
- **Ejemplo de Response (200 OK):**
  ```json
  {
    "success": true,
    "mensaje": "Documento electrónico v150 generado exitosamente.",
    "cdc": "01800123456001001000000112026103112345678901",
    "xml_generado": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rDE xmlns=\"http://sifen.set.gov.py/sifen/xsd\">...</rDE>",
    "version": 150,
    "timestamp": "2026-10-31T11:35:00.000Z"
  }
  ```
