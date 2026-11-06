# MEMORY.md - ENVIA ERP
## Registro del proyecto para continuación de tareas

**Fecha:** 05 de noviembre de 2026  
**Estado:** Proyecto completo y funcional  
**Versión:** 1.0.0  

---

## 1. Estructura del proyecto

```
EnVia/
├── index.html                     # Punto de entrada (file://)
├── css/styles.css                 # Estilos visuales
├── js/
│   ├── app.js                     # Login, sesión, RBAC, router, shell
│   ├── services/
│   │   ├── store.js               # Motor de datos, contabilidad, CRUD, seed, reports
│   │   └── supabaseService.js     # REST/Storage, sync, fallback
│   └── modules/
│       ├── ui.js                  # Helpers, modales, print/CSV, gráficos, validación
│       ├── dashboard.js           # Dashboard ejecutivo con KPIs y gráficos
│       ├── clients.js             # Maestro de clientes
│       ├── drivers.js             # Maestro de conductores y flota
│       ├── services.js            # Servicios (carreras y encomiendas)
│       ├── accounting.js          # Contabilidad: asientos, libros, reportes
│       ├── taxes.js               # Tributos: IVA, IGTF, ISLR, retenciones
│       ├── payables.js            # Cuentas por pagar: proveedores, facturas, pagos
│       ├── audit.js               # Bitácora de auditoría
│       ├── users.js               # Usuarios del ERP y RBAC
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

## 3. Módulos implementados (9 rutas)

1. **Dashboard** - Tablero de operación: banda de 14 días, ritmo de ingresos, composición/cobros, CxP y servicios recientes
2. **Servicios** - Carreras y encomiendas con IVA/IGTF/comisión, asientos automáticos
3. **Clientes** - Maestro de clientes (clave: cedula_rif V-/E-/J-)
4. **Conductores y Flota** - Conductores, vehículos, documentos, liquidaciones
5. **Contabilidad** - Plan de cuentas, asientos, libro diario, mayor, balance, resultados, libros SENIAT
6. **Tributos & BCV** - IVA (16%/8%/0%), IGTF (3%), ISLR (Decreto 1.808), retenciones
7. **Cuentas por Pagar** - Proveedores, facturas, retenciones IVA/ISLR, pagos, envejecimiento
8. **Bitácora de Auditoría** - Quién modificó qué, cuándo, usuario, fecha y hora
9. **Usuarios del ERP** - Gestión de usuarios y roles RBAC
10. **Configuración Supabase** - Conexión opcional a Supabase

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
- **Roles:** SuperAdmin, Contador/Fiscal, Tesorero/CxP, Auditor/Operaciones (solo lectura).
- **Sesión:** 12 horas expiración, sessionStorage.
- **Documentos:** ruta `/{bucket}/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}`, máximo 10 MB, PDF/JPG/PNG/WEBP.
- **Supabase:** Opcional. App funciona 100% en local con `localStorage` y Data URL fallback.

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

**Objetivo:** quitar el avatar, nombre, rol y botón de logout del pie del sidebar; el cierre de sesión ya está en la barra superior. Ganar altura para mostrar los 10 módulos sin scrollbar.

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

## 6. Próximas tareas pendientes (opcionales)

1. **Integración WhatsApp** para notificaciones a conductores (pendiente de conversación con equipo).
2. **Integración SENIAT real** solo si se consigue API privada/convenio institucional.
3. **API BCV real** solo si se consigue fuente oficial con autenticación.
4. **PWA** (Progressive Web App) para instalación como aplicación.
5. **Geolocalización** de conductores y rutas óptimas.
6. **Reportes PDF** nativos (actualmente son print/CSV).

---

## 7. Cómo continuar el día siguiente

1. Abrir `index.html` directamente en Chrome (doble clic o `file:///`).
2. Iniciar sesión con `ENVIA` / `123456789`.
3. Todos los 9 módulos están operativos.
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
