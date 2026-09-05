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
}
