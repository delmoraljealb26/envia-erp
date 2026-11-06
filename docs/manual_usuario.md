# Manual de Usuario — ENVIA ERP

**Versión:** 1.2 · **Fecha:** 06 de noviembre de 2026  
**Para:** Usuarios del sistema ENVIA ERP  
**Cómo abrir:** Doble clic en `index.html` en Google Chrome

---

## Índice

1. [Cómo entrar al sistema](#1-como-entrar-al-sistema)
2. [Panel principal (Dashboard)](#2-panel-principal-dashboard)
3. [Clientes](#3-clientes)
4. [Conductores y Flota](#4-conductores-y-flota)
5. [Servicios (Carreras y Encomiendas)](#5-servicios-carreras-y-encomiendas)
6. [Contabilidad (libros y estados)](#6-contabilidad-libros-y-estados)
7. [Tributos y Tasa BCV](#7-tributos-y-tasa-bcv)
8. [Cuentas por Pagar (proveedores y facturas)](#8-cuentas-por-pagar-proveedores-y-facturas)
9. [Bitácora de Auditoría](#9-bitacora-de-auditoria)
10. [Usuarios del ERP](#10-usuarios-del-erp)
11. [Respaldos](#11-respaldos)
12. [Sincronización con Supabase (nube)](#12-sincronización-con-supabase-nube)
13. [Reglas importantes que debes conocer](#13-reglas-importantes-que-debes-conocer)

---

## 1. Cómo entrar al sistema

### Paso 1 — Abrir la aplicación
Haz doble clic en el archivo `index.html` o arrástralo a una ventana de Google Chrome. La aplicación se abre directamente en tu navegador, no necesita internet ni servidor.

### Paso 2 — Iniciar sesión
En la pantalla de bienvenida verás el logotipo de ENVIA y dos campos:

| Campo | Qué escribir |
|-------|-------------|
| Usuario | `ENVIA` |
| Clave de acceso | `123456789` |

Puedes presionar el botón **"Usar"** que está debajo de "Credenciales maestras" para que se llenen automáticamente, y luego presiona **"Ingresar"**.

### Paso 3 — Ver tu sesión
Al entrar, verás tu nombre, tu rol y la tasa del dólar (BCV) en la parte superior derecha. Tu sesión dura 12 horas y se cierra automáticamente.

El **menú lateral** muestra todos los módulos a los que tienes acceso y se adapta a la altura de la pantalla: en pantallas de portátil reduce los espacios para que veas todas las opciones sin desplazarte. Los datos del usuario y el botón de **Cerrar sesión** están únicamente en la barra superior derecha.

> Si olvidas la clave, contacta a la persona encargada del sistema en tu empresa. No hay forma de recuperarla desde el login.

---

## 2. Panel principal (Dashboard)

Al entrar, ves el **Dashboard** organizado como un tablero de operación:

### Banda de operación (14 días)

Arriba, la banda azul resume el período:

- **Ingresos brutos** y su equivalente en bolívares.
- **Comisión ENVIA** y el margen sobre lo facturado.
- **Servicios** realizados, separados en carreras y encomiendas.
- **Hoy:** cuántos servicios van y cuánto generaron.
- En la franja inferior: conductores activos, facturas pendientes, IVA + IGTF del período y la tasa BCV aplicada.

### Ritmo de ingresos

Gráfico de barras de los últimos 14 días. La barra naranja es hoy y la más alta se resalta en azul. Abajo ves el promedio diario. Pasa el mouse sobre una barra para ver la fecha y el monto exacto.

### Por pagar

Lista de facturas de proveedores pendientes, ordenadas por fecha de vencimiento. Las vencidas se marcan en naranja. Al final se muestran el total de facturas pendientes y las liquidaciones a conductores. Haz clic en una factura para abrir su detalle o en **Ver CxP** para ir al módulo completo.

### De dónde viene y cómo se cobra

- **Composición del ingreso:** cuánto entra por carreras y cuánto por encomiendas, con montos y porcentajes.
- **Métodos de cobro:** cuánto se cobró por Pago Móvil, Efectivo USD, Wallet, Tarjeta y Zelle.
- Debajo: comisión retenida, IVA + IGTF, total cobrado y ticket promedio.

### Servicios recientes

Tabla con los últimos 8 servicios. Haz clic en el cliente o en el conductor para abrir su ficha, o en **Ver historial** para ir al módulo de Servicios.

> Todos los montos se muestran en dólares (USD) y en bolívares (VES) con la tasa del BCV vigente. La tasa se actualiza automáticamente al iniciar sesión.

---

## 3. Clientes

Los clientes son las personas o empresas a las que les prestas servicio de traslado o encomienda.

### Ver la lista de clientes
Ve al menú lateral y haz clic en **Clientes**. Verás una tabla con todos los clientes registrados, su cédula/RIF, teléfono, saldo en la billetera y cuántos servicios han tenido.

### Agregar un cliente nuevo
1. En la pantalla de Clientes, busca el botón para agregar nuevo (generalmente dice "Nuevo cliente" o tiene un icono de más).
2. Llena los campos obligatorios:
   - **Cédula / RIF:** Ejemplo `V-12345678`, `E-12345678` o `J-123456789`. Es la identificación única del cliente y no se puede repetir.
   - **Nombres y Apellidos**
   - **Teléfono móvil**
   - **Correo electrónico**
   - **Dirección completa**
   - **Estatus:** Activo, Suspendido, Pendiente o Corporativo.
3. Presiona **Guardar**.

### Editar un cliente
1. En la lista, haz clic sobre el nombre del cliente que quieres editar.
2. Cambia los campos que necesites (excepto la cédula/RIF, que no se puede cambiar una vez creado).
3. Presiona **Guardar**.

> No se puede eliminar un cliente que tenga servicios registrados.

---

## 4. Conductores y Flota

Los conductores son las personas que realizan las carreras y entregas. Reciben un pago por cada servicio.

### Registrar un conductor
1. Ve al menú lateral → **Conductores y Flota**.
2. Haz clic en el botón para agregar conductor nuevo.
3. Llena los datos personales:
   - Cédula / RIF (único, no se repite).
   - Nombres y apellidos.
   - Teléfono y correo.
   - Dirección.
4. Llena los datos del vehículo:
   - Tipo de servicio (Moto Delivery, Carro, etc.).
   - Placa, marca, modelo, año y color.
5. Llena los datos de pago:
   - Banco, número de cuenta.
   - Teléfono y cédula de Pago Móvil.
   - Porcentaje de comisión (cuánto se queda ENVIA de cada carrera).
6. Presiona **Guardar**.

### Documentos del conductor
Cada conductor debe tener documentos que pueden estar en tres estados: Pendiente, Aprobado o Rechazado.
- Cédula
- RIF
- Licencia de conducir
- Tarjeta de circulación

Cuando todos los documentos estén **Aprobados**, el conductor puede pasar de "En Revisión" a **Activo / Disponible** y podrá recibir carreras.

> No se puede eliminar un conductor que tenga servicios registrados.

---

## 5. Servicios (Carreras y Encomiendas)

Aquí registras cada viaje o entrega que se hace.

### Crear un servicio nuevo
1. Ve al menú lateral → **Servicios**.
2. Haz clic en el botón para agregar servicio nuevo.
3. Selecciona:
   - **Tipo:** Carrera (traslado de persona) o Encomienda (entrega de paquete).
   - **Cliente:** Debe estar registrado en Clientes.
   - **Conductor:** Debe estar registrado y activo.
   - **Origen y destino:** Direcciones de salida y llegada.
   - **Kilómetros y minutos:** Distancia y tiempo del viaje.
   - **Base en USD:** El monto cobrado al cliente (sin impuestos).
   - **IVA %:** 16 (general), 8 (reducido) o 0 (exento).
   - **Método de pago:** Pago Móvil, Wallet, Efectivo USD, Zelle o Tarjeta.
   - **Número de factura y control:** Si aplica.
4. Presiona **Guardar**.

### Qué pasa automáticamente al guardar
El sistema hace lo siguiente solo:
- Crea el ingreso contable en bolívares (usando la tasa del dólar del día).
- Calcula el IVA y el IGTF (3% si el pago es en efectivo USD o Zelle).
- Calcula la comisión del conductor.
- Suma el saldo que le debes al conductor.
- Resta del monto de la billetera del cliente si pagó con Wallet.

> No puedes crear un servicio si el cliente o el conductor no existen en sus respectivos maestros.

---

## 6. Contabilidad (libros y estados)

ENVIA ERP lleva la contabilidad automática en bolívares (VES). Cada servicio, factura o pago genera sus asientos contables solos.

### Qué puedes ver y imprimir
Desde el menú **Contabilidad** puedes consultar:

| Reporte | Qué muestra |
|---------|-------------|
| Libro Diario | Todos los asientos contables en orden de fecha. |
| Libro Mayor | El movimiento de cada cuenta contable. |
| Balance de Comprobación | Si los debitos y créditos están equilibrados. |
| Estado de Resultados | Ingresos, costos y gastos del período. |
| Balance General | Activos, pasivos y patrimonio de la empresa. |
| Libro de Ventas | Facturas emitidas con IVA e IGTF (para el SENIAT). |
| Libro de Compras | Facturas de proveedores con retenciones. |

### Cómo imprimir o exportar
Cada reporte tiene dos botones:
- **Imprimir:** Abre una versión lista para imprimir.
- **Exportar CSV:** Descarga un archivo que se puede abrir en Excel.

> Todos los reportes muestran la tasa del BCV utilizada y el período seleccionado.

---

## 7. Tributos y Tasa BCV

Desde el menú **Tributos & BCV** ves los parámetros fiscales de la empresa:

| Parámetro | Valor |
|-----------|-------|
| Tasa BCV (Bs por USD) | **Solo lectura** — se actualiza desde DolarVZLA o por fecha |
| IVA general | 16% |
| IVA reducido | 8% |
| IVA exento | 0% |
| IGTF | 3% (sobre pagos en divisas) |
| Unidad Tributaria | 90 Bs |

### Tasa automática (DolarVZLA)

ENVIA ERP consulta la **tasa oficial del BCV** automáticamente mediante DolarVZLA cada vez que inicias sesión. En la barra superior verás el indicador:

> 🏦 **Tasa BCV — Bs [valor] / USD**  
> 🕐 debajo, la fecha de la tasa y la fuente (`DolarVZLA`).

- La tasa **no se puede subir ni bajar manualmente**: es de solo lectura para evitar errores contables.
- Se guarda en la sesión del navegador para no saturar la API y se usa en todos los cálculos (servicios, cuentas por pagar, dashboard, contabilidad).
- Para forzar una consulta nueva de la tasa vigente, haz clic en el botón **⟳** junto a la tasa, o usa **Tributos & BCV → Sincronizar BCV**.

### Consultar la tasa de una fecha (calendario)

Junto a la tasa hay un icono de **calendario** 🗓️:

1. Haz clic en el icono de calendario.
2. Selecciona la fecha que necesitas (solo aparecen fechas con tasa publicada).
3. Presiona **Aplicar tasa**.

La tasa de esa fecha se aplica a todos los cálculos y el indicador cambia a **`DolarVZLA · histórica`** con el borde amarillo. Usa **Tasa de hoy** en el mismo cuadro para volver a la tasa vigente.

> Si eliges un fin de semana o feriado sin tasa publicada, el sistema usará automáticamente la fecha hábil más cercana anterior y te avisará.

### Si la API no responde

Si no hay internet o DolarVZLA no está disponible, el sistema **conserva la última tasa conocida** y muestra un aviso. La tasa no se edita manualmente: cuando se recupere la conexión, usa **⟳** para actualizarla.

> Solo los roles con permiso de escritura (SuperAdmin, Contador/Fiscal y Tesorero/CxP) ven los controles de calendario y actualización; el rol Auditor solo visualiza la tasa.

Todos los nuevos servicios y facturas usarán la nueva tasa. Los asientos contables ya creados conservan la tasa que tenían ese día.

> Esta tasa es importante porque convierte los dólares que capturas en operaciones a bolívares para la contabilidad.

---

## 8. Cuentas por Pagar (proveedores y facturas)

Aquí gestionas lo que le debes a tus proveedores (repuestos, combustible, servicios, etc.).

### Registrar un proveedor
1. Ve a **Cuentas por Pagar** → pestaña de proveedores.
2. Haz clic en **Nuevo proveedor**.
3. Llena:
   - RIF (ejemplo `J-123456789` o `V-12345678`).
   - Razón social (nombre de la empresa).
   - Teléfono, correo y dirección.
   - Retención de IVA (75% o 100%).
   - Tipo de persona para el impuesto sobre la renta.
4. Presiona **Guardar**.

### Registrar una factura de compra
1. En la lista de facturas, busca el botón para agregar nueva.
2. Selecciona el proveedor.
3. Llena número de factura, número de control, fechas y concepto.
4. Ingresa los montos (base, IVA, etc.).
5. El sistema calcula automáticamente las retenciones de IVA e ISLR.
6. Presiona **Guardar**.

### Pagar una factura
1. En la lista, busca la factura pendiente.
2. Haz clic en **Pagar**.
3. Ingresa el monto, método de pago y referencia.
4. Presiona **Guardar**.

> No se puede eliminar una factura que ya tenga pagos registrados.

---

## 9. Bitácora de Auditoría

Esta sección registra todo lo que se hace en el sistema para tener un control de quién modificó qué.

### Qué se registra
Cada vez que guardas o borras algo (cliente, conductor, servicio, factura, asiento contable, usuario, tasa del dólar, etc.), el sistema anota:
- **Usuario:** Quién hizo el cambio.
- **Fecha y hora:** Cuándo sucedió.
- **Acción:** Qué se hizo (crear, actualizar, eliminar, pagar, etc.).
- **Módulo:** En qué parte del sistema (clientes, servicios, contabilidad, etc.).
- **Detalle:** Qué se modificó.
- **Referencia:** El ID del registro cambiado.

### Cómo usarla
Ve al menú lateral → **Bitácora de Auditoría**. Puedes filtrar por usuario, acción o módulo, y exportar la lista a CSV si necesitas imprimirla o revisarla en Excel.

> Solo el administrador principal puede borrar esta bitácora. Los demás solo pueden verla.

---

## 10. Usuarios del ERP

Aquí se gestionan las personas que entran al sistema y qué pueden hacer.

### Roles disponibles
| Rol | Puede hacer |
|-----|-------------|
| SuperAdmin | Todo: todos los módulos, configurar, usuarios, sincronizar. |
| Contador / Fiscal | Contabilidad, tributos, libros, cuentas por pagar, maestros. |
| Tesorero / CxP | Pagos, proveedores, liquidaciones, maestros, consulta tributaria. |
| Auditor / Operaciones | Solo ver todo, no puede guardar ni borrar nada. |

### Crear un usuario nuevo
1. Ve a **Usuarios del ERP**.
2. Haz clic en **Nuevo usuario**.
3. Llena: usuario, clave, nombre, correo y asigna un rol.
4. Presiona **Guardar**.

> El usuario `ENVIA` es el dueño del sistema y no se puede eliminar ni cambiar su rol.

---

## 11. Respaldos

Es recomendable hacer respaldos periódicamente para no perder información.

### Hacer un respaldo
1. Ve a **Configuración** o a la sección de respaldos.
2. Haz clic en **Exportar respaldo JSON**.
3. Se descargará un archivo con todos los datos (clientes, conductores, servicios, facturas, asientos, etc.).

### Restaurar un respaldo
1. Haz clic en **Importar respaldo**.
2. Selecciona el archivo JSON que exportaste antes.
3. El sistema cargará esos datos (esto reemplaza lo que tengas actualmente).

> Antes de importar, asegúrate de no necesitar los datos actuales, porque se sobrescriben.

---

## 12. Sincronización con Supabase (nube)

ENVIA ERP puede guardar tus datos en la nube usando **Supabase**. Esto significa que tu información está respaldada y disponible desde cualquier dispositivo donde abra el sistema, además de seguir funcionando sin internet usando el almacenamiento local.

### Qué se sincroniza
Cuando sincronizas, el sistema sube a Supabase toda tu información operativa:

| Módulo | Qué se guarda en la nube |
|--------|--------------------------|
| Clientes | Todos los clientes registrados con sus datos y saldo de wallet |
| Conductores | Conductores, vehículos, documentos y datos de pago |
| Proveedores | RIF, razón social, datos de contacto y configuración de retenciones |
| Servicios | Carreras y encomiendas con montos, IVA, IGTF y comisiones |
| Cuentas por Pagar | Facturas, retenciones IVA/ISLR y pagos |
| Contabilidad | Plan de cuentas, asientos contables y líneas de asiento |
| Usuarios | Usuarios del ERP y sus roles |
| Tributos | Tasa BCV, IVA, IGTF, ISLR y unidad tributaria |

### Cómo sincronizar tus datos

1. Ve al menú lateral → **Configuración Supabase & Sincronización**.
2. Verifica que tengas pegados correctamente:
   - **Project URL:** `https://tu-proyecto.supabase.co`
   - **anon key:** La clave pública que empieza con `eyJ...`
3. Haz clic en el botón **"Sincronizar ahora"**.
4. Espera a que termine el proceso. Verás un reporte con cuántos registros se subieron a cada tabla.

### Qué pasa si la conexión falla

Si Supabase no está disponible o hay problemas de internet, el ERP **sigue funcionando normalmente**:

- Todos los datos se guardan en tu navegador (localStorage).
- Los documentos se guardan como Data URL localmente.
- Cuando recuperes la conexión, puedes volver a sincronizar y los datos se subirán a la nube sin perder nada.

### Cuándo sincronizar

Se recomienda sincronizar:
- Después de configurar Supabase por primera vez.
- Después de cargar muchos datos nuevos (clientes, servicios, facturas).
- Periódicamente, para mantener respaldo actualizado en la nube.

---

## 13. Reglas importantes que debes conocer

1. **La cédula / RIF no se repite:** Cada cliente y conductor tiene un identificador único. No se pueden duplicar.
2. **No se puede borrar lo que se usa:** No se puede eliminar un cliente que tenga servicios, ni un proveedor que tenga facturas, ni una cuenta contable que tenga movimientos.
3. **Todo queda registrado:** Cada cambio que hagas queda grabado en la bitácora con tu nombre, fecha y hora.
4. **El dólar es importante:** Los montos operativos se capturan en dólares y se convierten a bolívares con la tasa del día para la contabilidad.
5. **Tu sesión dura 12 horas:** Después de ese tiempo, el sistema te pedirá entrar de nuevo.
6. **El usuario ENVIA es el dueño:** Tiene acceso total y no se puede eliminar ni cambiar de rol.

---

## ¿Necesitas ayuda?

Si tienes dudas sobre cómo usar algún módulo, contacta al administrador del sistema en tu empresa o revisa la sección correspondiente de este manual.

ENVIA ERP — Gestión de movilidad, encomiendas y contabilidad venezolana.
