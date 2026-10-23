import { Injectable, inject } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlumnoService } from './alumno.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private alumnoService = inject(AlumnoService);
  private settings = inject(SettingsService);

  async checkAndSchedule(): Promise<void> {
    try {
      // Si el profe apagó los recordatorios, se cancelan los avisos pendientes
      // para que no siga apareciendo uno ya programado.
      if (!this.settings.get().recordatorios) {
        const pendientes = await LocalNotifications.getPending();
        await LocalNotifications.cancel({ notifications: pendientes.notifications });
        return;
      }

      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        if (result.display !== 'granted') return;
      }

      // Garantiza que el canal exista (idempotente)
      await LocalNotifications.createChannel({
        id: 'cuotas',
        name: 'Cuotas por vencer',
        description: 'Notificaciones de cuotas de alumnos por vencer o vencidas',
        importance: 5, // IMPORTANCE_HIGH
        visibility: 1, // VISIBILITY_PUBLIC
        vibration: true,
      });

      await LocalNotifications.cancel({ notifications: (await LocalNotifications.getPending()).notifications });

      // El recordatorio se envía el mismo día del vencimiento, a la hora elegida
      // en Ajustes (12:00 por defecto).
      const HORA = this.settings.get().horaRecordatorio;
      const MINUTO = 0;

      const alumnos = this.alumnoService.getActivos();
      const ahora = new Date();
      const mesActual = ahora.getMonth() + 1;
      const anioActual = ahora.getFullYear();

      for (const [index, alumno] of alumnos.entries()) {
        if (this.alumnoService.estaPagadoMes(alumno, mesActual, anioActual)) continue;

        // Si el día de pago no existe en el mes (ej. 31 en febrero), se ajusta al último día
        const ultimoDiaMes = new Date(anioActual, mesActual, 0).getDate();
        const diaVencimiento = Math.min(alumno.diaEntrada, ultimoDiaMes);
        const vencimiento = new Date(anioActual, mesActual - 1, diaVencimiento, HORA, MINUTO, 0, 0);

        const nombreCompleto = `${alumno.nombre}${alumno.apellido ? ' ' + alumno.apellido : ''}`;
        const idBase = (index + 1) * 100 + mesActual;

        if (vencimiento > ahora) {
          // Todavía no venció: se avisa el mismo día del vencimiento a las 12:00
          await this.programar(idBase, `Cuota vence hoy - ${nombreCompleto}`, vencimiento);
        } else {
          // Ya venció (o ya pasaron las 12:00 de hoy): recordatorio diario de cuota vencida
          const fechaNotificacion = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), HORA, MINUTO, 0, 0);
          if (fechaNotificacion <= ahora) {
            fechaNotificacion.setDate(fechaNotificacion.getDate() + 1);
          }
          await this.programar(idBase, `Cuota vencida - ${nombreCompleto}`, fechaNotificacion);
        }
      }
    } catch (e) {
      console.error('Error al programar notificaciones:', e);
    }
  }

  private async programar(id: number, titulo: string, fecha: Date): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: 'Clases de Apoyo',
        body: titulo,
        schedule: { at: fecha, allowWhileIdle: true },
        smallIcon: 'ic_stat_icon',
        largeIcon: 'ic_launcher',
        channelId: 'cuotas',
      }],
    });
  }
}
