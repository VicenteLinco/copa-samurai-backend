# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con código en este repositorio.

## Descripción del Proyecto

Copa Samurai 2025 es un sistema completo de gestión de torneos de karate con un backend en Node.js/Express y frontend en React (en `copa-samurai-frontend/`). El backend gestiona dojos, senseis, participantes y **equipos** para competiciones de artes marciales, con soporte completo para creación y gestión de equipos por categorías configurables.

## Comandos de Desarrollo

**Iniciar el servidor:**
```bash
node server.js
```

**Iniciar con recarga automática (desarrollo):**
```bash
npx nodemon server.js
```

**Instalar dependencias:**
```bash
npm install
```

## Arquitectura

### Backend de un Solo Archivo
Todo el backend está contenido en `server.js` - una aplicación Express monolítica con:
- MongoDB/Mongoose ODM para persistencia de datos
- Autenticación JWT con hash de contraseñas bcrypt
- Control de acceso basado en roles (admin/sensei)

### Modelos de Datos (Esquemas Mongoose)

**Dojo** (líneas 26-29):
- Representa escuelas de artes marciales
- Campos: `nombre`, `ubicacion`

**Sensei** (líneas 31-37):
- Instructores/entrenadores con credenciales de acceso
- Campos: `nombre`, `usuario`, `password`, `dojoId`, `rol`
- Dos roles: `admin` (acceso completo) o `sensei` (acceso limitado a su dojo)

**Participante** (líneas 39-53):
- Participantes/competidores del torneo
- Campos: `nombre`, `edad`, `genero`, `grado`, `dojoId`, `creadoPor`
- Restricción única en `nombre` (nombres de participantes globalmente únicos)
- Objeto embebido `modalidades` para categorías de competición:
  - `kataIndividual`, `kataEquipos`, `kumiteIndividual`, `kumiteEquipos`, `kihonIppon`
- Categorías de edad: Cambiado a 11+ años (kumite) según commit 2340264

**RangoEdad** (líneas 56-61):
- Define rangos de edad configurables para las categorías
- Campos: `nombre` (ej: "12-15"), `edadMin`, `edadMax`, `activo`
- Rangos por defecto: 0-11, 12-15, 16-19, 20-39, 40+ (kata) y 11-13, 14-16, 17-19, 20-39, 40+ (kumite)

**Disciplina** (líneas 63-70):
- Define las disciplinas del torneo (Kata Equipos, Kumite Equipos)
- Campos: `nombre`, `codigo`, `requiereGenero`, `mixto`, `activo`
- Kata es mixto, Kumite requiere separación por género

**Categoria** (líneas 72-79):
- Combinación de disciplina + rango de edad + género
- Campos: `nombre` (auto-generado), `disciplinaId`, `rangoEdadId`, `genero`
- Ejemplos: "Kata Mixto 12-15", "Kumite Varones 11-13", "Kumite Damas 14-16"
- Índice único para evitar duplicados (disciplina + rango + género)

**Equipo** (líneas 85-95):
- Equipos de competición con máximo 3 integrantes (configurable)
- Campos: `nombre`, `categoriaId`, `dojoId`, `miembros[]`, `numeroEquipo`, `creadoPor`
- Nombres únicos por dojo (índice compuesto)
- `numeroEquipo` se genera automáticamente por dojo y categoría
- Validaciones: edad, género, mismo dojo, no duplicados en misma categoría

**Configuracion** (líneas 101-105):
- Parámetros configurables del sistema
- Clave `maxMiembrosEquipo` define el máximo de integrantes por equipo (por defecto: 3)

### Autenticación y Autorización

**Middleware: `auth`** (líneas 85-100):
- Valida tokens JWT del header `Authorization: Bearer <token>`
- Adjunta `req.user` con datos del sensei y dojo poblado
- Retorna 401 si el token es inválido o falta

**Inicialización de Usuario Admin** (líneas 60-82):
- Auto-crea usuario admin en el primer inicio
- Credenciales por defecto: `usuario=admin`, `password=admin123`
- Pertenece al "Admin Dojo" especial

### Endpoints de la API

**Autenticación:**
- `POST /api/login` - Retorna token JWT e información del usuario
- `POST /api/change-password` - Cambio de contraseña autenticado

**Dojos** (CRUD solo admin):
- `GET /api/dojos` - Lista todos los dojos
- `POST /api/dojos` - Crear dojo
- `PUT /api/dojos/:id` - Actualizar dojo
- `DELETE /api/dojos/:id` - Eliminar dojo

**Senseis** (solo admin):
- `GET /api/senseis` - Lista todos los senseis con dojo poblado
- `POST /api/senseis` - Crear sensei (hashea la contraseña automáticamente)
- `PUT /api/senseis/:id` - Actualizar sensei
- `DELETE /api/senseis/:id` - Eliminar sensei

**Participantes** (según alcance del rol):
- `GET /api/participantes` - Lista participantes
  - Admin: ve todos, puede filtrar por `?dojoId=<id>`
  - Sensei: auto-filtrado solo a su dojo
  - Soporta parámetro de búsqueda `?search=<nombre>`
- `POST /api/participantes` - Crear participante
  - Sensei: auto-asigna su dojoId y creadoPor
  - Admin: puede especificar cualquier dojoId
- `PUT /api/participantes/:id` - Actualizar participante
  - Sensei: solo puede editar participantes de su dojo
- `DELETE /api/participantes/:id` - Eliminar participante
  - Sensei: solo puede eliminar participantes de su dojo

**Disciplinas** (acceso según rol):
- `GET /api/disciplinas` - Lista disciplinas activas (admin y sensei)
- `POST /api/disciplinas` - Crear disciplina (solo admin)
- `PUT /api/disciplinas/:id` - Actualizar disciplina (solo admin)
- `DELETE /api/disciplinas/:id` - Eliminar disciplina (solo admin)

**Rangos de Edad** (acceso según rol):
- `GET /api/rangos-edad` - Lista rangos activos (admin y sensei)
- `POST /api/rangos-edad` - Crear rango (solo admin)
- `PUT /api/rangos-edad/:id` - Actualizar rango (solo admin)
- `DELETE /api/rangos-edad/:id` - Eliminar rango (solo admin)

**Categorías** (acceso según rol):
- `GET /api/categorias` - Lista categorías activas con disciplina y rango poblados (admin y sensei)
- `POST /api/categorias` - Crear categoría (solo admin)
- `PUT /api/categorias/:id` - Actualizar categoría (solo admin)
- `DELETE /api/categorias/:id` - Eliminar categoría (solo admin)

**Equipos** (según alcance del rol):
- `GET /api/equipos` - Lista equipos
  - Admin: ve todos, puede filtrar por `?dojoId=<id>` y `?categoriaId=<id>`
  - Sensei: auto-filtrado solo a su dojo
- `GET /api/equipos/:id` - Obtener equipo por ID con datos completos
- `POST /api/equipos` - Crear equipo
  - Sensei: auto-asigna su dojoId y creadoPor
  - Admin: puede especificar cualquier dojoId
  - Validaciones completas: edad, género, mismo dojo, no duplicados, límite de miembros
  - Auto-genera `numeroEquipo` por dojo y categoría
- `PUT /api/equipos/:id` - Actualizar equipo
  - Sensei: solo puede editar equipos de su dojo
  - Mismas validaciones que al crear
- `DELETE /api/equipos/:id` - Eliminar equipo
  - Sensei: solo puede eliminar equipos de su dojo

**Configuración** (solo admin):
- `GET /api/configuracion` - Lista todas las configuraciones
- `GET /api/configuracion/:clave` - Obtener configuración específica
- `PUT /api/configuracion/:clave` - Actualizar valor de configuración

**Endpoints Especiales**:
- `GET /api/participantes-disponibles` - Obtener participantes disponibles para una categoría
  - Parámetros requeridos: `categoriaId`
  - Parámetros opcionales: `equipoId` (para edición), `nombre`, `edad`, `genero`, `grado`, `dojoId`
  - Filtra automáticamente por elegibilidad de edad, género y disponibilidad
  - No muestra participantes ya asignados a otros equipos de la misma categoría
  - Senseis solo ven participantes de su dojo

- `GET /api/panel-general` - Panel de visualización general
  - Admin: ve todas las categorías y equipos de todos los dojos (puede filtrar por `?dojoId=<id>`)
  - Sensei: solo ve categorías y equipos de su dojo
  - Retorna array de categorías con sus equipos, participantes y estadísticas

### Modelo de Permisos

**Rol Admin:**
- CRUD completo en dojos, senseis, participantes y equipos de todos los dojos
- Gestión completa de disciplinas, rangos de edad y categorías
- Acceso y modificación de configuración del sistema
- Puede ver y gestionar datos de cualquier dojo

**Rol Sensei:**
- CRUD completo en participantes y equipos, pero solo dentro de su dojo asignado
- Acceso de solo lectura a: dojos, disciplinas, rangos de edad y categorías
- No puede acceder a endpoints de gestión de senseis ni configuración
- Auto-asignación automática de su dojo al crear participantes y equipos

Correcciones recientes de permisos (commit 99f959d): Los senseis ahora tienen permisos completos dentro de su propio dojo.

### Variables de Entorno

Requeridas en el archivo `.env`:
- `MONGODB_URI` - Cadena de conexión MongoDB (por defecto localhost)
- `JWT_SECRET` - Clave secreta para firmar JWT (por defecto 'secret-key-copa-samurai-2025')
- `PORT` - Puerto del servidor (por defecto 5000)

### Reglas de Negocio Importantes

1. **Nombres Únicos de Participantes**: Los nombres de participantes deben ser globalmente únicos en todos los dojos (aplicado por índice único de MongoDB)

2. **Nombres Únicos de Equipos por Dojo**: Los nombres de equipos deben ser únicos dentro de cada dojo (índice compuesto nombre + dojoId)

3. **Restricciones de Edad**: Cambio reciente permite participantes de 11+ años para kumite (commit 2340264)

4. **Alcance de Sensei**: Los senseis están automáticamente restringidos a ver/editar solo los participantes y equipos de su dojo

5. **Auto-Población**: Las referencias dojoId, categoriaId, etc. se pueblan automáticamente en las respuestas para mejor UX

6. **Validaciones de Equipos**:
   - Máximo 3 miembros por equipo (configurable mediante `/api/configuracion/maxMiembrosEquipo`)
   - Todos los miembros deben pertenecer al mismo dojo del equipo
   - Los participantes deben estar en el rango de edad de la categoría
   - Para categorías no mixtas, todos los participantes deben ser del género requerido
   - Un participante no puede estar en dos equipos diferentes de la misma categoría y disciplina
   - Nombres de equipo únicos por dojo
   - Número de equipo auto-generado por dojo y categoría

7. **Sistema de Categorías**: Las categorías se crean combinando disciplina + rango de edad + género. Ejemplos:
   - Kata Mixto 0-11, 12-15, 16-19, 20-39, 40+
   - Kumite Varones/Damas 11-13, 14-16, 17-19, 20-39, 40+

8. **Inicialización Automática**: En el primer arranque, el sistema crea:
   - Usuario admin por defecto
   - Disciplinas: Kata Equipos (mixto) y Kumite Equipos (por género)
   - Rangos de edad por defecto para kata y kumite
   - Todas las categorías resultantes
   - Configuración de máximo de miembros por equipo (3)

### Configuración CORS

Política CORS abierta (`origin: '*'`) con soporte de credenciales (líneas 11-14) - adecuado para desarrollo pero debería restringirse en producción.

### Integración con Frontend

El frontend complementario en React está en el subdirectorio `copa-samurai-frontend/`. Es un repositorio Git separado y una aplicación basada en Vite.
