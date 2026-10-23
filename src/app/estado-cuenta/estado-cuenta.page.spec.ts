import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { EstadoCuentaPage } from './estado-cuenta.page';

const HOY = new Date(2026, 9, 12, 10, 0, 0); // 12/10/2026 10:00

/** Siembra un alumno registrado en julio con dos cuotas pagas. */
function sembrarAlumno(telefono?: string): void {
  localStorage.setItem(
    'alumnos',
    JSON.stringify([
      {
        id: 1,
        nombre: 'Ana',
        apellido: 'Pérez',
        diaEntrada: 5,
        montoMensual: 10000,
        activo: true,
        telefono,
        fechaRegistro: '2026-07-01T12:00:00',
        historialMontos: [],
        pagos: [
          { mes: 7, anio: 2026, pagado: true, montoPagado: 10000, fechaPago: '2026-07-05T10:00:00.000Z' },
          { mes: 8, anio: 2026, pagado: true, montoPagado: 10000, fechaPago: '2026-08-05T10:00:00.000Z' },
        ],
      },
    ])
  );
}

function crearComponente(): EstadoCuentaPage {
  const fixture: ComponentFixture<EstadoCuentaPage> = TestBed.createComponent(EstadoCuentaPage);
  const component = fixture.componentInstance;
  component.ionViewWillEnter();
  fixture.detectChanges();
  return component;
}

describe('EstadoCuentaPage', () => {
  beforeEach(() => {
    localStorage.clear();
    jasmine.clock().install();
    jasmine.clock().mockDate(HOY);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      ],
    });
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.clear();
  });

  it('muestra la deuda, los pagos y el estado del mes', () => {
    sembrarAlumno('1122334455');
    const component = crearComponente();

    expect(component.cuenta?.alumno.nombre).toBe('Ana');
    expect(component.iniciales).toBe('AP');
    expect(component.cuenta?.deuda).toEqual({ meses: 2, monto: 20000 });
    expect(component.cuenta?.pagos.length).toBe(2);
    expect(component.estado.pasado).toBeTrue();
    expect(component.claseEstado()).toBe('mora');
  });

  it('abre WhatsApp con el resumen cuando el alumno tiene teléfono', () => {
    sembrarAlumno('1122334455');
    const component = crearComponente();
    const abrir = spyOn(window, 'open').and.returnValue(null);

    component.enviarWhatsApp();

    expect(abrir).toHaveBeenCalled();
    expect(String(abrir.calls.mostRecent().args[0])).toContain('https://wa.me/1122334455?text=');
  });

  it('avisa cuando el alumno no tiene teléfono', () => {
    sembrarAlumno();
    const component = crearComponente();
    const abrir = spyOn(window, 'open');

    component.enviarWhatsApp();

    expect(abrir).not.toHaveBeenCalled();
    expect(component.toastMsg).toBe('El alumno no tiene teléfono cargado');
  });

  it('con un id inexistente deja la cuenta vacía', () => {
    const component = crearComponente();

    expect(component.cuenta).toBeNull();
    expect(component.claseEstado()).toBe('pendiente');
  });
});
