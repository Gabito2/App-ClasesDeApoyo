import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tab1Page } from './tab1.page';

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

describe('Tab1Page', () => {
  let component: Tab1Page;
  let fixture: ComponentFixture<Tab1Page>;

  const porNombre = (nombre: string) => component.alumnos.find((a) => a.nombre === nombre)!;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    jasmine.clock().install();
    jasmine.clock().mockDate(HOY);
    sembrarAlumnos();
    fixture = TestBed.createComponent(Tab1Page);
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

  it('resume cuántos activos están al día y cuántos en mora', () => {
    expect(component.resumen).toEqual({ alDia: 1, enMora: 1 });
  });

  it('ordena por cuota de mayor a menor', () => {
    component.orden = 'monto';
    expect(component.alumnosFiltrados.map((a) => a.nombre)).toEqual(['Beto', 'Ana', 'Carla']);
  });

  it('clasifica el avatar según el estado de la cuota', () => {
    expect(component.estadoClase(porNombre('Beto'))).toBe('ok');
    expect(component.estadoClase(porNombre('Ana'))).toBe('pendiente');
    expect(component.estadoClase(porNombre('Carla'))).toBe('mora');
  });
});
