import { Injectable, inject } from '@angular/core';
import { Alumno } from '../models/alumno.model';
import { AlumnoService } from './alumno.service';

/** Tipo de mensaje a enviar: 'pendiente' si la cuota todavía no venció, 'vencido' si ya venció. */
export type TipoMensaje = 'pendiente' | 'vencido';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private alumnoService = inject(AlumnoService);
  private readonly MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  crearEnlace(alumno: Alumno, tipo: TipoMensaje = 'pendiente'): string | null {
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
    return `Hola ${alumno.nombre}! Te recuerdo que la cuota de ${mes} ($${monto}) vence el día ${dia}. ¡Gracias!`;
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
    return `Hola ${alumno.nombre}! Te escribo para recordarte que la cuota de ${mes} por $${monto} venció el día ${dia}. ¡Por favor regularizala! ¡Gracias!`;
  }

  /** Ajusta el día de pago al último día del mes si el día no existe (ej. 31 en febrero). */
  private diaPagoMes(alumno: Alumno, anio: number, mes: number): number {
    const ultimoDia = new Date(anio, mes, 0).getDate();
    return Math.min(alumno.diaEntrada, ultimoDia);
  }
}