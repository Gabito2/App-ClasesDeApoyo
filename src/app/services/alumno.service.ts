import { Injectable } from '@angular/core';
import { Alumno, Pago } from '../models/alumno.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class AlumnoService {
  private readonly STORAGE_KEY = 'alumnos';

  constructor(private storage: StorageService) { }

  getAll(): Alumno[] {
    const data = this.storage.getData<any>(this.STORAGE_KEY);
    return data
      .filter((a: any) => a && typeof a.id === 'number' && typeof a.nombre === 'string')
      .map((a: any) => this.migrar(a));
  }

  private migrar(a: any): Alumno {
    if (!a.apellido) a.apellido = '';
    if (!a.pagos) {
      const mes = new Date().getMonth() + 1;
      const anio = new Date().getFullYear();
      a.pagos = [{ mes, anio, pagado: a.pagado ?? false, fechaPago: a.fechaPago }];
    }
    return a as Alumno;
  }

  getActivos(): Alumno[] {
    return this.getAll().filter((a) => a.activo);
  }

  getById(id: number): Alumno | undefined {
    return this.getAll().find((a) => a.id === id);
  }

  crear(alumno: Omit<Alumno, 'id' | 'activo' | 'pagos'>): Alumno {
    const alumnos = this.getAll();
    const ahora = new Date();
    const nuevo: Alumno = {
      ...alumno,
      id: Date.now(),
      activo: true,
      pagos: [{ mes: ahora.getMonth() + 1, anio: ahora.getFullYear(), pagado: false }],
    };
    alumnos.push(nuevo);
    this.storage.setData(this.STORAGE_KEY, alumnos);
    return nuevo;
  }

  actualizar(id: number, cambios: Partial<Alumno>): Alumno | undefined {
    const alumnos = this.getAll();
    const idx = alumnos.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    alumnos[idx] = { ...alumnos[idx], ...cambios };
    this.storage.setData(this.STORAGE_KEY, alumnos);
    return alumnos[idx];
  }

  eliminar(id: number): void {
    this.actualizar(id, { activo: false });
  }

  eliminarDefinitivo(id: number): void {
    const alumnos = this.getAll().filter((a) => a.id !== id);
    this.storage.setData(this.STORAGE_KEY, alumnos);
  }

  reactivar(id: number): void {
    this.actualizar(id, { activo: true });
  }

  togglePagoMes(id: number, mes: number, anio: number): Alumno | undefined {
    const alumno = this.getById(id);
    if (!alumno) return undefined;

    const existe = alumno.pagos.find((p) => p.mes === mes && p.anio === anio);
    if (existe) {
      existe.pagado = !existe.pagado;
      existe.fechaPago = existe.pagado ? new Date().toISOString() : undefined;
    } else {
      alumno.pagos.push({ mes, anio, pagado: true, fechaPago: new Date().toISOString() });
    }

    return this.actualizar(id, { pagos: alumno.pagos });
  }

  estaPagadoMes(alumno: Alumno, mes: number, anio: number): boolean {
    const pago = alumno.pagos.find((p) => p.mes === mes && p.anio === anio);
    return pago?.pagado ?? false;
  }

  getStats(): { total: number; pagados: number; pendientes: number; montoCobrado: number; montoPendiente: number } {
    const activos = this.getActivos();
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    const pagados = activos.filter((a) => this.estaPagadoMes(a, mes, anio));
    const pendientes = activos.filter((a) => !this.estaPagadoMes(a, mes, anio));

    return {
      total: activos.length,
      pagados: pagados.length,
      pendientes: pendientes.length,
      montoCobrado: pagados.reduce((sum, a) => sum + a.montoMensual, 0),
      montoPendiente: pendientes.reduce((sum, a) => sum + a.montoMensual, 0),
    };
  }

  getRecomendacion(): { texto: string; tipo: 'positivo' | 'atencion' | 'info' } {
    const activos = this.getActivos();
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    if (activos.length === 0) {
      return { texto: 'Cargá tu primer alumno para empezar', tipo: 'info' };
    }

    const sinPagar = activos.filter((a) => !this.estaPagadoMes(a, mes, anio));
    if (sinPagar.length === 0) {
      const totalMes = activos.reduce((s, a) => s + a.montoMensual, 0);
      return { texto: `¡Todos pagaron! Ingreso del mes: $${totalMes}`, tipo: 'positivo' };
    }

    if (sinPagar.length === 1) {
      return { texto: `Solo ${sinPagar[0].nombre} falta pagar`, tipo: 'atencion' };
    }

    const moroso = sinPagar.reduce((max, alum) => {
      const impagos = [mes - 1, mes - 2].filter((m) => {
        const mm = m <= 0 ? m + 12 : m;
        const aa = m <= 0 ? anio - 1 : anio;
        return !this.estaPagadoMes(alum, mm, aa);
      }).length;
      return impagos > (max.impagos || 0) ? { alumno: alum, impagos } : max;
    }, { alumno: null as any, impagos: 0 });

    if (moroso.impagos > 0) {
      return {
        texto: `${moroso.alumno.nombre} ${moroso.alumno.apellido} debe ${moroso.impagos + 1} meses consecutivos`,
        tipo: 'atencion',
      };
    }

    return { texto: `${sinPagar.length} alumnos deben pagar este mes`, tipo: 'info' };
  }
}
