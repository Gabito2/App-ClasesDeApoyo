import { Directive, OnDestroy, OnInit } from '@angular/core';

/**
 * Marca el contenedor con la clase `entrada` durante la animación inicial.
 *
 * Sin esto, el stagger de las listas se vuelve a disparar cada vez que el
 * usuario tipea en el buscador o cambia un filtro, porque Angular reutiliza
 * los `ion-item` y la animación CSS se reinicia en cada render.
 *
 * Uso: `<ion-list appEntradaLista>`
 */
@Directive({
  selector: '[appEntradaLista]',
  host: { '[class.entrada]': 'activa' },
})
export class EntradaListaDirective implements OnInit, OnDestroy {
  private readonly DURACION_MS = 900;

  activa = true;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => {
      this.activa = false;
    }, this.DURACION_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
