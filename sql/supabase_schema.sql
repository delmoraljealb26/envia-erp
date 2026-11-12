-- ============================================================================
--  ENVIA ERP · Esquema Supabase (PostgreSQL)
--  Versión 1.0 · Noviembre 2026
--  Última revisión de interfaz: v1.13.2 · Inventario consultable y sync con timeout (sin cambios de esquema).
--
--  Este esquema replica la estructura local de ENVIA ERP y soporta la
--  sincronización REST/Storage del frontend (js/services/supabaseService.js).
--
--  NOTA DE SEGURIDAD:
--  Las políticas RLS incluidas permiten el rol `anon` para que la demo funcione
--  con la clave pública. En producción se deben restringir a usuarios
--  autenticados, propietarios y al rol `service_role` para procesos internos.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
--  1. FUNCIÓN GENÉRICA updated_at
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================================
--  2. MAESTRO DE CLIENTES
-- ============================================================================
create table if not exists public.clients (
  cedula_rif            text primary key
                          check (cedula_rif ~ '^[VEJ]-[0-9]{7,9}$'),
  nombres               text not null,
  apellidos             text not null,
  telefono              text,
  correo                text,
  direccion             text,
  saldo_wallet_usd      numeric(14,2) not null default 0 check (saldo_wallet_usd >= 0),
  saldo_wallet_ves      numeric(14,2) not null default 0 check (saldo_wallet_ves >= 0),
  total_carreras        integer not null default 0 check (total_carreras >= 0),
  total_encomiendas     integer not null default 0 check (total_encomiendas >= 0),
  estatus               text not null default 'Activo'
                          check (estatus in ('Activo','Corporativo','Suspendido','Pendiente de Verificación')),
  fecha_registro        date not null default current_date,
  url_foto_cedula       text,
  url_foto_rif          text,
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);

comment on table public.clients is 'Clientes de ENVIA. Clave primaria: cédula o RIF.';

-- ============================================================================
--  3. MAESTRO DE CONDUCTORES
-- ============================================================================
create table if not exists public.drivers (
  cedula_rif              text primary key
                            check (cedula_rif ~ '^[VEJ]-[0-9]{7,9}$'),
  nombres                 text not null,
  apellidos               text not null,
  telefono                text,
  correo                  text,
  direccion               text,
  tipo_servicio           text check (tipo_servicio in ('Moto Delivery','Moto Taxi','Vehículo Sedán','Camioneta Carga')),
  placa                   text,
  marca                   text,
  modelo                  text,
  anio                    integer check (anio between 1950 and 2100),
  color                   text,
  banco                   text,
  telefono_pago_movil     text,
  cedula_pago_movil       text,
  cuenta_bancaria         text,
  porcentaje_comision     numeric(5,2) not null default 20 check (porcentaje_comision between 0 and 100),
  saldo_por_liquidar_usd  numeric(14,2) not null default 0 check (saldo_por_liquidar_usd >= 0),
  estatus_conductor       text not null default 'En Revisión Documental'
                            check (estatus_conductor in ('Activo / Disponible','En Servicio','En Revisión Documental','Inactivo por Documentos Vencidos','Suspendido')),
  nivel                   text not null default 'Zafiro'
                            check (nivel in ('Zafiro','Esmeralda','Diamante')),
  tipo_tarifa             text not null default 'fijo'
                            check (tipo_tarifa in ('fijo','porcentaje')),
  fecha_registro          date not null default current_date,
  url_foto_cedula         text,
  url_foto_rif            text,
  url_foto_licencia       text,
  url_carnet_circulacion  text,
  url_seguro_rcv          text,
  urls_fotos_vehiculo     jsonb not null default '[]'::jsonb,
  docs_estado             jsonb not null default '{}'::jsonb,
  docs_meta               jsonb not null default '{}'::jsonb,
  inactivado_por_documentos boolean not null default false,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

comment on table public.drivers is 'Conductores y vehículos. Clave primaria: cédula o RIF.';
comment on column public.drivers.docs_meta is 'Fechas de emisión/vencimiento por documento: {cedula:{emision,vencimiento,origen}}';

-- Migración idempotente para instalaciones existentes.
alter table public.drivers add column if not exists url_seguro_rcv text;
alter table public.drivers add column if not exists docs_meta jsonb not null default '{}'::jsonb;
alter table public.drivers add column if not exists inactivado_por_documentos boolean not null default false;
alter table public.drivers add column if not exists tipo_tarifa text not null default 'fijo';
alter table public.drivers alter column nivel set default 'Zafiro';
alter table public.drivers drop constraint if exists drivers_estatus_conductor_check;
alter table public.drivers add constraint drivers_estatus_conductor_check
  check (estatus_conductor in ('Activo / Disponible','En Servicio','En Revisión Documental','Inactivo por Documentos Vencidos','Suspendido'));
alter table public.drivers drop constraint if exists drivers_nivel_check;
update public.drivers
   set nivel = case nivel
     when 'Plata' then 'Zafiro'
     when 'Oro' then 'Esmeralda'
     when 'Platium' then 'Diamante'
     else nivel end
 where nivel in ('Plata','Oro','Platium');
alter table public.drivers add constraint drivers_nivel_check
  check (nivel in ('Zafiro','Esmeralda','Diamante'));

-- ============================================================================
--  4. PROVEEDORES
-- ============================================================================
create table if not exists public.suppliers (
  rif                 text primary key
                        check (rif ~ '^[VEJ]-[0-9]{7,9}$'),
  razon_social        text not null,
  telefono            text,
  correo              text,
  retencion_iva_pct   numeric(5,2) not null default 75 check (retencion_iva_pct in (0,75,100)),
  tipo_persona        text not null default 'PJ_DOM'
                        check (tipo_persona in ('PN_RES','PJ_DOM','PN_NORES','PJ_NODOM')),
  direccion           text,
  actividad           text,
  estatus             text not null default 'Activo',
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

comment on table public.suppliers is 'Proveedores de bienes y servicios. Clave primaria: RIF.';

-- ============================================================================
--  5. PLAN DE CUENTAS
-- ============================================================================
create table if not exists public.chart_of_accounts (
  codigo       text primary key,
  id           text unique,
  nombre       text not null,
  nivel        text not null check (nivel in ('Grupo','Subgrupo','Rubro','Cuenta de Movimiento')),
  naturaleza   text not null check (naturaleza in ('Deudora','Acreedora')),
  moneda       text not null default 'VES' check (moneda in ('VES','USD')),
  estado       text not null default 'Activa' check (estado in ('Activa','Inactiva')),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

comment on table public.chart_of_accounts is 'Catálogo jerárquico de cuentas contables (VES funcional).';

-- ============================================================================
--  6. SERVICIOS / ÓRDENES DE TRABAJO
-- ============================================================================
create table if not exists public.services_orders (
  id                      text primary key,
  tipo                    text not null check (tipo in ('carrera','encomienda')),
  cliente_cedula_rif      text not null references public.clients(cedula_rif)
                            on update cascade on delete restrict,
  conductor_cedula_rif    text not null references public.drivers(cedula_rif)
                            on update cascade on delete restrict,
  fecha                   date not null default current_date,
  origen                  text,
  destino                 text,
  distancia_km            numeric(10,2) not null default 0 check (distancia_km >= 0),
  duracion_min            integer not null default 0 check (duracion_min >= 0),
  base_usd                numeric(14,2) not null default 0 check (base_usd >= 0),
  iva_pct                 numeric(5,2) not null default 16 check (iva_pct in (0,8,16)),
  iva_usd                 numeric(14,2) not null default 0 check (iva_usd >= 0),
  igtf_pct                numeric(5,2) not null default 0 check (igtf_pct in (0,3)),
  igtf_usd                numeric(14,2) not null default 0 check (igtf_usd >= 0),
  total_usd               numeric(14,2) not null default 0 check (total_usd >= 0),
  comision_pct            numeric(5,2) not null default 20 check (comision_pct between 0 and 100),
  comision_usd            numeric(14,2) not null default 0 check (comision_usd >= 0),
  pago_conductor_usd      numeric(14,2) not null default 0 check (pago_conductor_usd >= 0),
  metodo_pago             text not null default 'Pago Móvil'
                            check (metodo_pago in ('Pago Móvil','Efectivo USD','Zelle','Tarjeta','Wallet')),
  estatus                 text not null default 'Completado',
  factura_numero          text,
  control_numero          text,
  notas                   text,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

comment on table public.services_orders is 'Carreras y encomiendas. Montos operativos en USD.';

-- ============================================================================
--  7. CUENTAS POR PAGAR
-- ============================================================================
create table if not exists public.accounts_payable (
  id                        text primary key,
  numero_factura            text not null,
  numero_control            text,
  proveedor_rif             text not null references public.suppliers(rif)
                              on update cascade on delete restrict,
  fecha_emision             date not null default current_date,
  fecha_vencimiento         date not null default current_date,
  concepto                  text not null,
  tipo                      text not null default 'compra',
  tasa_bcv                  numeric(14,4) not null default 0 check (tasa_bcv > 0),
  pagado_usd                numeric(14,2) not null default 0 check (pagado_usd >= 0),
  estatus                   text not null default 'Pendiente'
                              check (estatus in ('Pendiente','Pagado Parcial','Pagado','Anulado')),
  comprobante_numero        text,
  pagos                     jsonb not null default '[]'::jsonb,
  fecha_ultimo_pago         date,
  metodo_pago               text,
  base_usd                  numeric(14,2) not null default 0,
  exento_usd                numeric(14,2) not null default 0,
  iva_pct                   numeric(5,2) not null default 16,
  iva_usd                   numeric(14,2) not null default 0,
  igtf_pct                  numeric(5,2) not null default 0,
  igtf_usd                  numeric(14,2) not null default 0,
  ret_iva_pct               numeric(5,2) not null default 75,
  ret_iva_usd               numeric(14,2) not null default 0,
  ret_islr_usd              numeric(14,2) not null default 0,
  ret_islr_tarifa           numeric(5,2) not null default 5,
  ret_islr_sustraendo_ut    numeric(10,2) not null default 0,
  ret_total_usd             numeric(14,2) not null default 0,
  total_usd                 numeric(14,2) not null default 0,
  neto_pagar_usd            numeric(14,2) not null default 0,
  base_ves                  numeric(16,2) not null default 0,
  iva_ves                   numeric(16,2) not null default 0,
  igtf_ves                  numeric(16,2) not null default 0,
  ret_iva_ves               numeric(16,2) not null default 0,
  ret_islr_ves              numeric(16,2) not null default 0,
  total_ves                 numeric(16,2) not null default 0,
  neto_pagar_ves            numeric(16,2) not null default 0,
  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now())
);

comment on table public.accounts_payable is 'Facturas de compra con IVA, IGTF, retenciones y pagos.';

-- ============================================================================
--  8. COMPROBANTES DE RETENCIÓN
-- ============================================================================
create table if not exists public.withholding_vouchers (
  id                        text primary key,
  numero_comprobante        text not null unique,
  periodo                   text not null,
  tipo                      text not null check (tipo in ('IVA','ISLR','IVA + ISLR')),
  proveedor_rif             text references public.suppliers(rif)
                              on update cascade on delete set null,
  proveedor_nombre          text not null,
  proveedor_direccion       text,
  factura_numero            text not null,
  factura_control           text,
  factura_id                text references public.accounts_payable(id)
                              on update cascade on delete cascade,
  fecha                     date not null default current_date,
  tasa_bcv                  numeric(14,4) not null default 0,
  base_ves                  numeric(16,2) not null default 0,
  iva_ves                   numeric(16,2) not null default 0,
  ret_iva_pct               numeric(5,2) not null default 0,
  ret_iva_ves               numeric(16,2) not null default 0,
  ret_islr_tarifa           numeric(5,2) not null default 0,
  ret_islr_sustraendo_ut    numeric(10,2) not null default 0,
  ret_islr_ves              numeric(16,2) not null default 0,
  total_retenido_ves        numeric(16,2) not null default 0,
  concepto                  text,
  estado                    text not null default 'Emitido'
                              check (estado in ('Emitido','Anulado')),
  created_at                timestamptz not null default timezone('utc', now()),
  updated_at                timestamptz not null default timezone('utc', now())
);

comment on table public.withholding_vouchers is 'Comprobantes de retención de IVA e ISLR (SENIAT).';

-- ============================================================================
--  9. REGLAS CONTABLES AUTOMÁTICAS
-- ============================================================================
create table if not exists public.accounting_rules (
  evento         text primary key,
  id             text unique,
  nombre         text not null,
  cuenta_debe    text not null references public.chart_of_accounts(codigo)
                   on update cascade on delete restrict,
  cuenta_haber   text not null references public.chart_of_accounts(codigo)
                   on update cascade on delete restrict,
  cuenta_iva     text,
  cuenta_igtf    text,
  activo         boolean not null default true,
  descripcion    text,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

comment on table public.accounting_rules is
  'Reglas de asiento automático. cuenta_iva/cuenta_igtf pueden ser NULL o vacías.';

-- ============================================================================
--  10. ASIENTOS CONTABLES
-- ============================================================================
create table if not exists public.accounting_entries (
  id            text primary key,
  numero        text not null unique,
  fecha         date not null default current_date,
  descripcion   text not null,
  referencia    text,
  origen        text not null default 'manual'
                  check (origen in ('manual','apertura','servicio','liquidacion','compra','pago','wallet','gasto')),
  tasa_bcv      numeric(14,4) not null default 0 check (tasa_bcv >= 0),
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounting_entry_lines (
  id          text primary key,
  entry_id    text not null references public.accounting_entries(id)
                on update cascade on delete cascade,
  cuenta      text not null references public.chart_of_accounts(codigo)
                on update cascade on delete restrict,
  debe        numeric(16,2) not null default 0 check (debe >= 0),
  haber       numeric(16,2) not null default 0 check (haber >= 0),
  orden       integer not null default 0,
  created_at  timestamptz not null default timezone('utc', now()),
  check (debe = 0 or haber = 0)
);

comment on table public.accounting_entries is 'Cabecera de asientos contables.';
comment on table public.accounting_entry_lines is 'Líneas DEBE/HABER. La suma debe cuadrar.';

-- ============================================================================
--  11. USUARIOS DEL SISTEMA (RBAC)
-- ============================================================================
create table if not exists public.erp_roles (
  id          text primary key,
  nombre      text not null unique,
  descripcion text,
  icono       text not null default 'shield',
  admin       boolean not null default false,
  sistema     boolean not null default false,
  permisos    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

comment on table public.erp_roles is
  'Roles dinámicos. permisos guarda módulos, pestañas y acciones autorizadas por rol.';

create table if not exists public.erp_users (
  id          text primary key,
  usuario     text not null unique,
  password    text not null,
  nombre      text not null,
  rol         text not null,
  permisos    jsonb,
  correo      text,
  activo      boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

comment on table public.erp_users is
  'Usuarios demo. En producción migrar a Supabase Auth y almacenar solo hash.';

-- Migraciones idempotentes para instalaciones existentes.
alter table public.drivers add column if not exists nivel text not null default 'Plata';
alter table public.drivers drop constraint if exists drivers_nivel_check;
alter table public.drivers add constraint drivers_nivel_check check (nivel in ('Plata','Oro','Platium'));
alter table public.erp_users add column if not exists permisos jsonb;
alter table public.erp_users drop constraint if exists erp_users_rol_check;

-- ============================================================================
--  12. PARÁMETROS FISCALES
-- ============================================================================
create table if not exists public.tax_parameters (
  id                 integer primary key default 1 check (id = 1),
  bcv_rate           numeric(14,4) not null default 78.45 check (bcv_rate > 0),
  iva_general        numeric(5,2) not null default 16,
  iva_reducido       numeric(5,2) not null default 8,
  igtf               numeric(5,2) not null default 3,
  unidad_tributaria  numeric(12,2) not null default 90,
  islr_tariffs       jsonb not null default '{
    "PN_RES":   {"label":"Persona Natural Residente",  "tarifa":3,  "sustraendoUT":10},
    "PJ_DOM":   {"label":"Persona Jurídica Domiciliada","tarifa":5,  "sustraendoUT":0},
    "PN_NORES": {"label":"Persona Natural No Residente","tarifa":34,"sustraendoUT":0},
    "PJ_NODOM": {"label":"Persona Jurídica No Domiciliada","tarifa":34,"sustraendoUT":0}
  }'::jsonb,
  updated_at         timestamptz not null default timezone('utc', now())
);

comment on table public.tax_parameters is 'Fila única (id=1) con tasa BCV, IVA, IGTF, UT y tarifas ISLR.';

-- ============================================================================
--  13. MOVIMIENTOS DE WALLET
-- ============================================================================
create table if not exists public.wallet_movements (
  id                  text primary key,
  cliente_cedula_rif  text not null references public.clients(cedula_rif)
                        on update cascade on delete restrict,
  monto               numeric(14,2) not null check (monto > 0),
  moneda              text not null default 'USD' check (moneda in ('USD','VES')),
  monto_usd           numeric(14,2) not null default 0 check (monto_usd >= 0),
  metodo              text,
  referencia          text,
  fecha               date not null default current_date,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

comment on table public.wallet_movements is 'Recargas y consumos de la billetera del cliente.';

-- ============================================================================
--  13.1 NEGOCIOS ASOCIADOS · COMERCIOS ALIADOS
-- ============================================================================
create table if not exists public.partners (
  rif                   text primary key check (rif ~ '^[VEJ]-[0-9]{7,9}$'),
  razon_social          text not null,
  tipo                  text not null default 'Comercio'
                          check (tipo in ('Restaurante','Farmacia','Comercio','Delivery','Servicio','Otro')),
  contacto              text,
  telefono              text,
  correo                text,
  direccion             text,
  comision_pct          numeric(5,2) not null default 10 check (comision_pct between 0 and 100),
  saldo_por_cobrar_usd  numeric(14,2) not null default 0 check (saldo_por_cobrar_usd >= 0),
  saldo_por_pagar_usd   numeric(14,2) not null default 0 check (saldo_por_pagar_usd >= 0),
  estatus               text not null default 'Activo' check (estatus in ('Activo','Inactivo')),
  notas                 text,
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);
comment on table public.partners is 'Comercios aliados que generan pedidos de delivery. Clave primaria: RIF.';

create table if not exists public.partner_movements (
  id            text primary key,
  partner_rif   text not null references public.partners(rif) on update cascade on delete restrict,
  tipo          text not null check (tipo in ('comision','cobro','recaudacion','pago','ajuste')),
  concepto      text not null,
  monto_usd     numeric(14,2) not null check (monto_usd > 0),
  fecha         date not null default current_date,
  referencia    text,
  created_at    timestamptz not null default timezone('utc', now())
);
comment on table public.partner_movements is 'Cartera de negocios asociados: comisiones por cobrar, cobros, recaudaciones y pagos.';

-- ============================================================================
--  13.2 TIENDA DEL CONDUCTOR · INVENTARIO Y FINANCIAMIENTOS
-- ============================================================================
create table if not exists public.products (
  sku           text primary key,
  id            text unique,
  nombre        text not null,
  categoria     text not null default 'Equipamiento'
                  check (categoria in ('Uniforme','Equipamiento','Seguridad','Accesorio')),
  precio_usd    numeric(14,2) not null check (precio_usd > 0),
  costo_usd     numeric(14,2) not null default 0 check (costo_usd >= 0),
  stock         integer not null default 0 check (stock >= 0),
  stock_min     integer not null default 0 check (stock_min >= 0),
  activo        boolean not null default true,
  descripcion   text,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);
comment on table public.products is 'Catálogo de uniformes, equipamiento y seguridad que ENVIA financia a los conductores.';

create table if not exists public.driver_charges (
  id                    text primary key,
  conductor_cedula_rif  text not null references public.drivers(cedula_rif) on update cascade on delete restrict,
  producto_sku          text not null references public.products(sku) on update cascade on delete restrict,
  producto_nombre       text not null,
  cantidad              integer not null default 1 check (cantidad > 0),
  precio_unit_usd       numeric(14,2) not null check (precio_unit_usd > 0),
  total_usd             numeric(14,2) not null check (total_usd >= 0),
  cuotas                integer not null default 1 check (cuotas between 1 and 52),
  cuota_usd             numeric(14,2) not null default 0 check (cuota_usd >= 0),
  pagado_usd            numeric(14,2) not null default 0 check (pagado_usd >= 0),
  saldo_usd             numeric(14,2) not null default 0 check (saldo_usd >= 0),
  fecha                 date not null default current_date,
  estatus               text not null default 'Vigente' check (estatus in ('Vigente','Pagado','Anulado')),
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);
comment on table public.driver_charges is 'Cuentas por cobrar a conductores por compras financiadas de la tienda.';

create table if not exists public.driver_movements (
  id                    text primary key,
  conductor_cedula_rif  text not null references public.drivers(cedula_rif) on update cascade on delete restrict,
  tipo                  text not null check (tipo in ('ganancia','comision','producto','pago','pago_producto')),
  concepto              text not null,
  monto_usd             numeric(14,2) not null,
  fecha                 date not null default current_date,
  referencia            text,
  created_at            timestamptz not null default timezone('utc', now())
);
comment on table public.driver_movements is 'Historial de wallet del conductor: ganancias, comisiones, compras y liquidaciones.';

-- ============================================================================
--  13.3 PARÁMETROS DE MANTENIMIENTO DEL SISTEMA
-- ============================================================================
create table if not exists public.system_params (
  key          text primary key check (key ~ '^[a-z0-9_]{3,40}$'),
  label        text not null,
  value        text not null default '',
  tipo         text not null default 'texto' check (tipo in ('monto','porcentaje','texto','booleano','fecha')),
  module       text not null default 'sistema',
  nivel        text check (nivel in ('Zafiro','Esmeralda','Diamante')),
  tipo_plan    text check (tipo_plan in ('fijo','porcentaje')),
  descripcion  text,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);
comment on table public.system_params is 'Parámetros configurables por el administrador (tarifas, comisiones por nivel, descuentos, beneficios). Clave primaria: key.';
comment on column public.system_params.value is 'Valor guardado como texto; se interpreta según tipo (monto/porcentaje/etc).';
comment on column public.system_params.nivel is 'Nivel de conductor al que aplica el parámetro (opcional).';
comment on column public.system_params.tipo_plan is 'Esquema de tarifa asociado: fijo o porcentual (opcional).';

-- Migración idempotente para instalaciones existentes.
alter table public.system_params add column if not exists nivel text;
alter table public.system_params add column if not exists tipo_plan text;

-- ============================================================================
--  13.4 PLANES DE CONDUCTORES POR NIVEL
-- ============================================================================
create table if not exists public.driver_plans (
  key          text primary key check (key ~ '^[a-z0-9_]{3,40}$'),
  nivel        text not null check (nivel in ('Zafiro','Esmeralda','Diamante')),
  tipo_plan    text not null check (tipo_plan in ('fijo','porcentaje')),
  valor        numeric(14,2) not null default 0 check (valor >= 0),
  descripcion  text,
  modulo       text not null default 'drivers',
  activo       boolean not null default true,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);
comment on table public.driver_plans is 'Planes de descuento semanal por nivel de conductor (fijo o porcentaje). Clave primaria: key.';
comment on column public.driver_plans.valor is 'Si tipo_plan=fijo: monto en USD. Si tipo_plan=porcentaje: porcentaje (0-100).';

-- ============================================================================
--  13.5 EVENTOS DE CONDUCTORES (PREMIOS / BENEFICIOS)
-- ============================================================================
create table if not exists public.driver_events (
  key           text primary key check (key ~ '^[a-z0-9_]{3,40}$'),
  nombre        text not null,
  tipo_evento   text not null default 'premio' check (tipo_evento in ('premio','descuento')),
  aplicacion    text not null check (aplicacion in ('todos','nivel')),
  nivel_aplicar text check (nivel_aplicar in ('Zafiro','Esmeralda','Diamante')),
  valor         numeric(14,2) not null default 0 check (valor >= 0),
  tipo_valor    text not null check (tipo_valor in ('monto','porcentaje')),
  descripcion   text,
  fecha_inicio  date,
  fecha_fin     date,
  activo        boolean not null default true,
  modulo        text not null default 'drivers',
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);
comment on table public.driver_events is 'Eventos de premio o descuento aplicables a conductores (todos o por nivel). Clave primaria: key.';

-- ============================================================================
--  13.6 REPORTES PERSONALIZADOS (CONSTRUCTOR DEL ADMINISTRADOR)
-- ============================================================================
create table if not exists public.custom_reports (
  id            text primary key,
  modulo        text not null,
  nombre        text not null,
  descripcion   text,
  tabla         text not null,
  columnas      jsonb not null default '[]'::jsonb,
  filtro_campo  text,
  filtro_op     text check (filtro_op in ('contiene','igual','mayor','menor')),
  filtro_valor  text,
  orden_campo   text,
  orden_dir     text check (orden_dir in ('asc','desc')),
  creado_por    text,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);
comment on table public.custom_reports is 'Definiciones de reportes/listados a la medida creados por el administrador sobre las tablas existentes. No almacena datos, solo la definición.';
comment on column public.custom_reports.columnas is 'Arreglo JSON con las claves de columna seleccionadas.';
comment on column public.custom_reports.modulo is 'Módulo del centro de reportes donde se muestra el listado.';
comment on column public.custom_reports.creado_por is 'Usuario que creó la definición; el administrador puede gestionar todas.';

-- Migraciones idempotentes por si la tabla ya existía sin estas columnas.
alter table public.custom_reports add column if not exists filtro_campo text;
alter table public.custom_reports add column if not exists filtro_op text;
alter table public.custom_reports add column if not exists filtro_valor text;
alter table public.custom_reports add column if not exists orden_campo text;
alter table public.custom_reports add column if not exists orden_dir text;
alter table public.custom_reports add column if not exists creado_por text;

-- ============================================================================
--  14. ÍNDICES
-- ============================================================================
create index if not exists idx_clients_estatus          on public.clients(estatus);
create index if not exists idx_clients_correo           on public.clients(correo);
create index if not exists idx_drivers_estatus          on public.drivers(estatus_conductor);
create index if not exists idx_drivers_placa            on public.drivers(placa);
create index if not exists idx_services_cliente         on public.services_orders(cliente_cedula_rif);
create index if not exists idx_services_conductor       on public.services_orders(conductor_cedula_rif);
create index if not exists idx_services_fecha           on public.services_orders(fecha);
create index if not exists idx_services_tipo            on public.services_orders(tipo);
create index if not exists idx_payables_proveedor       on public.accounts_payable(proveedor_rif);
create index if not exists idx_payables_estatus         on public.accounts_payable(estatus);
create index if not exists idx_payables_vencimiento     on public.accounts_payable(fecha_vencimiento);
create index if not exists idx_payables_factura         on public.accounts_payable(numero_factura);
create index if not exists idx_withholdings_proveedor   on public.withholding_vouchers(proveedor_rif);
create index if not exists idx_withholdings_periodo     on public.withholding_vouchers(periodo);
create index if not exists idx_withholdings_factura     on public.withholding_vouchers(factura_id);
create index if not exists idx_entries_fecha            on public.accounting_entries(fecha);
create index if not exists idx_entries_origen           on public.accounting_entries(origen);
create index if not exists idx_entries_referencia       on public.accounting_entries(referencia);
create index if not exists idx_lines_entry              on public.accounting_entry_lines(entry_id);
create index if not exists idx_lines_cuenta             on public.accounting_entry_lines(cuenta);
create index if not exists idx_wallet_cliente           on public.wallet_movements(cliente_cedula_rif);
create index if not exists idx_wallet_fecha             on public.wallet_movements(fecha);
create index if not exists idx_partners_estatus         on public.partners(estatus);
create index if not exists idx_partner_movements_rif     on public.partner_movements(partner_rif);
create index if not exists idx_partner_movements_fecha   on public.partner_movements(fecha);
create index if not exists idx_products_activo          on public.products(activo);
create index if not exists idx_products_stock           on public.products(stock, stock_min);
create index if not exists idx_driver_charges_driver    on public.driver_charges(conductor_cedula_rif);
create index if not exists idx_driver_charges_estatus   on public.driver_charges(estatus);
create index if not exists idx_driver_movements_driver  on public.driver_movements(conductor_cedula_rif);
create index if not exists idx_driver_movements_fecha   on public.driver_movements(fecha);
create index if not exists idx_system_params_module     on public.system_params(module);
create index if not exists idx_driver_plans_nivel         on public.driver_plans(nivel);
create index if not exists idx_driver_events_nivel        on public.driver_events(nivel_aplicar);
create index if not exists idx_driver_events_activo       on public.driver_events(activo);
create index if not exists idx_custom_reports_modulo      on public.custom_reports(modulo);

-- ============================================================================
--  15. TRIGGERS updated_at
-- ============================================================================
drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_drivers_updated_at on public.drivers;
create trigger trg_drivers_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_partners_updated_at on public.partners;
create trigger trg_partners_updated_at
  before update on public.partners
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_driver_charges_updated_at on public.driver_charges;
create trigger trg_driver_charges_updated_at
  before update on public.driver_charges
  for each row execute function public.set_updated_at();

drop trigger if exists trg_accounts_updated_at on public.chart_of_accounts;
create trigger trg_accounts_updated_at
  before update on public.chart_of_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services_orders;
create trigger trg_services_updated_at
  before update on public.services_orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payables_updated_at on public.accounts_payable;
create trigger trg_payables_updated_at
  before update on public.accounts_payable
  for each row execute function public.set_updated_at();

drop trigger if exists trg_withholdings_updated_at on public.withholding_vouchers;
create trigger trg_withholdings_updated_at
  before update on public.withholding_vouchers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_rules_updated_at on public.accounting_rules;
create trigger trg_rules_updated_at
  before update on public.accounting_rules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_entries_updated_at on public.accounting_entries;
create trigger trg_entries_updated_at
  before update on public.accounting_entries
  for each row execute function public.set_updated_at();

drop trigger if exists trg_roles_updated_at on public.erp_roles;
create trigger trg_roles_updated_at
  before update on public.erp_roles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_users_updated_at on public.erp_users;
create trigger trg_users_updated_at
  before update on public.erp_users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tax_updated_at on public.tax_parameters;
create trigger trg_tax_updated_at
  before update on public.tax_parameters
  for each row execute function public.set_updated_at();

drop trigger if exists trg_wallet_updated_at on public.wallet_movements;
create trigger trg_wallet_updated_at
  before update on public.wallet_movements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_custom_reports_updated_at on public.custom_reports;
create trigger trg_custom_reports_updated_at
  before update on public.custom_reports
  for each row execute function public.set_updated_at();

-- ============================================================================
--  16. VALIDACIÓN DE PARTIDA DOBLE (por asiento)
-- ============================================================================
create or replace function public.assert_entry_balanced()
returns trigger
language plpgsql
as $$
declare
  v_entry_id text;
  v_debe     numeric(16,2);
  v_haber    numeric(16,2);
  v_count    integer;
begin
  if tg_op = 'DELETE' then
    v_entry_id := old.entry_id;
  else
    v_entry_id := new.entry_id;
  end if;

  select coalesce(sum(debe),0), coalesce(sum(haber),0), count(*)
    into v_debe, v_haber, v_count
    from public.accounting_entry_lines
   where entry_id = v_entry_id;

  -- Durante un INSERT por lotes el asiento puede estar incompleto; solo se
  -- valida al cerrar la transacción mediante el trigger diferido.
  if v_count > 0 and abs(v_debe - v_haber) > 0.01 then
    raise exception 'Partida doble: el asiento % no cuadra (DEBE %, HABER %)',
      v_entry_id, v_debe, v_haber;
  end if;

  return null;
end;
$$;

-- Trigger diferido: se ejecuta al final de la transacción, cuando todas las
-- líneas del asiento ya fueron insertadas.
drop trigger if exists trg_lines_balanced on public.accounting_entry_lines;
create constraint trigger trg_lines_balanced
  after insert or update or delete on public.accounting_entry_lines
  deferrable initially deferred
  for each row execute function public.assert_entry_balanced();

-- ============================================================================
--  17. ROW LEVEL SECURITY
-- ============================================================================
alter table public.clients                 enable row level security;
alter table public.drivers                 enable row level security;
alter table public.suppliers               enable row level security;
alter table public.chart_of_accounts       enable row level security;
alter table public.services_orders         enable row level security;
alter table public.accounts_payable        enable row level security;
alter table public.withholding_vouchers    enable row level security;
alter table public.accounting_rules        enable row level security;
alter table public.accounting_entries      enable row level security;
alter table public.accounting_entry_lines  enable row level security;
alter table public.erp_roles               enable row level security;
alter table public.erp_users               enable row level security;
alter table public.tax_parameters          enable row level security;
alter table public.wallet_movements        enable row level security;
alter table public.partners                enable row level security;
alter table public.partner_movements       enable row level security;
alter table public.products                enable row level security;
alter table public.driver_charges          enable row level security;
alter table public.driver_movements        enable row level security;
alter table public.system_params           enable row level security;
alter table public.driver_plans            enable row level security;
alter table public.driver_events           enable row level security;
alter table public.custom_reports          enable row level security;

-- Políticas demo: anon + authenticated con acceso completo.
-- PRODUCCIÓN: reemplazar por políticas basadas en auth.uid(), rol y propietario.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients','drivers','suppliers','chart_of_accounts','services_orders',
    'accounts_payable','withholding_vouchers','accounting_rules',
    'accounting_entries','accounting_entry_lines','erp_roles','erp_users',
    'tax_parameters','wallet_movements','partners','partner_movements',
    'products','driver_charges','driver_movements','system_params','driver_plans','driver_events',
    'custom_reports'
  ]
  loop
    execute format('drop policy if exists envia_demo_all on public.%I', t);
    execute format(
      'create policy envia_demo_all on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end;
$$;

-- ============================================================================
--  18. STORAGE · BUCKETS
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documentos-clientes',    'documentos-clientes',    true, 10485760,
    array['application/pdf','image/jpeg','image/png','image/webp']),
  ('documentos-conductores', 'documentos-conductores', true, 10485760,
    array['application/pdf','image/jpeg','image/png','image/webp']),
  ('fotos-vehiculos',        'fotos-vehiculos',        true, 10485760,
    array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
--  19. STORAGE · POLÍTICAS RLS
--  Ruta: /{bucket}/{cedula_rif}/{tipoDocumento}_{timestamp}.{ext}
-- ============================================================================
drop policy if exists envia_storage_read   on storage.objects;
drop policy if exists envia_storage_insert on storage.objects;
drop policy if exists envia_storage_update on storage.objects;
drop policy if exists envia_storage_delete on storage.objects;

create policy envia_storage_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('documentos-clientes','documentos-conductores','fotos-vehiculos'));

create policy envia_storage_insert
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id in ('documentos-clientes','documentos-conductores','fotos-vehiculos')
    and (storage.foldername(name))[1] ~ '^[VEJ]-[0-9]{7,9}$'
  );

create policy envia_storage_update
  on storage.objects for update
  to anon, authenticated
  using (
    bucket_id in ('documentos-clientes','documentos-conductores','fotos-vehiculos')
    and (storage.foldername(name))[1] ~ '^[VEJ]-[0-9]{7,9}$'
  )
  with check (
    bucket_id in ('documentos-clientes','documentos-conductores','fotos-vehiculos')
    and (storage.foldername(name))[1] ~ '^[VEJ]-[0-9]{7,9}$'
  );

create policy envia_storage_delete
  on storage.objects for delete
  to anon, authenticated
  using (
    bucket_id in ('documentos-clientes','documentos-conductores','fotos-vehiculos')
    and (storage.foldername(name))[1] ~ '^[VEJ]-[0-9]{7,9}$'
  );

-- ============================================================================
--  20. DATOS INICIALES MÍNIMOS
--  El frontend sincroniza el resto (clientes, conductores, servicios, etc.).
-- ============================================================================

insert into public.tax_parameters (id) values (1)
on conflict (id) do nothing;

-- Roles base. Los permisos se administran desde Usuarios del sistema.
insert into public.erp_roles (id, nombre, descripcion, icono, admin, sistema, permisos)
values
  ('role_superadmin', 'SuperAdmin', 'Acceso ilimitado a todos los módulos, configuración, usuarios y sincronización.', 'shield', true, true,
    '{"*":{"ver":true,"tabs":["*"],"acciones":["*"]}}'::jsonb),
  ('role_contador', 'Contador / Fiscal', 'Contabilidad, tributos, libros SENIAT, cuentas por pagar y maestros.', 'book', false, true,
    '{"dashboard":{"ver":true,"tabs":[],"acciones":["ver","reportes"]},"services":{"ver":true,"tabs":[],"acciones":["ver","crear","editar","eliminar","exportar","imprimir","reportes"]},"clients":{"ver":true,"tabs":[],"acciones":["ver","crear","editar","eliminar","billetera","documentos","exportar","imprimir","reportes"]},"drivers":{"ver":true,"tabs":[],"acciones":["ver","crear","editar","eliminar","documentos","liquidar","exportar","imprimir","reportes"]},"accounting":{"ver":true,"tabs":["entries","accounts","rules","journal","ledger","trial","balance","income","sales","purchases"],"acciones":["ver","crear","editar","eliminar","exportar","imprimir","reportes"]},"taxes":{"ver":true,"tabs":[],"acciones":["ver","editar","exportar","imprimir","reportes"]},"payables":{"ver":true,"tabs":["invoices","suppliers","settlements"],"acciones":["ver","crear","editar","eliminar","pagar","exportar","imprimir","reportes"]}}'::jsonb),
  ('role_tesorero', 'Tesorero / Cuentas por Pagar', 'Pagos, proveedores, liquidaciones, maestros y consulta tributaria.', 'wallet', false, true,
    '{"dashboard":{"ver":true,"tabs":[],"acciones":["ver","reportes"]},"services":{"ver":true,"tabs":[],"acciones":["ver","crear","editar","eliminar","exportar","imprimir","reportes"]},"clients":{"ver":true,"tabs":[],"acciones":["ver","crear","editar","eliminar","billetera","documentos","exportar","imprimir","reportes"]},"drivers":{"ver":true,"tabs":[],"acciones":["ver","crear","editar","eliminar","documentos","liquidar","exportar","imprimir","reportes"]},"payables":{"ver":true,"tabs":["invoices","suppliers","settlements"],"acciones":["ver","crear","editar","eliminar","pagar","exportar","imprimir","reportes"]},"taxes":{"ver":true,"tabs":[],"acciones":["ver","editar","exportar","imprimir","reportes"]}}'::jsonb),
  ('role_auditor', 'Auditor / Operaciones', 'Consulta de todos los módulos financieros y operativos en modo solo lectura.', 'eye', false, true,
    '{"dashboard":{"ver":true,"tabs":[],"acciones":["ver","reportes"]},"services":{"ver":true,"tabs":[],"acciones":["ver","exportar","imprimir","reportes"]},"clients":{"ver":true,"tabs":[],"acciones":["ver","exportar","imprimir","reportes"]},"drivers":{"ver":true,"tabs":[],"acciones":["ver","exportar","imprimir","reportes"]},"accounting":{"ver":true,"tabs":["entries","accounts","rules","journal","ledger","trial","balance","income","sales","purchases"],"acciones":["ver","exportar","imprimir","reportes"]},"taxes":{"ver":true,"tabs":[],"acciones":["ver","exportar","imprimir","reportes"]},"payables":{"ver":true,"tabs":["invoices","suppliers","settlements"],"acciones":["ver","exportar","imprimir","reportes"]}}'::jsonb)
on conflict (nombre) do nothing;

insert into public.erp_users (id, usuario, password, nombre, rol, correo, activo)
values
  ('usr_envia',    'ENVIA',     '123456789',    'Administrador ENVIA', 'SuperAdmin',                     'admin@envia.com.ve',        true),
  ('usr_contador', 'contador',  'Contador2026', 'Ana Belén Rojas',     'Contador / Fiscal',              'contabilidad@envia.com.ve', true),
  ('usr_tesoreria','tesoreria', 'Tesoreria2026','Jorge Luis Medina',   'Tesorero / Cuentas por Pagar',   'tesoreria@envia.com.ve',    true),
  ('usr_auditor',  'auditor',   'Auditor2026',  'Patricia Salazar',    'Auditor / Operaciones',          'auditoria@envia.com.ve',    true)
on conflict (usuario) do nothing;

-- Plan de cuentas base (mínimo indispensable para reglas y asientos).
insert into public.chart_of_accounts (codigo, id, nombre, nivel, naturaleza, moneda, estado)
values
  ('1',        'cta_1',        'ACTIVOS',                              'Grupo',                'Deudora',   'VES', 'Activa'),
  ('1.1',      'cta_1_1',      'Activo Corriente',                     'Subgrupo',             'Deudora',   'VES', 'Activa'),
  ('1.1.1',    'cta_1_1_1',    'Disponible',                           'Rubro',                'Deudora',   'VES', 'Activa'),
  ('1.1.1.01', 'cta_1_1_1_01', 'Caja General VES',                     'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('1.1.1.02', 'cta_1_1_1_02', 'Banco Mercantil · Cta. Corriente VES', 'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('1.1.1.03', 'cta_1_1_1_03', 'Banco Banesco · Cta. Corriente USD',   'Cuenta de Movimiento', 'Deudora',   'USD', 'Activa'),
  ('1.1.2',    'cta_1_1_2',    'Cuentas por Cobrar',                   'Rubro',                'Deudora',   'VES', 'Activa'),
  ('1.1.4',    'cta_1_1_4',    'Impuestos a Favor',                    'Rubro',                'Deudora',   'VES', 'Activa'),
  ('1.1.4.01', 'cta_1_1_4_01', 'IVA Crédito Fiscal',                   'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('1.1.5',    'cta_1_1_5',    'Tributos Pagados',                     'Rubro',                'Deudora',   'VES', 'Activa'),
  ('1.1.5.01', 'cta_1_1_5_01', 'IGTF Pagado',                          'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('2',        'cta_2',        'PASIVOS',                              'Grupo',                'Acreedora', 'VES', 'Activa'),
  ('2.1',      'cta_2_1',      'Pasivo Corriente',                     'Subgrupo',             'Acreedora', 'VES', 'Activa'),
  ('2.1.1',    'cta_2_1_1',    'Cuentas por Pagar',                    'Rubro',                'Acreedora', 'VES', 'Activa'),
  ('2.1.1.01', 'cta_2_1_1_01', 'Cuentas por Pagar Proveedores',        'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('2.1.1.02', 'cta_2_1_1_02', 'Cuentas por Pagar Conductores',        'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('2.1.2',    'cta_2_1_2',    'Impuestos por Pagar',                  'Rubro',                'Acreedora', 'VES', 'Activa'),
  ('2.1.2.01', 'cta_2_1_2_01', 'IVA por Pagar',                        'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('2.1.2.02', 'cta_2_1_2_02', 'IGTF por Pagar',                       'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('2.1.2.03', 'cta_2_1_2_03', 'ISLR por Pagar (Retenciones)',         'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('2.1.2.04', 'cta_2_1_2_04', 'Retenciones de IVA por Pagar',         'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('2.1.3',    'cta_2_1_3',    'Wallet Clientes',                      'Rubro',                'Acreedora', 'VES', 'Activa'),
  ('2.1.3.01', 'cta_2_1_3_01', 'Saldo Wallet Clientes USD',            'Cuenta de Movimiento', 'Acreedora', 'USD', 'Activa'),
  ('2.1.3.02', 'cta_2_1_3_02', 'Saldo Wallet Clientes VES',            'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('3',        'cta_3',        'PATRIMONIO',                           'Grupo',                'Acreedora', 'VES', 'Activa'),
  ('3.1',      'cta_3_1',      'Capital y Resultados',                 'Subgrupo',             'Acreedora', 'VES', 'Activa'),
  ('3.1.1.01', 'cta_3_1_1_01', 'Capital Social Suscrito y Pagado',     'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('4',        'cta_4',        'INGRESOS',                             'Grupo',                'Acreedora', 'VES', 'Activa'),
  ('4.1',      'cta_4_1',      'Ingresos Operativos',                  'Subgrupo',             'Acreedora', 'VES', 'Activa'),
  ('4.1.1',    'cta_4_1_1',    'Ingresos por Traslados',               'Rubro',                'Acreedora', 'VES', 'Activa'),
  ('4.1.1.01', 'cta_4_1_1_01', 'Ingresos por Carreras (Taxi)',         'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('4.1.2',    'cta_4_1_2',    'Ingresos por Encomiendas',             'Rubro',                'Acreedora', 'VES', 'Activa'),
  ('4.1.2.01', 'cta_4_1_2_01', 'Ingresos por Delivery / Encomiendas',  'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('4.1.3.01', 'cta_4_1_3_01', 'Comisión Neta ENVIA',                  'Cuenta de Movimiento', 'Acreedora', 'VES', 'Activa'),
  ('5',        'cta_5',        'COSTOS',                               'Grupo',                'Deudora',   'VES', 'Activa'),
  ('5.1',      'cta_5_1',      'Costos de Flota',                      'Subgrupo',             'Deudora',   'VES', 'Activa'),
  ('5.1.1',    'cta_5_1_1',    'Costos de Conductores',                'Rubro',                'Deudora',   'VES', 'Activa'),
  ('5.1.1.01', 'cta_5_1_1_01', 'Costo Liquidación Conductores',        'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('5.2.1.01', 'cta_5_2_1_01', 'Comisiones Pasarela / Procesamiento',   'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('6',        'cta_6',        'GASTOS',                               'Grupo',                'Deudora',   'VES', 'Activa'),
  ('6.1',      'cta_6_1',      'Gastos Operativos',                    'Subgrupo',             'Deudora',   'VES', 'Activa'),
  ('6.1.1.01', 'cta_6_1_1_01', 'Sueldos y Salarios',                   'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('6.1.2.01', 'cta_6_1_2_01', 'Alquiler de Oficina',                  'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('6.1.2.02', 'cta_6_1_2_02', 'Servicios Públicos',                   'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('6.1.2.03', 'cta_6_1_2_03', 'Publicidad y Marketing',               'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa'),
  ('6.1.1.03', 'cta_6_1_1_03', 'Compras y Suministros',               'Cuenta de Movimiento', 'Deudora',   'VES', 'Activa')
on conflict (codigo) do nothing;

-- Reglas contables base.
insert into public.accounting_rules
  (evento, id, nombre, cuenta_debe, cuenta_haber, cuenta_iva, cuenta_igtf, activo, descripcion)
values
  ('traslado',             'rule_traslado',             'Carrera de taxi / traslado',        '1.1.1.02', '4.1.1.01', '2.1.2.01', '2.1.2.02', true, 'Ingreso por servicio de traslado cobrado al cliente'),
  ('encomienda',           'rule_encomienda',           'Envío de encomienda / delivery',    '1.1.1.02', '4.1.2.01', '2.1.2.01', '2.1.2.02', true, 'Ingreso por encomienda cobrada al cliente'),
  ('recarga_wallet',       'rule_recarga_wallet',       'Recarga de Wallet (USD)',           '1.1.1.03', '2.1.3.01', null,       null,       true, 'Abono a billetera virtual en dólares'),
  ('recarga_wallet_ves',   'rule_recarga_wallet_ves',   'Recarga de Wallet (VES)',           '1.1.1.02', '2.1.3.02', null,       null,       true, 'Abono a billetera virtual en bolívares'),
  ('liquidacion_conductor','rule_liquidacion_conductor','Liquidación a conductor',           '5.1.1.01', '2.1.1.02', null,       null,       true, 'Costo de flota y cuenta por pagar al conductor'),
  ('compra_proveedor',     'rule_compra_proveedor',     'Factura de compra a proveedor',     '6.1.1.03', '2.1.1.01', '1.1.4.01', '1.1.5.01', true, 'Gasto / costo con IVA crédito fiscal e IGTF'),
  ('pago_proveedor',       'rule_pago_proveedor',       'Pago a proveedor o conductor',      '2.1.1.01', '1.1.1.02', null,       null,       true, 'Cancelación de cuentas por pagar')
on conflict (evento) do nothing;

-- ============================================================================
--  21. VISTAS DE APOYO (opcionales, respetan RLS del invocador en PG15+)
-- ============================================================================
create or replace view public.v_trial_balance
with (security_invoker = true) as
select
  l.cuenta,
  a.nombre,
  a.naturaleza,
  round(sum(l.debe), 2)  as total_debe,
  round(sum(l.haber), 2) as total_haber,
  round(sum(l.debe) - sum(l.haber), 2) as saldo_deudor,
  round(sum(l.haber) - sum(l.debe), 2) as saldo_acreedor
from public.accounting_entry_lines l
join public.chart_of_accounts a on a.codigo = l.cuenta
group by l.cuenta, a.nombre, a.naturaleza
order by l.cuenta;

comment on view public.v_trial_balance is 'Balance de comprobación por cuenta.';

create or replace view public.v_payables_aging
with (security_invoker = true) as
select
  p.id,
  p.proveedor_rif,
  s.razon_social,
  p.numero_factura,
  p.fecha_emision,
  p.fecha_vencimiento,
  p.total_usd,
  p.neto_pagar_usd,
  p.pagado_usd,
  round(p.neto_pagar_usd - p.pagado_usd, 2) as pendiente_usd,
  p.estatus,
  greatest(0, (current_date - p.fecha_vencimiento)) as dias_vencida
from public.accounts_payable p
left join public.suppliers s on s.rif = p.proveedor_rif
where p.estatus <> 'Anulado';

comment on view public.v_payables_aging is 'Antigüedad de saldos por pagar.';

-- ============================================================================
--  FIN DEL ESQUEMA
-- ============================================================================
