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
- **Conductores y flota**: expediente, documentos, vehículo, nivel y liquidaciones.
- **Contabilidad**: plan de cuentas, reglas, asientos, libro diario, libro mayor,
  balance de comprobación, balance general y estado de resultados.
- **Tributos & BCV**: tasa BCV, IVA, IGTF, UT, tarifas ISLR y comprobantes.
- **Cuentas por pagar**: proveedores, facturas, pagos, retenciones y antigüedad.
- **Bitácora de auditoría**: trazabilidad de cambios por usuario, módulo y fecha.
- **Usuarios del sistema**: roles base y personalizados con permisos por módulo,
  pestaña y acción; permisos personalizados por usuario.
- **Reportes**: botón en cada módulo con impresión y descarga Excel.
- **Configuración Supabase**: conexión, prueba, sincronización y respaldos.

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
- Login y recorrido de los 10 módulos con los 4 roles base, sin errores de consola.
- Alta/edición de cliente, servicio, factura y pago con asientos cuadrados.
- 34 reportes construidos correctamente; impresión y descarga Excel disponibles.
- Creación de roles y usuarios con permisos granulares; rechazo de acciones no permitidas.
- Subida de documento con fallback local, migración a IndexedDB y persistencia tras recarga.
- Diseño responsive verificado a 1440 px y 390 px.

## Estructura

```
index.html
css/styles.css
js/app.js
js/services/store.js
js/services/supabaseService.js
js/services/exchangeRateService.js
js/modules/{ui,dashboard,clients,drivers,services,accounting,taxes,payables,reports,audit,users,settings}.js
sql/supabase_schema.sql
docs/constitution.md
.opencode/agents/*.md
```
