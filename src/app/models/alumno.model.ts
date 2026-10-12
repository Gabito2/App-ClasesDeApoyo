export interface Pago {
  mes: number;
  anio: number;
  pagado: boolean;
  fechaPago?: string;
}

export interface HistorialMonto {
  monto: number;
  fecha: string;
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
