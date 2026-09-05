import { Injectable } from '@angular/core';
import { Alumno } from '../models/alumno.model';

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  crearEnlace(alumno: Alumno): string | null {
    const telefono = alumno.telefono?.replace(/\D/g, '');
    if (!telefono) return null;
    const mensaje = this.armarMensaje(alumno);
    return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
  }

  abrir(alumno: Alumno): boolean {
    const url = this.crearEnlace(alumno);
    if (!url) return false;
    window.open(url, '_system');
    return true;
  }

  private armarMensaje(alumno: Alumno): string {
    const ahora = new Date();
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mes = meses[ahora.getMonth()];
    const monto = alumno.montoMensual.toLocaleString('es-AR');
    return `Hola ${alumno.nombre}! Te recuerdo que la cuota de ${mes} ($${monto}) vence el día ${alumno.diaEntrada}. ¡Gracias!`;
  }
}