import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';
import { NotificationService } from './services/notification.service';
import { WidgetService } from './services/widget.service';
import { ThemeService } from './services/theme.service';

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
  private lastBack = 0;

  private isOnHomeTab(): boolean {
    const url = this.router.url;
    return url === '/tabs/tab1' || url === '/tabs/tab1/' || url === '/tabs';
  }

  ngOnInit() {
    this.themeService.aplicarGuardado();
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
}
