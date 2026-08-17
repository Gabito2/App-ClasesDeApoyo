import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonRange, IonInput, IonButton, IonButtons, IonModal, IonTextarea, IonToast, IonAlert } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notifications, download, cloudUpload, copy, shareSocial, chevronForward } from 'ionicons/icons';
import { Share } from '@capacitor/share';
import { AlumnoService } from '../services/alumno.service';
import { SettingsService } from '../services/settings.service';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-tab5',
  templateUrl: 'tab5.page.html',
  styleUrls: ['tab5.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonRange, IonInput, IonButton, IonButtons, IonModal, IonTextarea, IonToast, IonAlert],
})
export class Tab5Page {
  private alumnoService = inject(AlumnoService);
  private settingsService = inject(SettingsService);
  private notificationService = inject(NotificationService);

  diasAnticipacion = 3;
  horaNotificacion = '12:00';

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
    addIcons({ notifications, download, cloudUpload, copy, shareSocial, chevronForward });
  }

  ionViewWillEnter() {
    const s = this.settingsService.get();
    this.diasAnticipacion = s.diasAnticipacion;
    this.horaNotificacion = s.horaNotificacion;
  }

  onDiasChange(event: any) {
    this.settingsService.set({ diasAnticipacion: Number(event.detail.value) });
    this.notificationService.checkAndSchedule();
  }

  onHoraChange(event: any) {
    this.settingsService.set({ horaNotificacion: String(event.detail.value) });
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
    try {
      await Share.share({
        title: 'Respaldo Clases de Apoyo',
        text: this.jsonExport,
        dialogTitle: 'Compartir respaldo',
      });
    } catch {
      this.mostrarToast('No se pudo compartir');
    }
  }

  solicitarImportar() {
    this.importOpen = true;
  }

  pedirReemplazo() {
    if (!this.jsonImport.trim()) {
      this.mostrarToast('Pegá el JSON del respaldo primero');
      return;
    }
    this.confirmarReemplazo = true;
  }

  importar(reemplazar: boolean) {
    if (!this.jsonImport.trim()) {
      this.mostrarToast('Pegá el JSON del respaldo primero');
      return;
    }
    const res = this.alumnoService.importar(this.jsonImport, reemplazar);
    if (res.ok) {
      this.mostrarToast(reemplazar ? `Datos reemplazados (${res.cantidad} alumnos)` : `${res.cantidad} alumnos agregados`);
      this.jsonImport = '';
      this.importOpen = false;
      this.notificationService.checkAndSchedule();
    } else {
      this.mostrarToast(res.error || 'Error al importar');
    }
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
