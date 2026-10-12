import { Injectable } from '@angular/core';

export interface AppSettings {
  tema: string;
}

const DEFAULTS: AppSettings = {
  tema: 'bordeaux',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'app_settings';

  get(): AppSettings {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return { ...DEFAULTS };
      const parsed = JSON.parse(data);
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  }

  set(cambios: Partial<AppSettings>): AppSettings {
    const actual = this.get();
    const nuevo = { ...actual, ...cambios };
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(nuevo));
    } catch {
      console.error('Error guardando la configuración');
    }
    return nuevo;
  }
}
