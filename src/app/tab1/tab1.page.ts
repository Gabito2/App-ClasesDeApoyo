import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonActionSheet, IonInput, IonDatetime, IonSearchbar, IonToast, IonAlert, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAdd, chevronForward, create, trash, close, calendar, cash, ellipsisVertical, personRemove, eye, search } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';
import { NotificationService } from '../services/notification.service';

type FiltroEstado = 'activos' | 'inactivos';
type Orden = 'nombre' | 'dia' | 'monto';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonActionSheet, IonInput, IonDatetime, IonSearchbar, IonButtons, IonToast, IonAlert, IonSegment, IonSegmentButton, IonSelect, IonSelectOption],
})
export class Tab1Page {
  private alumnoService = inject(AlumnoService);
  private notificationService = inject(NotificationService);
  alumnos: Alumno[] = [];
  busqueda = '';
  filtroEstado: FiltroEstado = 'activos';
  hayAlumnosTotal = false;
  orden: Orden = 'nombre';

  isModalOpen = false;
  editando: Alumno | null = null;
  showActions = false;
  selectedAlumno: Alumno | null = null;

  formNombreCompleto = '';
  formDiaEntrada = 1;
  formMontoMensual = 0;
  formFecha: string = new Date().toISOString();

  toastOpen = false;
  toastMsg = '';

  isAlertOpen = false;
  alumnoAEliminar: Alumno | null = null;

  actionSheetButtons: any[] = [];

  alertButtons = [
    { text: 'Cancelar', role: 'cancel' },
    {
      text: 'Eliminar',
      role: 'destructive',
      handler: () => {
        if (this.alumnoAEliminar) this.eliminarDefinitivo(this.alumnoAEliminar);
      },
    },
  ];

  constructor() {
    addIcons({ personAdd, chevronForward, create, trash, close, calendar, cash, ellipsisVertical, personRemove, eye, search });
  }

  get alumnosFiltrados(): Alumno[] {
    const lista = this.busqueda.trim()
      ? this.alumnos.filter(
          (a) => `${a.nombre} ${a.apellido}`.toLowerCase().includes(this.busqueda.toLowerCase().trim())
        )
      : [...this.alumnos];

    switch (this.orden) {
      case 'dia':
        return lista.sort((x, y) => x.diaEntrada - y.diaEntrada);
      case 'monto':
        return lista.sort((x, y) => y.montoMensual - x.montoMensual);
      default:
        return lista.sort((x, y) => `${x.nombre} ${x.apellido}`.localeCompare(`${y.nombre} ${y.apellido}`, 'es'));
    }
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    const activos = this.filtroEstado === 'activos';
    this.alumnos = this.alumnoService.getAll().filter((a) => a.activo === activos);
    this.hayAlumnosTotal = this.alumnoService.getAll().length > 0;
  }

  abrirModalNuevo() {
    this.editando = null;
    this.formNombreCompleto = '';
    this.formDiaEntrada = 1;
    this.formMontoMensual = 0;
    this.formFecha = new Date().toISOString();
    this.isModalOpen = true;
  }

  abrirModalEditar(alumno: Alumno) {
    this.editando = alumno;
    this.formNombreCompleto = `${alumno.nombre} ${alumno.apellido}`;
    this.formDiaEntrada = alumno.diaEntrada;
    this.formMontoMensual = alumno.montoMensual;
    // El calendario muestra el día real de pago del alumno (ajustado al último día del mes si aplica)
    const ahora = new Date();
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    this.formFecha = new Date(ahora.getFullYear(), ahora.getMonth(), Math.min(alumno.diaEntrada, ultimoDia)).toISOString();
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.editando = null;
  }

  onFechaChange(event: any) {
    const date = new Date(event.detail.value);
    this.formDiaEntrada = date.getDate();
  }

  guardar() {
    if (!this.formNombreCompleto.trim() || this.formMontoMensual <= 0) {
      this.mostrarToast('Completá todos los campos');
      return;
    }

    const partes = this.formNombreCompleto.trim().split(' ');
    const nombre = partes[0];
    const apellido = partes.slice(1).join(' ') || '';

    if (this.editando) {
      this.alumnoService.actualizar(this.editando.id, {
        nombre,
        apellido,
        diaEntrada: this.formDiaEntrada,
        montoMensual: this.formMontoMensual,
      });
      this.mostrarToast('Alumno actualizado');
    } else {
      this.alumnoService.crear({
        nombre,
        apellido,
        diaEntrada: this.formDiaEntrada,
        montoMensual: this.formMontoMensual,
      });
      this.mostrarToast('Alumno agregado');
    }

    this.cargar();
    this.notificationService.checkAndSchedule();
    setTimeout(() => this.cerrarModal(), 500);
  }

  abrirAcciones(alumno: Alumno, event: Event) {
    event.stopPropagation();
    this.selectedAlumno = alumno;

    const acciones: any[] = alumno.activo
      ? [
          { text: 'Editar', icon: 'create', handler: () => this.abrirModalEditar(alumno) },
          {
            text: 'Dar de baja',
            icon: 'person-remove',
            role: 'destructive',
            handler: () => this.darDeBaja(alumno),
          },
        ]
      : [
          { text: 'Reactivar', icon: 'person-add', handler: () => this.reactivar(alumno) },
        ];

    acciones.push(
      {
        text: 'Eliminar permanentemente',
        icon: 'trash',
        role: 'destructive',
        cssClass: 'action-danger',
        handler: () => this.confirmarEliminar(alumno),
      },
      { text: 'Cancelar', icon: 'close', role: 'cancel' }
    );

    this.actionSheetButtons = acciones;
    this.showActions = true;
  }

  darDeBaja(alumno: Alumno) {
    this.alumnoService.eliminar(alumno.id);
    this.cargar();
    this.notificationService.checkAndSchedule();
  }

  reactivar(alumno: Alumno) {
    this.alumnoService.reactivar(alumno.id);
    this.cargar();
    this.notificationService.checkAndSchedule();
    this.mostrarToast(`${alumno.nombre} reactivado`);
  }

  confirmarEliminar(alumno: Alumno) {
    this.alumnoAEliminar = alumno;
    this.isAlertOpen = true;
  }

  eliminarDefinitivo(alumno: Alumno) {
    this.alumnoService.eliminarDefinitivo(alumno.id);
    this.cargar();
    this.notificationService.checkAndSchedule();
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
