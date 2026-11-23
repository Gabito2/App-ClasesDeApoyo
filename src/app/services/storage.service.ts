import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Problemas de persistencia que la UI debe mostrar al usuario. */
export type ProblemaAlmacenamiento = 'corrupto' | 'guardado';

@Injectable({ providedIn: 'root' })
export class StorageService {
  /**
   * Emite cuando un dato no se pudo leer o guardar. Es un BehaviorSubject para
   * que un fallo ocurrido antes de que la app termine de arrancar igual se
   * muestre cuando alguien se suscribe.
   */
  readonly problemas$ = new BehaviorSubject<ProblemaAlmacenamiento | null>(null);

  getData<T>(key: string): T[] {
    const raw = this.leer(key);
    if (raw === null) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`No se pudo interpretar "${key}"`, error);
      // Antes de devolver vacío, rescatamos el original: si la app sigue
      // escribiendo, el dato dañado ya no se pierde.
      this.preservarCorrupto(key, raw);
      this.problemas$.next('corrupto');
      return [];
    }
  }

  /** Devuelve `false` si el guardado falló (por ejemplo, sin espacio). */
  setData<T>(key: string, data: T[]): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`No se pudo guardar "${key}"`, error);
      this.problemas$.next('guardado');
      return false;
    }
  }

  clear(): void {
    localStorage.clear();
  }

  private leer(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /** Copia el contenido dañado a una clave aparte, con marca de tiempo. */
  private preservarCorrupto(key: string, raw: string): void {
    try {
      localStorage.setItem(`${key}_corrupto_${Date.now()}`, raw);
    } catch {
      // Sin espacio no hay dónde copiarlo; el aviso al usuario sigue saliendo.
    }
  }
}
