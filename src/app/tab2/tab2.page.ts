import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSearchbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendar, checkmarkCircle, closeCircle, time, search } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSearchbar],
})
export class Tab2Page {
  private alumnoService = inject(AlumnoService);
  alumnos: (Alumno & { diasInfo: { texto: string; pasado: boolean }; pagoAlDia: boolean })[] = [];
  busqueda = '';

  constructor() {
    addIcons({ calendar, checkmarkCircle, closeCircle, time, search });
  }

  get alumnosFiltrados() {
    if (!this.busqueda.trim()) return this.alumnos;
    const term = this.busqueda.toLowerCase().trim();
    return this.alumnos.filter(
      (a) => `${a.nombre} ${a.apellido}`.toLowerCase().includes(term)
    );
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
      return { ...a, diasInfo: this.calcularDias(a, pagoAlDia), pagoAlDia };
    });
  }

  private calcularDias(alumno: Alumno, pagoAlDia: boolean): { texto: string; pasado: boolean } {
    if (pagoAlDia) {
      const pago = alumno.pagos.find(
        (p) => p.mes === new Date().getMonth() + 1 && p.anio === new Date().getFullYear()
      );
      return { texto: pago?.fechaPago ? 'Pagado' : 'Al día', pasado: false };
    }

    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const diaPago = Math.min(alumno.diaEntrada, ultimoDiaMes);
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
