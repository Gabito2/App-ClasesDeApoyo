import { TestBed } from '@angular/core/testing';

import { AlumnoService } from './alumno.service';

describe('AlumnoService respaldo', () => {
  let svc: AlumnoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlumnoService);
  });

  it('round-trip: el respaldo exportado se importa reemplazando', () => {
    svc.crear({ nombre: 'Juan', apellido: 'Pérez', diaEntrada: 5, montoMensual: 15000.5 });
    svc.togglePagoMes(svc.getAll()[0].id, new Date().getMonth() + 1, new Date().getFullYear());

    const backup = svc.exportar();
    expect(backup.startsWith('CLASES-BACKUP-V1:')).toBeTrue();

    // Importa en un storage limpio (simula otro dispositivo)
    localStorage.clear();
    svc['invalidar']();

    const res = svc.importar(backup, true);
    expect(res.ok).toBeTrue();

    const importados = svc.getAll();
    expect(importados.length).toBe(1);
    expect(importados[0].nombre).toBe('Juan');
    expect(importados[0].apellido).toBe('Pérez');
    expect(importados[0].diaEntrada).toBe(5);
    expect(importados[0].montoMensual).toBe(15000.5);
    expect(importados[0].id).toBeGreaterThan(0);
  });

  it('el respaldo conserva los acentos de punta a punta', () => {
    svc.crear({ nombre: 'José Ñáñez', apellido: 'Müller', diaEntrada: 3, montoMensual: 1000 });

    const backup = svc.exportar();
    // El contenido viaja en base64: nunca contiene acentos corruptibles
    const codificado = backup.slice('CLASES-BACKUP-V1:'.length);
    expect(/[^\x20-\x7E]/.test(codificado)).toBeFalse();

    localStorage.clear();
    svc['invalidar']();
    expect(svc.importar(backup, true).ok).toBeTrue();

    const importados = svc.getAll();
    expect(importados[0].nombre).toBe('José Ñáñez');
    expect(importados[0].apellido).toBe('Müller');
  });

  it('importar sin reemplazar evita duplicados', () => {
    svc.crear({ nombre: 'Juan', apellido: 'Pérez', diaEntrada: 5, montoMensual: 15000 });

    const backup = svc.exportar();
    const res = svc.importar(backup, false);
    expect(res.ok).toBeTrue();
    expect(svc.getAll().length).toBe(1); // no se duplicó
  });

  it('acepta el formato viejo (JSON con version y alumnos)', () => {
    const viejo = JSON.stringify({
      version: 1,
      exportado: new Date().toISOString(),
      alumnos: [{ id: 123, nombre: 'Ana', apellido: 'García', diaEntrada: 10, montoMensual: 20000, activo: true, pagos: [{ mes: 1, anio: 2026, pagado: true }], historialMontos: [{ monto: 20000, fecha: '2026-01-01T00:00:00.000Z' }] }],
    });

    const res = svc.importar(viejo, true);
    expect(res.ok).toBeTrue();
    expect(svc.getAll().length).toBe(1);
    expect(svc.getAll()[0].nombre).toBe('Ana');
  });

  it('contenido inválido devuelve error', () => {
    expect(svc.importar('', true).ok).toBeFalse();
    expect(svc.importar('no es un respaldo', true).ok).toBeFalse();
    expect(svc.importar('CLASES-BACKUP-V1:no-base64!!', true).ok).toBeFalse();
  });
});
