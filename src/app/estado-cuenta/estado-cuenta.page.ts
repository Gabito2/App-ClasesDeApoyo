import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToast, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircle, calendarOutline, cashOutline, checkmarkCircle, closeCircle, logoWhatsapp, personOutline } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { WhatsappService } from '../services/whatsapp.service';
import { EstadoCuenta } from '../models/alumno.model';

type ClaseEstado = 'ok' | 'mora' | 'pendiente';

@Component({
  selector: 'app-estado-cuenta',
  templateUrl: 'estado-cuenta.page.html',
  styleUrls: ['estado-cuenta.page.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon, IonButton, IonToast],
})
export class EstadoCuentaPage {
  private alumnoService = inject(AlumnoService);
  private whatsappService = inject(WhatsappService);
  private route = inject(ActivatedRoute);

  cuenta: EstadoCuenta | null = null;
  estado = { texto: '', pasado: false, pagoAlDia: false };

  toastOpen = false;
  toastMsg = '';

  private readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  constructor() {
    addIcons({ alertCircle, calendarOutline, cashOutline, checkmarkCircle, closeCircle, logoWhatsapp, personOutline });
  }

  ionViewWillEnter() {
    this.cargar();
  }

  get iniciales(): string {
    if (!this.cuenta) return '';
    const { nombre, apellido } = this.cuenta.alumno;
    return `${nombre.charAt(0)}${apellido.charAt(0)}`;
  }

  /** Clase CSS del avatar/pill según el estado de pago del mes. */
  claseEstado(): ClaseEstado {
    if (this.estado.pagoAlDia) return 'ok';
    return this.estado.pasado ? 'mora' : 'pendiente';
  }

  mesLabel(mes: number): string {
    return this.MESES[mes - 1] ?? '';
  }

  numero(numero: number): string {
    return String(numero).padStart(4, '0');
  }

  enviarWhatsApp() {
    if (!this.cuenta) return;
    if (!this.whatsappService.abrirEstadoCuenta(this.cuenta.alumno)) {
      this.mostrarToast('El alumno no tiene teléfono cargado');
    }
  }

  private cargar() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cuenta = Number.isFinite(id) ? this.alumnoService.getEstadoCuenta(id) : null;
    this.estado = this.cuenta
      ? this.alumnoService.getEstadoPagoMes(this.cuenta.alumno)
      : { texto: '', pasado: false, pagoAlDia: false };
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
