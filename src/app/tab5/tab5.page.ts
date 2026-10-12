import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonRange, IonInput, IonButton, IonButtons, IonModal, IonTextarea, IonToast, IonAlert, IonRadioGroup, IonRadio } from '@ionic/angular/standalone';
import { RangeCustomEvent, InputCustomEvent, RadioGroupCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { notifications, download, cloudUpload, copy, shareSocial, chevronForward, apps, document as documentIcon } from 'ionicons/icons';
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
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonRange, IonInput, IonButton, IonButtons, IonModal, IonTextarea, IonToast, IonAlert, IonRadioGroup, IonRadio],
})
export class Tab5Page {
  private alumnoService = inject(AlumnoService);
  private settingsService = inject(SettingsService);
  private notificationService = inject(NotificationService);
  private widgetService = inject(WidgetService);
  private themeService = inject(ThemeService);

  diasAnticipacion = 3;
  horaNotificacion = '12:00';
  temaSeleccionado = 'bordeaux';
  temas: Tema[] = TEMAS;

  exportOpen = false;
  importOpen = false;
  jsonExport = '';
  jsonImport = '';

  toastOpen = false;
  toastMsg = '';
  confirmarReemplazo = false;

  alertButtons = [
    { text: 'Cancelar', role: 'cancel' },
    {
      text: 'Reemplazar',
      role: 'destructive',
      handler: () => this.importar(true),
    },
  ];

  constructor() {
    addIcons({ notifications, download, cloudUpload, copy, shareSocial, chevronForward, apps, document: documentIcon });
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

  abrirExportar() {
    this.jsonExport = this.alumnoService.exportar();
    this.exportOpen = true;
  }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.jsonExport);
      this.mostrarToast('Respaldo copiado al portapapeles');
    } catch {
      // Fallback para WebViews sin API de portapapeles
      const ta = document.createElement('textarea');
      ta.value = this.jsonExport;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      this.mostrarToast(ok ? 'Respaldo copiado al portapapeles' : 'No se pudo copiar');
    }
  }

  async compartir() {
    const ok = await this.compartirArchivo(this.generarNombreArchivo('respaldo_clases', 'json'), this.jsonExport, 'application/json');
    if (!ok) this.mostrarToast('No se pudo compartir el archivo');
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
      const conCharset = /charset=/.test(mime) ? mime : `${mime};charset=utf-8`;
      const blob = new Blob([contenido], { type: conCharset });
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
    this.importOpen = true;
  }

  async onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // Permite volver a elegir el mismo archivo
    if (!archivo) return;

    let contenido: string;
    try {
      contenido = await this.leerArchivo(archivo);
    } catch {
      this.mostrarToast('No se pudo leer el archivo');
      return;
    }

    const esJson = archivo.name.toLowerCase().endsWith('.json') || /^\s*[{\[]/.test(contenido);
    if (esJson) {
      this.jsonImport = contenido;
      this.mostrarToast('Archivo JSON cargado. Elegí cómo importarlo.');
      return;
    }

    // CSV: se convierte al mismo formato de respaldo interno y se muestra en el editor
    const alumnos = this.alumnoService.csvAAlumnos(contenido);
    if (alumnos.length === 0) {
      this.mostrarToast('No se encontraron alumnos válidos en el archivo CSV');
      return;
    }
    this.jsonImport = JSON.stringify({ version: 1, exportado: new Date().toISOString(), alumnos }, null, 2);
    this.mostrarToast(`Archivo CSV cargado (${alumnos.length} alumnos). Elegí cómo importarlo.`);
  }

  private leerArchivo(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        try {
          // Se decodifica siempre como UTF-8, sin importar la configuración del equipo.
          resolve(new TextDecoder('utf-8').decode(buffer));
        } catch {
          resolve(String(buffer ?? ''));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsArrayBuffer(archivo);
    });
  }

  /**
   * Devuelve el contenido a importar como JSON. Si lo pegado es un CSV, lo
   * convierte al formato de respaldo interno.
   */
  private prepararImportacion(): string | null {
    const texto = this.jsonImport.trim();
    if (!texto) return null;
    if (/^[{\[]/.test(texto)) return texto;
    const alumnos = this.alumnoService.csvAAlumnos(texto);
    if (alumnos.length === 0) return null;
    return JSON.stringify({ version: 1, exportado: new Date().toISOString(), alumnos });
  }

  pedirReemplazo() {
    if (!this.prepararImportacion()) {
      this.mostrarToast('Pegá un respaldo JSON o un CSV válido primero');
      return;
    }
    this.confirmarReemplazo = true;
  }

  importar(reemplazar: boolean) {
    const json = this.prepararImportacion();
    if (!json) {
      this.mostrarToast('El contenido no es un respaldo JSON ni un CSV válido');
      return;
    }
    const res = this.alumnoService.importar(json, reemplazar);
    if (res.ok) {
      this.mostrarToast(reemplazar ? `Datos reemplazados (${res.cantidad} alumnos)` : `${res.cantidad} alumnos agregados`);
      this.jsonImport = '';
      this.importOpen = false;
      this.notificationService.checkAndSchedule();
      this.widgetService.actualizar();
    } else {
      this.mostrarToast(res.error || 'Error al importar');
    }
  }

  async exportarCSV() {
    const csv = this.alumnoService.exportarCSV();
    const ok = await this.compartirArchivo(this.generarNombreArchivo('alumnos', 'csv'), csv, 'text/csv');
    if (!ok) {
      // Fallback: copiar al portapapeles
      try {
        await navigator.clipboard.writeText(csv);
        this.mostrarToast('CSV copiado al portapapeles');
      } catch {
        const ta = document.createElement('textarea');
        ta.value = csv;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.mostrarToast('CSV copiado al portapapeles');
      }
    }
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
