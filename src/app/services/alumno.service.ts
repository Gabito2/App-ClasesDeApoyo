import { Injectable, inject } from '@angular/core';
import { Alumno, Pago } from '../models/alumno.model';
import { StorageService } from './storage.service';

interface AlumnoLegado extends Partial<Alumno> {
  id: number;
  nombre: string;
  pagado?: boolean;
  fechaPago?: string;
}

@Injectable({ providedIn: 'root' })
export class AlumnoService {
  private readonly STORAGE_KEY = 'alumnos';
  private storage = inject(StorageService);
  private cache: Alumno[] | null = null;
  private readonly MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  getAll(): Alumno[] {
    if (this.cache) return [...this.cache];
    const data = this.storage.getData<AlumnoLegado>(this.STORAGE_KEY);
    this.cache = data
      .filter((a): a is AlumnoLegado => !!a && typeof a.id === 'number' && typeof a.nombre === 'string')
      .map((a) => this.migrar(a));
    return [...this.cache];
  }

  private invalidar(): void {
    this.cache = null;
  }

  private migrar(a: AlumnoLegado): Alumno {
    const alumno = { ...a };
    if (!alumno.apellido) alumno.apellido = '';
    if (alumno.activo === undefined) alumno.activo = true;
    if (!alumno.fechaRegistro) {
      // Alumnos creados antes de guardar la fecha de registro: se infiere del
      // mes más antiguo anotado en su lista de pagos (ese mes ya existía como
      // alumno). Así los meses impagos anteriores y el actual siguen sumando días.
      const ahora = new Date();
      const pagos = alumno.pagos ?? [];
      let masAntiguo: { anio: number; mes: number } | null = null;
      for (const p of pagos) {
        if (!masAntiguo || p.anio < masAntiguo.anio || (p.anio === masAntiguo.anio && p.mes < masAntiguo.mes)) {
          masAntiguo = { anio: p.anio, mes: p.mes };
        }
      }
      if (masAntiguo && (masAntiguo.anio < ahora.getFullYear() || masAntiguo.mes < ahora.getMonth() + 1)) {
        // Ya existía en un mes anterior al actual: piso el día 1 de ese mes
        alumno.fechaRegistro = new Date(masAntiguo.anio, masAntiguo.mes - 1, 1, 12, 0, 0).toISOString();
      } else {
        // Solo tiene anotado el mes actual (o nada): asume registro reciente
        alumno.fechaRegistro = new Date().toISOString();
      }
    }
    if (!alumno.pagos) {
      const ahora = new Date();
      alumno.pagos = [{ mes: ahora.getMonth() + 1, anio: ahora.getFullYear(), pagado: a.pagado ?? false, fechaPago: a.fechaPago }];
    }
    if (!alumno.historialMontos) alumno.historialMontos = [];
    if (!alumno.telefono) alumno.telefono = undefined;
    return alumno as Alumno;
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
    // Evita colisiones de ID si dos alumnos se crean en el mismo milisegundo
    let id = Date.now();
    while (alumnos.some((a) => a.id === id)) id++;
    const nuevo: Alumno = {
      ...alumno,
      id,
      activo: true,
      fechaRegistro: ahora.toISOString(),
      pagos: [{ mes: ahora.getMonth() + 1, anio: ahora.getFullYear(), pagado: false }],
      historialMontos: [{ monto: alumno.montoMensual, fecha: ahora.toISOString() }],
    };
    alumnos.push(nuevo);
    this.storage.setData(this.STORAGE_KEY, alumnos);
    this.invalidar();
    return nuevo;
  }

  actualizar(id: number, cambios: Partial<Alumno>): Alumno | undefined {
    const alumnos = this.getAll();
    const idx = alumnos.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;

    // Si cambia el monto, se guarda el valor anterior en el historial de cuotas
    if (cambios.montoMensual !== undefined && cambios.montoMensual !== alumnos[idx].montoMensual) {
      const historial = alumnos[idx].historialMontos ?? [];
      historial.push({ monto: alumnos[idx].montoMensual, fecha: new Date().toISOString() });
      alumnos[idx].historialMontos = historial;
    }

    alumnos[idx] = { ...alumnos[idx], ...cambios };
    this.storage.setData(this.STORAGE_KEY, alumnos);
    this.invalidar();
    return alumnos[idx];
  }

  eliminar(id: number): void {
    this.actualizar(id, { activo: false });
  }

  eliminarDefinitivo(id: number): void {
    const alumnos = this.getAll().filter((a) => a.id !== id);
    this.storage.setData(this.STORAGE_KEY, alumnos);
    this.invalidar();
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

  /** Fecha límite desde la que se cuenta la deuda de un alumno: su registro en la app. */
  private fechaPiso(alumno: Alumno): Date {
    let iso = alumno.fechaRegistro ?? '';
    // "2026-10-12" se parsea como UTC y puede caer el día anterior según la zona:
    // se fija el mediodía local para conservar el día de registro.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso += 'T12:00:00';
    const fecha = new Date(iso);
    return isNaN(fecha.getTime()) ? new Date(0) : fecha;
  }

  /**
   * Devuelve el día del mes (1..28) si la fecha cae dentro del mes/año dados, o 0 si no.
   */
  private diaRegistroEnMes(fecha: Date, anio: number, mes: number): number {
    if (fecha.getFullYear() === anio && fecha.getMonth() + 1 === mes) {
      return fecha.getDate();
    }
    return 0;
  }

  getEstadoPagoMes(alumno: Alumno): { texto: string; pasado: boolean; pagoAlDia: boolean } {
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();
    const pagoAlDia = this.estaPagadoMes(alumno, mes, anio);

    if (pagoAlDia) {
      const pago = alumno.pagos.find((p) => p.mes === mes && p.anio === anio);
      return { texto: pago?.fechaPago ? 'Pagado' : 'Al día', pasado: false, pagoAlDia: true };
    }

    // Piso: no se cuentan días de meses anteriores al alta del alumno
    const piso = this.fechaPiso(alumno);
    const mesPiso = piso.getFullYear() * 12 + piso.getMonth(); // meses desde año 0

    let totalDias = 0;
    let m = mes;
    let a = anio;
    let primerMesImpago = true;

    // Si el alumno se registró este mes y ya pasó su día de cobro, se cuenta desde ese día
    const diaRegistroActual = this.diaRegistroEnMes(piso, anio, mes);
    const diaInicioMesActual = diaRegistroActual > 0 ? diaRegistroActual : Math.min(alumno.diaEntrada, new Date(a, m, 0).getDate());

    while (!this.estaPagadoMes(alumno, m, a)) {
      const indiceMes = a * 12 + (m - 1);
      if (indiceMes < mesPiso) break; // no deudar antes del alta

      const ultimoDia = new Date(a, m, 0).getDate();
      let diaInicio: number;
      if (primerMesImpago) {
        diaInicio = diaInicioMesActual;
      } else if (indiceMes === mesPiso) {
        diaInicio = Math.min(piso.getDate(), ultimoDia);
      } else {
        diaInicio = Math.min(alumno.diaEntrada, ultimoDia);
      }

      const fechaPago = new Date(a, m - 1, diaInicio);
      const fechaFin = m === mes && a === anio ? ahora : new Date(a, m, 0, 23, 59, 59);

      // Contamos la porción de mes transcurrida desde el inicio efectivo.
      // Mes anterior: se redondea (incluye el día de inicio completo);
      // mes actual: días completos transcurridos.
      if (ahora > fechaPago) {
        const fin = fechaFin > ahora ? ahora : fechaFin;
        const esMesActual = m === mes && a === anio;
        const dias = (fin.getTime() - fechaPago.getTime()) / (1000 * 60 * 60 * 24);
        totalDias += esMesActual ? Math.floor(dias) : Math.round(dias);
      }
      primerMesImpago = false;

      m--;
      if (m === 0) {
        m = 12;
        a--;
      }
      if (totalDias > 3650) break;
    }

    if (totalDias === 0) {
      // Si el vencimiento de este mes todavía no llegó (p. ej. alumno recién registrado o
      // con día de pago posterior a hoy), mostramos la fecha de vencimiento en lugar de "Vence hoy".
      const diaVencimiento = diaRegistroActual > 0 ? diaRegistroActual : Math.min(alumno.diaEntrada, new Date(anio, mes, 0).getDate());
      const fechaVencimiento = new Date(anio, mes - 1, diaVencimiento);
      if (ahora < fechaVencimiento) {
        return { texto: `Vence el ${diaVencimiento}`, pasado: false, pagoAlDia: false };
      }
      return { texto: 'Vence hoy', pasado: false, pagoAlDia: false };
    }
    return { texto: `Venció hace ${totalDias} día${totalDias !== 1 ? 's' : ''}`, pasado: true, pagoAlDia: false };
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

  getHistorialIngresos(meses: number = 6): { mes: number; anio: number; total: number }[] {
    const alumnos = this.getAll();
    const ahora = new Date();
    const resultado: { mes: number; anio: number; total: number }[] = [];

    for (let i = meses - 1; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const mes = fecha.getMonth() + 1;
      const anio = fecha.getFullYear();
      const total = alumnos
        .filter((a) => this.estaPagadoMes(a, mes, anio))
        .reduce((sum, a) => sum + a.montoMensual, 0);
      resultado.push({ mes, anio, total });
    }
    return resultado;
  }

  getTendencia(): { actual: number; anterior: number; variacion: number } {
    const alumnos = this.getAll();
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();
    const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;
    const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;

    const actual = alumnos
      .filter((a) => this.estaPagadoMes(a, mesActual, anioActual))
      .reduce((sum, a) => sum + a.montoMensual, 0);
    const anterior = alumnos
      .filter((a) => this.estaPagadoMes(a, mesAnterior, anioAnterior))
      .reduce((sum, a) => sum + a.montoMensual, 0);

    const variacion = anterior === 0 ? (actual > 0 ? 100 : 0) : Math.round(((actual - anterior) / anterior) * 100);
    return { actual, anterior, variacion };
  }

  getMesesImpagos(alumno: Alumno): number {
    const ahora = new Date();
    // límite: no se cuentan meses anteriores al registro del alumno
    const piso = this.fechaPiso(alumno);
    const mesPiso = piso.getFullYear() * 12 + piso.getMonth();
    let contador = 0;
    let mes = ahora.getMonth() + 1;
    let anio = ahora.getFullYear();
    while (!this.estaPagadoMes(alumno, mes, anio)) {
      const indiceMes = anio * 12 + (mes - 1);
      if (indiceMes < mesPiso) break;
      contador++;
      mes--;
      if (mes === 0) {
        mes = 12;
        anio--;
      }
      if (contador > 120) break;
    }
    return contador;
  }

  getDeudaAlumno(alumno: Alumno): { meses: number; monto: number } {
    const meses = this.getMesesImpagos(alumno);
    return { meses, monto: meses * alumno.montoMensual };
  }

  getDeudaTotal(): { meses: number; monto: number; alumnosConDeuda: number } {
    const activos = this.getActivos();
    let mesesTotal = 0;
    let montoTotal = 0;
    let alumnosConDeuda = 0;
    for (const a of activos) {
      const deuda = this.getDeudaAlumno(a);
      if (deuda.meses > 0) {
        mesesTotal += deuda.meses;
        montoTotal += deuda.monto;
        alumnosConDeuda++;
      }
    }
    return { meses: mesesTotal, monto: montoTotal, alumnosConDeuda };
  }

  getEstadisticasAnio(anio: number): { total: number; mejorMes: { nombre: string; total: number }; promedio: number } {
    const alumnos = this.getAll();
    const porMes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const a of alumnos) {
      for (let m = 1; m <= 12; m++) {
        if (this.estaPagadoMes(a, m, anio)) {
          porMes[m - 1] += a.montoMensual;
        }
      }
    }
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    let mejorIdx = 0;
    for (let i = 1; i < 12; i++) {
      if (porMes[i] > porMes[mejorIdx]) mejorIdx = i;
    }
    const total = porMes.reduce((s, x) => s + x, 0);
    return {
      total,
      mejorMes: { nombre: nombres[mejorIdx], total: porMes[mejorIdx] },
      promedio: Math.round(total / 12),
    };
  }

  exportar(): string {
    return JSON.stringify({ version: 1, exportado: new Date().toISOString(), alumnos: this.getAll() }, null, 2);
  }

  exportarCSV(): string {
    const alumnos = this.getAll();
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const nombresMes = this.MESES_ABREV;
    const header = [
      'Nombre',
      'Apellido',
      'Día de pago',
      'Monto mensual',
      'Estado',
      'Deuda (meses)',
      ...nombresMes.map((n) => `${n} ${anio}`),
    ].join(',');
    const rows = alumnos.map((a) => {
      const deuda = this.getMesesImpagos(a);
      const mensuales = nombresMes.map((_, m) => (this.estaPagadoMes(a, m + 1, anio) ? 'Sí' : 'No'));
      return [
        `"${a.nombre}"`,
        `"${a.apellido}"`,
        a.diaEntrada,
        a.montoMensual,
        a.activo ? 'Activo' : 'Inactivo',
        deuda,
        ...mensuales,
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }

  /**
   * Parsea un CSV exportado por la app (o compatible) y devuelve los alumnos
   * listos para importar. Los alumnos reciben ids negativos provisorios para
   * distinguirlos de un respaldo JSON: al importar se les asigna un id real.
   */
  csvAAlumnos(csv: string): Alumno[] {
    const filas = this.parsearCSV(csv);
    if (filas.length < 2) return [];

    const headers = filas[0].map((h) => this.normalizarEncabezado(h));
    const idxNombre = headers.indexOf('nombre');
    if (idxNombre === -1) return [];

    const idxApellido = headers.indexOf('apellido');
    const idxDia = headers.indexOf('dia de pago');
    const idxMonto = headers.indexOf('monto mensual');
    const idxEstado = headers.indexOf('estado');
    const idxTelefono = headers.indexOf('telefono');
    const idxMeses: { col: number; mes: number; anio: number }[] = [];
    headers.forEach((h, col) => {
      const match = /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(\d{4})$/.exec(h);
      if (match) {
        const mes = this.MESES_ABREV.findIndex((m) => m.toLowerCase() === match[1]) + 1;
        idxMeses.push({ col, mes, anio: parseInt(match[2], 10) });
      }
    });

    let id = -1;
    const alumnos: Alumno[] = [];
    for (let r = 1; r < filas.length; r++) {
      const fila = filas[r];
      const nombre = (fila[idxNombre] ?? '').trim();
      if (!nombre) continue;

      const dia = parseInt((fila[idxDia] ?? '').trim(), 10);
      // El CSV exportado usa el punto como decimal (p. ej. 1500.5). Si el archivo
      // viene con comas (formato europeo, p. ej. 1.500,50) se normaliza.
      let montoTexto = (fila[idxMonto] ?? '').trim();
      if (montoTexto.includes(',')) {
        montoTexto = montoTexto.replace(/\./g, '').replace(',', '.');
      }
      const monto = parseFloat(montoTexto);
      const estado = (fila[idxEstado] ?? '').trim().toLowerCase();
      const telefono = idxTelefono !== -1 ? (fila[idxTelefono] ?? '').trim() : '';
      const pagos: Pago[] = idxMeses.map(({ col, mes, anio }) => ({
        mes,
        anio,
        pagado: ['sí', 'si', 'true', '1'].includes((fila[col] ?? '').trim().toLowerCase()),
      }));

      alumnos.push({
        id: id--,
        nombre,
        apellido: (fila[idxApellido] ?? '').trim(),
        diaEntrada: Number.isFinite(dia) ? dia : 1,
        montoMensual: Number.isFinite(monto) ? monto : 0,
        pagos,
        activo: estado === '' ? true : estado === 'activo',
        telefono: telefono || undefined,
      });
    }
    return alumnos;
  }

  importar(json: string, reemplazar: boolean): { ok: boolean; cantidad: number; error?: string } {
    try {
      const parsed: unknown = JSON.parse(json);
      const lista: unknown[] = Array.isArray(parsed) ? parsed : (parsed as { alumnos?: unknown[] } | null)?.alumnos ?? [];
      if (lista.length === 0) {
        return { ok: false, cantidad: 0, error: 'El archivo no contiene alumnos válidos' };
      }

      const validos = lista
        .filter((a): a is AlumnoLegado => !!a && typeof (a as AlumnoLegado).id === 'number' && typeof (a as AlumnoLegado).nombre === 'string')
        .map((a) => this.migrar(a));

      if (validos.length === 0) {
        return { ok: false, cantidad: 0, error: 'No se encontraron alumnos válidos en el archivo' };
      }

      if (reemplazar) {
        // Los alumnos de CSV traen ids negativos provisorios: se les asigna uno real
        let contador = 0;
        this.storage.setData(this.STORAGE_KEY, validos.map((a) => (a.id >= 0 ? a : { ...a, id: Date.now() + ++contador })));
      } else {
        const actuales = this.getAll();
        const ids = new Set(actuales.map((a) => a.id));
        for (const alumno of validos) {
          if (alumno.id < 0) {
            // Alumno proveniente de CSV: evitar duplicados por nombre completo
            const clave = `${alumno.nombre}|${alumno.apellido}`.toLowerCase();
            const yaExiste = actuales.some((a) => `${a.nombre}|${a.apellido}`.toLowerCase() === clave);
            if (!yaExiste) {
              const nuevo = { ...alumno, id: this.generarIdNuevo(actuales, ids) };
              actuales.push(nuevo);
              ids.add(nuevo.id);
            }
          } else if (!ids.has(alumno.id)) {
            actuales.push(alumno);
            ids.add(alumno.id);
          }
        }
        this.storage.setData(this.STORAGE_KEY, actuales);
      }
      this.invalidar();
      return { ok: true, cantidad: validos.length };
    } catch {
      return { ok: false, cantidad: 0, error: 'El archivo no es un JSON válido' };
    }
  }

  private generarIdNuevo(alumnos: Alumno[], ids: Set<number>): number {
    let id = Date.now();
    while (alumnos.some((a) => a.id === id) || ids.has(id)) id++;
    return id;
  }

  private parsearCSV(texto: string): string[][] {
    const filas: string[][] = [];
    let fila: string[] = [];
    let campo = '';
    let entreComillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (entreComillas) {
        if (c === '"') {
          if (texto[i + 1] === '"') {
            campo += '"';
            i++;
          } else {
            entreComillas = false;
          }
        } else {
          campo += c;
        }
      } else if (c === '"') {
        entreComillas = true;
      } else if (c === ',') {
        fila.push(campo);
        campo = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo);
        campo = '';
        if (fila.some((f) => f.trim() !== '')) filas.push(fila);
        fila = [];
      } else {
        campo += c;
      }
    }
    fila.push(campo);
    if (fila.some((f) => f.trim() !== '')) filas.push(fila);
    return filas;
  }

  private normalizarEncabezado(encabezado: string): string {
    return encabezado
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  getHistorialPagos(alumnoId: number): { mes: number; anio: number; pagado: boolean; fechaPago?: string }[] {
    const alumno = this.getById(alumnoId);
    if (!alumno) return [];
    return [...alumno.pagos]
      .sort((a, b) => (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes));
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
      return { texto: `¡Todos pagaron! Ingreso del mes: $${totalMes.toLocaleString('es-AR')}`, tipo: 'positivo' };
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
      return impagos > max.impagos ? { alumno: alum, impagos } : max;
    }, { alumno: sinPagar[0], impagos: 0 });

    if (moroso.impagos > 0) {
      return {
        texto: `${moroso.alumno.nombre} ${moroso.alumno.apellido} debe ${moroso.impagos + 1} meses consecutivos`,
        tipo: 'atencion',
      };
    }

    return { texto: `${sinPagar.length} alumnos deben pagar este mes`, tipo: 'info' };
  }
}
