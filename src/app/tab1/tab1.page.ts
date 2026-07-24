import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonFab, IonFabButton, IonActionSheet, IonInput, IonText, IonDatetime, IonSearchbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAdd, chevronForward, create, trash, close, calendar, cash, ellipsisVertical, personRemove, eye, search } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonModal, IonButton, IonButtons, IonFab, IonFabButton, IonActionSheet, IonInput, IonText, IonDatetime, IonSearchbar],
})
export class Tab1Page {
  private alumnoService = inject(AlumnoService);
  alumnos: Alumno[] = [];
  busqueda = '';

  isModalOpen = false;
  editando: Alumno | null = null;
  showActions = false;
  selectedAlumno: Alumno | null = null;

  formNombreCompleto = '';
  formDiaEntrada = 1;
  formMontoMensual = 0;
  formFecha: string = new Date().toISOString();
  mensaje = '';

  actionSheetButtons: any[] = [];

  constructor() {
    addIcons({ personAdd, chevronForward, create, trash, close, calendar, cash, ellipsisVertical, personRemove, eye, search });
  }

  get alumnosFiltrados(): Alumno[] {
    if (!this.busqueda.trim()) return this.alumnos;
    const term = this.busqueda.toLowerCase().trim();
    return this.alumnos.filter(
      (a) => `${a.nombre} ${a.apellido}`.toLowerCase().includes(term)
    );
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    this.alumnos = this.alumnoService.getAll().filter((a) => a.activo);
  }

  abrirModalNuevo() {
    this.editando = null;
    this.formNombreCompleto = '';
    this.formDiaEntrada = 1;
    this.formMontoMensual = 0;
    this.formFecha = new Date().toISOString();
    this.mensaje = '';
    this.isModalOpen = true;
  }

  abrirModalEditar(alumno: Alumno) {
    this.editando = alumno;
    this.formNombreCompleto = `${alumno.nombre} ${alumno.apellido}`;
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
    if (!this.formNombreCompleto.trim() || this.formMontoMensual <= 0) {
      this.mensaje = 'Completá todos los campos';
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
      this.mensaje = 'Alumno actualizado';
    } else {
      this.alumnoService.crear({
        nombre,
        apellido,
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
