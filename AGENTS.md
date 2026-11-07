# AGENTS.md — ENVIA ERP

Guía operativa para cualquier agente que trabaje en este repositorio. Las reglas
fiscales y contables completas están en [`docs/constitution.md`](docs/constitution.md).

## 1. Qué es este proyecto

**ENVIA ERP** es una aplicación web de gestión para una empresa venezolana de
movilidad y delivery. Cubre:

- Maestros de **clientes** y **conductores** con documentos digitales.
- **Servicios** (carreras y encomiendas) con IVA, IGTF y comisión del conductor.
- **Contabilidad** de partida doble, libro diario, libro mayor, balance de
  comprobación y estados financieros.
- **Fiscalidad SENIAT**: IVA, IGTF, retenciones de IVA e ISLR.
- **Proveedores, cuentas por pagar, pagos y comprobantes de retención**.
- **Dashboard** ejecutivo, reportes, exportación CSV/Excel e impresión.
- **RBAC** con cuatro roles base, roles personalizados, permisos granulares y
  **Supabase** opcional (REST + Storage).
- **Centro de reportes** en cada módulo, con impresión y exportación a Excel.

## 2. Restricciones técnicas obligatorias

1. **Sin build y sin servidor**: la app debe funcionar al abrir `index.html`
   directamente (`file://`). No uses módulos ES, imports, bundlers ni frameworks.
2. **Scripts clásicos** cargados en este orden: `store.js`, `supabaseService.js`,
   `ui.js`, módulos, `app.js`.
3. **Namespace global** `window.ENVIA` con `NS.store`, `NS.ui` y `NS.supabase`.
4. **Persistencia local**: `localStorage` (`envia_db_v1`, `envia_files_v1`,
   `envia_prefs_v1`) y `sessionStorage` para la sesión.
5. **Supabase es opcional**. Ningún flujo puede romperse si no hay conexión o
   configuración; los archivos usan fallback local en Data URL.
6. **Sin dependencias externas** de JS/CSS. Google Fonts es opcional y debe tener
   fallback del sistema.
7. **Rutas de imágenes** con espacios deben ir URL-encoded (`imagen/...`).

## 3. Reglas de negocio irrenunciables

- La **moneda funcional contable es VES**. Los montos operativos se capturan en
  USD y se convierten con la tasa **BCV** parametrizada.
- Todo asiento debe cumplir **DEBE = HABER** (tolerancia máxima 0,01 VES).
- La clave primaria de clientes y conductores es **`cedula_rif`**, validada con:
  `V-12345678`, `E-12345678` o `J-123456789`.
- La clave de proveedores es **`rif`**.
- No se puede eliminar un cliente/conductor con servicios, ni un proveedor con
  facturas, ni una cuenta con movimientos o subcuentas.
- Los documentos se guardan como
  `/{bucket}/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}`.
- Buckets: `documentos-clientes`, `documentos-conductores`, `fotos-vehiculos`.
- Roles base (el administrador puede crear roles personalizados):
  - `SuperAdmin`
  - `Contador / Fiscal`
  - `Tesorero / Cuentas por Pagar`
  - `Auditor / Operaciones`
- El usuario maestro es `ENVIA` / `123456789`, rol `SuperAdmin`, y no puede
  eliminarse ni cambiar de rol.

## 4. Fiscalidad venezolana

- IVA general **16 %**, reducido **8 %**, exento **0 %**.
- IGTF **3 %** cuando aplique.
- Retención de IVA: **75 %** o **100 %** según el tipo de proveedor.
- Retención de ISLR (Decreto 1.808):
  - `PN_RES`: 3 % con sustraendo de 10 UT.
  - `PJ_DOM`: 5 % sin sustraendo.
  - `PN_NORES` / `PJ_NODOM`: 34 %.
- UT y tasa BCV son parámetros editables; no las hardcodees en cálculos nuevos.

## 5. Arquitectura de archivos

```
index.html
css/styles.css
js/
  app.js                 # login, sesión, RBAC, router, shell
  services/
    store.js             # datos, seed, motor contable, CRUD, reportes
    supabaseService.js   # REST, Storage, sync, fallback
  modules/
    ui.js                # helpers, iconos, modales, gráficos, print/CSV
    dashboard.js clients.js drivers.js services.js
    accounting.js taxes.js payables.js users.js settings.js
sql/supabase_schema.sql
docs/constitution.md
.opencode/agents/*.md
```

## 6. Flujo de trabajo para agentes

1. Lee `docs/constitution.md` antes de tocar contabilidad o fiscalidad.
2. Inspecciona el código existente y sigue sus patrones.
3. Haz cambios pequeños y coherentes; no reescribas módulos completos sin causa.
4. Valida sintaxis: `node --check` sobre cada archivo JS modificado.
5. Prueba en Chrome: login, navegación por los 12 módulos, alta/edición,
   exportación, impresión y recarga.
6. Verifica que la app siga abriendo con `file://` y sin Supabase.
7. Reporta archivos tocados, pruebas ejecutadas y riesgos pendientes.

## 7. Convenciones

- UI y documentación en **español**; código y nombres de variables en español
  cuando representen dominio (`cedula_rif`, `saldo_wallet_usd`).
- Formato monetario: `ui.money` / `ui.bs`; fechas: `ui.date`.
- Escapa siempre texto de usuario con `ui.esc`.
- Usa `ui.toast`, `ui.modal`, `ui.confirm` en lugar de `alert`/`confirm`.
- Los reportes deben poder exportarse a CSV y abrirse en Excel (UTF-8 con BOM).
- No uses `alert`, `prompt` ni `document.write`.

## 8. Criterios de aceptación

- La app abre y funciona sin servidor ni Supabase.
- Los 12 módulos renderizan sin errores de consola y respetan los permisos
  granulares del rol o del usuario.
- Los cuatro roles ven solo lo permitido y las acciones de escritura se bloquean
  para `Auditor / Operaciones`.
- Los asientos cuadran y los reportes muestran totales consistentes.
- Los formularios validan cédula/RIF, montos y campos obligatorios.
- Los documentos se suben, previsualizan y persisten aun sin Supabase.
- El esquema SQL crea tablas, buckets, triggers, índices y políticas RLS.
