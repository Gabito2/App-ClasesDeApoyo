import { Injectable, inject } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AlumnoService } from './alumno.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private alumnoService = inject(AlumnoService);
  private settingsService = inject(SettingsService);

  async checkAndSchedule(): Promise<void> {
    try {
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

      const { diasAnticipacion, horaNotificacion } = this.settingsService.get();
      const partes = horaNotificacion.split(':');
      const hora = Number.isFinite(Number(partes[0])) ? Number(partes[0]) : 12;
      const minuto = Number.isFinite(Number(partes[1])) ? Number(partes[1]) : 0;

      const alumnos = this.alumnoService.getActivos();
      const ahora = new Date();
      const mesActual = ahora.getMonth() + 1;
      const anioActual = ahora.getFullYear();
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

      for (const [index, alumno] of alumnos.entries()) {
        if (this.alumnoService.estaPagadoMes(alumno, mesActual, anioActual)) continue;

        // Si el día de pago no existe en el mes (ej. 31 en febrero), se ajusta al último día
        const ultimoDiaMes = new Date(anioActual, mesActual, 0).getDate();
        const diaVencimiento = Math.min(alumno.diaEntrada, ultimoDiaMes);
        const fechaVencimiento = new Date(anioActual, mesActual - 1, diaVencimiento);
        const diffDias = Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        const nombreCompleto = `${alumno.nombre}${alumno.apellido ? ' ' + alumno.apellido : ''}`;
        const idBase = (index + 1) * 100 + mesActual;

        // SIEMPRE agenda la notificación del día del vencimiento
        const fechaVence = new Date(fechaVencimiento);
        fechaVence.setHours(hora, minuto, 0, 0);
        if (fechaVence > ahora) {
          await this.programar(idBase + 50, `Cuota vence hoy - ${nombreCompleto}`, fechaVence);
        }

        if (diffDias > diasAnticipacion) {
          // Falta más de N días: agenda recordatorio anticipado (N días antes del vencimiento)
          const fechaRecordatorio = new Date(fechaVencimiento);
          fechaRecordatorio.setDate(fechaRecordatorio.getDate() - diasAnticipacion);
          fechaRecordatorio.setHours(hora, minuto, 0, 0);
          if (fechaRecordatorio > ahora) {
            await this.programar(idBase, `Cuota por vencer - ${nombreCompleto}`, fechaRecordatorio);
          }
        } else if (diffDias >= 0) {
          // Dentro de la ventana de anticipación pero todavía no vence: recordatorio diario
          const fechaNotificacion = new Date(hoy);
          fechaNotificacion.setHours(hora, minuto, 0, 0);
          if (fechaNotificacion <= ahora) {
            fechaNotificacion.setDate(fechaNotificacion.getDate() + 1);
          }
          // Solo agendar si la notificación es antes del vencimiento
          if (fechaNotificacion < fechaVence) {
            const diffDiasNotif = Math.ceil(
              (fechaVencimiento.getTime() - fechaNotificacion.getTime()) / (1000 * 60 * 60 * 24)
            );
            const titulo = diffDiasNotif > 0
              ? `Cuota vence en ${diffDiasNotif} día${diffDiasNotif > 1 ? 's' : ''} - ${nombreCompleto}`
              : `Cuota vence hoy - ${nombreCompleto}`;
            await this.programar(idBase, titulo, fechaNotificacion);
          }
        } else {
          // Ya venció (diffDias < 0): recordatorio diario de cuota vencida
          const fechaNotificacion = new Date(hoy);
          fechaNotificacion.setHours(hora, minuto, 0, 0);
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
