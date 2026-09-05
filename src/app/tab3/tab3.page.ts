import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonSearchbar } from '@ionic/angular/standalone';
import { SearchbarCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { people, checkmarkCircle, closeCircle, chevronForward, chevronBack, search, logoWhatsapp, cashOutline, calendarOutline } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno, Pago, HistorialMonto } from '../models/alumno.model';
import { NotificationService } from '../services/notification.service';
import { WidgetService } from '../services/widget.service';
import { WhatsappService } from '../services/whatsapp.service';

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
  private widgetService = inject(WidgetService);
  private whatsappService = inject(WhatsappService);
  alumnos: Alumno[] = [];
  alumnosFiltradosCache: Alumno[] = [];
  selectedAlumno: Alumno | null = null;
  historialPagos: Pago[] = [];
  meses: MesInfo[] = [];
  isModalOpen = false;
  busqueda = '';
  anioSeleccionado = new Date().getFullYear();
  estadoDetalle = { texto: '', pasado: false, pagoAlDia: false };
  deudaDetalle = { meses: 0, monto: 0 };
  historialMontos: HistorialMonto[] = [];

  private readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  constructor() {
    addIcons({ people, checkmarkCircle, closeCircle, chevronForward, chevronBack, search, logoWhatsapp, cashOutline, calendarOutline });
  }

  ionViewDidEnter() {
    this.alumnos = this.alumnoService.getActivos();
    this.filtrarAlumnos();
  }

  private filtrarAlumnos() {
    const term = this.busqueda.trim().toLowerCase();
    this.alumnosFiltradosCache = term
      ? this.alumnos.filter(
          (a) => a.nombre.toLowerCase().includes(term) || a.apellido.toLowerCase().includes(term)
        )
      : this.alumnos;
  }

  onBuscar(event: SearchbarCustomEvent) {
    this.busqueda = event.detail.value ?? '';
    this.filtrarAlumnos();
  }

  get alumnosFiltrados(): Alumno[] {
    return this.alumnosFiltradosCache;
  }

  abrirModal(alumno: Alumno) {
    this.selectedAlumno = alumno;
    this.anioSeleccionado = new Date().getFullYear();
    this.generarMeses(alumno);
    this.historialPagos = this.alumnoService.getHistorialPagos(alumno.id);
    this.estadoDetalle = this.alumnoService.getEstadoPagoMes(alumno);
    this.deudaDetalle = this.alumnoService.getDeudaAlumno(alumno);
    this.historialMontos = [...(alumno.historialMontos ?? [])].slice().reverse();
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
      this.historialPagos = this.alumnoService.getHistorialPagos(this.selectedAlumno.id);
    }
    mes.pagado = !mes.pagado;
    this.notificationService.checkAndSchedule();
    this.widgetService.actualizar();
  }

  get pagados(): number {
    return this.meses.filter((m) => m.pagado).length;
  }

  recordarWhatsApp() {
    if (this.selectedAlumno) this.whatsappService.abrir(this.selectedAlumno);
  }

  mesLabel(mes: number): string {
    return this.MESES[mes - 1] || '';
  }
}
