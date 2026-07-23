import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonText, IonDatetime } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAdd, cash, calendar } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonText, IonDatetime],
})
export class Tab1Page {
  private alumnoService = inject(AlumnoService);

  nombre = '';
  fechaSeleccionada: string = new Date().toISOString();
  diaEntrada: number = new Date().getDate();
  montoMensual: number = 0;
  mensaje = '';

  constructor() {
    addIcons({ personAdd, cash, calendar });
  }

  onFechaChange(event: any) {
    const date = new Date(event.detail.value);
    this.diaEntrada = date.getDate();
  }

  guardar() {
    if (!this.nombre.trim() || this.montoMensual <= 0) {
      this.mensaje = 'Completá todos los campos';
      return;
    }
    this.alumnoService.crear({
      nombre: this.nombre.trim(),
      diaEntrada: this.diaEntrada,
      montoMensual: this.montoMensual,
    });
    this.mensaje = `¡${this.nombre} agregado!`;
    this.nombre = '';
    this.diaEntrada = new Date().getDate();
    this.fechaSeleccionada = new Date().toISOString();
    this.montoMensual = 0;
  }
}
