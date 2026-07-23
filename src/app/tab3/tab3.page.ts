import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonGrid, IonRow, IonCol, IonCard, IonCardContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { people, checkmarkCircle, closeCircle, chevronForward } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';

interface MesInfo {
  label: string;
  mes: number;
  anio: number;
  pagado: boolean;
  esActual: boolean;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonGrid, IonRow, IonCol, IonCard, IonCardContent],
})
export class Tab3Page {
  private alumnoService = inject(AlumnoService);
  alumnos: Alumno[] = [];
  selectedAlumno: Alumno | null = null;
  meses: MesInfo[] = [];
  isModalOpen = false;

  private readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  constructor() {
    addIcons({ people, checkmarkCircle, closeCircle, chevronForward });
  }

  ionViewWillEnter() {
    this.alumnos = this.alumnoService.getActivos();
  }

  abrirModal(alumno: Alumno) {
    this.selectedAlumno = alumno;
    this.generarMeses(alumno);
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.selectedAlumno = null;
  }

  private generarMeses(alumno: Alumno) {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();
    this.meses = [];

    for (let i = 11; i >= 0; i--) {
      let m = mesActual - i;
      let a = anioActual;
      while (m <= 0) { m += 12; a--; }
      while (m > 12) { m -= 12; a++; }

      this.meses.push({
        label: `${this.MESES[m - 1]} ${a}`,
        mes: m,
        anio: a,
        pagado: this.alumnoService.estaPagadoMes(alumno, m, a),
        esActual: m === mesActual && a === anioActual,
      });
    }
  }

  toggleMes(mes: MesInfo) {
    if (!this.selectedAlumno) return;
    this.alumnoService.togglePagoMes(this.selectedAlumno.id, mes.mes, mes.anio);
    mes.pagado = !mes.pagado;
  }

  get pagados(): number {
    return this.meses.filter((m) => m.pagado).length;
  }
}
