import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tab2Page } from './tab2.page';

// El reloj queda fijo en octubre de 2026 para que el estado de cada cuota no
// dependa del día en que se corra la suite.
const HOY = new Date(2026, 9, 12, 10, 0, 0); // 12/10/2026 10:00

/** Siembra tres activos: una cuota vencida, una por vencer y una al día. */
function sembrarAlumnos(): void {
  const base = {
    activo: true,
    telefono: '1122334455',
    historialMontos: [],
    fechaRegistro: new Date(2021, 0, 1, 12, 0, 0).toISOString(),
  };
  const alDiaHastaSeptiembre = [{ mes: 9, anio: 2026, pagado: true, fechaPago: HOY.toISOString() }];
  localStorage.setItem(
    'alumnos',
    JSON.stringify([
      // Cobra el 28: su cuota de octubre todavía no venció.
      { ...base, id: 1, nombre: 'Ana', apellido: 'Pérez', diaEntrada: 28, montoMensual: 10000, pagos: alDiaHastaSeptiembre },
      // Ya pagó octubre.
      {
        ...base,
        id: 2,
        nombre: 'Beto',
        apellido: 'Gómez',
        diaEntrada: 1,
        montoMensual: 12000,
        pagos: [...alDiaHastaSeptiembre, { mes: 10, anio: 2026, pagado: true, fechaPago: HOY.toISOString() }],
      },
      // Sin pagos desde el alta: acumula deuda.
      { ...base, id: 3, nombre: 'Carla', apellido: 'Díaz', diaEntrada: 1, montoMensual: 8000, pagos: [] },
    ])
  );
}

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    jasmine.clock().install();
    jasmine.clock().mockDate(HOY);
    sembrarAlumnos();
    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
    component.ionViewWillEnter();
    fixture.detectChanges();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('agrupa a los activos según el estado de la cuota del mes', () => {
    expect(component.vencidos.map((a) => a.nombre)).toEqual(['Carla']);
    expect(component.porVencer.map((a) => a.nombre)).toEqual(['Ana']);
    expect(component.alDia.map((a) => a.nombre)).toEqual(['Beto']);
    expect(component.totales).toEqual({ vencidos: 1, porVencer: 1, alDia: 1 });
  });

  it('solo ofrece el reclamo masivo para los vencidos con teléfono', () => {
    expect(component.vencidosConTelefono.map((a) => a.nombre)).toEqual(['Carla']);
  });
});
