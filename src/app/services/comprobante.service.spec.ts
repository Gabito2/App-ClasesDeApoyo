import { TestBed } from '@angular/core/testing';

import { ComprobanteService } from './comprobante.service';
import { Comprobante } from '../models/alumno.model';

describe('ComprobanteService', () => {
  let svc: ComprobanteService;

  const comprobante: Comprobante = {
    numero: 7,
    alumnoId: 1,
    alumnoNombre: 'Gabriel Pérez',
    mes: 3,
    anio: 2026,
    monto: 35000,
    fechaPago: new Date(2026, 2, 12, 10, 0, 0).toISOString(),
    telefono: '11 2233-4455',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ComprobanteService);
  });

  it('arma el texto con número, alumno, cuota, monto y fecha', () => {
    const texto = svc.texto(comprobante);
    expect(texto).toContain('Nº 0007');
    expect(texto).toContain('Gabriel Pérez');
    expect(texto).toContain('Marzo 2026');
    expect(texto).toContain(`$${comprobante.monto.toLocaleString('es-AR')}`);
    expect(texto).toContain('12/03/2026');
  });

  it('crea el enlace de WhatsApp con el texto codificado', () => {
    const url = svc.crearEnlaceWhatsApp(comprobante);
    expect(url).not.toBeNull();
    expect(url!.startsWith('https://wa.me/1122334455?text=')).toBeTrue();
    expect(decodeURIComponent(url!.split('text=')[1])).toContain('Gabriel Pérez');
  });

  it('sin teléfono no genera enlace de WhatsApp', () => {
    expect(svc.crearEnlaceWhatsApp({ ...comprobante, telefono: undefined })).toBeNull();
  });

  it('omite la fecha si el pago viejo no la tiene', () => {
    const texto = svc.texto({ ...comprobante, fechaPago: '' });
    expect(texto).not.toContain('Fecha de pago');
    expect(svc.fechaTexto({ ...comprobante, fechaPago: '' })).toBe('—');
  });

  it('genera la imagen del comprobante en PNG', async () => {
    const blob = await svc.generarImagen(comprobante);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
