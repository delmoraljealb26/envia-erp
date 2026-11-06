# Constitución de ENVIA ERP

**Versión:** 1.0 · **Vigencia:** noviembre 2026
**Ámbito:** arquitectura, contabilidad, fiscalidad, seguridad y calidad.

Esta constitución es vinculante para todo agente, desarrollador o auditor que
modifique ENVIA ERP. Si una instrucción contradice estas reglas, prevalece la
constitución y debe documentarse la excepción.

---

## Artículo 1 · Principios rectores

1. **Integridad contable.** Ningún asiento puede registrarse si `DEBE ≠ HABER`.
   La tolerancia máxima es **0,01 VES** por diferencias de redondeo.
2. **Trazabilidad.** Toda operación debe conservar fecha, referencia, origen,
   tasa BCV y usuario responsable.
3. **Resiliencia.** La aplicación debe operar sin Supabase y sin conexión a
   internet, usando almacenamiento local y archivos en Data URL.
4. **Mínimo privilegio.** El acceso se controla por rol y por módulo; la interfaz
   oculta lo no permitido y la capa de datos vuelve a validar.
5. **Exactitud fiscal.** Los parámetros (IVA, IGTF, UT, BCV, tarifas ISLR) son
   configurables y nunca deben quedar embebidos en la lógica nueva.
6. **Auditabilidad.** Los documentos, comprobantes y asientos no se eliminan
   silenciosamente; toda acción destructiva debe bloquearse o justificarse.

---

## Artículo 2 · Moneda y tipos de cambio

1. La **moneda funcional contable es el Bolívar (VES)**.
2. Los módulos operativos (servicios, proveedores, wallet) capturan **USD**.
3. La conversión usa la **tasa BCV** vigente en `taxParams.bcvRate`.
4. Los asientos guardan su propia `tasa_bcv` para preservar el valor histórico.
5. Los reportes contables se expresan en VES. Los reportes gerenciales pueden
   mostrar USD indicando la tasa utilizada.
6. No se permite mezclar monedas en una misma línea de asiento.

---

## Artículo 3 · Partida doble y catálogo de cuentas

1. Cada asiento tiene al menos dos líneas y cumple `Σ DEBE = Σ HABER`.
2. Las cuentas siguen la codificación jerárquica:
   - `1` Activos · `2` Pasivos · `3` Patrimonio · `4` Ingresos · `5` Costos · `6` Gastos.
3. Solo las cuentas de nivel **Cuenta de Movimiento** pueden recibir líneas.
4. Una cuenta con subcuentas o movimientos no puede eliminarse.
5. Los eventos automáticos se rigen por `accountingRules`:
   - `traslado`, `encomienda`, `recarga_wallet`, `recarga_wallet_ves`,
     `liquidacion_conductor`, `compra_proveedor`, `pago_proveedor`.
6. Los asientos de apertura, servicios, compras, retenciones, pagos, gastos y
   wallet se generan automáticamente y no deben duplicarse.

### 3.1 Registro de ingresos por servicio

| Cuenta | DEBE | HABER |
|---|---|---|
| Banco / Caja (según cobro) | Total VES | — |
| Ingreso por carrera o encomienda | — | Base VES |
| IVA por pagar | — | IVA VES |
| IGTF por pagar | — | IGTF VES |

### 3.2 Liquidación al conductor

| Cuenta | DEBE | HABER |
|---|---|---|
| Costo liquidación conductores | Pago conductor VES | — |
| Cuentas por pagar conductores | — | Pago conductor VES |

### 3.3 Compra a proveedor con retenciones

| Cuenta | DEBE | HABER |
|---|---|---|
| Gasto / costo | Base + exento | — |
| IVA crédito fiscal | IVA | — |
| IGTF pagado | IGTF | — |
| Cuentas por pagar proveedores | Retención IVA + ISLR | — |
| Cuentas por pagar proveedores | — | Total bruto |
| Retenciones IVA por pagar | — | Retención IVA |
| ISLR por pagar | — | Retención ISLR |

---

## Artículo 4 · IVA

1. Alícuota general: **16 %**.
2. Alícuota reducida: **8 %**.
3. Operaciones exentas: **0 %**.
4. La base imponible es el monto de la operación antes de IVA e IGTF.
5. El IVA se calcula con redondeo a dos decimales por documento.
6. En compras, el IVA soportado se registra en **IVA Crédito Fiscal** (`1.1.4.01`).
7. En ventas, el IVA se registra en **IVA por Pagar** (`2.1.2.01`).

---

## Artículo 5 · IGTF

1. Alícuota: **3 %**.
2. Se aplica sobre el total de la operación (base + IVA) cuando el pago se
   realiza en divisas o mediante instrumentos no bancarios, conforme a la norma
   vigente y a la parametrización de la empresa.
3. Se registra en **IGTF por Pagar** (`2.1.2.02`) en ventas y en
   **IGTF Pagado** (`1.1.5.01`) en compras.
4. Es parametrizable y puede desactivarse por operación (`igtf_pct = 0`).

---

## Artículo 6 · Retención de IVA

1. Se aplica a compras a proveedores cuando corresponda.
2. Porcentajes:
   - **75 %** para personas naturales residentes.
   - **100 %** para personas jurídicas domiciliadas y no domiciliadas.
3. La retención se calcula sobre el IVA facturado.
4. Se registra en **Retenciones de IVA por Pagar** (`2.1.2.04`).
5. El comprobante debe identificar período, número, proveedor, RIF, factura,
   número de control, base, IVA y monto retenido.

---

## Artículo 7 · Retención de ISLR (Decreto 1.808)

1. Tarifas parametrizadas:

| Tipo | Tarifa | Sustraendo |
|---|---:|---:|
| Persona Natural Residente (`PN_RES`) | 3 % | 10 UT |
| Persona Jurídica Domiciliada (`PJ_DOM`) | 5 % | 0 UT |
| Persona Natural No Residente (`PN_NORES`) | 34 % | 0 UT |
| Persona Jurídica No Domiciliada (`PJ_NODOM`) | 34 % | 0 UT |

2. Fórmula:
   `Retención VES = max(0, Base VES × tarifa% − sustraendo UT × valor UT)`
3. La retención en USD se obtiene dividiendo entre la tasa BCV del documento.
4. Se registra en **ISLR por Pagar** (`2.1.2.03`).
5. El sustraendo solo aplica cuando la tarifa lo define; nunca se resta dos veces.
6. El valor de la UT es el publicado por el SENIAT y se configura en
   `taxParams.ut` (demo: **90 VES**).

---

## Artículo 8 · Documentos y archivos

1. Buckets obligatorios:
   - `documentos-clientes`
   - `documentos-conductores`
   - `fotos-vehiculos`
2. Ruta obligatoria:
   `/{bucket}/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}`
3. Tipos permitidos: PDF, JPG, JPEG, PNG, WEBP.
4. Tamaño máximo por archivo: **10 MB**.
5. Si Supabase no está configurado o falla, el archivo se guarda localmente como
   Data URL y la UI debe indicarlo sin bloquear el flujo.
6. Los documentos deben poder previsualizarse en un modal y descargarse.
7. No se permite guardar archivos fuera de la carpeta del titular.

---

## Artículo 9 · Maestros y claves

1. **Clientes:** `cedula_rif` es clave primaria obligatoria y única.
2. **Conductores:** `cedula_rif` es clave primaria obligatoria y única.
3. **Proveedores:** `rif` es clave primaria obligatoria y única.
4. Formatos aceptados:
   - Venezolano: `V-12345678`
   - Extranjero: `E-12345678`
   - Jurídico: `J-123456789`
5. Se normaliza a mayúsculas y se valida antes de guardar.
6. Los documentos de conductor tienen estados:
   `Pendiente`, `Aprobado`, `Rechazado`.
7. Un conductor con todos los documentos aprobados puede pasar de
   `En Revisión Documental` a `Activo / Disponible`.

---

## Artículo 10 · Roles y permisos (RBAC)

| Rol | Acceso | Escritura |
|---|---|---|
| `SuperAdmin` | Todos los módulos | Sí |
| `Contador / Fiscal` | Dashboard, servicios, clientes, conductores, contabilidad, fiscal, CxP | Sí |
| `Tesorero / Cuentas por Pagar` | Dashboard, servicios, clientes, conductores, CxP, fiscal | Sí |
| `Auditor / Operaciones` | Dashboard, servicios, clientes, conductores, contabilidad, fiscal, CxP | **No** |

1. El usuario maestro `ENVIA` (`123456789`) es `SuperAdmin` y no puede
   eliminarse ni degradarse.
2. La sesión expira a las **12 horas**.
3. Las contraseñas se almacenan localmente para la demo; en producción deben
   migrarse a Supabase Auth con hash.
4. La UI debe ocultar acciones no permitidas y la capa de datos debe rechazarlas.

---

## Artículo 11 · Seguridad y datos

1. No se almacenan secretos ni claves de servicio en el frontend.
2. La `anon key` de Supabase es pública por diseño; la protección real son las
   políticas RLS.
3. Las políticas RLS del repositorio son de **demostración** (permiten anon);
   en producción deben restringirse a usuarios autenticados y propietarios.
4. Toda entrada de usuario se escapa antes de insertarse en HTML.
5. No se usa `eval`, `document.write`, `innerHTML` con datos sin escapar, ni
   `alert`/`confirm` nativos.
6. Los respaldos se exportan/importan en JSON y deben validar su estructura.

---

## Artículo 12 · Reportes y exportación

1. Todo reporte debe poder **imprimirse** y **exportarse a CSV/Excel**.
2. El CSV se codifica en UTF-8 con BOM para compatibilidad con Excel.
3. Los reportes mínimos:
   - Libro diario.
   - Libro mayor.
   - Balance de comprobación.
   - Estado de resultados.
   - Balance general.
   - Libro de ventas y libro de compras.
   - Retenciones de IVA e ISLR.
   - Antigüedad de cuentas por pagar.
4. Los totales deben coincidir con los asientos del período seleccionado.
5. Se debe indicar claramente la moneda, la tasa BCV y el período.

---

## Artículo 13 · Calidad y validación

Antes de entregar cualquier cambio:

1. `node --check` sobre todos los archivos JS modificados.
2. Apertura de `index.html` en Chrome mediante `file://`.
3. Login con `ENVIA` / `123456789`.
4. Recorrido de los 9 módulos sin errores en consola.
5. Alta y edición de cliente y conductor con validación de cédula/RIF.
6. Carga y vista previa de un documento con y sin Supabase.
7. Registro de un servicio y verificación del asiento generado.
8. Registro de una factura de proveedor y verificación de retenciones.
9. Exportación CSV e impresión de al menos un reporte.
10. Recarga de la página y verificación de persistencia.

---

## Artículo 14 · Prohibiciones

- Romper la partida doble o alterar totales para "cuadrar" reportes.
- Hardcodear tasas, UT o alícuotas en lógica nueva.
- Usar módulos ES o dependencias que impidan `file://`.
- Eliminar datos o archivos sin confirmación y sin respaldo.
- Exponer claves privadas o `service_role` en el cliente.
- Omitir la validación de cédula/RIF o permitir duplicados.
- Publicar una versión sin haber validado sintaxis y flujo principal.

---

## Artículo 15 · Reforma

Cualquier cambio a esta constitución debe:

1. Justificarse por normativa SENIAT, cambio de alcance o incidente.
2. Documentarse con fecha, versión y responsable.
3. Actualizar `AGENTS.md` y, si aplica, el esquema SQL.
4. Ser revisado por el rol `Contador / Fiscal` y el `SuperAdmin`.
