export interface Pago {
  mes: number;
  anio: number;
  pagado: boolean;
  fechaPago?: string;
  /** Monto realmente cobrado. Si falta (pagos viejos) se usa `montoMensual`. */
  montoPagado?: number;
  /** Número correlativo del comprobante, asignado al registrar el pago. */
  numeroComprobante?: number;
}

/** Pago ya cobrado, con los datos necesarios para emitir su comprobante. */
export interface Comprobante {
  numero: number;
  alumnoId: number;
  alumnoNombre: string;
  mes: number;
  anio: number;
  monto: number;
  /** Fecha ISO del cobro. Puede faltar en pagos marcados antes de esta función. */
  fechaPago: string;
  telefono?: string;
}

export interface HistorialMonto {
  monto: number;
  fecha: string;
}

/** Cuota impaga de un alumno, con el monto de su cuota actual. */
export interface MesImpago {
  mes: number;
  anio: number;
  monto: number;
}

/** Pago ya cobrado, con su monto resuelto para mostrar en el estado de cuenta. */
export interface PagoCuenta {
  mes: number;
  anio: number;
  monto: number;
  fechaPago?: string;
  numeroComprobante?: number;
}

/** Datos consolidados de la cuenta de un alumno (pantalla Estado de cuenta). */
export interface EstadoCuenta {
  alumno: Alumno;
  /** Misma regla que getDeudaAlumno(): meses impagos × cuota actual. */
  deuda: { meses: number; monto: number };
  /** Meses impagos, del más antiguo al más reciente. */
  impagos: MesImpago[];
  /** Pagos cobrados, del más reciente al más antiguo. */
  pagos: PagoCuenta[];
  /** Cambios de cuota, del más reciente al más antiguo. */
  historialMontos: HistorialMonto[];
  totalCobrado: number;
  cantidadPagos: number;
  anio: { numero: number; cobrado: number; cantidad: number };
}

export interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  diaEntrada: number;
  montoMensual: number;
  pagos: Pago[];
  activo: boolean;
  telefono?: string;
  historialMontos?: HistorialMonto[];
  /** Fecha ISO en que se registró el alumno en la app (piso para calcular días/meses de deuda). */
  fechaRegistro?: string;
}
