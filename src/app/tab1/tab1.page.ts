import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonFab, IonFabButton, IonActionSheet, IonInput, IonText, IonDatetime } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAdd, chevronForward, create, trash, close, calendar, cash, ellipsisVertical, personRemove, eye } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonFab, IonFabButton, IonActionSheet, IonInput, IonText, IonDatetime],
})
export class Tab1Page {
  private alumnoService = inject(AlumnoService);
  alumnos: Alumno[] = [];

  isModalOpen = false;
  editando: Alumno | null = null;
  showActions = false;
  selectedAlumno: Alumno | null = null;

  formNombre = '';
  formApellido = '';
  formDiaEntrada = 1;
  formMontoMensual = 0;
  formFecha: string = new Date().toISOString();
  mensaje = '';

  actionSheetButtons: any[] = [];

  constructor() {
    addIcons({ personAdd, chevronForward, create, trash, close, calendar, cash, ellipsisVertical, personRemove, eye });
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    this.alumnos = this.alumnoService.getAll().filter((a) => a.activo);
  }

  abrirModalNuevo() {
    this.editando = null;
    this.formNombre = '';
    this.formApellido = '';
    this.formDiaEntrada = 1;
    this.formMontoMensual = 0;
    this.formFecha = new Date().toISOString();
    this.mensaje = '';
    this.isModalOpen = true;
  }

  abrirModalEditar(alumno: Alumno) {
    this.editando = alumno;
    this.formNombre = alumno.nombre;
    this.formApellido = alumno.apellido;
    this.formDiaEntrada = alumno.diaEntrada;
    this.formMontoMensual = alumno.montoMensual;
    this.formFecha = new Date().toISOString();
    this.mensaje = '';
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
    if (!this.formNombre.trim() || !this.formApellido.trim() || this.formMontoMensual <= 0) {
      this.mensaje = 'Completá todos los campos';
      return;
    }

    if (this.editando) {
      this.alumnoService.actualizar(this.editando.id, {
        nombre: this.formNombre.trim(),
        apellido: this.formApellido.trim(),
        diaEntrada: this.formDiaEntrada,
        montoMensual: this.formMontoMensual,
      });
      this.mensaje = 'Alumno actualizado';
    } else {
      this.alumnoService.crear({
        nombre: this.formNombre.trim(),
        apellido: this.formApellido.trim(),
        diaEntrada: this.formDiaEntrada,
        montoMensual: this.formMontoMensual,
      });
      this.mensaje = 'Alumno agregado';
    }

    this.cargar();
    setTimeout(() => this.cerrarModal(), 800);
  }

  abrirAcciones(alumno: Alumno, event: Event) {
    event.stopPropagation();
    this.selectedAlumno = alumno;
    this.actionSheetButtons = [
      {
        text: 'Editar',
        icon: 'create',
        handler: () => this.abrirModalEditar(alumno),
      },
      {
        text: 'Dar de baja',
        icon: 'person-remove',
        role: 'destructive',
        handler: () => this.darDeBaja(alumno),
      },
      {
        text: 'Eliminar permanentemente',
        icon: 'trash',
        role: 'destructive',
        cssClass: 'action-danger',
        handler: () => this.eliminarDefinitivo(alumno),
      },
      {
        text: 'Cancelar',
        icon: 'close',
        role: 'cancel',
      },
    ];
    this.showActions = true;
  }

  darDeBaja(alumno: Alumno) {
    this.alumnoService.eliminar(alumno.id);
    this.cargar();
  }

  eliminarDefinitivo(alumno: Alumno) {
    this.alumnoService.eliminarDefinitivo(alumno.id);
    this.cargar();
  }
}
