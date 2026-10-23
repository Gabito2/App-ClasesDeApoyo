import { TestBed } from '@angular/core/testing';

import { AlumnoService } from './alumno.service';
import { WhatsappService } from './whatsapp.service';

/** Siembra dos alumnos: Ana debe dos cuotas y Beto no tiene teléfono. */
function sembrarAlumnos(): void {
  const base = {
    activo: true,
    diaEntrada: 5,
    montoMensual: 10000,
    historialMontos: [],
    fechaRegistro: '2026-07-01T12:00:00',
  };
  localStorage.setItem(
    'alumnos',
    JSON.stringify([
      {
        ...base,
        id: 1,
        nombre: 'Ana',
        apellido: 'Pérez',
        pagos: [
          { mes: 7, anio: 2026, pagado: true, montoPagado: 10000, fechaPago: '2026-07-05T10:00:00.000Z' },
          { mes: 8, anio: 2026, pagado: true, montoPagado: 10000, fechaPago: '2026-08-05T10:00:00.000Z' },
        ],
      },
      { ...base, id: 2, nombre: 'Beto', apellido: 'Gómez', telefono: '11 2233-4455', pagos: [] },
    ])
  );
}

describe('WhatsappService estado de cuenta', () => {
  let svc: AlumnoService;
  let wa: WhatsappService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlumnoService);
    wa = TestBed.inject(WhatsappService);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 12, 10, 0, 0));
    sembrarAlumnos();
    svc['invalidar']();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.clear();
  });

  it('detalla la deuda mes por mes y el total', () => {
    const texto = wa.textoEstadoCuenta(svc.getById(1)!);

    expect(texto).toContain('Hola Ana Pérez!');
    expect(texto).toContain('*Cuota:* $10.000 por mes (vence el día 5)');
    expect(texto).toContain('*Pagado hasta hoy:* $20.000 (2 cuotas)');
    expect(texto).toContain('*Deuda:* $20.000 (2 cuotas)');
    expect(texto).toContain('• septiembre 2026 — $10.000');
    expect(texto).toContain('• octubre 2026 — $10.000');
  });

  it('sin cuotas pendientes el mensaje lo aclara', () => {
    svc.registrarPago(1, 9, 2026);
    svc.registrarPago(1, 10, 2026);

    const texto = wa.textoEstadoCuenta(svc.getById(1)!);
    expect(texto).toContain('No tenés cuotas pendientes');
    expect(texto).not.toContain('*Deuda:*');
  });

  it('el enlace de deuda codifica el resumen y limpia el teléfono', () => {
    const enlace = wa.crearEnlace(svc.getById(2)!, 'deuda');

    expect(enlace).toContain('https://wa.me/1122334455?text=');
    expect(decodeURIComponent(enlace!.split('text=')[1])).toContain('*Deuda:* $40.000 (4 cuotas)');
  });

  it('sin teléfono no arma enlace', () => {
    expect(wa.crearEnlaceEstadoCuenta(svc.getById(1)!)).toBeNull();
  });
});
