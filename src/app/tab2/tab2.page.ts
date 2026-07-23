import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendar, checkmarkCircle, closeCircle, time } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge],
})
export class Tab2Page {
  private alumnoService = inject(AlumnoService);
  alumnos: (Alumno & { diasInfo: { texto: string; pasado: boolean }; pagoAlDia: boolean })[] = [];

  constructor() {
    addIcons({ calendar, checkmarkCircle, closeCircle, time });
  }

  ionViewDidEnter() {
    this.cargar();
  }

  private cargar() {
    const activos = this.alumnoService.getActivos();
    const ahora = new Date();
    const mes = ahora.getMonth() + 1;
    const anio = ahora.getFullYear();

    this.alumnos = activos.map((a) => {
      const pagoAlDia = this.alumnoService.estaPagadoMes(a, mes, anio);
      return { ...a, diasInfo: this.calcularDias(a), pagoAlDia };
    });
  }

  private calcularDias(alumno: Alumno): { texto: string; pasado: boolean } {
    const hoy = new Date();
    const diaPago = alumno.diaEntrada;
    const fechaPago = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);

    if (hoy.toDateString() === fechaPago.toDateString()) {
      return { texto: 'Vence hoy', pasado: false };
    }
    if (hoy > fechaPago) {
      const diff = Math.floor((hoy.getTime() - fechaPago.getTime()) / (1000 * 60 * 60 * 24));
      return { texto: `Venció hace ${diff} día${diff !== 1 ? 's' : ''}`, pasado: true };
    }
    const diff = Math.floor((fechaPago.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return { texto: `Faltan ${diff} día${diff !== 1 ? 's' : ''}`, pasado: false };
  }
}
