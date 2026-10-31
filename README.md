# SIFEN Paraguay - Microservicio Backend

Microservicio aislado y de alto rendimiento en **Node.js** y **TypeScript** diseñado para interactuar con la infraestructura del **SIFEN (Sistema Integrado de Facturación Electrónica Nacional de Paraguay - DNIT / SET)**.

---

## 🚀 Características Principales

- **Arquitectura Limpia & Modular:** Preparado para despliegue directo en contenedores (Docker), plataformas Cloud (AWS, GCP, Railway, Render) o repositorios de GitHub.
- **Feature Flag / Interruptor de Alcance:** Middleware `alcance.ts` que habilita o bloquea el acceso a todas las rutas de facturación mediante la variable `ENABLE_SIFEN_MODULE`.
- **Criptografía Robusta (AES-256-GCM):** Servicio de seguridad `certificadoService.ts` para encriptar y desencriptar contraseñas de certificados digitales `.p12` / `.pfx` con vector de inicialización (IV) dinámico y autenticación de integridad (Auth Tag).
- **Herramientas XML de Alta Velocidad:** Soporte nativo para manipulación de esquemas XML y SOAP del SIFEN mediante `fast-xml-parser`.
- **Cliente HTTP Resiliente:** Configurado con `axios` para consumo de Web Services de la DNIT con manejo de timeouts.

---

## 📁 Estructura del Proyecto

```text
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Exclusiones de Git (previene filtrado de certificados .p12)
├── package.json                # Dependencias y scripts del proyecto
├── tsconfig.json               # Configuración del compilador TypeScript
├── README.md                   # Documentación oficial
└── src/
    ├── server.ts               # Punto de entrada y configuración de Express
    ├── middlewares/
    │   └── alcance.ts          # Middleware Feature Flag (ENABLE_SIFEN_MODULE)
    ├── services/
    │   └── certificadoService.ts # Servicio criptográfico AES-256-GCM
    ├── routes/
    │   └── sifenRoutes.ts      # Rutas del módulo SIFEN (/api/sifen/*)
    └── examples/
        └── demoCertificado.ts  # Demostración de encriptación/desencriptación
```

---

## 🛠️ Requisitos Previos

- **Node.js** >= 18.0.0
- **npm** o **pnpm**

---

## ⚙️ Instalación y Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Variables clave en `.env`:**

   | Variable | Descripción | Valor por defecto / Ejemplo |
   | :--- | :--- | :--- |
   | `PORT` | Puerto de escucha de Express | `3000` |
   | `ENABLE_SIFEN_MODULE` | Interruptor del módulo SIFEN (`true` / `false`) | `false` |
   | `AES_SECRET_KEY` | Clave secreta para cifrado AES-256 (64 hex o 32 chars) | Generar aleatoria de 32 bytes |
   | `SIFEN_ENV` | Entorno de facturación | `test` o `prod` |
   | `CERT_P12_PATH` | Ruta al certificado digital | `./certs/certificado.p12` |

> 💡 **Generar clave AES-256 segura:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 🚦 Ejecución

### Modo Desarrollo (Recarga en caliente con TSX):
```bash
npm run dev
```

### Probar el Cifrado AES-256 de Contraseñas de Certificados:
```bash
npm run demo:cert
```

### Compilar para Producción:
```bash
npm run build
npm start
```

---

## 📡 Endpoints del Microservicio

### 1. Diagnóstico General (Sin Bloqueo)
- **URL:** `GET /health`
- **Respuesta:**
  ```json
  {
    "status": "OK",
    "service": "SIFEN Paraguay Microservice",
    "timestamp": "2026-10-31T10:40:00.000Z"
  }
  ```

---

### 2. Prueba de Conexión SIFEN (Protegida por Feature Flag)
- **URL:** `GET /api/sifen/test-conexion`
- **Middleware:** `alcance.ts` (`verificarAlcanceSifen`)

#### Caso A: Cuando `ENABLE_SIFEN_MODULE=false` (Módulo Deshabilitado)
Retorna código de estado **`503 Service Unavailable`**:
```json
{
  "success": false,
  "codigo": "SIFEN_MODULE_DISABLED",
  "mensaje": "El módulo de facturación electrónica SIFEN está temporalmente deshabilitado en este entorno.",
  "timestamp": "2026-10-31T10:40:00.000Z"
}
```

#### Caso B: Cuando `ENABLE_SIFEN_MODULE=true` (Módulo Habilitado)
Retorna código de estado **`200 OK`**:
```json
{
  "success": true,
  "microservice": "sifen-backend-microservice",
  "status": "ONLINE",
  "ambienteSifen": "test",
  "endpointConsultado": "https://sifen-test.set.gov.py/de/ws/consultas/consulta-ruc.wsdl",
  "estadoConexionSifen": "HTTP_200",
  "latenciaMs": 142,
  "herramientas": {
    "xmlEngine": "fast-xml-parser (v4)",
    "xmlEngineStatus": "READY",
    "httpClient": "Axios (v1)",
    "seguridadCertificados": "AES-256-GCM"
  },
  "certificadoDigital": {
    "rutaConfigurada": "./certs/certificado.p12",
    "archivoEncontrado": false
  },
  "timestamp": "2026-10-31T10:40:00.000Z"
}
```

---

## 🔐 Seguridad y Certificados `.p12`

El servicio `CertificadoService` implementa:
1. **AES-256-GCM:** Cifrado simétrico de nivel bancario con autenticación de integridad mediante *Auth Tag*.
2. **Formato seguro de almacenamiento:** El payload resultante tiene la estructura:
   ```text
   {vector_inicializacion_hex}:{auth_tag_hex}:{datos_cifrados_hex}
   ```
   Esto permite almacenar la contraseña cifrada en bases de datos (PostgreSQL, MongoDB) de manera 100% segura.
