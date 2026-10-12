import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonRange, IonInput, IonToast, IonAlert, IonRadioGroup, IonRadio } from '@ionic/angular/standalone';
import { RangeCustomEvent, InputCustomEvent, RadioGroupCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { notifications, download, cloudUpload, shareSocial, chevronForward, apps } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AlumnoService } from '../services/alumno.service';
import { SettingsService } from '../services/settings.service';
import { NotificationService } from '../services/notification.service';
import { WidgetService } from '../services/widget.service';
import { ThemeService, TEMAS, Tema } from '../services/theme.service';

@Component({
  selector: 'app-tab5',
  templateUrl: 'tab5.page.html',
  styleUrls: ['tab5.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonRange, IonInput, IonToast, IonAlert, IonRadioGroup, IonRadio],
})
export class Tab5Page {
  private alumnoService = inject(AlumnoService);
  private settingsService = inject(SettingsService);
  private notificationService = inject(NotificationService);
  private widgetService = inject(WidgetService);
  private themeService = inject(ThemeService);

  private importInput = viewChild.required<ElementRef<HTMLInputElement>>('archivoInput');

  diasAnticipacion = 3;
  horaNotificacion = '12:00';
  temaSeleccionado = 'bordeaux';
  temas: Tema[] = TEMAS;

  toastOpen = false;
  toastMsg = '';
  confirmarReemplazo = false;
  importContenido = '';

  alertButtons = [
    { text: 'Cancelar', role: 'cancel' },
    {
      text: 'Agregar',
      handler: () => this.importar(false),
    },
    {
      text: 'Reemplazar todo',
      role: 'destructive',
      handler: () => this.importar(true),
    },
  ];

  constructor() {
    addIcons({ notifications, download, cloudUpload, shareSocial, chevronForward, apps });
  }

  ionViewWillEnter() {
    const s = this.settingsService.get();
    this.diasAnticipacion = s.diasAnticipacion;
    this.horaNotificacion = s.horaNotificacion;
    this.temaSeleccionado = s.tema;
  }

  cambiarTema(event: RadioGroupCustomEvent) {
    const temaId = String(event.detail.value);
    this.settingsService.set({ tema: temaId });
    this.themeService.aplicar(temaId);
    this.mostrarToast(this.themeService.getById(temaId).nombre + ' aplicado');
  }

  async anclarWidget() {
    const ok = await this.widgetService.pedirAnclar();
    this.mostrarToast(ok ? 'Elegí el tamaño del widget en la pantalla de inicio' : 'El widget no se pudo agregar en este dispositivo');
  }

  onDiasChange(event: RangeCustomEvent) {
    this.settingsService.set({ diasAnticipacion: event.detail.value as number });
    this.notificationService.checkAndSchedule();
  }

  onHoraChange(event: InputCustomEvent) {
    this.settingsService.set({ horaNotificacion: String(event.detail.value ?? '') });
    this.notificationService.checkAndSchedule();
  }

  async exportar() {
    const contenido = this.alumnoService.exportar();
    const nombre = this.generarNombreArchivo('respaldo_clases', 'backup');
    const ok = await this.compartirArchivo(nombre, contenido, 'application/octet-stream');
    this.mostrarToast(ok
      ? `Respaldo creado (${nombre}). Guardalo en Archivos o mandalo por WhatsApp.`
      : 'No se pudo exportar el respaldo');
  }

  /**
   * Crea un archivo real con el contenido y lo comparte.
   * En Android/iOS escribe el archivo en caché y abre el panel de compartir;
   * en web (navegador) descarga el archivo directamente.
   */
  private async compartirArchivo(nombre: string, contenido: string, mime: string): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { uri } = await Filesystem.writeFile({
          path: nombre,
          data: contenido,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: nombre,
          files: [uri],
          dialogTitle: 'Compartir archivo',
        });
        return true;
      } catch {
        return false;
      }
    }

    // Web: descargar el archivo con el navegador
    try {
      const blob = new Blob([contenido], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  private generarNombreArchivo(base: string, extension: string): string {
    const ahora = new Date();
    const fecha = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    return `${base}_${fecha}.${extension}`;
  }

  solicitarImportar() {
    this.importInput().nativeElement.click();
  }

  async onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // Permite volver a elegir el mismo archivo
    if (!archivo) return;

    try {
      // Contenido legible: el texto llega tal cual (los respaldos son ASCII/base64,
      // inmunes a problemas de codificación).
      this.importContenido = await archivo.text();
    } catch {
      this.mostrarToast('No se pudo leer el archivo');
      return;
    }
    this.confirmarImportar();
  }

  confirmarImportar() {
    if (!this.importContenido.trim()) {
      this.mostrarToast('El archivo está vacío o no se leyó bien');
      return;
    }
    this.confirmarReemplazo = true;
  }

  importar(reemplazar: boolean) {
    const res = this.alumnoService.importar(this.importContenido, reemplazar);
    if (res.ok) {
      this.mostrarToast(reemplazar ? `Datos reemplazados (${res.cantidad} alumnos)` : `${res.cantidad} alumnos agregados`);
      this.importContenido = '';
      this.notificationService.checkAndSchedule();
      this.widgetService.actualizar();
    } else {
      this.mostrarToast(res.error || 'Error al importar');
    }
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
