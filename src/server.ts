import dotenv from 'dotenv';
// Cargar variables de entorno antes de importar componentes que dependan de ellas
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import sifenRoutes from './routes/sifenRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ruta de diagnóstico general del microservicio (sin bloqueo de feature flag)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    service: 'SIFEN Paraguay Microservice',
    timestamp: new Date().toISOString()
  });
});

// Rutas de facturación electrónica protegidas por el feature flag
app.use('/api/sifen', sifenRoutes);

// Manejador de rutas no encontradas (404)
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    mensaje: 'Ruta no encontrada'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SIFEN Microservice activo en el puerto: ${PORT}`);
  console.log(`📡 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 SIFEN Module Status: ${process.env.ENABLE_SIFEN_MODULE === 'true' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/sifen/test-conexion`);
  console.log(`====================================================`);
});

export default app;
