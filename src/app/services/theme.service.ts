import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service';

export interface Tema {
  id: string;
  nombre: string;
  primario: string;
  primarioRgb: string;
  primarioShade: string;
  primarioTint: string;
}

/**
 * Temas de la app: variantes de borgoña/vino.
 * Todos tienen contraste suficiente con texto blanco en los botones.
 */
export const TEMAS: Tema[] = [
  { id: 'borgona', nombre: 'Borgoña', primario: '#6a1220', primarioRgb: '106, 18, 32', primarioShade: '#54101a', primarioTint: '#8c2f3c' },
  { id: 'vino', nombre: 'Vino', primario: '#8c2f3c', primarioRgb: '140, 47, 60', primarioShade: '#6a1220', primarioTint: '#a3546a' },
  { id: 'cereza', nombre: 'Cereza', primario: '#a03246', primarioRgb: '160, 50, 70', primarioShade: '#8c2f3c', primarioTint: '#b8576a' },
  { id: 'cepas', nombre: 'Cepas', primario: '#54101a', primarioRgb: '84, 16, 26', primarioShade: '#3d0a12', primarioTint: '#6a1220' },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private settings = inject(SettingsService);

  getById(id: string): Tema {
    return TEMAS.find((t) => t.id === id) ?? TEMAS[0];
  }

  aplicar(temaId: string): void {
    const tema = this.getById(temaId);
    const root = document.documentElement;
    root.style.setProperty('--ion-color-primary', tema.primario);
    root.style.setProperty('--ion-color-primary-rgb', tema.primarioRgb);
    root.style.setProperty('--ion-color-primary-shade', tema.primarioShade);
    root.style.setProperty('--ion-color-primary-tint', tema.primarioTint);
    this.sincronizarCromoDelNavegador(tema.primario);
  }

  /**
   * Pinta la barra del navegador/PWA con el color de marca activo.
   * Sin esto, elegir otro tema deja el status bar con el bordó por defecto.
   */
  private sincronizarCromoDelNavegador(color: string): void {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', color);
    }
  }

  aplicarGuardado(): void {
    this.aplicar(this.settings.get().tema);
  }
}