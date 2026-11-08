# MEMORY.md - ENVIA ERP
## Registro del proyecto para continuación de tareas

**Fecha:** 07 de noviembre de 2026

**Estado:** Proyecto completo y funcional

**Versión:** 1.12.0

---

## 1. Estructura del proyecto

```
EnVia/
├── index.html                     # Punto de entrada (file://)
├── css/styles.css                 # Estilos visuales
├── js/
│   ├── app.js                     # Arranque, RBAC global y errores
│   ├── services/
│   │   ├── store.js               # Datos, contabilidad, CRUD, seed, roles y permisos
│   │   ├── supabaseService.js     # REST/Storage, IndexedDB, sync, fallback
│   │   ├── exchangeRateService.js # Tasa BCV oficial (DolarVZLA), caché e históricos
│   │   ├── ocrService.js          # Lectura IA opcional de fechas de documentos
│   │   ├── sessionService.js      # Sesión, RBAC y expiración
│   │   ├── routerService.js       # Rutas, shell, topbar, sidebar y tasa BCV
│   │   └── errorService.js        # Errores centralizados y feedback
│   └── modules/
│       ├── ui.js                  # Helpers, modales, print/CSV, gráficos, validación
│       ├── login.js               # Pantalla de acceso
│       ├── dashboard.js           # Dashboard ejecutivo con KPIs, alertas y gráficos
│       ├── clients.js             # Maestro de clientes
│       ├── drivers.js             # Conductores, flota, RCV, vencimientos y wallet
│       ├── partners.js            # Negocios asociados y cartera de comisiones
│       ├── inventory.js           # Tienda del conductor, stock y financiamientos
│       ├── services.js            # Servicios (carreras y encomiendas)
│       ├── accounting.js          # Contabilidad: asientos, libros, reportes
│       ├── taxes.js               # Tributos: IVA, IGTF, ISLR, retenciones
│       ├── payables.js            # Cuentas por pagar: proveedores, facturas, pagos
│       ├── reports.js             # Centro de reportes, impresión y Excel por módulo
│       ├── audit.js               # Bitácora de auditoría
│       ├── users.js               # Usuarios del sistema, roles y permisos granulares
│       └── settings.js            # Configuración Supabase y sistema
├── sql/supabase_schema.sql        # Esquema SQL completo (tablas, buckets, RLS, seeds)
├── docs/
│   ├── constitution.md            # Constitución vinculante del proyecto
│   └── manual_usuario.md          # Manual de usuario final (este se mantiene actualizado)
├── AGENTS.md                      # Guía operativa para agentes
├── imagen/                        # 5 imágenes de marca (logos, paleta)
├── opencode.json                  # Configuración de OpenCode
└── README.md                      # Quick start, credenciales, Supabase setup
```

---

## 2. Credenciales de acceso

| Usuario | Clave | Rol |
|---------|-------|-----|
| ENVIA | 123456789 | SuperAdmin (maestro - no se puede eliminar ni cambiar rol) |
| contador | Contador2026 | Contador / Fiscal |
| tesoreria | Tesoreria2026 | Tesorero / Cuentas por Pagar |
| auditor | Auditor2026 | Auditor / Operaciones (solo lectura) |

---

## 3. Módulos implementados (12 rutas)

1. **Dashboard** - Tablero de operación: banda de 14 días, ritmo de ingresos, composición/cobros, CxP, alertas documentales, stock y cartera de asociados
2. **Servicios** - Carreras y encomiendas con IVA/IGTF/comisión, asientos automáticos
3. **Clientes** - Maestro de clientes (clave: cedula_rif V-/E-/J-)
4. **Conductores y Flota** - Conductores, vehículos, documentos, RCV, vencimientos, wallet y liquidaciones
5. **Negocios Asociados** - Comercios aliados, comisiones por cobrar, recaudaciones por pagar y movimientos
6. **Tienda & Inventario** - Catálogo, stock, asignación a conductores y financiamiento por cuotas
7. **Contabilidad** - Plan de cuentas, asientos, libro diario, mayor, balance, resultados, libros SENIAT
8. **Tributos & BCV** - IVA (16%/8%/0%), IGTF (3%), ISLR (Decreto 1.808), retenciones
9. **Cuentas por Pagar** - Proveedores, facturas, retenciones IVA/ISLR, pagos, envejecimiento
10. **Bitácora de Auditoría** - Quién modificó qué, cuándo, usuario, fecha y hora
11. **Usuarios del sistema** - Usuarios, roles base/personalizados, permisos por módulo/pestaña/acción
12. **Configuración Supabase** - Conexión opcional a Supabase

---

## 4. Reglas de negocio clave (Constitución vinculante)

- **Moneda funcional:** VES (Bolívares). Operativos capturan en USD, convierten a tasa BCV.
- **Partida doble:** DEBE = HABER (tolerancia 0,01 VES). `postEntryInternal` auto-ajusta redondeo.
- **IVA:** 16% general, 8% reducido, 0% exento.
- **IGTF:** 3% sobre pagos en divisas.
- **Retención IVA:** 75% (PN residente), 100% (PJ domiciliada/no domiciliada).
- **ISLR:** PN_RES 3% (sustraendo 10 UT), PJ_DOM 5%, PN/PJ no residente 34%.
- **UT:** 90 VES (configurable).
- **Tasa BCV:** Parametrizable, configurable en Tributos & BCV.
- **Claves primarias:** clientes y conductores = `cedula_rif`; proveedores = `rif`.
- **Formatos válidos:** V-12345678, E-12345678, J-123456789.
- **Roles base:** SuperAdmin, Contador/Fiscal, Tesorero/CxP, Auditor/Operaciones (solo lectura). Se pueden crear roles personalizados y permisos por usuario.
- **Sesión:** 12 horas expiración, sessionStorage. Cada inicio de sesión abre el Dashboard.
- **Documentos:** ruta `/{bucket}/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}`, máximo 10 MB, PDF/JPG/PNG/WEBP; IndexedDB con fallback local.
- **Supabase:** Opcional. App funciona 100% en local con `localStorage` y archivos en IndexedDB.

---

## 4. Decisiones de diseño tomadas

1. **Login centrado:** Un solo fondo oscuro (#0F1E36), panel centrado con logo ENVIA + "Bienvenido a" + texto "ERP".
2. **Botón "Ingresar":** Texto simple sin flechas ni adornos.
3. **Botón "Manual de usuario":** Junto a "Credenciales maestras", color azul #005FFF, abre `manual.html`.
4. **Tasa BCV:** Automática vía DolarVZLA (`https://rates.dolarvzla.com/bcv/...`), de solo lectura, con selección por fecha y caché de sesión de 15 minutos.
5. **Validación SENIAT:** Eliminada por completo (no hay API pública gratuita del SENIAT).
6. **Sidebar:** Línea de color naranja → azul → blanco sobre el logotipo.
7. **Datos de seed:** 10 clientes, 8 conductores, 16 servicios, 63 cuentas, 50 asientos, trial balance balanceado.

---

## 5. Archivos modificados recientemente (sesión 05/11/2026)

| Archivo | Cambio |
|---------|--------|
| `index.html` | Login centrado, logo ENVIA más grande, botón "Manual de usuario", quitó textos de impuestos y fichas IVA/IGTF |
| `css/styles.css` | Estilos del login centrado, sidebar línea naranja-azul-blanco, logo 64px |
| `js/modules/clients.js` | Cliente María Fernanda → Jesús Alberto Mendoza Quintero (V-19654872), quitó botón SENIAT |
| `js/modules/drivers.js` | Quitó botón SENIAT |
| `js/modules/payables.js` | Quitó botón SENIAT de proveedores |
| `js/services/store.js` | Quitó todo lo de SENIAT y bcvEndpoint, migración limpia |
| `js/modules/audit.js` | **NUEVO** - Módulo de Bitácora de Auditoría |
| `js/app.js` | Ruta de auditoría registrada, listener del botón Manual de usuario |
| `js/modules/ui.js` | Agregó `ui.prompt()` |
| `manual.html` | **NUEVO** - Manual gráfico e interactivo aparte del ERP |
| `docs/manual_usuario.md` | **NUEVO** - Manual de usuario en Markdown |

---

## 5.1 Integración DolarVZLA BCV (05/11/2026)

| Archivo | Cambio |
|---------|--------|
| `js/services/exchangeRateService.js` | **NUEVO** — `fetchBcvRate()`, `fetchBcvRateByDate()`, `getAvailableDates()`, caché en `sessionStorage`, `convertirMoneda()` global y `start()`. Fuente: `https://rates.dolarvzla.com` (BCV público, sin API key). |
| `js/services/store.js` | `setRate(rate, when, source)` recibe fecha y fuente para la bitácora. |
| `js/modules/ui.js` | `ui.rate()` lee la tasa activa del servicio; `ui.toBs`/`ui.fromBs` usan `convertirMoneda`. |
| `js/app.js` | Indicador de solo lectura en el header + icono de calendario para tasa por fecha + refresco. Sin edición manual. |
| `js/modules/taxes.js` | Botón **Sincronizar BCV**; campo de tasa bloqueado (solo lectura); calculadora con tasa viva. |
| `js/modules/dashboard.js` | La tasa mostrada usa `ui.rate()`. |
| `css/styles.css` | Estilos de `rate-value`, `rate-calendar`, modo histórico y responsive. |
| `docs/manual_usuario.md` | Sección 7: tasa solo lectura, calendario histórico y fallback. |

**Endpoints DolarVZLA (CDN público, CORS `*`):**
- `GET https://rates.dolarvzla.com/bcv/current.json` → `{ current:{date,usd,eur}, previous, changePercentage }`
- `GET https://rates.dolarvzla.com/bcv/available-dates.json` → `["YYYY-MM-DD", ...]`
- `GET https://rates.dolarvzla.com/bcv/{yyyy}/{m}/{d}.json` → `{ date, usd, eur }` (mes/día sin cero a la izquierda)

**Comportamiento:**
- Al iniciar sesión: `Integración DolarVZLA BCV iniciada. Tasa actual: Bs [tasa] / USD · DolarVZLA`.
- Caché de sesión: `tasaBcv`, `tasaBcvFecha`, `tasaBcvFuente`, `tasaBcvTimestamp`, `tasaBcvModo` (TTL 15 min).
- La tasa es **solo lectura**; no hay inputs numéricos ni botones de guardar tasa.
- Calendario: selecciona fecha → `fetchBcvRateByDate()` aplica la tasa histórica y marca `DolarVZLA · histórica`.
- Si la API falla, conserva la última tasa y avisa; no se habilita edición manual.
- `x-dolarvzla-key` **no se usa ni se incrusta**: la documentación del sitio indica que las tasas BCV son públicas y la key es solo para USDT (Binance).

---

## 5.2 Rediseño del Dashboard (06/11/2026)

**Concepto:** tablero de operación en lugar de grid de KPIs. Una sola pieza protagonista (banda navy) y el resto en paneles planos con separadores finos.

| Archivo | Cambio |
|---------|--------|
| `js/modules/dashboard.js` | Reescrito: banda de 14 días (ingresos, comisión, servicios, hoy), ritmo diario, CxP vencida, panel unificado composición + cobros y tabla de servicios. |
| `css/styles.css` | Nuevas clases `ops-band`, `ops-grid`, `panel`, `rhythm-*`, `payable-*`, `money-*`, `pay-*`, `dash-table`; responsive 900/760/520. |

**Datos calculados en vivo:**
- Período = `store.iso(13)` a `store.today()` (14 días inclusivos).
- `pGross`, `pCommission`, `pTax` se suman solo sobre los servicios del período.
- Hoy = servicios con `fecha === store.today()`.
- Vencimientos: `diff` en días contra hoy → `Vencida`, `Vence hoy`, `Mañana`, `En N d` o fecha corta.
- Mejor día y promedio diario se calculan de la serie de 14 días.
- Ticket promedio de cobros = `methodTotal / period.length`.

**Decisiones visuales:**
- Navy `#0F1E36` para la banda; naranja `#F05A24` reservado para hoy, vencidas y alertas.
- Sin sombras en los paneles; borde `#E4EAF3` y radios 14 px.
- Cifras con `font-variant-numeric: tabular-nums` y Sora; etiquetas en Inter.
- Se eliminaron los puntos medios en la copy nueva; fechas y estados usan texto explícito.
- La tabla del dashboard usa encabezados en sentence case (no mayúsculas).

---

## 5.3 Sidebar sin bloque de usuario (06/11/2026)

**Objetivo:** quitar el avatar, nombre, rol y botón de logout del pie del sidebar; el cierre de sesión ya está en la barra superior. Ganar altura para mostrar los 10 módulos sin scrollbar. **Nota 07/11:** se revirtió parcialmente en 5.6; el usuario pidió recuperar un botón de **Cerrar sesión** al final del menú, con separación después de Configuración Supabase.

| Archivo | Cambio |
|---------|--------|
| `index.html` | Se eliminó `#sidebar-user`; el pie conserva solo `#sidebar-status`. |
| `js/app.js` | Se eliminó el render del avatar/nombre/rol y el listener de `#sidebar-logout`. El logout queda solo en `#topbar-logout`. |
| `css/styles.css` | Se eliminaron `.sidebar-user-*` y `.sidebar-logout`; brand, caption, grupos e ítems más compactos. |
| `docs/manual_usuario.md` | Sección 1 actualizada; versión 1.2. |

**Densidad adaptativa por altura:**
- Normal: logo 152 px, ítems con padding 8 px, grupos con 14 px.
- `max-height: 820px`: logo 140 px, ítems 6 px, grupos 8 px, footer más corto.
- `max-height: 640px`: se oculta el caption, logo 128 px, ítems 5 px.

**Medición (Chrome headless, 1366 px de ancho):**
- 650, 700, 768, 800, 900 y 1050 px de alto: 10 ítems visibles, `scrollbar: false`.
- 600 px: entra con el caption oculto y sin scrollbar.
- `#sidebar-user` y `#sidebar-logout`: ausentes. `#topbar-logout`: presente.

---

## 5.4 Manual gráfico, capturas y limpieza de secciones (06/11/2026)

**Objetivo:** hacer el manual más amigable para usuarios nuevos, con capturas reales de los procesos; retirar del instructivo la configuración de bases de datos y los respaldos/exportación JSON (uso exclusivo de administradores); eliminar el bloque “Ir a sección” para que el capítulo elegido se muestre directamente.

| Archivo | Cambio |
|---------|--------|
| `manual.html` | Se eliminó el índice rápido `.quick-index` y su CSS/JS. El contenido principal inicia directamente en la sección activa. Se quitaron las secciones de Supabase y respaldos; Reglas pasó a `sec-11`. Se agregaron 15 capturas y se actualizó la sección BCV a tasa automática de solo lectura. Versión v1.3. |
| `docs/manual_usuario.md` | Versión 1.3. Se agregaron las mismas capturas en Markdown, se quitaron Respaldos y Sincronización con Supabase, y Reglas pasó a ser la sección 11. |
| `imagen/manual/` | 15 capturas PNG de 1440×900: login, dashboard, clientes, conductores, servicios, contabilidad, tributos, CxP, auditoría y usuarios, incluyendo formularios y expediente. |

**Decisiones:**
- El manual de usuario final no documenta configuración de Supabase, `anon key`, RLS, buckets ni exportación/importación JSON.
- Se conservan las exportaciones CSV de reportes operativos (Libro Diario, auditoría, etc.) porque son parte del trabajo diario, no respaldos de la base.
- El capítulo 04 ya no muestra el bloque “Ir a sección”; al hacer clic en el menú se renderiza su contenido de inmediato y el encabezado “04 Conductores y Flota” flota con el contenido.
- `showSection()` reinicia `scrollTop` del panel `.manual-main` y un `setTimeout` corrige la carga directa con hash (`manual.html#sec-4`) para que nunca se oculte el encabezado del capítulo.
- La tasa BCV del manual ahora se describe como automática, de solo lectura, con calendario histórico y fallback a la última tasa conocida.

**Validación (Chrome headless):**
- 11 secciones y 11 ítems de navegación; sin `.quick-index` ni texto “Ir a sección”.
- `#sec-4` activo y visible; `#sec-3` oculto.
- Las 16 imágenes del manual cargan (`naturalWidth > 0`), incluidas las 15 capturas nuevas.
- Recorrido por clic en las 11 secciones: `sec-1` a `sec-11`, sin errores de consola.
- Búsqueda “conductor” filtra correctamente las secciones relacionadas.

---

## 5.5 Permisos granulares, reportes, niveles y persistencia (06/11/2026)

**Objetivo:** convertir el RBAC fijo en roles administrables, agregar reportes imprimibles/Excel en todos los módulos, incorporar el nivel del conductor, mejorar la navegación de pestañas y corregir la pérdida de clientes por falta de persistencia.

| Archivo | Cambio |
|---------|--------|
| `js/services/store.js` | Catálogo de 10 módulos, pestañas y acciones; roles base y personalizados en `db.roles`; `permissionsFor()`, `can()`, `canAction()`, CRUD de roles y auditoría. Migración de `nivel`; corrección de `deleteClient()`; verificación de escritura y errores de cuota. |
| `js/app.js` | Inicio de sesión siempre en Dashboard; helpers `canAction`, `canTab`, `isAdmin`; botón Reportes inyectado como respaldo; etiqueta “Usuarios del sistema”. |
| `js/modules/users.js` | Reescrito: tarjetas de roles, “Nuevo rol”, editor de permisos por módulo/pestaña/acción, permisos personalizados por usuario, cambio de clave y borrado seguro de roles. |
| `js/modules/reports.js` | **NUEVO**: registro de 34 reportes en 10 módulos, catálogo modal, impresión con `ui.printHTML` y descarga Excel `.xls`. Botón reutilizable `NS.reports.button(module)`. |
| `js/modules/clients.js`, `drivers.js`, `services.js`, `accounting.js`, `taxes.js`, `payables.js`, `audit.js`, `settings.js`, `dashboard.js` | Botones y acciones condicionados por permisos granulares; botón Reportes persistente tras cambiar pestañas o filtros. |
| `js/modules/drivers.js` | Campo `nivel` con opciones exactas `Plata`, `Oro` y `Platium`; visible en formulario, listado, detalle, CSV y reportes. |
| `js/services/supabaseService.js` | Documentos en IndexedDB (`envia_files_db`) con migración desde `envia_files_v1`; límite de archivo alineado a 10 MB; sincronización de `erp_roles`. |
| `sql/supabase_schema.sql` | `drivers.nivel`, `erp_roles`, `erp_users.permisos`, migraciones idempotentes, RLS y seeds de roles base. |
| `css/styles.css` | Pestañas en cuadrícula sin scroll horizontal; estilos del centro de reportes, tarjetas de roles, editor de permisos y checkbox de línea. |
| `index.html`, `manual.html`, `docs/manual_usuario.md`, `README.md` | Manual v1.4, nuevas capturas y documentación de roles, reportes, niveles y persistencia. |

**Permisos:**
- Permiso por módulo (`ver`) y acciones: `crear`, `editar`, `eliminar`, `exportar`, `imprimir`, `reportes`, `billetera`, `documentos`, `liquidar`, `pagar`, `roles`.
- Pestañas internas por módulo (Contabilidad y CxP) seleccionables por separado.
- Los permisos personalizados de un usuario sustituyen los del rol solo para ese usuario.
- SuperAdmin conserva acceso total y no puede degradarse; los roles del sistema no se eliminan.
- La UI oculta lo no permitido y `store`/`app` rechazan la acción en la capa de datos.

**Reportes:**
- Dashboard 3 · Servicios 3 · Clientes 3 · Conductores 3 · Contabilidad 7 · Tributos 4 · CxP 4 · Auditoría 3 · Usuarios 3 · Configuración 1.
- La impresión usa el diálogo del navegador; Excel descarga un `.xls` HTML en UTF-8 con BOM.
- Todos los reportes muestran tasa BCV, usuario y fecha; los contables incluyen el período consultado.

**Persistencia (causa probable del cliente perdido):**
- La base se guarda en `localStorage` con clave `envia_db_v1` y respaldo `envia_db_v1_backup`; se relee y verifica después de guardar.
- Los documentos ya no consumen el cupo de `localStorage`: viven en IndexedDB y se migran automáticamente.
- Si la escritura falla por cuota, ahora se lanza un error visible en lugar de cerrar el formulario silenciosamente.
- `deleteClient()` ya calcula `hasSvc` localmente antes de borrar; antes referenciaba una variable inexistente.

**Validación (Chrome headless/CDP):**
- `node --check` en todos los archivos JS sin errores.
- 12 módulos renderizados (incluye Negocios Asociados y Tienda & Inventario), botón Reportes presente y persistente al cambiar pestañas de Contabilidad y CxP.
- Reportes de asociados e inventario construyen columnas y filas sin excepciones; la descarga Excel genera el archivo y registra auditoría.
- Pestañas de Contabilidad (10) y CxP (3) sin scroll horizontal, en cuadrícula.
- Login tras logout abre `#/dashboard`; recarga conserva cliente creado.
- Rol personalizado solo con acceso a Clientes: no puede entrar a Contabilidad, no puede crear clientes y sí puede abrir reportes.
- 64 checkboxes de acciones y 13 pestañas en el editor de roles; “Acceso” solo concede `ver` y las pestañas, “Todo” concede todas las acciones.
- Documento de prueba guardado como `local://` en IndexedDB, resuelto como Data URL y eliminado correctamente.
- Manual con 12 secciones, 17 imágenes cargadas y cero errores de consola.
- Capturas nuevas: `16-centro-reportes.png` y `17-editor-roles-permisos.png`; manual con 12 secciones.

---

## 5.6 Móvil, asociados, tienda, RCV y vencimientos (07/11/2026)

**Objetivo:** mejorar el uso en teléfono, recuperar el cierre de sesión en el menú, renombrar los niveles, agregar negocios aliados, incorporar el Seguro RCV, controlar vencimientos documentales y crear la tienda del conductor con financiamiento y wallet.

| Archivo | Cambio |
|---------|--------|
| `js/services/routerService.js` | Nuevas rutas `partners` e `inventory`; menú de usuario en el topbar (perfil y logout); botón **Cerrar sesión** al final del sidebar con separación; corrección de `available2` en el calendario BCV. |
| `js/services/store.js` | Niveles `Zafiro/Esmeralda/Diamante`; estado `Inactivo por Documentos Vencidos`; cuentas 1.1.2.03, 1.1.6.01, 2.1.1.03, 4.2.1.02, 4.2.1.03, 5.2.2.01; reglas de asociados y tienda; CRUD de negocios, productos, financiamientos y movimientos; wallet del conductor; alertas y metadatos documentales; asientos demo. |
| `js/modules/drivers.js` | Documento **Seguro RCV**; fechas emisión/vencimiento por documento; lectura IA opcional; badges de vencimiento; inactivación/reactivación; wallet con ganancias, comisiones, compras y deuda; botón para asignar producto. |
| `js/modules/partners.js` | **NUEVO**: negocios asociados, cartera por cobrar/pagar, movimientos y asientos. |
| `js/modules/inventory.js` | **NUEVO**: catálogo, stock, ajustes, asignación a conductores, cuotas y abonos. |
| `js/services/ocrService.js` | **NUEVO**: lectura opcional de fechas vía endpoint compatible con OpenAI Vision; fallback manual. |
| `js/modules/dashboard.js` | Panel **Alertas operativas**: documentos vencidos/por vencer, stock bajo y comisiones de asociados. |
| `css/styles.css` | Menú de usuario, logout lateral, wallet, alertas documentales, cálculo de asignación, grilla de alertas y mejoras móviles (touch, tipografía, logout visible). |
| `index.html` | Carga de `ocrService.js`, `partners.js` e `inventory.js`. |
| `js/services/supabaseService.js` | Sincronización de `partners`, `partner_movements`, `products`, `driver_charges` y `driver_movements`. |
| `sql/supabase_schema.sql` | Nuevas tablas, columnas RCV/docs_meta, niveles, estado de inactividad, índices, triggers y RLS. |
| `docs/manual_usuario.md`, `MEMORY.md` | Manual v1.5 y registro de la sesión. |

**Decisiones de negocio:**
- **Negocios Asociados es un módulo independiente** (no una pestaña de proveedores). El asociado puede deber comisiones (CxC) y ENVIA puede deberle recaudaciones (CxP); separar las carteras evita mezclar antigüedad de CxP con ingresos por comisión.
- **Seguro RCV** se maneja como documento del conductor y como producto de tienda de $25; son dos controles distintos: el documento acredita la cobertura y el producto registra la venta/financiamiento.
- **Tienda:** toda asignación descuenta stock, genera CxC al conductor (1.1.2.02), ingreso por tienda (4.2.1.03) y costo (5.2.2.01). El saldo se muestra en la wallet y puede abonarse.
- **IA:** la lectura automática es opcional y configurable; si no hay endpoint o falla, se capturan las fechas manualmente. No se hardcodean claves ni se bloquea la carga.

---

## 5.7 Navegación, parámetros, planes y configuración (07/11/2026)

**Objetivo:** convertir el sidebar en acordeón con submenús, hacer que cada
subitem cambie el contenido real del módulo, ordenar Configuración del Sistema,
añadir planes/eventos de conductores, integraciones de APIs y tarifa fija o
porcentual por conductor.

**Cambios principales:**

| Archivo | Cambio |
|---------|--------|
| `js/services/routerService.js` | Submenús por módulo con **Reportes** al final; `getSubroute()` y `currentSubquery`; los subitems navegan con `?sub=...`; el sub `*-reports` abre el centro de reportes; oculta el `stat-strip` al entrar por subitem; orden de Configuración sincronizado con la pantalla. |
| `js/services/store.js` | `systemParams` con `nivel` y `tipo_plan`; `driverPlans` y `driverEvents`; `apiIntegrations`; `tipo_tarifa` en conductores; `applyDriverWeeklyPlan()` elige el plan por nivel + tarifa; migración `schemaVersion` 3 con blindaje de colecciones. |
| `js/modules/settings.js` | Orden definitivo: parámetros → planes → eventos → APIs → Supabase → estado → sincronización → respaldo; cada subitem se desplaza a su sección con margen para la barra sticky; CRUD de planes, eventos y APIs; formulario de parámetros con módulo, nivel y tipo de plan. |
| `js/modules/drivers.js` | Selector **Tarifa del conductor** (fija/porcentual), plan semanal acorde al nivel y tarifa, y detalle del plan en la tabla y el expediente. |
| `js/modules/inventory.js` | Se retiró la banda de estadísticas del encabezado (valor, unidades, financiado y alertas). |
| `css/styles.css` | `scroll-margin-top` y resaltado de sección para Configuración; ajustes del sidebar acordeón y responsive. |
| `sql/supabase_schema.sql` | `system_params.nivel`, `system_params.tipo_plan`, `drivers.tipo_tarifa` y migraciones idempotentes. |
| `docs/manual_usuario.md`, `README.md`, `MEMORY.md` | Manual y documentación alineados con la navegación y la configuración actual. |

**Decisiones:**
- **Reportes** es siempre el último subitem y abre el modal del módulo, no una
  pantalla repetida.
- El encabezado con estadísticas pertenece al módulo principal; los subitems
  muestran directamente su contenido.
- **Descripción** de un parámetro es informativa; la lógica se define por
  `key`, `tipo`, `value`, `module`, `nivel` y `tipo_plan`.
- **Tarifa del conductor:** `fijo` usa el plan de monto semanal; `porcentaje`
  usa el plan porcentual del mismo nivel. Si no existe el plan del tipo elegido,
  se usa el primer plan activo del nivel como respaldo.
- La migración sube a `schemaVersion = 3` y crea las colecciones faltantes aunque
  la base ya estuviera en la versión anterior.

**Validación:**
- `node --check` en todos los JS modificados.
- CDP en `file://`: reportes del sidebar abren el modal, subitems ocultan el
  `stat-strip`, inventario sin estadísticas, sin errores de consola.
- Cambio de subitem en Contabilidad modifica el tab activo (Libro Diario, Libro
  Mayor, Balance de Comprobación).

---

## 5.8 Navegación directa, topbar y reportes personalizados (07/11/2026)

**Objetivo:** corregir el regreso al Dashboard desde cualquier parte del menú,
simplificar la barra superior y permitir que el administrador cree listados a la
medida con la información ya almacenada.

**Cambios principales:**

| Archivo | Cambio |
|---------|--------|
| `js/services/routerService.js` | El título de cada módulo navega siempre a su pantalla principal y abre el acordeón; **Dashboard** vuelve al inicio desde cualquier ruta; se retiró el menú desplegable de perfil/logout del topbar y se conserva el icono de salida. |
| `js/modules/reports.js` | Catálogo de tablas y columnas; constructor **Nuevo reporte a la medida** para el administrador (módulo, tabla, columnas, filtro y orden); sección **Reportes personalizados** con editar/eliminar; impresión y Excel usan el mismo motor. |
| `js/services/store.js` | Colección `customReports` con CRUD, auditoría y persistencia; migración `schemaVersion = 4` con blindaje de la colección. |
| `js/services/supabaseService.js` | `customReports` → `custom_reports` en `TABLE_MAP` para la sincronización opcional. |
| `js/modules/settings.js` | `customReports` incluido en las tablas de respaldo/sincronización. |
| `css/styles.css` | Estilos del constructor (columnas, filtros, orden), insignia **Personalizado** y responsive. |
| `sql/supabase_schema.sql` | Tabla `custom_reports`, índices, RLS y política demo; migraciones idempotentes de sus columnas. |
| `docs/manual_usuario.md`, `manual.html`, `README.md`, `MEMORY.md` | Documentación del constructor, navegación y cierre de sesión actualizados. |

**Decisiones:**
- El constructor trabaja sobre **una tabla base** por reporte y guarda solo la
  definición (tabla, columnas, filtro, orden); no duplica datos.
- Los reportes personalizados se muestran en el módulo elegido. En esta versión
  solo el administrador podía crearlos, editarlos o eliminarlos; la sección 5.9
  amplía la creación a usuarios con permiso de reportes y escritura.
- Los roles con permiso de **Centro de reportes** pueden ejecutar los listados
  personalizados del módulo, pero no modificarlos.
- El menú de perfil del topbar se elimina; el cierre de sesión queda en el icono
  de la barra superior y en el pie del sidebar móvil.

**Validación:**
- `node --check` en los JS modificados.
- CDP en `file://`: Dashboard regresa desde un submódulo; el título del módulo
  abre su pantalla principal; `stat-strip` oculto en subitems.
- Creación de reportes de conductores (correo/dirección) y usuarios
  (nombre/correo), filtro y orden; Excel generado con las columnas y filas
  esperadas.
- Sin errores de consola.

---

## 5.9 Reportes según acceso, pestañas contables y título del Dashboard (08/11/2026)

**Objetivo:** alinear el constructor de reportes con el RBAC, reparar la
navegación interna de Contabilidad y ajustar el título del tablero.

**Cambios principales:**

| Archivo | Cambio |
|---------|--------|
| `js/modules/reports.js` | El constructor solo ofrece módulos y tablas a los que el usuario tiene acceso; los reportes personalizados se ocultan si la tabla pertenece a un módulo no permitido; `Nuevo reporte` aparece solo con permiso de reportes y escritura; cada usuario gestiona sus reportes y el administrador todos. |
| `js/services/store.js` | `customReports` guarda `creado_por` para controlar la edición/eliminación por propietario. |
| `js/services/routerService.js` | Nuevo `setSubroute()` para sincronizar pestaña, URL y sidebar sin re-renderizar el módulo. |
| `js/modules/accounting.js` | Las pestañas internas (Asientos, Plan de cuentas, Libro Mayor, Balance, etc.) actualizan la subruta y ya no vuelven a la pestaña anterior del sidebar. |
| `js/modules/dashboard.js` | El título **Así va la operación.** pasa a **Resumen de operaciones**. |
| `sql/supabase_schema.sql` | `custom_reports.creado_por` y migración idempotente. |
| `docs/manual_usuario.md`, `manual.html`, `README.md`, `MEMORY.md` | Documentación del acceso por rol/perfil y de la gestión de reportes por propietario. |

**Decisiones:**
- Crear reportes requiere permiso de **Centro de reportes** y capacidad de
  escritura; los roles de solo lectura solo ejecutan reportes existentes.
- El desplegable de módulos solo muestra módulos con permiso de reportes; el de
  tablas solo incluye datos de módulos accesibles para el rol o perfil.
- Un reporte personalizado solo se muestra si el usuario tiene acceso a su
  módulo y a la tabla de origen, evitando exponer datos de otras áreas.
- El propietario puede editar/eliminar su reporte; el administrador puede
  gestionar todos. Los reportes antiguos sin `creado_por` quedan bajo control
  del administrador.

**Validación:**
- `node --check` en los JS modificados.
- CDP en `file://`: las pestañas de Contabilidad cambian de contenido aun
  entrando por un subitem del sidebar; URL y subitem activo quedan sincronizados.
- SuperAdmin ve los 12 módulos y las 9 tablas; Contador no ve Usuarios ni
  Configuración; Auditor no ve el botón de creación y no puede editar/eliminar.
- El reporte creado por `contador` guarda `creado_por: contador` y solo muestra
  acciones de gestión a su propietario y al administrador.
- Dashboard muestra **Resumen de operaciones**. Sin errores de consola.

---

## 5.10 Sidebar toggle, endpoint BCV y detalle de auditoría (08/11/2026)

**Objetivo:** mejorar la usabilidad del menú lateral, corregir el endpoint de la API BCV y enriquecer la bitácora de auditoría.

**Cambios principales:**

| Archivo | Cambio |
|---------|--------|
| `js/services/routerService.js` | La flecha del módulo solo expande/recoge el acordeón sin navegar; el título del módulo sigue abriendo su pantalla principal. Se agregó `setSidebarModuleOpen()` y `aria-expanded` en toggle. |
| `css/styles.css` | Estilos del botón `.nav-toggle` (posición absoluta, rotación al abrir, colores). |
| `js/services/store.js` | Endpoint predeterminado de `bcv_tasa_dolar` pasa de `https://bcv.org.ve` a `https://rates.dolarvzla.com` (servicio real usado por `exchangeRateService.js`). `addAuditLog` acepta `extras` con `antes`/`después`; upsert/delete de clientes, conductores, proveedores, negocios asociados, planes, eventos, parámetros, APIs y usuarios guardan el diff. |
| `js/modules/audit.js` | Las filas de la bitácora son clicables y abren un modal con detalle del movimiento, tabla de cambios campo a campo (antes → después) y registro JSON completo. |

**Decisiones:**
- El endpoint `https://bcv.org.ve` solo era una referencia descriptiva; el consumo real de tasa BCV se hace desde `https://rates.dolarvzla.com` (CDN público, sin API key) en `js/services/exchangeRateService.js`.
- El detalle de auditoría se guarda como `extras.antes` / `extras.después` en cada entrada; las filas antiguas sin el campo se muestran sin tabla de cambios.
- Al pulsar una fila de auditoría se abre una ventana (modal) con el detalle completo, no solo el texto resumido.

**Validación:**
- `node --check` en JS modificados.
- CDP en `file://`: clic en flecha de Conductores abre y cierra el acordeón; URL y estado `aria-expanded` se mantienen consistentes.
- CDP en `file://`: abrir Bitácora de Auditoría, pulsar una fila y se abre el modal con detalle; sin errores de consola.

---

## 6. Próximas tareas pendientes (opcionales)

1. **Integración WhatsApp** para notificaciones a conductores (pendiente de conversación con equipo).
2. **Integración SENIAT real** solo si se consigue API privada/convenio institucional.
3. **API BCV real** solo si se consigue fuente oficial con autenticación.
4. **PWA** (Progressive Web App) para instalación como aplicación.
5. **Geolocalización** de conductores y rutas óptimas.
6. **Reportes PDF nativos** (actualmente se imprimen desde el navegador y se exportan a Excel).

---

## 7. Cómo continuar el día siguiente

1. Abrir `index.html` directamente en Chrome (doble clic o `file:///`).
2. Iniciar sesión con `ENVIA` / `123456789`.
3. Todos los 12 módulos están operativos (incluye Negocios Asociados y Tienda & Inventario).
4. Si necesita agregar una función nueva:
   - Crear módulo en `js/modules/`.
   - Registrar ruta en `js/app.js` (objeto `MODULES`).
   - Cargar script en `index.html` antes de `app.js`.
   - Validar sintaxis: `node --check` en todos los JS.
   - Actualizar `docs/manual_usuario.md` con el modo de uso para el usuario final.
5. Para desplegar en Supabase: crear proyecto, ejecutar `sql/supabase_schema.sql`, configurar URL y anon key en Configuración.

---

## 8. Archivos de referencia rápida

- `AGENTS.md` - Guía operativa para agentes de IA
- `docs/constitution.md` - Reglas fiscales, contables y de seguridad (vinculantes)
- `docs/manual_usuario.md` - Manual de usuario final (modo de uso por módulo)
- `manual.html` - Versión gráfica interactiva del manual
- `README.md` - Quick start y credenciales
- `sql/supabase_schema.sql` - Esquema SQL completo
