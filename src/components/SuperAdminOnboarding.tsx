import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, ShieldAlert, KeyRound, Building2, 
  FileKey, UploadCloud, CheckCircle2, AlertCircle, 
  Loader2, Eye, EyeOff, FileCheck, RefreshCw, Server
} from 'lucide-react';

interface FormState {
  ruc: string;
  razonSocial: string;
  csc: string;
  idCsc: string;
  claveCertificado: string;
  llaveMaestra: string;
  ambiente: 'test' | 'prod';
  // Campos adicionales opcionales
  nombreFantasia?: string;
  timbradoNumero?: string;
  timbradoFecha?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
}

interface NotificationState {
  type: 'success' | 'error';
  title: string;
  message: string;
  details?: any;
}

export const SuperAdminOnboarding: React.FC = () => {
  const [formState, setFormState] = useState<FormState>({
    ruc: '',
    razonSocial: '',
    csc: '',
    idCsc: '0001',
    claveCertificado: '',
    llaveMaestra: '',
    ambiente: 'test',
    establecimiento: '001',
    puntoExpedicion: '001'
  });

  const [archivoCertificado, setArchivoCertificado] = useState<File | null>(null);
  const [mostrarClaveCertificado, setMostrarClaveCertificado] = useState(false);
  const [mostrarLlaveMaestra, setMostrarLlaveMaestra] = useState(false);
  const [mostrarCamposAvanzados, setMostrarCamposAvanzados] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.p12') && !file.name.toLowerCase().endsWith('.pfx')) {
        setNotification({
          type: 'error',
          title: 'Formato de archivo inválido',
          message: 'El certificado debe ser un archivo digital con extensión .p12 o .pfx.'
        });
        return;
      }
      setArchivoCertificado(file);
      setNotification(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.p12') && !file.name.toLowerCase().endsWith('.pfx')) {
        setNotification({
          type: 'error',
          title: 'Formato de archivo inválido',
          message: 'El certificado debe ser un archivo digital con extensión .p12 o .pfx.'
        });
        return;
      }
      setArchivoCertificado(file);
      setNotification(null);
    }
  };

  const resetFormulario = (mantenerLlaveMaestra = true) => {
    setFormState(prev => ({
      ruc: '',
      razonSocial: '',
      csc: '',
      idCsc: '0001',
      claveCertificado: '',
      llaveMaestra: mantenerLlaveMaestra ? prev.llaveMaestra : '',
      ambiente: 'test',
      establecimiento: '001',
      puntoExpedicion: '001',
      timbradoNumero: '',
      timbradoFecha: '',
      direccion: '',
      telefono: '',
      correo: ''
    }));
    setArchivoCertificado(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    // 1. Validaciones locales obligatorias
    if (!formState.ruc.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese el RUC del emisor (ej: 80001234-5).'
      });
      return;
    }

    if (!formState.razonSocial.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese la Razón Social del contribuyente.'
      });
      return;
    }

    if (!formState.csc.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese el Código de Seguridad del Contribuyente (CSC).'
      });
      return;
    }

    if (!formState.idCsc.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese el Identificador de CSC (ID CSC, ej: 0001).'
      });
      return;
    }

    if (!formState.claveCertificado.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese la contraseña del certificado digital (.p12).'
      });
      return;
    }

    if (!formState.llaveMaestra.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese la Llave Maestra (SUPERADMIN_API_KEY) para autorizar el onboarding.'
      });
      return;
    }

    if (!archivoCertificado) {
      setNotification({
        type: 'error',
        title: 'Archivo Requerido',
        message: 'Debe adjuntar el archivo del certificado digital (.p12).'
      });
      return;
    }

    setLoading(true);

    try {
      // 2. Empaquetar formulario con FormData
      const payload = new FormData();
      payload.append('ruc', formState.ruc.trim());
      payload.append('razonSocial', formState.razonSocial.trim());
      payload.append('csc', formState.csc.trim());
      payload.append('idCsc', formState.idCsc.trim());
      payload.append('claveCertificado', formState.claveCertificado.trim());
      payload.append('ambiente', formState.ambiente);

      // Campos opcionales si fueron provistos
      if (formState.establecimiento?.trim()) payload.append('establecimiento', formState.establecimiento.trim());
      if (formState.puntoExpedicion?.trim()) payload.append('puntoExpedicion', formState.puntoExpedicion.trim());
      if (formState.timbradoNumero?.trim()) payload.append('timbradoNumero', formState.timbradoNumero.trim());
      if (formState.timbradoFecha?.trim()) payload.append('timbradoFecha', formState.timbradoFecha.trim());
      if (formState.direccion?.trim()) payload.append('direccion', formState.direccion.trim());
      if (formState.telefono?.trim()) payload.append('telefono', formState.telefono.trim());
      if (formState.correo?.trim()) payload.append('correo', formState.correo.trim());

      // Archivo binario .p12
      payload.append('certificado', archivoCertificado);

      // 3. Petición POST al endpoint Cloud Run
      const endpoint = 'https://olga-sifen-api-933976114072.us-central1.run.app/api/admin/onboarding';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-superadmin-api-key': formState.llaveMaestra.trim()
          // Nota: NO definir 'Content-Type', el navegador adjunta automáticamente el boundary de multipart/form-data
        },
        body: payload
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        setNotification({
          type: 'success',
          title: '¡Inquilino Registrado Exitosamente!',
          message: responseData.mensaje || `La empresa ${responseData.inquilino?.razonSocial || formState.razonSocial} fue configurada correctamente en el ecosistema SaaS.`,
          details: responseData.inquilino
        });
        resetFormulario(true);
      } else {
        setNotification({
          type: 'error',
          title: 'Error de Onboarding',
          message: responseData.mensaje || responseData.error || `Error del servidor (${response.status}): ${response.statusText}`
        });
      }
    } catch (err: any) {
      console.error('Error al enviar onboarding a Cloud Run:', err);
      setNotification({
        type: 'error',
        title: 'Error de Conexión',
        message: err.message || 'No fue posible conectar con el microservicio SIFEN Cloud Run. Verifique su conexión y vuelva a intentarlo.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in w-full box-border max-w-5xl mx-auto text-slate-200">
      {/* Header del Panel */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Superadmin · SIFEN Paraguay
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Onboarding de Inquilinos SaaS
          </h1>
          <p className="text-slate-400 mt-2 font-medium text-sm">
            Alta de empresas emisoras, almacenamiento seguro de certificados .p12 en Cloud Storage y sincronización multi-tenant en Firestore.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 self-start md:self-auto text-xs text-slate-400">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>Cloud Run: <strong className="text-slate-200">olga-sifen-api</strong></span>
        </div>
      </div>

      {/* Notificaciones Visuales de Éxito o Error */}
      {notification && (
        <div className={`mb-8 p-5 rounded-2xl border transition-all animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 shadow-lg shadow-emerald-950/50' 
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200 shadow-lg shadow-rose-950/50'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-xl mt-0.5 ${
              notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base text-white">{notification.title}</h3>
              <p className="mt-1 text-sm opacity-90">{notification.message}</p>
              
              {notification.details && (
                <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-xs text-slate-300 space-y-1">
                  <p><span className="text-slate-500">RUC:</span> <strong className="text-white">{notification.details.ruc}</strong></p>
                  <p><span className="text-slate-500">Razón Social:</span> <strong className="text-white">{notification.details.razonSocial}</strong></p>
                  <p><span className="text-slate-500">Storage:</span> <span className="text-emerald-400">{notification.details.rutaCertificadoStorage}</span></p>
                  <p><span className="text-slate-500">Ambiente:</span> <span className="uppercase text-blue-400">{notification.details.ambiente}</span></p>
                </div>
              )}
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Bloque 1: Credencial Maestra de Superadmin */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Autorización Superadmin</h2>
              <p className="text-xs text-slate-400">Clave secreta configurada en el servidor (SUPERADMIN_API_KEY)</p>
            </div>
          </div>

          <div className="relative">
            <input
              type={mostrarLlaveMaestra ? 'text' : 'password'}
              name="llaveMaestra"
              value={formState.llaveMaestra}
              onChange={handleInputChange}
              placeholder="Ingrese la Llave Maestra del Superadmin"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors pr-12 font-mono"
            />
            <button
              type="button"
              onClick={() => setMostrarLlaveMaestra(!mostrarLlaveMaestra)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
              title={mostrarLlaveMaestra ? 'Ocultar llave' : 'Mostrar llave'}
            >
              {mostrarLlaveMaestra ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bloque 2: Datos de la Empresa Contribuyente */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Datos del Contribuyente (Emisor)</h2>
              <p className="text-xs text-slate-400">Identificación fiscal registrada en el SIFEN / SET</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                RUC del Emisor <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="ruc"
                value={formState.ruc}
                onChange={handleInputChange}
                placeholder="Ej: 80001234-5"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Razón Social <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="razonSocial"
                value={formState.razonSocial}
                onChange={handleInputChange}
                placeholder="Ej: MI EMPRESA S.A."
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Código de Seguridad del Contribuyente (CSC) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="csc"
                value={formState.csc}
                onChange={handleInputChange}
                placeholder="Código alfanumérico provisto por la SET"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  ID CSC <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="idCsc"
                  value={formState.idCsc}
                  onChange={handleInputChange}
                  placeholder="0001"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Ambiente
                </label>
                <select
                  name="ambiente"
                  value={formState.ambiente}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-semibold"
                >
                  <option value="test">🧪 Test (Pruebas)</option>
                  <option value="prod">🚀 Prod (Producción)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Bloque 3: Certificado Digital (.p12) y Contraseña */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
              <FileKey className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Certificado Digital PKCS#12</h2>
              <p className="text-xs text-slate-400">Archivo criptográfico (.p12) para firma digital en SIFEN</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Dropzone de Archivo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Archivo de Certificado (.p12 / .pfx) <span className="text-rose-400">*</span>
              </label>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  archivoCertificado
                    ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200 hover:border-emerald-400'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".p12,.pfx,application/x-pkcs12"
                  className="hidden"
                />

                {archivoCertificado ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-white">{archivoCertificado.name}</p>
                      <p className="text-xs text-emerald-400">{(archivoCertificado.size / 1024).toFixed(1)} KB · Listo para subir</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud className="w-10 h-10 text-slate-500 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">Arrastre aquí su archivo .p12 o haga clic para examinar</p>
                    <p className="text-xs text-slate-500 mt-1">Formato soportado: Certificado Digital PKCS#12 (máximo 10 MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contraseña del Certificado */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Contraseña del Certificado <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={mostrarClaveCertificado ? 'text' : 'password'}
                  name="claveCertificado"
                  value={formState.claveCertificado}
                  onChange={handleInputChange}
                  placeholder="Clave privada para abrir el certificado .p12"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors pr-12 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setMostrarClaveCertificado(!mostrarClaveCertificado)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  title={mostrarClaveCertificado ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarClaveCertificado ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de Campos Opcionales / Avanzados */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setMostrarCamposAvanzados(!mostrarCamposAvanzados)}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span>{mostrarCamposAvanzados ? '▲ Ocultar campos avanzados de timbrado' : '▼ Ver campos avanzados de timbrado y establecimiento (opcional)'}</span>
          </button>
        </div>

        {mostrarCamposAvanzados && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Establecimiento (ej: 001)</label>
              <input
                type="text"
                name="establecimiento"
                value={formState.establecimiento}
                onChange={handleInputChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Punto de Expedición (ej: 001)</label>
              <input
                type="text"
                name="puntoExpedicion"
                value={formState.puntoExpedicion}
                onChange={handleInputChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Número de Timbrado</label>
              <input
                type="text"
                name="timbradoNumero"
                value={formState.timbradoNumero || ''}
                onChange={handleInputChange}
                placeholder="12345678"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Fecha de Timbrado</label>
              <input
                type="date"
                name="timbradoFecha"
                value={formState.timbradoFecha || ''}
                onChange={handleInputChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Dirección del Emisor</label>
              <input
                type="text"
                name="direccion"
                value={formState.direccion || ''}
                onChange={handleInputChange}
                placeholder="Av. Principal 123"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Correo Electrónico</label>
              <input
                type="email"
                name="correo"
                value={formState.correo || ''}
                onChange={handleInputChange}
                placeholder="contacto@empresa.com.py"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        )}

        {/* Botón de Envío y Reseteo */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => resetFormulario(true)}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Limpiar Formulario
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Registrando Inquilino...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>Completar Onboarding</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SuperAdminOnboarding;
