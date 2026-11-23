import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, AlertController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';
import { NotificationService } from './services/notification.service';
import { WidgetService } from './services/widget.service';
import { ThemeService } from './services/theme.service';
import { ProblemaAlmacenamiento, StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private platform = inject(Platform);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private widgetService = inject(WidgetService);
  private themeService = inject(ThemeService);
  private storage = inject(StorageService);
  private alertCtrl = inject(AlertController);
  private lastBack = 0;
  private problemasAvisados = new Set<ProblemaAlmacenamiento>();

  private readonly AVISOS: Record<ProblemaAlmacenamiento, { header: string; message: string }> = {
    corrupto: {
      header: 'No se pudieron leer los datos',
      message:
        'El archivo de datos del teléfono estaba dañado. Guardamos una copia del original y la app abrió sin datos. Importá tu último respaldo desde Ajustes.',
    },
    guardado: {
      header: 'No se pudo guardar',
      message:
        'El último cambio no quedó guardado en el teléfono, probablemente por falta de espacio. Exportá un respaldo desde Ajustes y liberá espacio antes de seguir.',
    },
  };

  private isOnHomeTab(): boolean {
    const url = this.router.url;
    return url === '/tabs/tab1' || url === '/tabs/tab1/' || url === '/tabs';
  }

  ngOnInit() {
    this.themeService.aplicarGuardado();

    // Los fallos de lectura/escritura no pueden quedar solo en la consola:
    // el usuario tiene que enterarse antes de seguir cargando pagos.
    this.storage.problemas$.subscribe((problema) => {
      if (problema) void this.avisarProblema(problema);
    });

    this.platform.ready().then(() => {
      this.notificationService.checkAndSchedule();
      this.widgetService.actualizar();

      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else if (!this.isOnHomeTab()) {
          // Si no estás en el tab de inicio, navegá a tab1
          this.router.navigateByUrl('/tabs/tab1');
        } else {
          // Ya estás en el tab1: double-press para salir
          const now = Date.now();
          if (now - this.lastBack < 2000) {
            App.exitApp();
          } else {
            this.lastBack = now;
          }
        }
      });

      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          this.notificationService.checkAndSchedule();
          this.widgetService.actualizar();
        }
      });
    });
  }

  /** Muestra el aviso una sola vez por tipo de problema en toda la sesión. */
  private async avisarProblema(problema: ProblemaAlmacenamiento): Promise<void> {
    if (this.problemasAvisados.has(problema)) return;
    this.problemasAvisados.add(problema);

    const aviso = this.AVISOS[problema];
    const alerta = await this.alertCtrl.create({
      header: aviso.header,
      message: aviso.message,
      buttons: ['Entendido'],
    });
    await alerta.present();
  }
}
