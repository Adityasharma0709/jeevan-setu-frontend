import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideLottieOptions } from 'ngx-lottie';
import player from 'lottie-web';

import { routes } from './app.routes';
import { tokenInterceptor } from './core/interceptors/token-interceptor';
import { provideZard } from '@/shared/core/provider/providezard';


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideHttpClient(
      withInterceptors([tokenInterceptor]) // 🔥 REGISTER HERE
    ),
    provideZard(),
    provideLottieOptions({
      player: () => player,
    })
  ]
};
