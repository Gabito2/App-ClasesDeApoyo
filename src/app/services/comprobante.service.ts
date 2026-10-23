import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Comprobante } from '../models/alumno.model';

/**
 * Arma los comprobantes de pago: el texto que se manda por WhatsApp y la
 * imagen que se comparte como archivo. La imagen se dibuja con canvas para no
 * depender de librerías externas y que se vea igual en web y en Android.
 */
@Injectable({ providedIn: 'root' })
export class ComprobanteService {
  private readonly MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  mesLabel(mes: number): string {
    return this.MESES[mes - 1] ?? '';
  }

  /** Número visible del comprobante, con ceros a la izquierda (0001). */
  numeroTexto(numero: number): string {
    return String(numero).padStart(4, '0');
  }

  /** Fecha del cobro en formato dd/mm/aaaa (vacía si el pago no la tiene). */
  fechaTexto(comprobante: Comprobante): string {
    if (!comprobante.fechaPago) return '—';
    const fecha = new Date(comprobante.fechaPago);
    if (isNaN(fecha.getTime())) return '—';
    return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
  }

  /** Texto listo para WhatsApp o para acompañar la imagen. */
  texto(comprobante: Comprobante): string {
    const lineas = [
      `🧾 *Comprobante de pago Nº ${this.numeroTexto(comprobante.numero)}*`,
      '',
      `*Alumno:* ${comprobante.alumnoNombre}`,
      `*Cuota:* ${this.mesLabel(comprobante.mes)} ${comprobante.anio}`,
      `*Monto:* $${comprobante.monto.toLocaleString('es-AR')}`,
    ];
    if (comprobante.fechaPago) {
      lineas.push(`*Fecha de pago:* ${this.fechaTexto(comprobante)}`);
    }
    lineas.push('', 'Clases de Apoyo');
    return lineas.join('\n');
  }

  /** Enlace de WhatsApp con el texto del comprobante, o null si no hay teléfono. */
  crearEnlaceWhatsApp(comprobante: Comprobante): string | null {
    const telefono = comprobante.telefono?.replace(/\D/g, '');
    if (!telefono) return null;
    return `https://wa.me/${telefono}?text=${encodeURIComponent(this.texto(comprobante))}`;
  }

  abrirWhatsApp(comprobante: Comprobante): boolean {
    const url = this.crearEnlaceWhatsApp(comprobante);
    if (!url) return false;
    window.open(url, '_system');
    return true;
  }

  /**
   * Comparte el comprobante como imagen (PNG). En Android/iOS abre el panel de
   * compartir con el archivo; en el navegador usa el share nativo si existe o
   * descarga la imagen. Devuelve false si no se pudo generar o compartir.
   */
  async compartirImagen(comprobante: Comprobante): Promise<boolean> {
    const nombre = `comprobante_${this.numeroTexto(comprobante.numero)}.png`;
    try {
      const blob = await this.generarImagen(comprobante);

      if (Capacitor.isNativePlatform()) {
        const base64 = await this.blobABase64(blob);
        const { uri } = await Filesystem.writeFile({ path: nombre, data: base64, directory: Directory.Cache });
        await Share.share({
          title: 'Comprobante de pago',
          text: this.texto(comprobante),
          files: [uri],
          dialogTitle: 'Compartir comprobante',
        });
        return true;
      }

      const archivo = new File([blob], nombre, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      const datos: ShareData = { files: [archivo], text: this.texto(comprobante), title: 'Comprobante de pago' };
      if (nav.share && nav.canShare?.(datos)) {
        await nav.share(datos);
        return true;
      }

      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      // Cancelar el panel de compartir no es un error: no mostramos alarma
      if (error instanceof DOMException && error.name === 'AbortError') return true;
      return false;
    }
  }

  /** Dibuja el comprobante y lo devuelve como PNG de 900x1200. */
  async generarImagen(comprobante: Comprobante): Promise<Blob> {
    const ancho = 900;
    const alto = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo dibujar el comprobante');

    const primario = this.colorPrimario();
    const margen = 40;
    const anchoTarjeta = ancho - margen * 2;
    const centro = ancho / 2;

    ctx.fillStyle = '#f4f4f6';
    ctx.fillRect(0, 0, ancho, alto);

    // Tarjeta blanca con sombra suave
    ctx.save();
    ctx.shadowColor = 'rgba(16, 24, 40, 0.12)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    this.rectanguloRedondeado(ctx, margen, margen, anchoTarjeta, alto - margen * 2, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Cabecera del color del tema, recortada a las esquinas de la tarjeta
    ctx.save();
    this.rectanguloRedondeado(ctx, margen, margen, anchoTarjeta, alto - margen * 2, 28);
    ctx.clip();
    ctx.fillStyle = primario;
    ctx.fillRect(margen, margen, anchoTarjeta, 300);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '600 22px Arial, sans-serif';
    ctx.fillText('CLASES DE APOYO', centro, 118);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 36px Arial, sans-serif';
    ctx.fillText('COMPROBANTE DE PAGO', centro, 180);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '600 26px Arial, sans-serif';
    ctx.fillText(`Nº ${this.numeroTexto(comprobante.numero)}`, centro, 232);

    // Monto cobrado
    ctx.fillStyle = '#9a9aa0';
    ctx.font = '600 20px Arial, sans-serif';
    ctx.fillText('MONTO ABONADO', centro, 410);

    const monto = `$${comprobante.monto.toLocaleString('es-AR')}`;
    ctx.fillStyle = '#1a1a1a';
    this.ajustarFuente(ctx, monto, '700', 88, anchoTarjeta - 120);
    ctx.fillText(monto, centro, 505);

    // Sello "PAGADO"
    ctx.fillStyle = 'rgba(80, 120, 88, 0.14)';
    this.rectanguloRedondeado(ctx, centro - 100, 540, 200, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#40704a';
    ctx.font = '700 22px Arial, sans-serif';
    ctx.fillText('PAGADO', centro, 575);

    this.linea(ctx, margen + 70, 640, ancho - margen - 70, 640);

    // Datos del pago
    const filas: { etiqueta: string; valor: string }[] = [
      { etiqueta: 'ALUMNO', valor: comprobante.alumnoNombre },
      { etiqueta: 'CUOTA', valor: `${this.mesLabel(comprobante.mes)} ${comprobante.anio}` },
      { etiqueta: 'FECHA DE PAGO', valor: this.fechaTexto(comprobante) },
    ];

    this.linea(ctx, margen + 70, 985, ancho - margen - 70, 985);

    const izquierda = margen + 70;
    const derecha = ancho - margen - 70;
    let y = 705;
    for (const fila of filas) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9a9aa0';
      ctx.font = '600 20px Arial, sans-serif';
      ctx.fillText(fila.etiqueta, izquierda, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#1a1a1a';
      this.ajustarFuente(ctx, fila.valor, '600', 32, derecha - izquierda - 220);
      ctx.fillText(fila.valor, derecha, y);
      y += 95;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#555555';
    ctx.font = '600 26px Arial, sans-serif';
    ctx.fillText('Gracias por tu pago', centro, 1045);

    ctx.fillStyle = '#9a9aa0';
    ctx.font = '400 18px Arial, sans-serif';
    ctx.fillText('Comprobante generado desde la app', centro, 1085);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la imagen'));
      }, 'image/png');
    });
  }

  /** Color primario del tema activo, con el bordó de la app como respaldo. */
  private colorPrimario(): string {
    if (typeof document === 'undefined') return '#550000';
    const valor = getComputedStyle(document.documentElement).getPropertyValue('--ion-color-primary').trim();
    return valor || '#550000';
  }

  /** Reduce el tamaño de fuente hasta que el texto entre en el ancho disponible. */
  private ajustarFuente(ctx: CanvasRenderingContext2D, texto: string, peso: string, tamano: number, anchoMaximo: number): void {
    let actual = tamano;
    ctx.font = `${peso} ${actual}px Arial, sans-serif`;
    while (actual > 18 && ctx.measureText(texto).width > anchoMaximo) {
      actual -= 2;
      ctx.font = `${peso} ${actual}px Arial, sans-serif`;
    }
  }

  private linea(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
    ctx.strokeStyle = '#ececf0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private rectanguloRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, ancho: number, alto: number, radio: number): void {
    const r = Math.min(radio, ancho / 2, alto / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + ancho - r, y);
    ctx.arcTo(x + ancho, y, x + ancho, y + r, r);
    ctx.lineTo(x + ancho, y + alto - r);
    ctx.arcTo(x + ancho, y + alto, x + ancho - r, y + alto, r);
    ctx.lineTo(x + r, y + alto);
    ctx.arcTo(x, y + alto, x, y + alto - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private blobABase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onerror = () => reject(lector.error);
      lector.onload = () => {
        const resultado = String(lector.result ?? '');
        resolve(resultado.slice(resultado.indexOf(',') + 1));
      };
      lector.readAsDataURL(blob);
    });
  }
}
