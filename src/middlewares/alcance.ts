import { Request, Response, NextFunction } from 'express';

/**
 * Middleware que actúa como Feature Flag (interruptor de alcance)
 * Controla si el módulo de facturación electrónica SIFEN está habilitado o bloqueado.
 * 
 * Regla:
 * - Solo bloquea si ENABLE_SIFEN_MODULE está explícitamente configurado como 'false'.
 * - Si no está definido (ej: despliegue inicial en Cloud Run), por defecto se considera habilitado
 *   para evitar errores 503 automáticos.
 */
export const verificarAlcanceSifen = (req: Request, res: Response, next: NextFunction): void => {
  const flag = process.env.ENABLE_SIFEN_MODULE?.trim().toLowerCase();
  const isExplicitlyDisabled = flag === 'false';

  if (isExplicitlyDisabled) {
    res.status(403).json({
      success: false,
      codigo: 'SIFEN_MODULE_DISABLED',
      mensaje: 'El módulo de facturación electrónica SIFEN se encuentra deshabilitado por Feature Flag (ENABLE_SIFEN_MODULE=false).',
      sugerencia: 'Para habilitarlo en Cloud Run o localmente, configure ENABLE_SIFEN_MODULE=true en las variables de entorno.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};
