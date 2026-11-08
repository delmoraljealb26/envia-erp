# Skill: Avant-Garde UI · ENVIA Spatial OS

Directivas permanentes de diseño para ENVIA ERP. Se aplican a cualquier cambio
visual futuro. La lógica de negocio, los identificadores del DOM y los cálculos
SENIAT son inmutables.

## 1. Identidad

- **Concepto:** *ENVIA Spatial OS* — una plataforma de movilidad y finanzas
  operando en capas espaciales, no un panel administrativo plano.
- **Paleta oficial** (extraída de `/imagen`):
  - Navy profundo `#0F1E36`
  - Azul eléctrico `#005FFF`
  - Azul celeste `#46B6F9`
  - Naranja ENVIA `#F05A24`
  - Ámbar brillante `#FF9900`
  - Amarillo `#FFD200`
  - Blanco `#FFFFFF`
  - Gris perla `#E5E9F0`
- **Tipografía:** Sora para títulos y cifras; Inter para interfaz y cuerpo.
  Escala con tracking negativo en display y positivo en micro-etiquetas.
- **Temas:** `Dark Fintech` (por defecto) y `Light Spatial`. La preferencia se
  guarda en `localStorage` y se aplica antes del primer render.

## 2. Arquitectura visual

- **Dock flotante:** el menú lateral es una cápsula de cristal navy con radio
  de 28 px, separada del borde, indicador luminoso de sección activa y
  contadores. Nunca una barra pegada al borde.
- **Bento Grid asimétrico:** las métricas ocupan celdas de distinto tamaño y
  jerarquía. La cifra principal domina; las secundarias acompañan. Nada de
  cuadrículas idénticas de tarjetas.
- **Spatial Glassmorphism:** paneles translúcidos con
  `backdrop-filter: blur(16px)`, borde luminoso de 1 px y sombras multicapa.
  El vidrio debe tener profundidad, no ser un simple fondo blanco.
- **Capas:** fondo ambiental con auroras y rejilla sutil; superficies de vidrio;
  contenido nítido al frente.

## 3. Movimiento

- Curva maestra: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Elevación suave al hover: `translateY(-2px)` + sombra más profunda.
- Feedback inmediato en botones, filas, tarjetas y campos.
- Un solo momento orquestado de entrada por vista. Evitar animaciones
  dispersas en cada elemento.
- Respetar `prefers-reduced-motion: reduce`.

## 4. Componentes

### Navegación
- Dock flotante con logo de `/imagen`, estado de conexión con pulso y cierre de
  sesión integrado.
- Barra superior tipo *command bar*: búsqueda global, cápsula BCV con indicador
  `LIVE`, conmutador USD/VES, tema y usuario.

### Command Palette
- Atajo `Ctrl/Cmd + K`.
- Búsqueda instantánea de módulos, cédulas/RIF, números de factura y servicios.
- Navegación con flechas, `Enter` para abrir y `Esc` para cerrar.

### Datos
- Prohibido mostrar tablas HTML planas.
- Las filas son *smart cards* flotantes con separación, radio, hover y acciones
  que se revelan o elevan.
- Chips de filtro animados, insignias con brillo suave y avatares.
- Los estados usan color + forma + texto, nunca solo color.

### Documentos
- Tarjetas de expediente con vista previa tipo galería de cristal.
- Zona de carga con drag & drop, borde punteado luminoso y etiquetas de
  verificación (`Pendiente`, `Aprobado`, `Rechazado`).
- Lightbox modal con fondo desenfocado.

### Login
- Tarjeta de cristal única y centrada, sin panel lateral; la marca vive dentro
  de la propia tarjeta.
- Fondo cinematográfico animado con la paleta ENVIA.
- Inputs con foco luminoso y transición de entrada al ERP.
- En móvil, ancho completo, padding reducido y desplazamiento vertical cuando
  el formulario supera el alto de la pantalla.

## 5. Reglas inquebrantables

1. No renombrar ni eliminar `id`, `data-*`, `name` o eventos usados por
   `app.js`, `routerService.js`, `supabaseService.js`,
   `exchangeRateService.js` ni por los módulos.
2. No tocar cálculos, validaciones, claves primarias, RBAC ni persistencia.
3. La app debe seguir abriendo con `file://`, sin build y sin Supabase.
4. Mantener los logos y la paleta de `/imagen`.
5. Todo texto de usuario se escapa con `ui.esc`.
6. Impresión: superficies blancas, sin vidrio, sin dock flotante.
7. Accesibilidad: foco visible, contraste AA, navegación por teclado.

## 6. Anti-patrones

- Tarjetas idénticas en cuadrícula uniforme.
- Sombras genéricas `rgba(0,0,0,.1)` en todo.
- Degradados decorativos sin función.
- Tablas con bordes duros y filas pegadas.
- Exceso de etiquetas en mayúsculas.
- Animaciones en cada elemento de la página.
