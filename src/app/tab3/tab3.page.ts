import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonButtons, IonModal, IonToast, IonSearchbar, IonSelect, IonSelectOption, IonInput } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { receiptOutline, logoWhatsapp, shareSocial, chevronForward, close, checkmarkCircle, search, cashOutline, calendarOutline } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { ComprobanteService } from '../services/comprobante.service';
import { Alumno, Comprobante } from '../models/alumno.model';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonButtons, IonModal, IonToast, IonSearchbar, IonSelect, IonSelectOption, IonInput],
})
export class Tab3Page {
  private alumnoService = inject(AlumnoService);
  private comprobanteService = inject(ComprobanteService);

  readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  alumnos: Alumno[] = [];
  busqueda = '';
  private conteoPorAlumno = new Map<number, number>();

  anio = new Date().getFullYear();
  totalAnio = 0;
  cantidadAnio = 0;

  // ── Alta de comprobante ──
  alumnoSeleccionado: Alumno | null = null;
  isFormOpen = false;
  formMes = new Date().getMonth() + 1;
  formAnio = new Date().getFullYear();
  formMonto = 0;
  comprobantesAlumno: Comprobante[] = [];

  // ── Vista previa / envío ──
  comprobanteSeleccionado: Comprobante | null = null;
  isPreviewOpen = false;
  enviando = false;

  toastOpen = false;
  toastMsg = '';

  constructor() {
    addIcons({ receiptOutline, logoWhatsapp, shareSocial, chevronForward, close, checkmarkCircle, search, cashOutline, calendarOutline });
  }

  ionViewWillEnter() {
    this.anio = new Date().getFullYear();
    this.cargar();
  }

  cargar() {
    this.alumnos = this.alumnoService.getActivos();

    const delAnio = this.alumnoService.getComprobantes({ anio: this.anio });
    this.totalAnio = delAnio.reduce((suma, c) => suma + c.monto, 0);
    this.cantidadAnio = delAnio.length;

    const conteo = new Map<number, number>();
    for (const c of this.alumnoService.getComprobantes()) {
      conteo.set(c.alumnoId, (conteo.get(c.alumnoId) ?? 0) + 1);
    }
    this.conteoPorAlumno = conteo;
  }

  /** Alumnos activos filtrados por nombre o apellido. */
  get filtrados(): Alumno[] {
    const term = this.busqueda.toLowerCase().trim();
    if (!term) return this.alumnos;
    return this.alumnos.filter((a) => `${a.nombre} ${a.apellido}`.toLowerCase().includes(term));
  }

  get anios(): number[] {
    const actual = new Date().getFullYear();
    return [actual - 3, actual - 2, actual - 1, actual, actual + 1];
  }

  get puedeWhatsApp(): boolean {
    return !!this.comprobanteSeleccionado?.telefono;
  }

  conteo(alumno: Alumno): number {
    return this.conteoPorAlumno.get(alumno.id) ?? 0;
  }

  abrirFormulario(alumno: Alumno) {
    const ahora = new Date();
    this.alumnoSeleccionado = alumno;
    this.formMes = ahora.getMonth() + 1;
    this.formAnio = ahora.getFullYear();
    this.formMonto = alumno.montoMensual;
    this.comprobantesAlumno = this.alumnoService.getComprobantes().filter((c) => c.alumnoId === alumno.id);
    this.isFormOpen = true;
  }

  cerrarFormulario() {
    this.isFormOpen = false;
    this.alumnoSeleccionado = null;
  }

  crearComprobante() {
    if (!this.alumnoSeleccionado) return;

    const monto = Number(this.formMonto);
    if (!Number.isFinite(monto) || monto <= 0) {
      this.mostrarToast('El monto debe ser mayor a $0');
      return;
    }

    const alumno = this.alumnoSeleccionado;
    const actualizado = this.alumnoService.registrarPago(alumno.id, this.formMes, this.formAnio, monto);
    if (!actualizado) return;

    const comprobante = this.alumnoService
      .getComprobantes({ mes: this.formMes, anio: this.formAnio })
      .find((c) => c.alumnoId === alumno.id);

    this.comprobantesAlumno = this.alumnoService.getComprobantes().filter((c) => c.alumnoId === alumno.id);
    this.cargar();

    if (!comprobante) {
      this.mostrarToast('Pago registrado, pero no se pudo armar el comprobante');
      return;
    }

    this.isFormOpen = false;
    this.abrirPreview(comprobante);
    this.mostrarToast(`Comprobante Nº ${this.numero(comprobante)} creado`);
  }

  abrirPreview(comprobante: Comprobante) {
    this.comprobanteSeleccionado = comprobante;
    this.isPreviewOpen = true;
  }

  cerrarPreview() {
    this.isPreviewOpen = false;
    this.comprobanteSeleccionado = null;
  }

  async compartir() {
    if (!this.comprobanteSeleccionado || this.enviando) return;
    const comprobante = this.comprobanteSeleccionado;
    this.enviando = true;
    const ok = await this.comprobanteService.compartirImagen(comprobante);
    this.enviando = false;
    this.mostrarToast(ok ? `Comprobante Nº ${this.numero(comprobante)} listo para compartir` : 'No se pudo generar la imagen');
  }

  enviarWhatsApp() {
    if (!this.comprobanteSeleccionado) return;
    if (!this.comprobanteService.abrirWhatsApp(this.comprobanteSeleccionado)) {
      this.mostrarToast('El alumno no tiene teléfono cargado');
    }
  }

  numero(comprobante: Comprobante): string {
    return this.comprobanteService.numeroTexto(comprobante.numero);
  }

  mesLabel(mes: number): string {
    return this.comprobanteService.mesLabel(mes);
  }

  fecha(comprobante: Comprobante): string {
    return this.comprobanteService.fechaTexto(comprobante);
  }

  iniciales(alumno: Alumno): string {
    return `${alumno.nombre.charAt(0)}${alumno.apellido.charAt(0)}`;
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
