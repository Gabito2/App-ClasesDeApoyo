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

      await LocalNotifications.cancel({ notifications: (await LocalNotifications.getPending()).notifications });

      const { diasAnticipacion, horaNotificacion } = this.settingsService.get();
      const partes = horaNotificacion.split(':');
      const hora = Number(partes[0]) || 12;
      const minuto = Number(partes[1]) || 0;

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

        if (diffDias > diasAnticipacion) {
          // Recordatorio anticipado (N días antes) + recordatorio el día del vencimiento
          const fechaRecordatorio = new Date(fechaVencimiento);
          fechaRecordatorio.setDate(fechaRecordatorio.getDate() - diasAnticipacion);
          fechaRecordatorio.setHours(hora, minuto, 0, 0);

          const fechaVence = new Date(fechaVencimiento);
          fechaVence.setHours(hora, minuto, 0, 0);

          await this.programar(idBase, `Cuota por vencer - ${nombreCompleto}`, fechaRecordatorio);
          await this.programar(idBase + 50, `Cuota vence hoy - ${nombreCompleto}`, fechaVence);
        } else {
          const fechaNotificacion = new Date(hoy);
          fechaNotificacion.setHours(hora, minuto, 0, 0);
          if (fechaNotificacion <= ahora) {
            fechaNotificacion.setHours(ahora.getHours() + 1, 0, 0, 0);
          }

          const titulo = diffDias > 0
            ? `Cuota vence en ${diffDias} día${diffDias > 1 ? 's' : ''} - ${nombreCompleto}`
            : diffDias === 0
              ? `Cuota vence hoy - ${nombreCompleto}`
              : `Cuota vencida - ${nombreCompleto}`;

          await this.programar(idBase, titulo, fechaNotificacion);
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
