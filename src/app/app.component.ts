import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private platform = inject(Platform);
  private router = inject(Router);
  private lastBack = 0;

  ngOnInit() {
    this.platform.ready().then(() => {
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
    });
  }
}
