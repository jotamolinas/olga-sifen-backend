import dotenv from 'dotenv';
// Cargar variables de entorno antes de importar componentes que dependan de ellas
dotenv.config();

// Inicializar explícitamente el monkey patch ANTES de cualquier ruta o servicio
import { inicializarMonkeyPatchXmlSign } from './services/xmlSignMonkeyPatch.js';
inicializarMonkeyPatchXmlSign();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import sifenRoutes from './routes/sifenRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ruta de diagnóstico general del microservicio
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    service: 'SIFEN Paraguay Microservice',
    timestamp: new Date().toISOString()
  });
});

// Rutas de facturación electrónica SIFEN
app.use('/api/sifen', sifenRoutes);

// Manejador de rutas no encontradas (404)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    codigo: 'ROUTE_NOT_FOUND',
    mensaje: `La ruta solicitada [${req.method}] ${req.originalUrl} no fue encontrada en este servidor.`,
    timestamp: new Date().toISOString()
  });
});

// Manejador global de errores (previene colapsos inesperados o códigos 503 no controlados)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error no controlado en la aplicación:', err);
  res.status(500).json({
    success: false,
    codigo: 'INTERNAL_SERVER_ERROR',
    mensaje: err?.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SIFEN Microservice activo en el puerto: ${PORT}`);
  console.log(`📡 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 SIFEN Module Status: ${process.env.ENABLE_SIFEN_MODULE !== 'false' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/sifen/test-conexion`);
  console.log(`🚀 Envío SET Endpoint: http://localhost:${PORT}/api/sifen/enviar-set-prueba`);
  console.log(`====================================================`);
});

export default app;
