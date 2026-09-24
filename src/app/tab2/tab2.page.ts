import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSearchbar, IonButton, IonButtons, IonAlert, IonToast } from '@ionic/angular/standalone';
import { AlertButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendar, checkmarkCircle, closeCircle, time, search, logoWhatsapp } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';
import { WhatsappService, TipoMensaje } from '../services/whatsapp.service';

type AlumnoVencimiento = Alumno & { diasInfo: { texto: string; pasado: boolean }; pagoAlDia: boolean };

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSearchbar, IonButton, IonButtons, IonAlert, IonToast],
})
export class Tab2Page {
  private alumnoService = inject(AlumnoService);
  private whatsappService = inject(WhatsappService);
  alumnos: AlumnoVencimiento[] = [];
  busqueda = '';

  isBulkAlertOpen = false;
  bulkAlertButtons: AlertButton[] = [
    { text: 'Cancelar', role: 'cancel' },
    { text: 'Enviar', handler: () => this.enviarRecordatorioMasivo() },
  ];

  toastOpen = false;
  toastMsg = '';

  constructor() {
    addIcons({ calendar, checkmarkCircle, closeCircle, time, search, logoWhatsapp });
  }

  get alumnosFiltrados() {
    if (!this.busqueda.trim()) return this.alumnos;
    const term = this.busqueda.toLowerCase().trim();
    return this.alumnos.filter(
      (a) => `${a.nombre} ${a.apellido}`.toLowerCase().includes(term)
    );
  }

  /** Alumnos con cuota vencida que tienen teléfono de WhatsApp. */
  get vencidosConTelefono(): AlumnoVencimiento[] {
    return this.alumnos.filter((a) => a.diasInfo.pasado && a.telefono);
  }

  ionViewWillEnter() {
    this.cargar();
  }

  recordarWhatsApp(alumno: AlumnoVencimiento, event: Event) {
    event.stopPropagation();
    const tipo: TipoMensaje = alumno.diasInfo.pasado ? 'vencido' : 'pendiente';
    this.whatsappService.abrir(alumno, tipo);
  }

  recordarVencidosWhatsApp() {
    const vencidos = this.vencidosConTelefono;
    if (vencidos.length === 0) {
      this.mostrarToast('No hay alumnos vencidos con teléfono');
      return;
    }
    this.isBulkAlertOpen = true;
  }

  enviarRecordatorioMasivo() {
    const vencidos = this.vencidosConTelefono;
    if (vencidos.length === 0) return;
    // Se abre WhatsApp una vez por alumno, con una pequeña pausa entre conversaciones
    vencidos.forEach((a, i) => {
      setTimeout(() => this.whatsappService.abrir(a, 'vencido'), i * 1500);
    });
    this.mostrarToast(`Se abrieron ${vencidos.length} conversación${vencidos.length === 1 ? '' : 'es'} de WhatsApp`);
  }

  private cargar() {
    this.alumnos = this.alumnoService.getActivos().map((a) => {
      const estado = this.alumnoService.getEstadoPagoMes(a);
      return { ...a, diasInfo: { texto: estado.texto, pasado: estado.pasado }, pagoAlDia: estado.pagoAlDia };
    });
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}