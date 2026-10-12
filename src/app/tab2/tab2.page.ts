import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonSearchbar, IonButton, IonButtons, IonAlert, IonToast, IonModal, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';
import { AlertButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendar, checkmarkCircle, closeCircle, search, logoWhatsapp, chevronForward, chevronBack, cashOutline, calendarOutline, alertCircle, hourglassOutline, close } from 'ionicons/icons';
import { AlumnoService } from '../services/alumno.service';
import { Alumno, Pago, HistorialMonto } from '../models/alumno.model';
import { WhatsappService, TipoMensaje } from '../services/whatsapp.service';
import { NotificationService } from '../services/notification.service';
import { WidgetService } from '../services/widget.service';

type AlumnoVencimiento = Alumno & { diasInfo: { texto: string; pasado: boolean }; pagoAlDia: boolean };

interface MesInfo {
  label: string;
  mes: number;
  anio: number;
  pagado: boolean;
  esActual: boolean;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonSearchbar, IonButton, IonButtons, IonAlert, IonToast, IonModal, IonGrid, IonRow, IonCol],
})
export class Tab2Page {
  private alumnoService = inject(AlumnoService);
  private whatsappService = inject(WhatsappService);
  private notificationService = inject(NotificationService);
  private widgetService = inject(WidgetService);
  alumnos: AlumnoVencimiento[] = [];
  busqueda = '';

  isBulkAlertOpen = false;
  bulkAlertButtons: AlertButton[] = [
    { text: 'Cancelar', role: 'cancel' },
    { text: 'Enviar', handler: () => this.enviarRecordatorioMasivo() },
  ];

  toastOpen = false;
  toastMsg = '';

  // ── Modal de pagos ──
  selectedAlumno: Alumno | null = null;
  historialPagos: Pago[] = [];
  meses: MesInfo[] = [];
  isModalOpen = false;
  anioSeleccionado = new Date().getFullYear();
  estadoDetalle = { texto: '', pasado: false, pagoAlDia: false };
  deudaDetalle = { meses: 0, monto: 0 };
  historialMontos: HistorialMonto[] = [];

  private readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  constructor() {
    addIcons({ calendar, checkmarkCircle, closeCircle, search, logoWhatsapp, chevronForward, chevronBack, cashOutline, calendarOutline, alertCircle, hourglassOutline, close });
  }

  get alumnosFiltrados() {
    if (!this.busqueda.trim()) return this.alumnos;
    const term = this.busqueda.toLowerCase().trim();
    return this.alumnos.filter(
      (a) => `${a.nombre} ${a.apellido}`.toLowerCase().includes(term)
    );
  }

  /** Alumnos con cuota vencida que tienen teléfono de WhatsApp. */
  get vencidosConTelefono(): AlumnoVencimiento[] {
    return this.alumnos.filter((a) => a.diasInfo.pasado && a.telefono);
  }

  /** Totales para el panel de resumen (sobre todos los activos, no lo filtrado). */
  get totales(): { vencidos: number; porVencer: number; alDia: number } {
    let vencidos = 0;
    let porVencer = 0;
    let alDia = 0;
    for (const a of this.alumnos) {
      if (a.pagoAlDia) alDia++;
      else if (a.diasInfo.pasado) vencidos++;
      else porVencer++;
    }
    return { vencidos, porVencer, alDia };
  }

  /** Alumnos con la cuota vencida (sin pagar y con el vencimiento pasado). */
  get vencidos(): AlumnoVencimiento[] {
    return this.alumnosFiltrados.filter((a) => !a.pagoAlDia && a.diasInfo.pasado);
  }

  /** Alumnos cuya cuota todavía no venció. */
  get porVencer(): AlumnoVencimiento[] {
    return this.alumnosFiltrados.filter((a) => !a.pagoAlDia && !a.diasInfo.pasado);
  }

  /** Alumnos con la cuota del mes al día. */
  get alDia(): AlumnoVencimiento[] {
    return this.alumnosFiltrados.filter((a) => a.pagoAlDia);
  }

  /** Clase CSS del avatar/pill según el estado de pago del alumno. */
  claseEstado(a: AlumnoVencimiento): 'ok' | 'mora' | 'pendiente' {
    if (a.pagoAlDia) return 'ok';
    return a.diasInfo.pasado ? 'mora' : 'pendiente';
  }

  /** Clase CSS del estado mostrado en el modal de detalle. */
  claseEstadoDetalle(): 'ok' | 'mora' | 'pendiente' {
    if (this.estadoDetalle.pagoAlDia) return 'ok';
    return this.estadoDetalle.pasado ? 'mora' : 'pendiente';
  }

  ionViewWillEnter() {
    this.cargar();
  }

  recordarWhatsApp(alumno: AlumnoVencimiento, event: Event) {
    event.stopPropagation();
    const tipo: TipoMensaje = alumno.diasInfo.pasado ? 'vencido' : 'pendiente';
    this.whatsappService.abrir(alumno, tipo);
  }

  recordarVencidosWhatsApp() {
    const vencidos = this.vencidosConTelefono;
    if (vencidos.length === 0) {
      this.mostrarToast('No hay alumnos vencidos con teléfono');
      return;
    }
    this.isBulkAlertOpen = true;
  }

  enviarRecordatorioMasivo() {
    const vencidos = this.vencidosConTelefono;
    if (vencidos.length === 0) return;
    // Se abre WhatsApp una vez por alumno, con una pequeña pausa entre conversaciones
    vencidos.forEach((a, i) => {
      setTimeout(() => this.whatsappService.abrir(a, 'vencido'), i * 1500);
    });
    this.mostrarToast(`Se abrieron ${vencidos.length} conversación${vencidos.length === 1 ? '' : 'es'} de WhatsApp`);
  }

  // ── Modal de pagos ──

  abrirModal(a: AlumnoVencimiento) {
    this.selectedAlumno = a;
    this.anioSeleccionado = new Date().getFullYear();
    this.generarMeses(a);
    this.historialPagos = this.alumnoService.getHistorialPagos(a.id);
    this.estadoDetalle = this.alumnoService.getEstadoPagoMes(a);
    this.deudaDetalle = this.alumnoService.getDeudaAlumno(a);
    this.historialMontos = [...(a.historialMontos ?? [])].slice().reverse();
    this.isModalOpen = true;
  }

  cambiarAnio(delta: number) {
    this.anioSeleccionado += delta;
    if (this.selectedAlumno) this.generarMeses(this.selectedAlumno);
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.selectedAlumno = null;
    this.cargar();
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
    this.cargar();
  }

  get pagados(): number {
    return this.meses.filter((m) => m.pagado).length;
  }

  recordarWhatsAppDetalle() {
    if (!this.selectedAlumno) return;
    const tipo: TipoMensaje = this.estadoDetalle.pasado ? 'vencido' : 'pendiente';
    this.whatsappService.abrir(this.selectedAlumno, tipo);
  }

  mesLabel(mes: number): string {
    return this.MESES[mes - 1] || '';
  }

  private cargar() {
    this.alumnos = this.alumnoService.getActivos().map((a) => {
      const estado = this.alumnoService.getEstadoPagoMes(a);
      return { ...a, diasInfo: { texto: estado.texto, pasado: estado.pasado }, pagoAlDia: estado.pagoAlDia };
    });
  }

  private mostrarToast(mensaje: string) {
    this.toastMsg = mensaje;
    this.toastOpen = true;
  }
}
