import { Injectable, inject } from '@angular/core';
import { Alumno } from '../models/alumno.model';
import { AlumnoService } from './alumno.service';

/** Tipo de mensaje: 'pendiente' si la cuota no venció, 'vencido' si venció y 'deuda' para el resumen completo de cuenta. */
export type TipoMensaje = 'pendiente' | 'vencido' | 'deuda';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private alumnoService = inject(AlumnoService);
  private readonly MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  crearEnlace(alumno: Alumno, tipo: TipoMensaje = 'pendiente'): string | null {
    if (tipo === 'deuda') return this.crearEnlaceEstadoCuenta(alumno);
    const telefono = alumno.telefono?.replace(/\D/g, '');
    if (!telefono) return null;
    const mensaje = tipo === 'vencido' ? this.armarMensajeVencido(alumno) : this.armarMensaje(alumno);
    return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
  }

  abrir(alumno: Alumno, tipo: TipoMensaje = 'pendiente'): boolean {
    const url = this.crearEnlace(alumno, tipo);
    if (!url) return false;
    window.open(url, '_system');
    return true;
  }

  /** Mensaje para alumnos cuya cuota todavía no venció. */
  private armarMensaje(alumno: Alumno): string {
    const ahora = new Date();
    const mes = this.MESES[ahora.getMonth()];
    const monto = alumno.montoMensual.toLocaleString('es-AR');
    const dia = this.diaPagoMes(alumno, ahora.getFullYear(), ahora.getMonth() + 1);
    return `Hola ${alumno.nombre} ${alumno.apellido} ! Te recuerdo que la cuota de ${mes} ($${monto}) vence el día ${dia}. ¡Gracias!`;
  }

  /**
   * Mensaje para alumnos cuya cuota ya venció. Referencia el mes impago más
   * antiguo (ej. si adeuda septiembre y octubre, menciona septiembre).
   */
  private armarMensajeVencido(alumno: Alumno): string {
    const impagos = Math.max(0, this.alumnoService.getMesesImpagos(alumno) - 1);
    const ahora = new Date();
    const mesVencido = new Date(ahora.getFullYear(), ahora.getMonth() - impagos, 1);
    const mes = this.MESES[mesVencido.getMonth()];
    const monto = alumno.montoMensual.toLocaleString('es-AR');
    const dia = this.diaPagoMes(alumno, mesVencido.getFullYear(), mesVencido.getMonth() + 1);
    return `Hola ${alumno.nombre} ${alumno.apellido} !Te escribo para recordarte que la cuota de ${mes} por $${monto} venció el día ${dia}. ¡Gracias!`;
  }

  /** Enlace con el resumen de cuenta completo, o null si no hay teléfono. */
  crearEnlaceEstadoCuenta(alumno: Alumno): string | null {
    const telefono = alumno.telefono?.replace(/\D/g, '');
    if (!telefono) return null;
    return `https://wa.me/${telefono}?text=${encodeURIComponent(this.textoEstadoCuenta(alumno))}`;
  }

  abrirEstadoCuenta(alumno: Alumno): boolean {
    const url = this.crearEnlaceEstadoCuenta(alumno);
    if (!url) return false;
    window.open(url, '_system');
    return true;
  }

  /**
   * Resumen de cuenta listo para WhatsApp: cuota, total pagado y el detalle de
   * las cuotas pendientes. Sirve como reclamo cuando hay varios meses de deuda.
   */
  textoEstadoCuenta(alumno: Alumno): string {
    const nombre = `${alumno.nombre} ${alumno.apellido}`.trim();
    const ahora = new Date();
    const dia = this.diaPagoMes(alumno, ahora.getFullYear(), ahora.getMonth() + 1);
    const monto = alumno.montoMensual.toLocaleString('es-AR');
    const lineas = [
      `Hola ${nombre}! Te paso el estado de tu cuenta:`,
      '',
      `*Cuota:* $${monto} por mes (vence el día ${dia})`,
    ];

    const cuenta = this.alumnoService.getEstadoCuenta(alumno.id);
    if (cuenta) {
      const pagado = cuenta.totalCobrado.toLocaleString('es-AR');
      lineas.push(`*Pagado hasta hoy:* $${pagado} (${cuenta.cantidadPagos} ${cuenta.cantidadPagos === 1 ? 'cuota' : 'cuotas'})`);

      if (cuenta.impagos.length === 0) {
        lineas.push('', 'No tenés cuotas pendientes. ¡Gracias!');
      } else {
        const deuda = cuenta.deuda.monto.toLocaleString('es-AR');
        lineas.push(
          `*Deuda:* $${deuda} (${cuenta.deuda.meses} ${cuenta.deuda.meses === 1 ? 'cuota' : 'cuotas'})`,
          '',
          '*Cuotas pendientes:*'
        );
        for (const impago of cuenta.impagos) {
          const montoImpago = impago.monto.toLocaleString('es-AR');
          lineas.push(`• ${this.MESES[impago.mes - 1]} ${impago.anio} — $${montoImpago}`);
        }
      }
    }

    lineas.push('', 'Clases de Apoyo');
    return lineas.join('\n');
  }

  /** Ajusta el día de pago al último día del mes si el día no existe (ej. 31 en febrero). */
  private diaPagoMes(alumno: Alumno, anio: number, mes: number): number {
    const ultimoDia = new Date(anio, mes, 0).getDate();
    return Math.min(alumno.diaEntrada, ultimoDia);
  }
}