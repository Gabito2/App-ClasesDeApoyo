export interface Pago {
  mes: number;
  anio: number;
  pagado: boolean;
  fechaPago?: string;
}

export interface Alumno {
  id: number;
  nombre: string;
  apellido: string;
  diaEntrada: number;
  montoMensual: number;
  pagos: Pago[];
  activo: boolean;
}
