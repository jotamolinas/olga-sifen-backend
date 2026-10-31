import { Request, Response, NextFunction } from 'express';

/**
 * Middleware que actúa como Feature Flag (interruptor de alcance)
 * Controla si el módulo de facturación electrónica SIFEN está habilitado o bloqueado.
 * 
 * Regla:
 * Si ENABLE_SIFEN_MODULE no es 'true', bloquea el acceso con código HTTP 503 (Service Unavailable).
 */
export const verificarAlcanceSifen = (req: Request, res: Response, next: NextFunction): void => {
  const isSifenEnabled = process.env.ENABLE_SIFEN_MODULE?.trim().toLowerCase() === 'true';

  if (!isSifenEnabled) {
    res.status(503).json({
      success: false,
      codigo: 'SIFEN_MODULE_DISABLED',
      mensaje: 'El módulo de facturación electrónica SIFEN está temporalmente deshabilitado en este entorno.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};
