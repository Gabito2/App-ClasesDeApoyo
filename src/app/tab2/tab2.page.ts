import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSearchbar, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendar, checkmarkCircle, closeCircle, time, search, logoWhatsapp } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';
import { WhatsappService } from '../services/whatsapp.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSearchbar, IonButton],
})
export class Tab2Page {
  private alumnoService = inject(AlumnoService);
  private whatsappService = inject(WhatsappService);
  alumnos: (Alumno & { diasInfo: { texto: string; pasado: boolean }; pagoAlDia: boolean })[] = [];
  busqueda = '';

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

  ionViewWillEnter() {
    this.cargar();
  }

  recordarWhatsApp(alumno: Alumno, event: Event) {
    event.stopPropagation();
    this.whatsappService.abrir(alumno);
  }

  private cargar() {
    this.alumnos = this.alumnoService.getActivos().map((a) => {
      const estado = this.alumnoService.getEstadoPagoMes(a);
      return { ...a, diasInfo: { texto: estado.texto, pasado: estado.pasado }, pagoAlDia: estado.pagoAlDia };
    });
  }
}
