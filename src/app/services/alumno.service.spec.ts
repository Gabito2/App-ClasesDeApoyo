import { TestBed } from '@angular/core/testing';

import { AlumnoService } from './alumno.service';

describe('AlumnoService CSV', () => {
  let svc: AlumnoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlumnoService);
  });

  it('round-trip: CSV exportado por la app se puede parsear e importar reemplazando', () => {
    svc.crear({ nombre: 'Juan', apellido: 'Pérez', diaEntrada: 5, montoMensual: 15000.5 });

    const csv = svc.exportarCSV();
    const alumnos = svc.csvAAlumnos(csv);

    expect(alumnos.length).toBe(1);
    expect(alumnos[0].nombre).toBe('Juan');
    expect(alumnos[0].apellido).toBe('Pérez');
    expect(alumnos[0].diaEntrada).toBe(5);
    expect(alumnos[0].montoMensual).toBe(15000.5);
    expect(alumnos[0].id).toBeLessThan(0); // id provisorio de CSV

    const res = svc.importar(JSON.stringify({ version: 1, alumnos }), true);
    expect(res.ok).toBeTrue();
    expect(res.cantidad).toBe(1);

    const importados = svc.getAll();
    expect(importados.length).toBe(1);
    expect(importados[0].nombre).toBe('Juan');
    expect(importados[0].apellido).toBe('Pérez');
    expect(importados[0].diaEntrada).toBe(5);
    expect(importados[0].montoMensual).toBe(15000.5);
    expect(importados[0].id).toBeGreaterThan(0);
  });

  it('CSV con nombres entre comillas y coma interna se parsea bien', () => {
    const csv = 'Nombre,Apellido,Día de pago,Monto mensual,Estado,Deuda (meses),Ene 2026,Feb 2026\n' +
      '"López, Ana",García,10,20000,Activo,0,Sí,No\n';
    const alumnos = svc.csvAAlumnos(csv);

    expect(alumnos.length).toBe(1);
    expect(alumnos[0].nombre).toBe('López, Ana');
    expect(alumnos[0].apellido).toBe('García');
    expect(alumnos[0].montoMensual).toBe(20000);
    expect(alumnos[0].activo).toBeTrue();
    expect(svc.estaPagadoMes(alumnos[0], 1, 2026)).toBeTrue();
    expect(svc.estaPagadoMes(alumnos[0], 2, 2026)).toBeFalse();
  });

  it('importar CSV sin reemplazar evita duplicados por nombre y apellido', () => {
    svc.crear({ nombre: 'Juan', apellido: 'Pérez', diaEntrada: 5, montoMensual: 15000 });

    const csv = svc.exportarCSV();
    const alumnos = svc.csvAAlumnos(csv);

    const res = svc.importar(JSON.stringify({ version: 1, alumnos }), false);
    expect(res.ok).toBeTrue();
    expect(svc.getAll().length).toBe(1); // no se duplicó
  });

  it('CSV sin alumnos válidos devuelve lista vacía', () => {
    expect(svc.csvAAlumnos('Nombre,Apellido\n')).toEqual([]);
    expect(svc.csvAAlumnos('no es csv')).toEqual([]);
  });

  it('exportarCSV incluye BOM y conserva los acentos', () => {
    svc.crear({ nombre: 'José', apellido: 'Ñáñez', diaEntrada: 3, montoMensual: 1000 });
    const csv = svc.exportarCSV();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Día de pago');
    expect(csv).toContain('José');
  });

  it('CSV con acentos corruptos (UTF-8 leído como Windows-1252) se repara al importar', () => {
    // "Día" y "Sí" escritos como bytes UTF-8 mal interpretados
    const csvCorrupto =
      'Nombre,Apellido,DÃ\u00ADa de pago,Monto mensual,Estado,Deuda (meses),Ene 2026,Feb 2026\n' +
      'SuÃ¡rez,"MatÃ\u00ADas",19,40000,Activo,1,SÃ\u00AD,No\n';
    const alumnos = svc.csvAAlumnos(csvCorrupto);

    expect(alumnos.length).toBe(1);
    expect(alumnos[0].nombre).toBe('Suárez');
    expect(alumnos[0].apellido).toBe('Matías');
    expect(alumnos[0].diaEntrada).toBe(19);
    expect(svc.estaPagadoMes(alumnos[0], 1, 2026)).toBeTrue();
    expect(svc.estaPagadoMes(alumnos[0], 2, 2026)).toBeFalse();
  });
});