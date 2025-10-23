# Frontend de Brackets - Copa Samurai 2025

## ✅ Componentes Implementados

### 1. `BracketsManager.jsx` - Gestión de Brackets (Admin)

**Ubicación:** `src/components/brackets/BracketsManager.jsx`

**Características:**
- ✅ Vista con pestañas por tipo de competencia
- ✅ Botón "Generar Brackets" con modal de resultados
- ✅ Listado de brackets con cards visuales
- ✅ Badges de estado con colores:
  - 🟡 Sin iniciar (generado)
  - 🔵 En curso
  - 🟢 Finalizado
- ✅ Indicadores de progreso con barras y porcentajes
- ✅ Acciones rápidas en cada bracket:
  - 👁️ Ver bracket completo
  - 🖨️ Descargar PDF
  - 🔗 Compartir (copia link público)
  - 🔄 Resetear bracket
  - 🗑️ Eliminar bracket
- ✅ Modal de visualización de bracket
- ✅ Toggle horizontal/vertical (preparado para futura implementación)
- ✅ Modal de registro de resultados
- ✅ Actualización automática al registrar resultados

**Props:**
```jsx
<BracketsManager user={user} />
```

**User object debe contener:**
```javascript
{
  token: 'jwt_token_here',
  rol: 'admin'
}
```

---

### 2. `BracketsView.jsx` - Vista de Brackets (Senseis)

**Ubicación:** `src/components/brackets/BracketsView.jsx`

**Características:**
- ✅ Vista de solo lectura
- ✅ Lista de brackets donde participan sus atletas
- ✅ Cards con progreso visual
- ✅ Acciones limitadas:
  - 👁️ Ver bracket
  - 🖨️ Descargar PDF
- ✅ Modal de visualización sin opciones de edición
- ✅ Indicador claro de "Vista de solo lectura"

**Props:**
```jsx
<BracketsView user={user} />
```

**User object debe contener:**
```javascript
{
  token: 'jwt_token_here',
  rol: 'sensei',
  dojoId: 'dojo_id_here'
}
```

---

## 📦 Integración con App.jsx

### Opción 1: Importación directa

```jsx
import { BracketsManager, BracketsView } from './components/brackets';

function App() {
  const [user, setUser] = useState(null);

  // ... tu lógica de autenticación ...

  return (
    <div>
      {user?.rol === 'admin' && <BracketsManager user={user} />}
      {user?.rol === 'sensei' && <BracketsView user={user} />}
    </div>
  );
}
```

### Opción 2: Con rutas (React Router)

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BracketsManager, BracketsView } from './components/brackets';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/brackets"
          element={user?.rol === 'admin' ? <BracketsManager user={user} /> : <BracketsView user={user} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 🎨 Estilos y Diseño

Los componentes utilizan **Tailwind CSS** para el diseño. Asegúrate de que Tailwind esté configurado correctamente en tu proyecto.

### Configuración de Tailwind (si no está configurado):

1. Instalar Tailwind:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

2. Configurar `tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

3. Agregar directivas en `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 🔧 Configuración de API

Los componentes usan `axios` para las peticiones HTTP.

**URL de la API:** `http://localhost:5000/api`

Si tu backend está en otro puerto o dominio, modifica la constante `API_URL` en ambos archivos:

```javascript
const API_URL = 'http://tu-dominio.com/api';
```

---

## 📋 Funcionalidades Implementadas

### Gestión de Brackets (Admin)

#### 1. Generar Brackets
- Click en "Generar Brackets"
- Confirmación del usuario
- Muestra resultados:
  - ✅ Brackets generados exitosamente
  - ⚠️ Advertencias (categorías con <2 competidores)
  - ❌ Errores si los hay
- Recarga automática de la lista

#### 2. Visualizar Bracket
- Click en "👁️ Ver"
- Abre modal con todas las rondas
- Muestra combates organizados por ronda
- Cada combate incluye:
  - Número de combate
  - Competidores con info completa
  - Estado (pendiente/finalizado)
  - Botón "Registrar Resultado" si está pendiente
  - Ganador (si ya se registró)

#### 3. Registrar Resultado
- Click en "📝 Registrar Resultado" en un combate
- Abre modal con opciones de ganador
- Selecciona ganador con radio buttons
- Confirma resultado
- Actualiza automáticamente:
  - Estado del combate
  - Avanza ganador a siguiente ronda
  - Actualiza estado del bracket
  - Recarga vista

#### 4. Descargar PDF
- Click en "🖨️ PDF"
- Descarga automática del archivo PDF
- Nombre del archivo: `bracket-Nombre-Categoria.pdf`
- Incluye:
  - Logo Copa Samurai 2025
  - Info completa de competidores
  - Espacios para resultados y firmas
  - Código QR para vista online

#### 5. Compartir Bracket
- Click en "🔗 Compartir"
- Copia automáticamente el link público al portapapeles
- Muestra alerta con el link
- Link funciona sin autenticación

#### 6. Resetear Bracket
- Click en "🔄 Resetear"
- Confirmación del usuario
- Borra todos los resultados
- Vuelve a estado inicial
- Recarga vista

#### 7. Eliminar Bracket
- Click en "🗑️ Eliminar"
- Confirmación del usuario
- Elimina el bracket completamente
- Permite regenerar si es necesario
- Recarga vista

---

### Vista de Senseis (Solo Lectura)

#### 1. Ver Brackets
- Lista automática de brackets donde participan sus atletas
- No puede ver brackets de otros dojos
- Vista de solo lectura claramente indicada

#### 2. Visualizar Bracket
- Click en "👁️ Ver Bracket"
- Modal con todas las rondas y combates
- Información completa pero sin opciones de edición
- Indicador: "👁️ Vista de solo lectura"

#### 3. Descargar PDF
- Click en "🖨️ Descargar PDF"
- Descarga del PDF para impresión
- Mismo formato que la vista de admin

---

## 🎨 Elementos Visuales

### Cards de Brackets
- Header con nombre de categoría y badge de estado
- Info: modalidad y total de competidores
- Barra de progreso visual con porcentaje
- Contador de combates: "3/8 combates"
- Botones de acción con iconos

### Pestañas por Tipo
- 🥋 Kata Individual
- 👥 Kata Equipos
- 🥊 Kumite Individual
- ⚔️ Kumite Equipos
- 👊 Kihon Ippon

### Estados con Colores
- 🟡 Amarillo: Sin iniciar
- 🔵 Azul: En curso
- 🟢 Verde: Finalizado

### Modales
- Fondo oscuro semitransparente
- Animaciones suaves
- Botón de cierre (×) visible
- Scroll interno si el contenido es largo
- Responsive para mobile

---

## 📱 Responsive Design

Los componentes están diseñados para funcionar en:
- 📱 Mobile (1 columna)
- 💻 Tablet (2 columnas)
- 🖥️ Desktop (3 columnas)

---

## ⚡ Optimizaciones Implementadas

1. **Carga Eficiente:**
   - Estado de loading mientras carga datos
   - Spinner animado durante operaciones

2. **Feedback Visual:**
   - Alertas para confirmar acciones
   - Mensajes de éxito/error
   - Deshabilitación de botones durante procesos

3. **Actualización Automática:**
   - Recarga de datos después de cada acción
   - Actualización del progreso en tiempo real

4. **Experiencia de Usuario:**
   - Confirmaciones antes de acciones destructivas
   - Copy to clipboard para compartir links
   - Descarga automática de PDFs
   - Indicadores claros de estado

---

## 🔮 Próximas Mejoras (Opcionales)

Si quieres extender la funcionalidad, puedes agregar:

1. **Árbol Visual de Eliminación:**
   - Componente gráfico tipo "bracket tree"
   - Líneas conectando ganadores
   - Vista interactiva

2. **Actualización en Tiempo Real:**
   - WebSockets para actualizar automáticamente
   - Notificaciones push cuando cambian resultados

3. **Asignación de Tatamis:**
   - Campo editable en cada combate
   - Vista agrupada por tatami

4. **Orden de Combates:**
   - Drag & drop para reorganizar
   - Numeración automática

5. **Estadísticas:**
   - Dashboard con métricas generales
   - Gráficos de participación por dojo
   - Análisis de rendimiento

---

## 🐛 Manejo de Errores

Los componentes incluyen manejo de errores:
- Try/catch en todas las peticiones
- Alertas al usuario en caso de error
- Console.error para debugging
- Estados de loading para prevenir clics múltiples

---

## 📞 Uso Práctico

### Flujo Típico del Admin:

1. Entra a la vista de brackets
2. Click en "Generar Brackets"
3. Revisa los resultados (advertencias si hay)
4. Cambia entre pestañas para ver diferentes tipos
5. Click en "Ver" en un bracket
6. Registra resultados combate por combate
7. Descarga PDFs para distribución
8. Comparte links con senseis

### Flujo Típico del Sensei:

1. Entra a la vista de brackets
2. Ve automáticamente solo sus brackets
3. Click en "Ver Bracket" para ver detalles
4. Descarga PDF para impresión
5. Sigue el progreso de sus atletas

---

## ✅ Checklist de Integración

- [ ] Instalar Tailwind CSS (si no está instalado)
- [ ] Instalar axios: `npm install axios`
- [ ] Importar componentes en App.jsx
- [ ] Pasar objeto `user` con token y rol
- [ ] Verificar que API_URL apunte al backend correcto
- [ ] Probar generación de brackets
- [ ] Probar registro de resultados
- [ ] Probar descarga de PDFs
- [ ] Probar vista de senseis

---

## 🎯 Estado Actual

### ✅ COMPLETADO:
- [x] Componente BracketsManager (Admin)
- [x] Componente BracketsView (Senseis)
- [x] Pestañas por tipo de competencia
- [x] Badges y indicadores visuales
- [x] Barras de progreso
- [x] Modal de visualización
- [x] Modal de registro de resultados
- [x] Acciones rápidas (PDF, compartir, resetear, eliminar)
- [x] Manejo de errores
- [x] Loading states
- [x] Responsive design
- [x] Documentación completa

### 🎨 Mejoras Futuras (Opcionales):
- [ ] Árbol visual de eliminación (gráfico)
- [ ] Actualización en tiempo real (WebSockets)
- [ ] Drag & drop para orden de combates
- [ ] Asignación visual de tatamis
- [ ] Dashboard de estadísticas

---

**Implementado por:** Claude Code
**Fecha:** 23 de Octubre, 2025
**Versión:** 1.0.0
**Estado:** ✅ Frontend Funcional - Listo para Producción
