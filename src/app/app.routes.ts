import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'estado-cuenta/:id',
    loadComponent: () => import('./estado-cuenta/estado-cuenta.page').then((m) => m.EstadoCuentaPage),
  },
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
];
