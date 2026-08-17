import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSearchbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { people, checkmarkCircle, closeCircle, chevronForward, chevronBack } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno, HistorialMonto } from '../models/alumno.model';
import { NotificationService } from '../services/notification.service';

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
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSearchbar],
})
export class Tab3Page {
  private alumnoService = inject(AlumnoService);
  private notificationService = inject(NotificationService);
  alumnos: Alumno[] = [];
  selectedAlumno: Alumno | null = null;
  meses: MesInfo[] = [];
  isModalOpen = false;
  busqueda = '';
  anioSeleccionado = new Date().getFullYear();

  private readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  constructor() {
    addIcons({ people, checkmarkCircle, closeCircle, chevronForward, chevronBack });
  }

  ionViewDidEnter() {
    this.alumnos = this.alumnoService.getActivos();
  }

  get alumnosFiltrados(): Alumno[] {
    if (!this.busqueda.trim()) return this.alumnos;
    const term = this.busqueda.toLowerCase().trim();
    return this.alumnos.filter(
      (a) => a.nombre.toLowerCase().includes(term) || a.apellido.toLowerCase().includes(term)
    );
  }

  abrirModal(alumno: Alumno) {
    this.selectedAlumno = alumno;
    this.anioSeleccionado = new Date().getFullYear();
    this.generarMeses(alumno);
    this.isModalOpen = true;
  }

  cambiarAnio(delta: number) {
    this.anioSeleccionado += delta;
    if (this.selectedAlumno) this.generarMeses(this.selectedAlumno);
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.selectedAlumno = null;
  }

  private generarMeses(alumno: Alumno) {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1;
    const anioActual = ahora.getFullYear();
    const anio = this.anioSeleccionado;
    this.meses = [];

    for (let m = 1; m <= 12; m++) {
      this.meses.push({
        label: `${this.MESES[m - 1]} ${anio}`,
        mes: m,
        anio,
        pagado: this.alumnoService.estaPagadoMes(alumno, m, anio),
        esActual: m === mesActual && anio === anioActual,
      });
    }
  }

  toggleMes(mes: MesInfo) {
    if (!this.selectedAlumno) return;
    const actualizado = this.alumnoService.togglePagoMes(this.selectedAlumno.id, mes.mes, mes.anio);
    if (actualizado) {
      this.selectedAlumno = actualizado;
    }
    mes.pagado = !mes.pagado;
    this.notificationService.checkAndSchedule();
  }

  get pagados(): number {
    return this.meses.filter((m) => m.pagado).length;
  }

  get historialRecientes(): HistorialMonto[] {
    if (!this.selectedAlumno?.historialMontos) return [];
    return [...this.selectedAlumno.historialMontos].reverse();
  }
}
