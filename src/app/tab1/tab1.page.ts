import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonModal, IonButton, IonButtons, IonActionSheet, IonInput, IonSelect, IonSelectOption, IonSearchbar, IonToast, IonAlert, IonSegment, IonSegmentButton, IonFooter } from '@ionic/angular/standalone';
import { ActionSheetButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { personAdd, create, trash, close, ellipsisVertical, personRemove, checkmarkCircle, closeCircle, searchOutline, personOutline, logoWhatsapp, calendarOutline } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';
import { NotificationService } from '../services/notification.service';
import { WidgetService } from '../services/widget.service';
import { coincideAlumno, normalizar } from '../utils/texto';
import { EntradaListaDirective } from '../directivas/entrada-lista.directive';

type FiltroEstado = 'activos' | 'inactivos';
type Orden = 'nombre' | 'dia' | 'monto';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonModal, IonButton, IonActionSheet, IonInput, IonSelect, IonSelectOption, IonSearchbar, IonButtons, IonToast, IonAlert, IonSegment, IonSegmentButton, IonFooter, EntradaListaDirective],
})
export class Tab1Page {
  private alumnoService = inject(AlumnoService);
  private notificationService = inject(NotificationService);
  private widgetService = inject(WidgetService);
  private router = inject(Router);
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

  formNombre = '';
  formApellido = '';
  formDiaEntrada = 1;
  /** null = campo vacío: se muestra el placeholder en lugar de un 0 incómodo. */
  formMontoMensual: number | null = null;
  formTelefono = '';
  /** Días elegibles para el cobro mensual. */
  readonly dias = Array.from({ length: 31 }, (_, i) => i + 1);

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
    addIcons({ personAdd, create, trash, close, ellipsisVertical, personRemove, checkmarkCircle, closeCircle, searchOutline, personOutline, logoWhatsapp, calendarOutline });
  }

  get alumnosFiltrados(): Alumno[] {
    const lista = this.busqueda.trim()
      ? this.alumnos.filter((a) => coincideAlumno(a, this.busqueda))
      : [...this.alumnos];

    const nombreStr = (a: Alumno) => normalizar(`${a.nombre} ${a.apellido}`);

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

  /** Clase CSS del avatar/pill según el estado de pago del alumno. */
  estadoClase(alumno: Alumno): 'ok' | 'mora' | 'pendiente' {
    const estado = this.getEstado(alumno);
    if (estado.pagoAlDia) return 'ok';
    return estado.pasado ? 'mora' : 'pendiente';
  }

  /** Totales de la lista visible, para el panel de resumen. */
  get resumen(): { alDia: number; enMora: number } {
    let alDia = 0;
    let enMora = 0;
    for (const alumno of this.alumnos) {
      const estado = this.getEstado(alumno);
      if (estado.pagoAlDia) alDia++;
      else if (estado.pasado) enMora++;
    }
    return { alDia, enMora };
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

  /** El botón de guardar se habilita recién con nombre y monto cargados. */
  get formValido(): boolean {
    return this.formNombre.trim().length > 0 && Number(this.formMontoMensual) > 0 && this.formDiaEntrada >= 1;
  }

  abrirModalNuevo() {
    this.editando = null;
    this.formNombre = '';
    this.formApellido = '';
    // Arranca en el día de hoy: es el día en que el alumno empieza a cursar.
    this.formDiaEntrada = new Date().getDate();
    this.formMontoMensual = null;
    this.formTelefono = '';
    this.isModalOpen = true;
  }

  abrirModalEditar(alumno: Alumno) {
    this.editando = alumno;
    this.formNombre = alumno.nombre;
    this.formApellido = alumno.apellido;
    this.formDiaEntrada = alumno.diaEntrada;
    this.formMontoMensual = alumno.montoMensual;
    this.formTelefono = alumno.telefono ?? '';
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.editando = null;
  }

  guardar() {
    const nombre = this.formNombre.trim();
    const apellido = this.formApellido.trim();

    if (!nombre) {
      this.mostrarToast('Ingresá el nombre del alumno');
      return;
    }
    const monto = Number(this.formMontoMensual);
    if (monto <= 0) {
      this.mostrarToast('El monto mensual debe ser mayor a $0');
      return;
    }

    if (this.editando) {
      this.alumnoService.actualizar(this.editando.id, {
        nombre,
        apellido,
        diaEntrada: this.formDiaEntrada,
        montoMensual: monto,
        telefono: this.formTelefono.trim() || undefined,
      });
      this.mostrarToast('Alumno actualizado');
    } else {
      this.alumnoService.crear({
        nombre,
        apellido,
        diaEntrada: this.formDiaEntrada,
        montoMensual: monto,
        telefono: this.formTelefono.trim() || undefined,
      });
      this.mostrarToast('Alumno agregado');
    }

    this.cargar();
    this.notificationService.checkAndSchedule();
    this.widgetService.actualizar();
    setTimeout(() => this.cerrarModal(), 500);
  }

  /** Abre el estado de cuenta completo del alumno. */
  verEstadoCuenta(alumno: Alumno) {
    this.router.navigate(['/estado-cuenta', alumno.id]);
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
