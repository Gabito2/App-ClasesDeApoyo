import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tab3Page } from './tab3.page';
import { AlumnoService } from '../services/alumno.service';

// Reloj fijo en octubre de 2026 para que el período inicial no dependa del día real.
const HOY = new Date(2026, 9, 12, 10, 0, 0);

/** Siembra dos activos (uno con un cobro previo) y un alumno dado de baja. */
function sembrarAlumnos(): void {
  const base = { activo: true, diaEntrada: 5, historialMontos: [], fechaRegistro: '2026-01-01T12:00:00' };
  localStorage.setItem(
    'alumnos',
    JSON.stringify([
      {
        ...base, id: 1, nombre: 'Gabriel', apellido: 'Pérez', montoMensual: 15000,
        pagos: [
          { mes: 9, anio: 2026, pagado: true, montoPagado: 14000, fechaPago: new Date(2026, 8, 5, 10).toISOString() },
        ],
      },
      { ...base, id: 2, nombre: 'Ana', apellido: 'Díaz', montoMensual: 12000, telefono: '1122334455', pagos: [] },
      { ...base, id: 3, nombre: 'Baja', apellido: 'Total', montoMensual: 9000, activo: false, pagos: [] },
    ])
  );
}

describe('Tab3Page', () => {
  let component: Tab3Page;
  let fixture: ComponentFixture<Tab3Page>;
  let svc: AlumnoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlumnoService);
    jasmine.clock().install();
    jasmine.clock().mockDate(HOY);
    sembrarAlumnos();
    fixture = TestBed.createComponent(Tab3Page);
    component = fixture.componentInstance;
    component.ionViewWillEnter();
    fixture.detectChanges();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.clear();
  });

  it('lista solo alumnos activos y busca por nombre', () => {
    expect(component).toBeTruthy();
    expect(component.alumnos.map((a) => a.nombre)).toEqual(['Gabriel', 'Ana']);

    component.busqueda = 'díaz';
    expect(component.filtrados.map((a) => a.nombre)).toEqual(['Ana']);
  });

  it('muestra el total cobrado del año', () => {
    expect(component.totalAnio).toBe(14000);
    expect(component.cantidadAnio).toBe(1);
  });

  it('crea el comprobante con el mes y monto elegidos y marca la cuota como pagada', () => {
    const gabriel = component.alumnos.find((a) => a.nombre === 'Gabriel')!;

    component.abrirFormulario(gabriel);
    expect(component.formMonto).toBe(15000);

    component.formMes = 3;
    component.formAnio = 2026;
    component.formMonto = 18000;
    component.crearComprobante();

    const alumno = svc.getById(gabriel.id)!;
    expect(svc.estaPagadoMes(alumno, 3, 2026)).toBeTrue();
    expect(svc.getMontoPago(alumno, 3, 2026)).toBe(18000);
    expect(component.isPreviewOpen).toBeTrue();
    expect(component.comprobanteSeleccionado?.alumnoNombre).toBe('Gabriel Pérez');
    expect(component.comprobanteSeleccionado?.monto).toBe(18000);
    expect(component.comprobanteSeleccionado?.numero).toBe(2);
  });

  it('no crea el comprobante si el monto no es válido', () => {
    const ana = component.alumnos.find((a) => a.nombre === 'Ana')!;

    component.abrirFormulario(ana);
    component.formMonto = 0;
    component.crearComprobante();

    expect(component.isPreviewOpen).toBeFalse();
    expect(svc.getComprobantes({ anio: 2026 }).length).toBe(1); // solo el cobro previo de Gabriel
  });

  it('permite reabrir un comprobante anterior del alumno', () => {
    const gabriel = component.alumnos.find((a) => a.nombre === 'Gabriel')!;

    component.abrirFormulario(gabriel);
    expect(component.comprobantesAlumno.length).toBe(1);

    component.abrirPreview(component.comprobantesAlumno[0]);
    expect(component.isPreviewOpen).toBeTrue();
    expect(component.comprobanteSeleccionado?.monto).toBe(14000);
  });
});
