import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de seguridad para proteger los endpoints de administración y onboarding de inquilinos.
 * Exige que la cabecera 'x-superadmin-api-key' coincida exactamente con la variable de entorno SUPERADMIN_API_KEY.
 * Si la clave falta o no coincide, responde inmediatamente con HTTP 403 Forbidden.
 */
export const superadminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const superadminApiKeyEnv = process.env.SUPERADMIN_API_KEY;

  // Si no está configurada la variable en el entorno, bloquear por seguridad estricta
  if (!superadminApiKeyEnv || superadminApiKeyEnv.trim() === '') {
    res.status(403).json({
      success: false,
      codigo: 'SUPERADMIN_KEY_NOT_CONFIGURED',
      mensaje: 'Acceso denegado: La clave SUPERADMIN_API_KEY no se encuentra configurada en el servidor.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Obtener la clave enviada en cabeceras (case-insensitive)
  const headerKey = req.headers['x-superadmin-api-key'];
  const providedKey = typeof headerKey === 'string' ? headerKey.trim() : (Array.isArray(headerKey) ? headerKey[0] : '');

  if (!providedKey || providedKey !== superadminApiKeyEnv.trim()) {
    res.status(403).json({
      success: false,
      codigo: 'FORBIDDEN',
      mensaje: 'Acceso no autorizado: La cabecera x-superadmin-api-key es inválida o no fue proporcionada.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};

export default superadminAuth;
