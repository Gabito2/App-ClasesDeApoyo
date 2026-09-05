import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonActionSheet, IonInput, IonDatetime, IonSearchbar, IonToast, IonAlert, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { ActionSheetButton, DatetimeCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personAdd, create, trash, close, ellipsisVertical, personRemove } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';
import { NotificationService } from '../services/notification.service';
import { WidgetService } from '../services/widget.service';

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
  private widgetService = inject(WidgetService);
  alumnos: Alumno[] = [];
  busqueda = '';
  filtroEstado: FiltroEstado = 'activos';
  hayAlumnosTotal = false;
  orden: Orden = 'nombre';
  private estadoCache = new Map<number, { texto: string; pasado: boolean; pagoAlDia: boolean }>();

  isModalOpen = false;
  editando: Alumno | null = null;
  showActions = false;
  selectedAlumno: Alumno | null = null;

  formNombreCompleto = '';
  formDiaEntrada = 1;
  formMontoMensual = 0;
  formTelefono = '';
  formFecha: string = new Date().toISOString();

  toastOpen = false;
  toastMsg = '';

  isAlertOpen = false;
  alumnoAEliminar: Alumno | null = null;

  actionSheetButtons: ActionSheetButton[] = [];

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
    addIcons({ personAdd, create, trash, close, ellipsisVertical, personRemove });
  }

  get alumnosFiltrados(): Alumno[] {
    const lista = this.busqueda.trim()
      ? this.alumnos.filter(
          (a) => `${a.nombre} ${a.apellido}`.toLowerCase().includes(this.busqueda.toLowerCase().trim())
        )
      : [...this.alumnos];

    const nombreStr = (a: Alumno) => `${a.nombre} ${a.apellido}`.toLowerCase();

    switch (this.orden) {
      case 'dia':
        return lista.sort((x, y) => x.diaEntrada - y.diaEntrada || nombreStr(x).localeCompare(nombreStr(y), 'es'));
      case 'monto':
        return lista.sort((x, y) => y.montoMensual - x.montoMensual || nombreStr(x).localeCompare(nombreStr(y), 'es'));
      default:
        return lista.sort((x, y) => nombreStr(x).localeCompare(nombreStr(y), 'es'));
    }
  }

  getEstado(alumno: Alumno): { texto: string; pasado: boolean; pagoAlDia: boolean } {
    let estado = this.estadoCache.get(alumno.id);
    if (!estado) {
      estado = this.alumnoService.getEstadoPagoMes(alumno);
      this.estadoCache.set(alumno.id, estado);
    }
    return estado;
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    const todos = this.alumnoService.getAll();
    const activos = this.filtroEstado === 'activos';
    this.alumnos = todos.filter((a) => a.activo === activos);
    this.hayAlumnosTotal = todos.length > 0;
    this.estadoCache.clear();
  }

  abrirModalNuevo() {
    this.editando = null;
    this.formNombreCompleto = '';
    this.formDiaEntrada = 1;
    this.formMontoMensual = 0;
    this.formTelefono = '';
    this.formFecha = new Date().toISOString();
    this.isModalOpen = true;
  }

  abrirModalEditar(alumno: Alumno) {
    this.editando = alumno;
    this.formNombreCompleto = `${alumno.nombre} ${alumno.apellido}`;
    this.formDiaEntrada = alumno.diaEntrada;
    this.formMontoMensual = alumno.montoMensual;
    this.formTelefono = alumno.telefono ?? '';
    // El calendario muestra el día real de pago del alumno (ajustado al último día del mes si aplica)
    const ahora = new Date();
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    this.formFecha = new Date(ahora.getFullYear(), ahora.getMonth(), Math.min(alumno.diaEntrada, ultimoDia), 12, 0, 0).toISOString();
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.editando = null;
  }

  onFechaChange(event: DatetimeCustomEvent) {
    const value = event.detail.value;
    if (typeof value !== 'string') return;
    const date = new Date(value);
    this.formDiaEntrada = date.getDate();
  }

  guardar() {
    if (!this.formNombreCompleto.trim()) {
      this.mostrarToast('Ingresá el nombre del alumno');
      return;
    }
    if (this.formMontoMensual <= 0) {
      this.mostrarToast('El monto mensual debe ser mayor a $0');
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
        telefono: this.formTelefono.trim() || undefined,
      });
      this.mostrarToast('Alumno actualizado');
    } else {
      this.alumnoService.crear({
        nombre,
        apellido,
        diaEntrada: this.formDiaEntrada,
        montoMensual: this.formMontoMensual,
        telefono: this.formTelefono.trim() || undefined,
      });
      this.mostrarToast('Alumno agregado');
    }

    this.cargar();
    this.notificationService.checkAndSchedule();
    this.widgetService.actualizar();
    setTimeout(() => this.cerrarModal(), 500);
  }

  abrirAcciones(alumno: Alumno, event: Event) {
    event.stopPropagation();
    this.selectedAlumno = alumno;

    const acciones: ActionSheetButton[] = alumno.activo
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
    this.widgetService.actualizar();
  }

  reactivar(alumno: Alumno) {
    this.alumnoService.reactivar(alumno.id);
    this.cargar();
    this.notificationService.checkAndSchedule();
    this.widgetService.actualizar();
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
    this.widgetService.actualizar();
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
