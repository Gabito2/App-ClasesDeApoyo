import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private platform = inject(Platform);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private lastBack = 0;

  ngOnInit() {
    this.platform.ready().then(() => {
      this.notificationService.checkAndSchedule();

      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
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
        }
      });
    });
  }
}
