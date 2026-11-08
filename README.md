# ENVIA ERP

ERP web para la operación venezolana de movilidad y delivery de **ENVIA**:
servicios (carreras y encomiendas), maestros de clientes y conductores,
contabilidad de partida doble, fiscalidad SENIAT, cuentas por pagar, retenciones,
dashboard ejecutivo, centro de reportes imprimibles/Excel y control de acceso con
roles y permisos granulares.

## Inicio rápido

1. Abre `index.html` con doble clic (funciona con `file://`, sin servidor).
2. Ingresa con las credenciales maestras:

   | Usuario | Clave | Rol |
   |---|---|---|
   | `ENVIA` | `123456789` | `SuperAdmin` |
   | `contador` | `Contador2026` | `Contador / Fiscal` |
   | `tesoreria` | `Tesoreria2026` | `Tesorero / Cuentas por Pagar` |
   | `auditor` | `Auditor2026` | `Auditor / Operaciones` (solo lectura) |

3. La primera vez se carga una base demo con clientes, conductores, servicios,
   proveedores, facturas, retenciones y asientos contables.
4. La base de datos se guarda en `localStorage` y los documentos en IndexedDB,
   con respaldo automático de la base. La app no depende de Supabase para operar.

> No requiere Node, npm, build ni servidor. Es una SPA con scripts clásicos para
> que `file://` funcione en Chrome, Edge o Firefox.

## Módulos

- **Dashboard**: KPIs, ingresos, métodos de pago, vencimientos y actividad.
- **Servicios**: carreras y encomiendas con IVA, IGTF, comisión y asientos.
- **Clientes**: cédula/RIF como PK, wallet, documentos y servicios.
- **Conductores y flota**: expediente, documentos (incluye **Seguro RCV**), fechas
  de vencimiento con alertas, vehículo, niveles Zafiro/Esmeralda/Diamante,
  wallet e liquidaciones.
- **Negocios asociados**: comercios aliados con comisiones por cobrar,
  recaudaciones por pagar y movimientos de cartera.
- **Tienda & inventario**: catálogo de uniformes/equipamiento, stock y compras
  financiadas al conductor con cuotas y abonos.
- **Contabilidad**: plan de cuentas, reglas, asientos, libro diario, libro mayor,
  balance de comprobación, balance general y estado de resultados.
- **Tributos & BCV**: tasa BCV, IVA, IGTF, UT, tarifas ISLR y comprobantes.
- **Cuentas por pagar**: proveedores, facturas, pagos, retenciones y antigüedad.
- **Bitácora de auditoría**: trazabilidad de cambios por usuario, módulo y fecha.
- **Usuarios del sistema**: roles base y personalizados con permisos por módulo,
  pestaña y acción; permisos personalizados por usuario.
- **Reportes**: botón en cada módulo con impresión y descarga Excel; los usuarios
  con permiso de escritura y reportes pueden crear listados personalizados
  eligiendo tabla, columnas, filtros y orden, limitados a los módulos y tablas
  que su rol o perfil tienen habilitados.
- **Configuración del Sistema**: parámetros de mantenimiento con módulo, nivel y
  tipo de plan; planes y eventos de conductores; integración de APIs; Supabase;
  estado de conexión; mapa de sincronización y respaldos.
- **Navegación por submenús**: el sidebar despliega las opciones de cada módulo y
  **Reportes** siempre queda al final; al elegir una opción se muestra su
  contenido sin repetir el encabezado de estadísticas del módulo. El título del
  módulo y **Dashboard** siempre regresan a la pantalla principal.

## Experiencia visual (v1.13.0)

- **ENVIA Spatial OS**: dock flotante de cristal, dashboard Bento asimétrico,
  tablas convertidas en *smart cards* y fichas documentales con vista previa.
- **Temas persistente**: `Dark Fintech` (por defecto) y `Light Spatial`. La
  preferencia se guarda en `localStorage` (`envia_theme_v2`) y se aplica antes
  del primer render.
- **Command palette global**: `Ctrl + K` / `⌘ + K` busca módulos, cédulas/RIF,
  facturas, servicios y productos. Navegación con flechas y `Enter`.
- **Cápsula BCV Live**: la tasa oficial muestra estado `LIVE` y conversión
  rápida `1 USD = Bs …` / `1.000 Bs = $ …` al pasar el cursor.
- **Login cinematográfico**: composición de marca + formulario de cristal, con
  los logos y fotografías de `imagen/`.
- **Respaldo del diseño anterior**: `_backup_diseno_original/` contiene
  `index.html`, `css/` y `js/` originales. Para volver atrás:

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\revertir_diseno.ps1
  ```

- **Archivo nuevo**: `js/services/experienceService.js` (tema, command palette y
  sincronización visual). No altera datos, sesión, RBAC ni cálculos fiscales.

## Contabilidad y fiscalidad

- Moneda funcional **VES**; operaciones en **USD** a la tasa **BCV**.
- Partida doble estricta: **DEBE = HABER** (tolerancia 0,01 VES).
- IVA **16 % / 8 % / exento**.
- IGTF **3 %** cuando aplique.
- Retención de IVA **75 % / 100 %**.
- Retención de ISLR (Decreto 1.808): **3 % + 10 UT**, **5 %**, **34 %**.
- Parámetros editables: tasa BCV, UT y tarifas.

Las reglas completas están en [`docs/constitution.md`](docs/constitution.md) y las
instrucciones para agentes en [`AGENTS.md`](AGENTS.md).

## Supabase (opcional)

La app funciona sin Supabase. Para habilitar la nube:

1. Crea un proyecto en Supabase.
2. Ejecuta [`sql/supabase_schema.sql`](sql/supabase_schema.sql) en el SQL Editor.
   El script crea tablas, índices, triggers, políticas RLS, los buckets
   `documentos-clientes`, `documentos-conductores` y `fotos-vehiculos`, y sus
   políticas de Storage.
3. En **Configuración Supabase**, ingresa la URL del proyecto y la `anon key`.
4. Prueba la conexión y usa **Sincronizar**.

### Rutas de archivos

```
documentos-clientes/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}
documentos-conductores/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}
fotos-vehiculos/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}
```

Si Supabase no está configurado o falla, el archivo se guarda localmente en
IndexedDB y se mantiene la vista previa. Los archivos antiguos en `localStorage`
se migran automáticamente para liberar espacio para la base de datos.

> **Seguridad:** las políticas RLS del script son de demostración y permiten
> `anon` para que la demo funcione con la clave pública. En producción deben
> restringirse a usuarios autenticados y propietarios.

## Validación realizada

- `node --check` sobre los 16 archivos JS.
- Login y recorrido de los 12 módulos con los 4 roles base, sin errores de consola.
- Alta/edición de cliente, servicio, factura y pago con asientos cuadrados.
- Asignación de productos con descuento de stock, cartera del conductor y abonos.
- Movimientos de negocios asociados y alertas documentales (vencido / por vencer).
- Reportes por módulo, incluidos asociados e inventario; impresión y Excel disponibles; reportes personalizados por el administrador con tabla, columnas, filtro y orden.
- Creación de roles y usuarios con permisos granulares; rechazo de acciones no permitidas.
- Subida de documento con fallback local, migración a IndexedDB y persistencia tras recarga.
- Diseño responsive verificado a 1440 px y 390 px.

## Estructura

```
index.html
css/styles.css
js/app.js
js/services/{store,supabaseService,exchangeRateService,sessionService,routerService,errorService,ocrService}.js
js/modules/{login,ui,dashboard,clients,drivers,partners,inventory,services,accounting,taxes,payables,reports,audit,users,settings}.js
sql/supabase_schema.sql
docs/constitution.md
docs/manual_usuario.md
manual.html
MEMORY.md
.opencode/agents/*.md
```
