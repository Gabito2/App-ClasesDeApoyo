import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { statsChart, people, cash, checkmarkCircle, closeCircle, trendingUp, bulb } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonIcon, IonGrid, IonRow, IonCol],
})
export class Tab4Page {
  private alumnoService = inject(AlumnoService);

  stats = { total: 0, pagados: 0, pendientes: 0, montoCobrado: 0, montoPendiente: 0 };
  recomendacion = { texto: '', tipo: 'info' as 'positivo' | 'atencion' | 'info' };

  constructor() {
    addIcons({ statsChart, people, cash, checkmarkCircle, closeCircle, trendingUp, bulb });
  }

  ionViewWillEnter() {
    this.stats = this.alumnoService.getStats();
    this.recomendacion = this.alumnoService.getRecomendacion();
  }

  get porcentajeCobro(): number {
    if (this.stats.total === 0) return 0;
    return Math.round((this.stats.pagados / this.stats.total) * 100);
  }

  get totalMes(): number {
    return this.stats.montoCobrado + this.stats.montoPendiente;
  }
}
