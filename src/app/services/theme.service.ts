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

export const TEMAS: Tema[] = [
  { id: 'bordeaux', nombre: 'Bordó', primario: '#550000', primarioRgb: '85, 0, 0', primarioShade: '#4c0000', primarioTint: '#690000' },
  { id: 'azul', nombre: 'Azul noche', primario: '#1a2c56', primarioRgb: '26, 44, 86', primarioShade: '#16243f', primarioTint: '#2c3f6b' },
  { id: 'verde', nombre: 'Verde bosque', primario: '#1e5140', primarioRgb: '30, 81, 64', primarioShade: '#184134', primarioTint: '#2c6350' },
  { id: 'violeta', nombre: 'Violeta', primario: '#4a1d5e', primarioRgb: '74, 29, 94', primarioShade: '#3b174b', primarioTint: '#5d2f72' },
  { id: 'petroleo', nombre: 'Petróleo', primario: '#00504f', primarioRgb: '0, 80, 79', primarioShade: '#00403f', primarioTint: '#15605f' },
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
  }

  aplicarGuardado(): void {
    this.aplicar(this.settings.get().tema);
  }
}