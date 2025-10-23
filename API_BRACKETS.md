# API de Brackets - Copa Samurai 2025

## Resumen del Sistema Implementado

### ✅ Backend Completado

**Modelos de Datos:**
- ✅ **Categoria** - Actualizado con campos `nivel` (Novicio/Avanzado/Libre) y `modalidad` (Individual/Equipos)
- ✅ **Bracket** - Modelo completo con rondas, combates, estados y token público
- ✅ **66 Categorías creadas** automáticamente al iniciar el servidor

**Algoritmo de Brackets:**
- ✅ Generación automática de eliminación directa
- ✅ Cálculo de potencia de 2 más cercana
- ✅ Distribución de "byes" para números impares
- ✅ **Separación de dojos con PRIORIDAD ALTA** - Evita enfrentamientos del mismo dojo en primera ronda
- ✅ Avance automático de ganadores entre rondas
- ✅ Nombres de rondas automáticos (Final, Semifinal, Cuartos, etc.)

---

## 📡 Endpoints de la API

### 🔐 Autenticación Requerida

Todos los endpoints (excepto el público) requieren header:
```
Authorization: Bearer <token_jwt>
```

---

## 1. Generar Brackets (Admin)

**POST** `/api/brackets/generar`

**Permisos:** Solo admin

**Descripción:** Genera brackets para TODAS las categorías con al menos 2 competidores inscritos.

**Request:** No requiere body

**Response:**
```json
{
  "generados": [
    {
      "categoria": "Kata Novicio Damas 6-8",
      "bracketId": "abc123...",
      "competidores": 5,
      "rondas": 3
    }
  ],
  "advertencias": [
    {
      "categoria": "Kumite Libre Varones 11-12",
      "mensaje": "Solo hay 1 competidor inscrito",
      "competidor": "Juan Pérez"
    }
  ],
  "errores": []
}
```

---

## 2. Listar Brackets

**GET** `/api/brackets`

**Permisos:**
- Admin: ve todos los brackets
- Sensei: solo ve brackets donde participan sus atletas/equipos

**Response:**
```json
[
  {
    "_id": "bracket123",
    "categoriaId": {
      "_id": "cat123",
      "nombre": "Kata Novicio Damas 6-8",
      "disciplinaId": { "nombre": "Kata Individual" },
      "rangoEdadId": { "nombre": "6-8" },
      "genero": "Femenino",
      "nivel": "Novicio",
      "modalidad": "Individual"
    },
    "modalidad": "Individual",
    "totalCompetidores": 5,
    "estado": "generado",
    "tokenPublico": "abc123def456",
    "createdAt": "2025-10-23T04:00:00.000Z"
  }
]
```

---

## 3. Obtener Bracket Completo

**GET** `/api/brackets/:id`

**Permisos:** Admin y Sensei

**Description:** Retorna el bracket completo con todos los competidores poblados en cada combate.

**Response:**
```json
{
  "_id": "bracket123",
  "categoriaId": { ... },
  "modalidad": "Individual",
  "totalCompetidores": 5,
  "estado": "en_curso",
  "rondas": [
    {
      "numeroRonda": 1,
      "nombreRonda": "Ronda 1",
      "combates": [
        {
          "numeroCombate": 1,
          "orden": 1,
          "competidor1": {
            "tipo": "Individual",
            "id": "part123",
            "esBye": false,
            "datos": {
              "nombre": "Juan Pérez",
              "edad": 7,
              "grado": "8 Kyu",
              "dojoId": { "nombre": "Dojo Kaizen" }
            }
          },
          "competidor2": {
            "tipo": "Individual",
            "id": null,
            "esBye": true
          },
          "ganador": {
            "tipo": "Individual",
            "id": "part123",
            "datos": { ... }
          },
          "estado": "finalizado",
          "tatami": null,
          "notas": ""
        }
      ]
    },
    {
      "numeroRonda": 2,
      "nombreRonda": "Semifinal",
      "combates": [ ... ]
    }
  ]
}
```

---

## 4. Actualizar Resultado de Combate

**PUT** `/api/brackets/:id/combate/:rondaNum/:combateNum`

**Permisos:** Solo admin

**Descripción:** Registra el ganador de un combate y lo avanza automáticamente a la siguiente ronda.

**Request Body:**
```json
{
  "ganadorId": "participante_o_equipo_id",
  "tatami": 2,
  "notas": "Victoria por puntos 5-3"
}
```

**Response:** Bracket actualizado completo

---

## 5. Eliminar Bracket

**DELETE** `/api/brackets/:categoriaId`

**Permisos:** Solo admin

**Descripción:** Elimina el bracket de una categoría para poder regenerarlo.

**Response:**
```json
{
  "message": "Bracket eliminado correctamente"
}
```

---

## 6. Editar Emparejamientos

**PUT** `/api/brackets/:id/emparejamientos`

**Permisos:** Solo admin

**Descripción:** Permite intercambiar competidores manualmente antes de publicar el bracket.

**Request Body:**
```json
{
  "intercambios": [
    {
      "combate1": {
        "ronda": 1,
        "combate": 1,
        "posicion": "competidor1"
      },
      "combate2": {
        "ronda": 1,
        "combate": 2,
        "posicion": "competidor2"
      }
    }
  ]
}
```

---

## 7. Cambiar Orden de Combates

**PUT** `/api/brackets/:id/orden`

**Permisos:** Solo admin

**Descripción:** Permite reorganizar la secuencia de ejecución de los combates.

**Request Body:**
```json
{
  "rondaNum": 1,
  "nuevosOrdenes": [
    { "numeroCombate": 1, "nuevoOrden": 3 },
    { "numeroCombate": 2, "nuevoOrden": 1 },
    { "numeroCombate": 3, "nuevoOrden": 2 }
  ]
}
```

---

## 8. Resetear Bracket

**PUT** `/api/brackets/:id/resetear`

**Permisos:** Solo admin

**Descripción:** Borra todos los resultados y vuelve el bracket a su estado inicial.

**Response:** Bracket reseteado

---

## 9. Duplicar Bracket

**POST** `/api/brackets/:id/duplicar`

**Permisos:** Solo admin

**Descripción:** Copia la estructura de emparejamientos a otra categoría similar.

**Request Body:**
```json
{
  "categoriaIdDestino": "categoria_destino_id"
}
```

---

## 10. Obtener Bracket Público (Sin Autenticación)

**GET** `/api/brackets/publico/:token`

**Permisos:** Público (no requiere autenticación)

**Descripción:** Permite compartir brackets con senseis usando un token único.

**Response:** Bracket completo con todos los datos poblados

**Uso:**
```
https://tu-dominio.com/api/brackets/publico/abc123def456
```

---

## 📊 Estados del Sistema

### Estados del Bracket
- `generado` - Recién creado, puede editarse
- `en_curso` - Al menos un combate finalizado
- `finalizado` - Todos los combates completados

### Estados del Combate
- `pendiente` - No ha comenzado
- `en_curso` - En ejecución (futuro uso)
- `finalizado` - Tiene ganador registrado

---

## 🔄 Flujo de Uso Típico

1. **Admin genera brackets:**
   ```
   POST /api/brackets/generar
   ```

2. **Admin revisa advertencias** (categorías con <2 competidores)

3. **Admin puede editar emparejamientos** si detecta errores:
   ```
   PUT /api/brackets/:id/emparejamientos
   ```

4. **Admin asigna tatamis y orden:**
   ```
   PUT /api/brackets/:id/combate/:ronda/:combate
   { "tatami": 1 }
   ```

5. **Durante el torneo, registra ganadores:**
   ```
   PUT /api/brackets/:id/combate/:ronda/:combate
   { "ganadorId": "..." }
   ```

6. **Comparte con senseis:**
   - Copia el token público del bracket
   - Envía link: `/api/brackets/publico/:token`

---

## ⚠️ Validaciones Importantes

### Al Generar Brackets:
- ✅ Mínimo 2 competidores por categoría (advertencia si hay 1)
- ✅ No genera bracket si ya existe uno para esa categoría
- ✅ Valida inscripción en modalidad correcta
- ✅ Filtra por edad, género y nivel (grado) según la categoría

### Modalidades de Competición:
- **Kata Individual:** Requiere `participante.modalidades.kataIndividual = true`
- **Kumite Individual:** Requiere `participante.modalidades.kumiteIndividual = true`
- **Kihon Ippon:** Requiere `participante.modalidades.kihonIppon = true`
- **Kata Equipos:** Requiere equipos con `categoria.modalidad = 'Equipos'` y `disciplina = 'kata-equipos'`
- **Kumite Equipos:** Requiere equipos con `categoria.modalidad = 'Equipos'` y `disciplina = 'kumite-equipos'`

### Niveles por Grado (Solo Kata Individual):
- **Novicio:** 10 Kyu, 9 Kyu, 8 Kyu, 7 Kyu
- **Avanzado:** 6 Kyu, 5 Kyu, 4 Kyu, 3 Kyu, 2 Kyu, 1 Kyu, Dan
- **Libre:** Sin restricción de grado (Kumite, Kihon Ippon)

---

## 🎯 Próximos Pasos (Frontend)

### Componentes a Crear:
1. **Vista Admin - Gestión de Brackets**
   - Botón "Generar Brackets"
   - Pestañas por tipo: Kata Individual | Kata Equipos | Kumite Individual | Kumite Equipos | Kihon Ippon
   - Lista de brackets con badges de estado
   - Acciones rápidas: PDF, Resetear, Duplicar, Compartir

2. **Visualización de Bracket**
   - Árbol de eliminación directa (horizontal/vertical con toggle)
   - Lista de combates por ronda
   - Indicadores visuales de progreso

3. **Edición de Resultados**
   - Modal para registrar ganador
   - Asignación de tatami
   - Notas del combate

4. **Vista Sensei**
   - Lista de brackets donde participan sus atletas
   - Solo lectura
   - Descarga PDF

### Generación de PDF (Pendiente):
- Librería sugerida: `pdfkit` o `jsPDF`
- Incluir logo Copa Samurai 2025
- Información de competidores con dojo y grado
- Espacios para firmas y resultados
- Código QR con link público

---

## 🧪 Testing

Para probar el sistema:

1. **Crear participantes de prueba** con diferentes grados, edades, géneros
2. **Inscribirlos en modalidades** (marcar checkboxes de modalidades)
3. **Generar brackets:** `POST /api/brackets/generar`
4. **Ver resultados:** `GET /api/brackets`
5. **Registrar ganador de prueba:** `PUT /api/brackets/:id/combate/1/1`

---

## 📝 Notas de Migración

Si ya tienes datos anteriores:
```bash
node migrate.js
```

Este script:
- ✅ Conserva dojos y senseis
- ✅ Elimina participantes, equipos, categorías antiguas
- ✅ Resetea brackets
- ✅ Permite reinicialización limpia del sistema

---

**Estado del Backend:** ✅ **COMPLETADO Y FUNCIONAL**

**Servidor corriendo en:** `http://localhost:5000`

**Total de categorías creadas:** 66
