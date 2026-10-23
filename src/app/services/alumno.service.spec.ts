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

describe('AlumnoService pagos y comprobantes', () => {
  let svc: AlumnoService;
  const HOY = new Date(2026, 9, 12, 10, 0, 0); // 12/10/2026 10:00

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlumnoService);
    jasmine.clock().install();
    jasmine.clock().mockDate(HOY);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('registrarPago guarda monto real, fecha y número de comprobante', () => {
    const alumno = svc.crear({ nombre: 'Gabriel', apellido: 'Pérez', diaEntrada: 5, montoMensual: 15000 });

    const actualizado = svc.registrarPago(alumno.id, 3, 2026, 18000);
    const pago = actualizado?.pagos.find((p) => p.mes === 3 && p.anio === 2026);

    expect(pago?.pagado).toBeTrue();
    expect(pago?.montoPagado).toBe(18000);
    expect(pago?.numeroComprobante).toBe(1);
    expect(pago?.fechaPago).toBe(HOY.toISOString());
    expect(svc.getMontoPago(actualizado!, 3, 2026)).toBe(18000);
  });

  it('registrar sin monto usa la cuota del alumno', () => {
    const alumno = svc.crear({ nombre: 'Ana', apellido: '', diaEntrada: 5, montoMensual: 15000 });
    svc.togglePagoMes(alumno.id, 10, 2026);

    const [comprobante] = svc.getComprobantes({ mes: 10, anio: 2026 });
    expect(comprobante.monto).toBe(15000);
  });

  it('las cuentas del dashboard usan el monto realmente cobrado', () => {
    const alumno = svc.crear({ nombre: 'Ana', apellido: '', diaEntrada: 5, montoMensual: 15000 });
    svc.registrarPago(alumno.id, 10, 2026, 12000);

    expect(svc.getStats().montoCobrado).toBe(12000);
    expect(svc.getHistorialIngresos(1)[0].total).toBe(12000);
    expect(svc.getEstadisticasAnio(2026).total).toBe(12000);
  });

  it('desmarcarPago borra monto, fecha y número del comprobante', () => {
    const alumno = svc.crear({ nombre: 'Ana', apellido: '', diaEntrada: 5, montoMensual: 15000 });
    svc.registrarPago(alumno.id, 10, 2026, 12000);

    const actualizado = svc.desmarcarPago(alumno.id, 10, 2026);
    const pago = actualizado?.pagos.find((p) => p.mes === 10 && p.anio === 2026);

    expect(pago?.pagado).toBeFalse();
    expect(pago?.montoPagado).toBeUndefined();
    expect(pago?.fechaPago).toBeUndefined();
    expect(pago?.numeroComprobante).toBeUndefined();
    expect(svc.getStats().montoCobrado).toBe(0);
  });

  it('numera los pagos viejos en orden cronológico al leerlos', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Ana', apellido: '', diaEntrada: 1, montoMensual: 10000, activo: true,
        fechaRegistro: '2026-01-01T12:00:00', historialMontos: [],
        pagos: [
          { mes: 8, anio: 2026, pagado: true, fechaPago: '2026-08-05T10:00:00.000Z' },
          { mes: 9, anio: 2026, pagado: true, fechaPago: '2026-09-05T10:00:00.000Z' },
        ],
      },
      {
        id: 2, nombre: 'Beto', apellido: '', diaEntrada: 1, montoMensual: 12000, activo: true,
        fechaRegistro: '2026-01-01T12:00:00', historialMontos: [],
        pagos: [{ mes: 10, anio: 2026, pagado: true, fechaPago: '2026-10-05T10:00:00.000Z' }],
      },
    ]));
    svc['invalidar']();

    const comprobantes = svc.getComprobantes();
    expect(comprobantes.map((c) => c.numero)).toEqual([3, 2, 1]);
    expect(comprobantes[0].fechaPago).toBe('2026-10-05T10:00:00.000Z');
  });

  it('un pago viejo sin monto se cuenta con la cuota del alumno', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Ana', apellido: '', diaEntrada: 1, montoMensual: 10000, activo: true,
        fechaRegistro: '2026-01-01T12:00:00', historialMontos: [],
        pagos: [{ mes: 10, anio: 2026, pagado: true, fechaPago: '2026-10-05T10:00:00.000Z' }],
      },
    ]));
    svc['invalidar']();

    expect(svc.getStats().montoCobrado).toBe(10000);
    expect(svc.getComprobantes({ mes: 10, anio: 2026 })[0].monto).toBe(10000);
  });

  it('getComprobantes filtra por mes y año y no incluye meses impagos', () => {
    const alumno = svc.crear({ nombre: 'Ana', apellido: '', diaEntrada: 5, montoMensual: 15000 });
    svc.registrarPago(alumno.id, 3, 2026, 15000);
    svc.registrarPago(alumno.id, 4, 2026, 14000);

    expect(svc.getComprobantes({ mes: 3, anio: 2026 }).length).toBe(1);
    expect(svc.getComprobantes({ anio: 2026 }).length).toBe(2);
    expect(svc.getComprobantes({ mes: 5, anio: 2026 }).length).toBe(0);
    expect(svc.getComprobantes({ mes: 3, anio: 2025 }).length).toBe(0);
  });
});

describe('AlumnoService estado de pago del mes', () => {
  let svc: AlumnoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlumnoService);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 12, 10, 0, 0)); // 12 de octubre de 2026, 10:00
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('registrado hoy con día de cobro 19 muestra "Faltan 7 días", no "Vence hoy"', () => {
    const alumno = svc.crear({ nombre: 'Ana', apellido: 'Pérez', diaEntrada: 19, montoMensual: 10000 });
    const estado = svc.getEstadoPagoMes(alumno);
    expect(estado.texto).toBe('Faltan 7 días');
    expect(estado.pasado).toBeFalse();
  });

  it('registrado este mes (día 1) con día de cobro 19 no se marca vencido antes del 19', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Luis', apellido: '', diaEntrada: 19, montoMensual: 10000, activo: true,
        fechaRegistro: '2026-10-01T12:00:00',
        pagos: [{ mes: 10, anio: 2026, pagado: false }],
        historialMontos: [],
      },
    ]));
    svc['invalidar']();
    expect(svc.getEstadoPagoMes(svc.getAll()[0]).texto).toBe('Faltan 7 días');
  });

  it('un día antes del cobro muestra "Falta 1 día" (singular)', () => {
    const alumno = svc.crear({ nombre: 'Ana', apellido: '', diaEntrada: 13, montoMensual: 10000 });
    expect(svc.getEstadoPagoMes(alumno).texto).toBe('Falta 1 día');
  });

  it('si hoy es el día de cobro muestra "Vence hoy"', () => {
    const alumno = svc.crear({ nombre: 'Ana', apellido: '', diaEntrada: 12, montoMensual: 10000 });
    expect(svc.getEstadoPagoMes(alumno).texto).toBe('Vence hoy');
  });

  it('pasado el día de cobro cuenta los días vencidos desde ese día', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Luis', apellido: '', diaEntrada: 5, montoMensual: 10000, activo: true,
        fechaRegistro: '2026-10-01T12:00:00',
        pagos: [{ mes: 10, anio: 2026, pagado: false }],
        historialMontos: [],
      },
    ]));
    svc['invalidar']();
    expect(svc.getEstadoPagoMes(svc.getAll()[0]).texto).toBe('Venció hace 7 días');
  });

  it('mes de registro impago (septiembre) cuenta desde el día de cobro, no desde el registro', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Luis', apellido: '', diaEntrada: 19, montoMensual: 10000, activo: true,
        fechaRegistro: '2026-09-05T12:00:00',
        pagos: [{ mes: 9, anio: 2026, pagado: false }, { mes: 10, anio: 2026, pagado: false }],
        historialMontos: [],
      },
    ]));
    svc['invalidar']();
    expect(svc.getEstadoPagoMes(svc.getAll()[0]).texto).toBe('Venció hace 12 días');
  });

  it('alumno registrado en un mes anterior con todos los meses anteriores pagados muestra los días que faltan', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Luis', apellido: '', diaEntrada: 19, montoMensual: 10000, activo: true,
        fechaRegistro: '2026-09-05T12:00:00',
        pagos: [{ mes: 9, anio: 2026, pagado: true }, { mes: 10, anio: 2026, pagado: false }],
        historialMontos: [],
      },
    ]));
    svc['invalidar']();
    const estado = svc.getEstadoPagoMes(svc.getAll()[0]);
    expect(estado.texto).toBe('Faltan 7 días');
    expect(estado.pasado).toBeFalse();
  });
});

describe('AlumnoService estado de cuenta', () => {
  let svc: AlumnoService;
  const HOY = new Date(2026, 9, 12, 10, 0, 0); // 12/10/2026 10:00

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(AlumnoService);
    jasmine.clock().install();
    jasmine.clock().mockDate(HOY);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('lista las cuotas impagas del más viejo al más nuevo', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Ana', apellido: 'Pérez', diaEntrada: 5, montoMensual: 10000, activo: true,
        fechaRegistro: '2026-08-01T12:00:00', historialMontos: [],
        pagos: [{ mes: 8, anio: 2026, pagado: true, fechaPago: '2026-08-05T10:00:00.000Z' }],
      },
    ]));
    svc['invalidar']();

    const impagos = svc.getMesesImpagosLista(svc.getById(1)!);
    expect(impagos.map((m) => `${m.mes}/${m.anio}`)).toEqual(['9/2026', '10/2026']);
    expect(impagos.every((m) => m.monto === 10000)).toBeTrue();
  });

  it('no lista meses anteriores al alta del alumno', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Luis', apellido: '', diaEntrada: 19, montoMensual: 9000, activo: true,
        fechaRegistro: '2026-10-05T12:00:00', historialMontos: [], pagos: [],
      },
    ]));
    svc['invalidar']();

    expect(svc.getMesesImpagosLista(svc.getById(1)!).map((m) => m.mes)).toEqual([10]);
  });

  it('consolida pagos, comprobantes y totales del año', () => {
    const alumno = svc.crear({ nombre: 'Gabriel', apellido: 'Pérez', diaEntrada: 5, montoMensual: 15000 });
    svc.registrarPago(alumno.id, 3, 2026, 18000);
    svc.registrarPago(alumno.id, 4, 2026, 15000);

    const cuenta = svc.getEstadoCuenta(alumno.id)!;
    expect(cuenta.pagos.map((p) => p.mes)).toEqual([4, 3]);
    expect(cuenta.pagos.find((p) => p.mes === 3)?.numeroComprobante).toBe(1);
    expect(cuenta.pagos.find((p) => p.mes === 4)?.monto).toBe(15000);
    expect(cuenta.totalCobrado).toBe(33000);
    expect(cuenta.cantidadPagos).toBe(2);
    expect(cuenta.anio).toEqual({ numero: 2026, cobrado: 33000, cantidad: 2 });
    expect(cuenta.impagos.map((m) => m.mes)).toEqual([10]);
  });

  it('un pago viejo sin monto se cuenta con la cuota actual', () => {
    localStorage.setItem('alumnos', JSON.stringify([
      {
        id: 1, nombre: 'Ana', apellido: '', diaEntrada: 5, montoMensual: 12000, activo: true,
        fechaRegistro: '2026-01-01T12:00:00', historialMontos: [],
        pagos: [{ mes: 9, anio: 2026, pagado: true }],
      },
    ]));
    svc['invalidar']();

    const cuenta = svc.getEstadoCuenta(1)!;
    expect(cuenta.totalCobrado).toBe(12000);
    expect(cuenta.pagos[0].monto).toBe(12000);
  });

  it('devuelve null si el alumno no existe', () => {
    expect(svc.getEstadoCuenta(12345)).toBeNull();
  });
});
