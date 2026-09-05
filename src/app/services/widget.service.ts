import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { WidgetBridgePlugin } from 'capacitor-widget-bridge';
import { AlumnoService } from './alumno.service';

const WIDGET_GROUP = 'cuotas_widget';
const WIDGET_KEY = 'cuotas_data';
const WIDGET_PROVIDER = 'com.clases.CuotasWidgetProvider';

interface WidgetAlumno {
  nombre: string;
  apellido: string;
  diaEntrada: number;
  monto: string;
  pagoMesActual: boolean;
}

interface WidgetData {
  actualizado: string;
  alumnos: WidgetAlumno[];
}

@Injectable({ providedIn: 'root' })
export class WidgetService {
  private alumnoService = inject(AlumnoService);
  private registrado = false;

  private async registrar(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android' || this.registrado) return;
    try {
      await WidgetBridgePlugin.setRegisteredWidgets({ widgets: [WIDGET_PROVIDER] });
      this.registrado = true;
    } catch (e) {
      console.error('Error registrando widget:', e);
    }
  }

  async actualizar(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      await this.registrar();
      const data = this.computarDatos();
      await WidgetBridgePlugin.setItem({ key: WIDGET_KEY, value: JSON.stringify(data), group: WIDGET_GROUP });
      await WidgetBridgePlugin.reloadTimelines({ ofKind: WIDGET_PROVIDER });
    } catch (e) {
      console.error('Error actualizando widget:', e);
    }
  }

  async pedirAnclar(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false;
    try {
      await this.registrar();
      const res = await WidgetBridgePlugin.requestWidget();
      return res.results === true;
    } catch (e) {
      console.error('Error al pedir anclar el widget:', e);
      return false;
    }
  }

  private computarDatos(): WidgetData {
    const alumnos = this.alumnoService.getActivos();
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    return {
      actualizado: ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      alumnos: alumnos.map((a) => ({
        nombre: a.nombre,
        apellido: a.apellido,
        diaEntrada: a.diaEntrada,
        monto: a.montoMensual.toLocaleString('es-AR'),
        pagoMesActual: this.alumnoService.estaPagadoMes(a, mes, anio),
      })),
    };
  }
}
