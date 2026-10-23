import { Injectable, inject } from '@angular/core';
import { Alumno, Comprobante, EstadoCuenta, MesImpago, Pago, PagoCuenta } from '../models/alumno.model';
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

  getAll(): Alumno[] {
    if (this.cache) return [...this.cache];
    const data = this.storage.getData<AlumnoLegado>(this.STORAGE_KEY);
    this.cache = data
      .filter((a): a is AlumnoLegado => !!a && typeof a.id === 'number' && typeof a.nombre === 'string')
      .map((a) => this.migrar(a));
    // Los pagos anteriores a los comprobantes no tienen número: se completa acá
    // (una sola vez) para que el historial no cambie de numeración después.
    if (this.asegurarNumerosComprobantes(this.cache)) {
      this.storage.setData(this.STORAGE_KEY, this.cache);
    }
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
    return this.estaPagadoMes(alumno, mes, anio)
      ? this.desmarcarPago(id, mes, anio)
      : this.registrarPago(id, mes, anio);
  }

  /**
   * Registra el cobro de un mes. El monto es opcional: si no se indica se usa
   * la cuota actual del alumno. El pago queda con fecha, monto real y número
   * de comprobante para poder reenviarlo más adelante.
   */
  registrarPago(id: number, mes: number, anio: number, monto?: number, fechaPago?: string): Alumno | undefined {
    const alumno = this.getById(id);
    if (!alumno) return undefined;

    const montoValido = monto !== undefined && Number.isFinite(monto) && monto >= 0;
    const montoFinal = montoValido ? monto : alumno.montoMensual;
    const existe = alumno.pagos.find((p) => p.mes === mes && p.anio === anio);

    if (existe) {
      existe.pagado = true;
      existe.montoPagado = montoFinal;
      existe.fechaPago = fechaPago ?? new Date().toISOString();
      if (existe.numeroComprobante === undefined) {
        existe.numeroComprobante = this.proximoNumeroComprobante();
      }
    } else {
      alumno.pagos.push({
        mes,
        anio,
        pagado: true,
        montoPagado: montoFinal,
        fechaPago: fechaPago ?? new Date().toISOString(),
        numeroComprobante: this.proximoNumeroComprobante(),
      });
    }

    return this.actualizar(id, { pagos: alumno.pagos });
  }

  /** Deshace un cobro (pago marcado por error) y libera su número de comprobante. */
  desmarcarPago(id: number, mes: number, anio: number): Alumno | undefined {
    const alumno = this.getById(id);
    if (!alumno) return undefined;

    const existe = alumno.pagos.find((p) => p.mes === mes && p.anio === anio);
    if (existe) {
      existe.pagado = false;
      existe.fechaPago = undefined;
      existe.montoPagado = undefined;
      existe.numeroComprobante = undefined;
    }

    return this.actualizar(id, { pagos: alumno.pagos });
  }

  estaPagadoMes(alumno: Alumno, mes: number, anio: number): boolean {
    const pago = alumno.pagos.find((p) => p.mes === mes && p.anio === anio);
    return pago?.pagado ?? false;
  }

  /** Monto cobrado de un mes: el registrado al pagar o la cuota del alumno si es un pago viejo. */
  getMontoPago(alumno: Alumno, mes: number, anio: number): number {
    const pago = alumno.pagos.find((p) => p.mes === mes && p.anio === anio);
    return pago?.montoPagado ?? alumno.montoMensual;
  }

  /** Pagos cobrados, listos para emitir el comprobante. Más recientes primero. */
  getComprobantes(filtro: { mes?: number; anio?: number } = {}): Comprobante[] {
    const resultado: Comprobante[] = [];
    for (const alumno of this.getAll()) {
      for (const pago of alumno.pagos) {
        if (!pago.pagado) continue;
        if (filtro.mes !== undefined && pago.mes !== filtro.mes) continue;
        if (filtro.anio !== undefined && pago.anio !== filtro.anio) continue;
        resultado.push({
          numero: pago.numeroComprobante ?? 0,
          alumnoId: alumno.id,
          alumnoNombre: `${alumno.nombre} ${alumno.apellido}`.trim(),
          mes: pago.mes,
          anio: pago.anio,
          monto: pago.montoPagado ?? alumno.montoMensual,
          fechaPago: pago.fechaPago ?? '',
          telefono: alumno.telefono,
        });
      }
    }

    const clave = (c: Comprobante) => c.fechaPago || `${c.anio}-${String(c.mes).padStart(2, '0')}`;
    return resultado.sort((a, b) => clave(b).localeCompare(clave(a)) || b.numero - a.numero);
  }

  private proximoNumeroComprobante(): number {
    let maximo = 0;
    for (const alumno of this.getAll()) {
      for (const pago of alumno.pagos) {
        if (pago.numeroComprobante && pago.numeroComprobante > maximo) {
          maximo = pago.numeroComprobante;
        }
      }
    }
    return maximo + 1;
  }

  /**
   * Numera los pagos cobrados antes de que existieran los comprobantes.
   * Devuelve true si asignó algún número (hay que persistir).
   */
  private asegurarNumerosComprobantes(alumnos: Alumno[]): boolean {
    let maximo = 0;
    const pendientes: Pago[] = [];
    for (const alumno of alumnos) {
      for (const pago of alumno.pagos) {
        if (!pago.pagado) continue;
        if (typeof pago.numeroComprobante === 'number') {
          maximo = Math.max(maximo, pago.numeroComprobante);
        } else {
          pendientes.push(pago);
        }
      }
    }
    if (pendientes.length === 0) return false;

    // Orden cronológico: los pagos más viejos reciben los números más bajos.
    pendientes.sort((a, b) => {
      const fechaA = a.fechaPago ?? '';
      const fechaB = b.fechaPago ?? '';
      return fechaA.localeCompare(fechaB) || a.anio * 12 + a.mes - (b.anio * 12 + b.mes);
    });
    for (const pago of pendientes) {
      pago.numeroComprobante = ++maximo;
    }
    return true;
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

    // El vencimiento del mes es el día de cobro (diaEntrada). Si el alumno se registró
    // este mes DESPUÉS de ese día, se cuenta desde el registro (no se deuda por días
    // previos al alta); si se registró antes, rige el día de cobro.
    const diaRegistroActual = this.diaRegistroEnMes(piso, anio, mes);
    const diaPagoMesActual = Math.min(alumno.diaEntrada, new Date(anio, mes, 0).getDate());
    const diaInicioMesActual = Math.max(diaRegistroActual, diaPagoMesActual);

    while (!this.estaPagadoMes(alumno, m, a)) {
      const indiceMes = a * 12 + (m - 1);
      if (indiceMes < mesPiso) break; // no deudar antes del alta

      const ultimoDia = new Date(a, m, 0).getDate();
      let diaInicio: number;
      if (primerMesImpago) {
        diaInicio = diaInicioMesActual;
      } else if (indiceMes === mesPiso) {
        // Mes de registro: rige el día de cobro, salvo que el registro sea posterior
        diaInicio = Math.max(Math.min(piso.getDate(), ultimoDia), Math.min(alumno.diaEntrada, ultimoDia));
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
      // La cuota de este mes todavía no venció: mostramos cuántos días faltan
      // (p. ej. si el día de cobro es posterior a hoy). Se compara día contra
      // día (medianoche) para que el conteo no dependa de la hora actual.
      const fechaVencimiento = new Date(anio, mes - 1, diaInicioMesActual);
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      const diasFaltantes = Math.round((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diasFaltantes > 0) {
        const texto = diasFaltantes === 1 ? 'Falta 1 día' : `Faltan ${diasFaltantes} días`;
        return { texto, pasado: false, pagoAlDia: false };
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
      montoCobrado: pagados.reduce((sum, a) => sum + this.getMontoPago(a, mes, anio), 0),
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
        .reduce((sum, a) => sum + this.getMontoPago(a, mes, anio), 0);
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
      .reduce((sum, a) => sum + this.getMontoPago(a, mesActual, anioActual), 0);
    const anterior = alumnos
      .filter((a) => this.estaPagadoMes(a, mesAnterior, anioAnterior))
      .reduce((sum, a) => sum + this.getMontoPago(a, mesAnterior, anioAnterior), 0);

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

  /**
   * Meses impagos del alumno, del más antiguo al más reciente, para armar el
   * estado de cuenta. Respeta el piso de registro y cuenta la cuota del mes
   * actual aunque todavía no haya vencido (misma regla que getDeudaAlumno).
   */
  getMesesImpagosLista(alumno: Alumno): MesImpago[] {
    const ahora = new Date();
    const piso = this.fechaPiso(alumno);
    const mesPiso = piso.getFullYear() * 12 + piso.getMonth();
    const resultado: MesImpago[] = [];
    let mes = ahora.getMonth() + 1;
    let anio = ahora.getFullYear();

    while (!this.estaPagadoMes(alumno, mes, anio)) {
      const indiceMes = anio * 12 + (mes - 1);
      if (indiceMes < mesPiso) break; // no se cuentan meses anteriores al alta
      resultado.push({ mes, anio, monto: alumno.montoMensual });
      mes--;
      if (mes === 0) {
        mes = 12;
        anio--;
      }
      if (resultado.length > 120) break;
    }

    return resultado.reverse();
  }

  /**
   * Consolida la cuenta de un alumno: deuda, cuotas impagas, pagos con su
   * comprobante y totales del año en curso. Devuelve null si no existe.
   */
  getEstadoCuenta(alumnoId: number): EstadoCuenta | null {
    const alumno = this.getById(alumnoId);
    if (!alumno) return null;

    const pagos: PagoCuenta[] = alumno.pagos
      .filter((p) => p.pagado)
      .map((p) => ({
        mes: p.mes,
        anio: p.anio,
        monto: p.montoPagado ?? alumno.montoMensual,
        fechaPago: p.fechaPago,
        numeroComprobante: p.numeroComprobante,
      }))
      .sort((a, b) => b.anio * 12 + b.mes - (a.anio * 12 + a.mes));

    const anio = new Date().getFullYear();
    const delAnio = pagos.filter((p) => p.anio === anio);

    return {
      alumno,
      deuda: this.getDeudaAlumno(alumno),
      impagos: this.getMesesImpagosLista(alumno),
      pagos,
      historialMontos: [...(alumno.historialMontos ?? [])].reverse(),
      totalCobrado: pagos.reduce((suma, p) => suma + p.monto, 0),
      cantidadPagos: pagos.length,
      anio: {
        numero: anio,
        cobrado: delAnio.reduce((suma, p) => suma + p.monto, 0),
        cantidad: delAnio.length,
      },
    };
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
          porMes[m - 1] += this.getMontoPago(a, m, anio);
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

  private readonly BACKUP_MARCA = 'CLASES-BACKUP-V1:';

  /**
   * Genera el contenido del respaldo: el JSON completo de los alumnos codificado
   * en base64 con una marca de formato. Al estar codificado, ningún editor,
   * planilla o proceso de compartido puede corromper acentos ni reordenar campos.
   */
  exportar(): string {
    const json = JSON.stringify({ version: 1, exportado: new Date().toISOString(), alumnos: this.getAll() });
    return this.BACKUP_MARCA + btoa(unescape(encodeURIComponent(json)));
  }

  /**
   * Convierte un respaldo en el JSON interno. Acepta el formato actual
   * (marca + base64), un base64 suelto y el JSON de versiones anteriores;
   * devuelve null si el contenido no es un respaldo válido.
   */
  private backupAJson(contenido: string): string | null {
    const texto = (contenido ?? '').trim().replace(/^\uFEFF/, '');
    if (!texto) return null;
    const base64 = texto.startsWith(this.BACKUP_MARCA) ? texto.slice(this.BACKUP_MARCA.length).trim() : texto;
    if (base64.startsWith('{') || base64.startsWith('[')) {
      return base64; // respaldo viejo o pegado a mano: se valida al parsear
    }
    try {
      // atob entrega solo latín-1: los bytes se reinterpretan como UTF-8,
      // así los acentos (á, ñ, Sí) viajan intactos de un dispositivo a otro.
      const binario = atob(base64);
      const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }



  importar(backup: string, reemplazar: boolean): { ok: boolean; cantidad: number; error?: string } {
    const json = this.backupAJson(backup);
    if (!json) {
      return { ok: false, cantidad: 0, error: 'El contenido no es un respaldo válido' };
    }
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
        // Ids negativos (respaldos muy viejos): se les asigna uno real
        let contador = 0;
        this.storage.setData(this.STORAGE_KEY, validos.map((a) => (a.id >= 0 ? a : { ...a, id: Date.now() + ++contador })));
      } else {
        const actuales = this.getAll();
        const ids = new Set(actuales.map((a) => a.id));
        for (const alumno of validos) {
          if (alumno.id < 0) {
            // Id provisorio: evitar duplicados por nombre completo
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
      return { ok: false, cantidad: 0, error: 'El respaldo no contiene datos válidos' };
    }
  }

  private generarIdNuevo(alumnos: Alumno[], ids: Set<number>): number {
    let id = Date.now();
    while (alumnos.some((a) => a.id === id) || ids.has(id)) id++;
    return id;
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
      const totalMes = activos.reduce((s, a) => s + this.getMontoPago(a, mes, anio), 0);
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
