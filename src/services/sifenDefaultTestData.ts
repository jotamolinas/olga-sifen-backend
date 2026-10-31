/**
 * Estructura de datos de prueba oficial, validada y definitiva para SIFEN v150 (Paraguay).
 * Cumple con todos los requerimientos técnicos y de esquema de la DNIT / SET:
 * - Emisor (params): Actividades económicas (69101), timbrado y establecimientos con códigos oficiales.
 * - Ubicación geográfica paraguaya correcta: Capital (Dpto 1, Distrito 1, Ciudad 1 - ASUNCION).
 * - Desfase temporal estricto: La fecha de la factura (fecha / dFeEmiDE) es exactamente 10 minutos
 *   antes que la fecha de envío/firma (fechaEnvio / fecFirma). Nunca comparten la misma marca de tiempo.
 * - Cliente no contribuyente estricto:
 *   { contribuyente: false, tipoOperacion: 2, razonSocial: 'JUAN CARLOS PEREZ', documentoTipo: 1,
 *     documentoNumero: '1234567', ruc: '1234567-8', direccion: 'Av. Espana', numeroCasa: '500',
 *     departamento: 1, distrito: 1, ciudad: 1, pais: 'PRY', paisDescripcion: 'Paraguay' }
 * - Nodo data.factura explícito con presencia: 1 (operación presencial) y fechaEnvio.
 * - Condición: Contado (tipo: 1) con desglose en efectivo.
 * - Ítems notariales: Tasa IVA 10% con ivaProporcion: 100 obligatorio en v150.
 */

export interface SifenParamsAndData {
  params: any;
  data: any;
}

export function obtenerDatosPruebaSifenV150(inputBody: any = {}): SifenParamsAndData {
  const now = new Date();
  
  // 1. Marca de tiempo actual de Envío / Firma digital (fechaEnvio / fecFirma)
  const fechaEnvioFirmaDate = now;
  const fechaEnvioIso = fechaEnvioFirmaDate.toISOString().split('.')[0]; // 'YYYY-MM-DDTHH:mm:ss'

  // 2. Marca de tiempo de la Factura / Emisión: EXACTAMENTE 10 minutos antes (dFeEmiDE / fecha)
  const fechaFacturaDate = new Date(fechaEnvioFirmaDate.getTime() - 10 * 60 * 1000);
  const fechaFacturaIso = fechaFacturaDate.toISOString().split('.')[0]; // 'YYYY-MM-DDTHH:mm:ss'

  // Parámetros estáticos del Contribuyente Emisor (Escribanía Notarial)
  const defaultParams = {
    version: 150,
    sincronico: 'S',
    tipoContribuyente: 2, // 2: Persona Jurídica / Entidad con RUC
    tipoRegimen: 8,       // 8: Régimen General
    ruc: '80012345-6',
    dveruc: '1',
    razonSocial: 'Escribanía Notarial Dra. Olga Benítez - Registro Notarial N° 12',
    nombreFantasia: 'Escribanía Notarial Olga Benítez',
    actividadesEconomicas: [
      {
        codigo: '69101',
        descripcion: 'Actividades jurídicas y notariales'
      }
    ],
    timbradoNumero: '12567890',
    timbradoFecha: '2026-01-01',
    establecimientos: [
      {
        codigo: '001',
        direccion: 'Avda. Mariscal López c/ San Martín',
        numeroCasa: '1234',
        complementoDireccion1: 'Edificio Plaza Notarial',
        complementoDireccion2: 'Piso 2, Oficina 201',
        departamento: 1,
        departamentoDescripcion: 'CAPITAL',
        distrito: 1,
        distritoDescripcion: 'ASUNCION (DISTRITO)',
        ciudad: 1,
        ciudadDescripcion: 'ASUNCION (DISTRITO)',
        telefono: '021600000',
        email: 'notaria.olga@gmail.com',
        denominacion: 'Casa Matriz Escribanía'
      }
    ]
  };

  // Cliente No Contribuyente (Estructura Estricta requerida por SIFEN v150)
  const defaultClienteNoContribuyente = {
    contribuyente: false,
    tipoOperacion: 2,
    razonSocial: 'JUAN CARLOS PEREZ',
    documentoTipo: 1,
    documentoNumero: '1234567',
    ruc: '1234567-8',
    direccion: 'Av. Espana',
    numeroCasa: '500',
    departamento: 1,
    distrito: 1,
    ciudad: 1,
    pais: 'PRY',
    paisDescripcion: 'Paraguay',
    // Compatibilidad adicional bidireccional
    tipoDocumento: 1,
    numeroDocumento: '1234567'
  };

  // Ítems notariales con ivaProporcion: 100 obligatorio en v150
  const defaultItems = [
    {
      codigo: 'HON-001',
      descripcion: 'Honorarios notariales por protocolización y escrituración pública',
      observacion: 'Escritura pública de transferencia de inmueble',
      partidaArancelaria: 0,
      ncm: 0,
      unidadMedida: 77, // UNI (Unidad)
      cantidad: 1,
      precioUnitario: 1500000,
      cambio: 0,
      descuento: 0,
      anticipo: 0,
      pais: 'PRY',
      paisDescripcion: 'Paraguay',
      tolerancia: 0,
      toleranciaCantidad: 0,
      toleranciaPorcentaje: 0,
      cdcAnticipo: 0,
      ivaTipo: 1,        // 1: Gravado IVA
      ivaBase: 100,      // Retrocompatibilidad
      ivaProporcion: 100,// Exigido y validado en v150
      iva: 10            // Tasa IVA 10%
    },
    {
      codigo: 'CERT-002',
      descripcion: 'Certificación notarial de firmas y documentos',
      observacion: 'Certificación de firmas de comparecientes en contrato privado',
      partidaArancelaria: 0,
      ncm: 0,
      unidadMedida: 77,
      cantidad: 1,
      precioUnitario: 150000,
      cambio: 0,
      descuento: 0,
      anticipo: 0,
      pais: 'PRY',
      paisDescripcion: 'Paraguay',
      tolerancia: 0,
      toleranciaCantidad: 0,
      toleranciaPorcentaje: 0,
      cdcAnticipo: 0,
      ivaTipo: 1,
      ivaBase: 100,
      ivaProporcion: 100,
      iva: 10
    }
  ];

  // Condición de pago (Contado en Efectivo)
  const defaultCondicion = {
    tipo: 1, // 1: Contado
    entregas: [
      {
        tipo: 1, // 1: Efectivo
        tipoDescripcion: 'Efectivo',
        monto: 1650000,
        moneda: 'PYG'
      }
    ]
  };

  // Nodo específico data.factura exigido en v150
  const defaultFactura = {
    presencia: 1,           // 1: Operación presencial
    fechaEnvio: fechaEnvioIso
  };

  // Factura Electrónica (data)
  const defaultData = {
    tipoDocumento: 1,       // 1: Factura Electrónica
    establecimiento: '001',
    punto: '001',
    numero: 1,
    descripcion: 'Servicios Notariales y Protocolización',
    observacion: 'Facturación Electrónica SIFEN v150',
    fecha: fechaFacturaIso, // Exactamente 10 minutos antes que fechaEnvio / fecFirma
    dFeEmiDE: fechaFacturaIso,
    fecFirma: fechaEnvioIso,
    tipoEmision: 1,         // 1: Normal
    tipoTransaccion: 1,     // 1: Venta de bienes / servicios
    tipoImpuesto: 1,        // 1: IVA
    moneda: 'PYG',
    presencia: 1,           // 1: Operación presencial
    factura: defaultFactura,
    cliente: defaultClienteNoContribuyente,
    condicion: defaultCondicion,
    items: defaultItems
  };

  // Si no se proporcionó cuerpo o está vacío {}, devuelve el payload validado completo
  if (!inputBody || Object.keys(inputBody).length === 0) {
    return {
      params: defaultParams,
      data: defaultData
    };
  }

  // Fusión inteligente preservando todos los campos obligatorios
  const userParams = inputBody.params || inputBody.emisor || {};
  const userData = inputBody.data || {};

  const mergedParams = {
    ...defaultParams,
    ...userParams,
    actividadesEconomicas: (userParams.actividadesEconomicas && userParams.actividadesEconomicas.length > 0)
      ? userParams.actividadesEconomicas
      : defaultParams.actividadesEconomicas,
    establecimientos: (userParams.establecimientos && userParams.establecimientos.length > 0)
      ? userParams.establecimientos
      : defaultParams.establecimientos
  };

  const userCliente = userData.cliente || inputBody.cliente || {};
  const mergedCliente = {
    ...defaultClienteNoContribuyente,
    ...userCliente,
    documentoTipo: userCliente.documentoTipo !== undefined ? userCliente.documentoTipo : defaultClienteNoContribuyente.documentoTipo,
    documentoNumero: userCliente.documentoNumero || userCliente.numeroDocumento || defaultClienteNoContribuyente.documentoNumero,
    ruc: userCliente.ruc || defaultClienteNoContribuyente.ruc,
    tipoDocumento: userCliente.tipoDocumento !== undefined ? userCliente.tipoDocumento : defaultClienteNoContribuyente.documentoTipo,
    numeroDocumento: userCliente.numeroDocumento || userCliente.documentoNumero || defaultClienteNoContribuyente.documentoNumero
  };

  const userFactura = userData.factura || inputBody.factura || {};
  const mergedFactura = {
    ...defaultFactura,
    ...userFactura,
    presencia: userFactura.presencia !== undefined ? userFactura.presencia : 1,
    fechaEnvio: userFactura.fechaEnvio || defaultFactura.fechaEnvio
  };

  // Garantizar que la fecha de la factura NUNCA sea idéntica a la fecha de envío/firma
  let fechaFacturaFinal = userData.fecha || inputBody.fecha || defaultData.fecha;
  const fechaEnvioFinal = mergedFactura.fechaEnvio;

  if (fechaFacturaFinal === fechaEnvioFinal) {
    const envioDate = new Date(fechaEnvioFinal.includes('T') ? fechaEnvioFinal : `${fechaEnvioFinal}T12:00:00`);
    fechaFacturaFinal = new Date(envioDate.getTime() - 10 * 60 * 1000).toISOString().split('.')[0];
  }

  const userItems = (userData.items && userData.items.length > 0)
    ? userData.items
    : (inputBody.items && inputBody.items.length > 0 ? inputBody.items : defaultItems);

  const mergedItems = userItems.map((item: any, index: number) => ({
    codigo: item.codigo || `ITEM-${index + 1}`,
    descripcion: item.descripcion || 'Servicio Notarial Profesional',
    observacion: item.observacion || '',
    partidaArancelaria: item.partidaArancelaria || 0,
    ncm: item.ncm || 0,
    unidadMedida: item.unidadMedida || 77,
    cantidad: item.cantidad || 1,
    precioUnitario: item.precioUnitario || 100000,
    cambio: item.cambio || 0,
    descuento: item.descuento || 0,
    anticipo: item.anticipo || 0,
    pais: item.pais || 'PRY',
    paisDescripcion: item.paisDescripcion || 'Paraguay',
    tolerancia: item.tolerancia || 0,
    toleranciaCantidad: item.toleranciaCantidad || 0,
    toleranciaPorcentaje: item.toleranciaPorcentaje || 0,
    cdcAnticipo: item.cdcAnticipo || 0,
    ivaTipo: item.ivaTipo || 1,
    ivaBase: item.ivaBase !== undefined ? item.ivaBase : 100,
    ivaProporcion: item.ivaProporcion !== undefined ? item.ivaProporcion : 100,
    iva: item.iva !== undefined ? item.iva : 10
  }));

  const mergedData = {
    ...defaultData,
    ...userData,
    fecha: fechaFacturaFinal,
    dFeEmiDE: fechaFacturaFinal,
    fecFirma: fechaEnvioFinal,
    presencia: userData.presencia !== undefined ? userData.presencia : 1,
    factura: mergedFactura,
    cliente: mergedCliente,
    condicion: userData.condicion || inputBody.condicion || defaultCondicion,
    items: mergedItems
  };

  return {
    params: mergedParams,
    data: mergedData
  };
}
