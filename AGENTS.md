# AGENTS.md

App "Clases de Apoyo": Angular 20 + Ionic 8 (componentes standalone) + Capacitor 8 (Android). Paquete único, sin monorepo. UI, comentarios y commits en español (es-AR).

## Comandos

- `npm start` — dev server.
- `npm run build` — build de producción a `www/` (gitignored). Es también el único chequeo real de tipos + templates: no hay script de typecheck.
- `npm run lint` — ESLint sobre `src/**/*.ts` y `src/**/*.html`.
- `npm test` — Karma en **watch** y con navegador `Chrome` (por defecto no sirve para verificar).

Tests headless (verificado en esta máquina: no hay Chrome, sí Edge):

```powershell
$env:CHROME_BIN = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
npm test -- --watch=false --browsers=ChromeHeadless
```

Suite única: agregar `--include=src/app/services/alumno.service.spec.ts`.

Orden de verificación: `npm run lint` → tests → `npm run build` si hay dudas. No hay CI (no existe `.github/`).

## Estructura

- `src/app/services/alumno.service.ts` — servicio de dominio central: alumnos, pagos, deuda, vencimientos, backup. Todo el estado vive en `localStorage` (clave `alumnos`); los datos legacy se migran al leerse (`migrar()`).
- Rutas: `app.routes.ts` → `tabs/tabs.routes.ts` con tabs 1, 2, 4 y 5 (no existe tab3), lazy load de componentes standalone.
- `widget.service.ts` — empuja datos al widget Android vía `capacitor-widget-bridge`; solo Android, no-op en browser y trague errores sin romper la UI.
- `www/` es salida de build: **no editar**. `android/` está commiteado; `capacitor.config.ts` apunta `webDir: 'www'`.

## Reglas de fechas (históricamente propensas a bugs)

- Regla única de vencimiento: día de cobro = `min(alumno.diaEntrada, último día del mes)`; `fechaRegistro` es piso (nunca deudar días previos al alta). Si el alumno se registró este mes **después** del día de cobro, recién ahí se cuenta desde el registro.
- UI (`getEstadoPagoMes`), notificaciones (`notification.service.ts`) y WhatsApp (`whatsapp.service.ts`) deben derivar de esa misma regla. Ya hubo bugs por usar día de registro en un lado y `diaEntrada` en otro.
- La lógica usa la fecha actual (`new Date()`): los tests deben mockear el reloj con `jasmine.clock().install()` + `mockDate` (ver `alumno.service.spec.ts`).

## Tests

- Karma + Jasmine corriendo en browser; specs junto al código (`*.spec.ts`).
- Los servicios leen `localStorage`: en `beforeEach`, `localStorage.clear()` + `TestBed.configureTestingModule({})`, y crear el service con `TestBed.inject`.
- Tras escribir `localStorage` a mano hay que invalidar la caché privada del service: `svc['invalidar']()`.

## Convenciones

- ESLint obliga sufijo de clase `Page`/`Component` y selector `app-` kebab-case; TS estricto (`strict`, `strictTemplates`).
- Componentes standalone con `imports` inline; SCSS por componente.
- Cambios en persistencia: mantener migración compatible con datos existentes (patrón en `migrar()`).
- Backup de alumnos: formato `CLASES-BACKUP-V1:` + base64 UTF-8 (`exportar()`/`importar()`). No romper la lectura de respaldos viejos.
