# Registro de cobros reales

Objetivo: separar operaciones reales de cobro del estado mensual resumido sin perder datos legacy.
Branch: rama activa
Entrega: implementación local, sin commit ni push hasta indicación del usuario
Runner: npm run lint, npm test -- --watch=false --browsers=ChromeHeadless, npm run build

## Specs

S1. Permitir varios cobros reales para el mismo alumno y mes.
S2. Cada cobro conserva fecha real, monto cobrado y número de comprobante.
S3. Los cobros parciales no pagan ni calculan automáticamente la cuota mensual.
S4. Mantener `Pago` como estado mensual resumido.
S5. Desmarcar un mes no elimina sus cobros reales.
S6. Migrar pagos legacy pagados a cobros reales sin duplicarlos ni renumerarlos.
S7. Preservar los métodos públicos existentes `registrarPago`, `desmarcarPago` y `togglePagoMes`.
S8. Mostrar los cobros reales en detalle de pagos y estado de cuenta.

## Tasks

- [x] T1 — Modelo y migración compatible — S1, S4, S6, S7 — inline — GREEN observado
- [x] T2 — Servicio de operaciones múltiples — S1, S2, S3, S5, S7 — inline — GREEN observado
- [x] T3 — UI mensual y estado de cuenta — S8 — inline — chequeo observado
- [x] T4 — Verificación final — S1-S8 — inline — lint, 27 tests de servicio, 4 tests de estado de cuenta, 3 tests de vencimientos y build observados

## Log

L1. "che quiero cambiar un poco la manera o forma en la que se registran los dias que se van cobrando, quiero una forma distinta y mas optima para hacerla"
L2. Se decidió un modelo con cobros reales informativos y estado mensual separado.
L3. Implementado modelo `Cobro`, migración legacy, operaciones múltiples, UI en detalle mensual y estado de cuenta.
