import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tab3Page } from './tab3.page';
import { AlumnoService } from '../services/alumno.service';
import { Alumno } from '../models/alumno.model';
import { SearchbarCustomEvent } from '@ionic/angular';

describe('Tab3Page', () => {
  let component: Tab3Page;
  let fixture: ComponentFixture<Tab3Page>;

  beforeEach(async () => {
    localStorage.clear();
    const alumno: Alumno = {
      id: 1,
      nombre: 'Juan',
      apellido: 'Perez',
      diaEntrada: 10,
      montoMensual: 5000,
      activo: true,
      pagos: [
        { mes: 7, anio: 2026, pagado: true, fechaPago: '2026-07-10T12:00:00.000Z' },
        { mes: 8, anio: 2026, pagado: false },
      ],
      historialMontos: [{ monto: 5000, fecha: '2026-01-01T00:00:00.000Z' }],
    };
    localStorage.setItem('alumnos', JSON.stringify([alumno]));

    await TestBed.configureTestingModule({
      imports: [Tab3Page],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab3Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens modal without hanging or throwing', () => {
    component.ionViewDidEnter();
    fixture.detectChanges();

    const svc = TestBed.inject(AlumnoService);
    component.abrirModal(svc.getById(1)!);
    fixture.detectChanges();

    const pagos = component.historialPagos;
    expect(pagos.length).toBe(2);
    expect(component.pagados).toBe(component.meses.filter((m) => m.pagado).length);
    expect(component.selectedAlumno?.id).toBe(1);
  });

  it('toggles a month without throwing', () => {
    component.ionViewDidEnter();
    fixture.detectChanges();
    const svc = TestBed.inject(AlumnoService);
    component.abrirModal(svc.getById(1)!);
    fixture.detectChanges();
    const mes = component.meses.find((m) => m.mes === 8 && m.anio === 2026)!;
    component.toggleMes(mes);
    fixture.detectChanges();
    expect(svc.estaPagadoMes(svc.getById(1)!, 8, 2026)).toBeTrue();
  });

  it('keeps stable array references across change detection (no infinite loop)', () => {
    component.ionViewDidEnter();
    fixture.detectChanges();
    const svc = TestBed.inject(AlumnoService);
    component.abrirModal(svc.getById(1)!);
    fixture.detectChanges();

    const refHistorial = component.historialPagos;
    const refLista = component.alumnosFiltrados;
    fixture.detectChanges();
    fixture.detectChanges();
    expect(component.historialPagos).toBe(refHistorial);
    expect(component.alumnosFiltrados).toBe(refLista);

    component.onBuscar({ detail: { value: 'perez' } } as SearchbarCustomEvent);
    fixture.detectChanges();
    expect(component.alumnosFiltrados.length).toBe(1);
    component.onBuscar({ detail: { value: '' } } as SearchbarCustomEvent);
    fixture.detectChanges();
    expect(component.alumnosFiltrados.length).toBe(1);
  });
});