# FixmeTiendas

Fundación SaaS multitenant para inventario/POS: backend Spring Boot 3 + Java 21, PostgreSQL con `tenant_id` y RLS, y frontend React/TypeScript PWA mobile-first.

## Ejecutar con Docker
```bash
docker compose up --build
```
Frontend: http://localhost:3000 · API: http://localhost:8080. Flyway crea tablas, RLS y tenant demo.

## Desarrollo local
```bash
cd backend && mvn test
cd frontend && npm install && npm run build
```
La API exige JWT; el `tenant_id` se toma exclusivamente del token (nunca de un header enviado por el
cliente). Roles: `SUPER_ADMIN` y `TENANT_ADMIN` administran productos, mientras `SELLER` consulta y
puede registrar salidas. El stock se mantiene por sucursal y cada movimiento queda auditado.

Endpoints protegidos:
* `GET /api/products?branchId={uuid}` (consulta)
* `POST /api/products?branchId={uuid}` y `PUT /api/products/{id}?branchId={uuid}` (administración)
* `POST /api/products/{id}/movements?branchId={uuid}` con `{"type":"IN|OUT|ADJUSTMENT","quantity":1,"reason":"..."}`.
Los errores de validación devuelven HTTP 400 y conflictos de SKU HTTP 409. Sustituir secretos y configurar
emisión de tokens en producción.

### Login local (demo)
`POST /api/auth/login` es público y requiere el tenant para identificar la cuenta:
```json
{"tenantId":"00000000-0000-0000-0000-000000000001","email":"demo@fixme.local","password":"password"}
```
La migración Flyway `V2__demo_user.sql` crea esa cuenta únicamente si no existe. Devuelve un
JWT Bearer con `tenant_id` y `scope` compatibles con la seguridad de la API. La cuenta y el
secreto JWT son valores de desarrollo: cámbialos/elimina la migración antes de producción.

## Módulos y POS
Cada tenant dispone de INVENTORY, POS, DELIVERIES, WORK_ORDERS, CUSTOMERS y REPORTS. `GET /api/modules` consulta el estado y `PATCH /api/modules/{moduleKey}` con `{"enabled":true}` lo modifica. SUPER_ADMIN puede indicar `?tenantId=...`; un administrador de tenant siempre opera sobre su tenant. Los endpoints de un m�dulo desactivado responden 403.

El POS requiere POS activo y permite vender a SELLER, TENANT_ADMIN y SUPER_ADMIN:
```json
{"branchId":"00000000-0000-0000-0000-000000000010","items":[{"productId":"...","quantity":2}],"payments":[{"method":"CASH","amount":19.98},{"method":"CARD","amount":5.00}]}
```
POST `/api/sales` calcula totales con precios persistidos, valida sucursal/productos/stock, descuenta stock y registra movimientos OUT transaccionalmente. GET `/api/sales?branchId=...` lista ventas. Pagos insuficientes devuelven 400 y stock insuficiente 409. V4/V5 crean m�dulos, ventas, pagos y sus pol�ticas RLS.

### Operación empresarial
V6 incorpora los módulos persistentes `CUSTOMERS`, `DELIVERIES` y `WORK_ORDERS`, además de
reportes agregados y sus políticas RLS. Todos los controladores derivan el tenant del claim
`tenant_id` del JWT y establecen `app.tenant_id` antes de cada consulta. Las entregas soportan
estado (`PENDING`, `ASSIGNED`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`), repartidor, dirección,
coordenadas y evidencia/metadata; la integración de mapas puede consumir `latitude/longitude`
sin cambiar el modelo. Las órdenes generan un token de aprobación de un solo uso, con expiración
de siete días y URL apta para QR:

* `GET|POST|PUT|DELETE /api/customers`
* `GET|POST /api/deliveries`, `PATCH /api/deliveries/{id}/status`
* `GET|POST /api/work-orders`, `PUT /api/work-orders/{id}`, `PATCH /api/work-orders/{id}/status`
* `GET /api/public/work-orders/tracking?token=...` (API pública de seguimiento en tiempo real)
* `GET|POST /public/work-orders/approve?token=...` (Portal web interactivo para el cliente final)
* `GET /api/reports/summary?branchId=...`

V17 implementa la experiencia completa de taller y servicio técnico profesional:
ficha técnica de equipo (marca, modelo, serie/IMEI, falla reportada y accesorios),
numeración de folio amigable (`OT-1001`), portal web de seguimiento para clientes con
línea de tiempo (Stepper interactivo), autorización de presupuesto en 1 clic, botón
para enviar enlace por WhatsApp, modal con código QR para escaneo en mostrador y
ticket de recepción imprimible en formato de 80mm. El token de seguimiento permanece
activo tras la aprobación para que el cliente consulte el avance hasta la entrega final.

La PWA ofrece navegación lateral de escritorio y navegación inferior móvil, dashboard de KPIs,
inventario, clientes, entregas, órdenes y reportes; cada opción se oculta cuando el módulo del
tenant está desactivado. Para desarrollo: `docker compose up --build` y `cd frontend && npm run build`.

### Caja y administración empresarial
V7-V9 incorporan el módulo `CASH_REGISTER`, el perfil comercial de la empresa y el control de
usuarios/sucursales. Una sesión de caja registra apertura, entradas, salidas, ventas por método de
pago, arqueo y cierre. Solo puede existir una sesión abierta por sucursal, pero se conserva todo el
historial de sesiones cerradas.

Endpoints principales de caja:

* `POST /api/cash/open?branchId={uuid}` con `{"openingCash":100,"amounts":{"CASH":100}}`
* `GET /api/cash/current?branchId={uuid}`
* `POST /api/cash/movement?branchId={uuid}` con tipo `CASH_IN` o `CASH_OUT`, método, monto y motivo
* `POST /api/cash/close?branchId={uuid}` con `{"counted":{"CASH":140,"CARD":20,"TRANSFER":0,"OTHER":0}}`
* `GET /api/cash/report?branchId={uuid}&from={iso}&to={iso}`

El cierre calcula por separado el esperado, contado y diferencia de `CASH`, `CARD`, `TRANSFER` y
`OTHER`; el estado resultante es `BALANCED`, `SHORT` u `OVER`. La tarjeta y las transferencias nunca
se suman al efectivo físico. Los roles `SELLER`, `MANAGER`, `TENANT_ADMIN` y `SUPER_ADMIN` pueden
operar según el caso de uso, mientras `ACCOUNTANT` puede consultar reportes.

La administración expone el perfil de empresa en `/api/administration/profile`, usuarios en
`/api/administration/users` y sucursales en `/api/administration/branches`. El tenant mantiene
tipo de negocio, plan, estado de suscripción, límites y datos fiscales.

### Usuarios demo por rol
La migración `V10__demo_roles.sql` crea usuarios de prueba para el tenant demo. Todos usan la
contraseña temporal `password` y deben reemplazarse antes de producción:

* `manager@fixme.local` — `MANAGER`
* `seller@fixme.local` — `SELLER`
* `delivery@fixme.local` — `DELIVERY`
* `technician@fixme.local` — `TECHNICIAN`
* `accountant@fixme.local` — `ACCOUNTANT`

### Matriz de autorización empresarial

La autorización se valida en el backend con authorities derivadas del JWT y alcance
`tenant_id`; la navegación del frontend es únicamente una ayuda visual. `SUPER_ADMIN`
es el único rol global y usa `/api/platform/tenants` y
`/api/platform/tenants/{tenantId}/modules/{key}`. `TENANT_ADMIN` administra su empresa,
usuarios, sucursales, módulos contratados, inventario, POS, caja, clientes, entregas,
órdenes y reportes. `MANAGER` administra la operación de su tenant y puede crear
`SELLER`, `DELIVERY`, `TECHNICIAN` o `ACCOUNTANT`, pero nunca elevar roles ni modificar
planes. `SELLER` opera POS/caja y consulta stock; `DELIVERY` solo entregas/clientes;
`TECHNICIAN` órdenes/clientes; `ACCOUNTANT` reportes, ventas y caja cerrada.

La creación de usuarios (`POST /api/administration/users`) siempre aplica BCrypt,
valida que la sucursal pertenezca al tenant y rechaza cualquier asignación fuera del
alcance del creador. Los cambios de tenant, plan y módulos generan registros en
`audit_log`; la migración `V11__enterprise_authorization.sql` añade la auditoría y
los roles empresariales. Un usuario normal nunca puede emular `SUPER_ADMIN` cambiando
parámetros: el rol y el tenant efectivo se toman del JWT y se comprueban en servidor.
