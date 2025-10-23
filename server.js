const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copa-samurai')
  .then(async () => {
    console.log('✅ MongoDB conectado');
    await initAdmin();
    await initSistema();
  })
  .catch(err => console.error('❌ Error MongoDB:', err));

// Schemas
const dojoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  ubicacion: { type: String, required: true, trim: true }
}, { timestamps: true });

const senseiSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  usuario: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  dojoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dojo', required: true },
  rol: { type: String, default: 'sensei' }
}, { timestamps: true });

const participanteSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 100, unique: true },
  edad: { type: Number, required: true, min: 1, max: 100 },
  genero: { type: String, required: true, enum: ['Masculino', 'Femenino'] },
  grado: { type: String, required: true, enum: ['10 Kyu', '9 Kyu', '8 Kyu', '7 Kyu', '6 Kyu', '5 Kyu', '4 Kyu', '3 Kyu', '2 Kyu', '1 Kyu', 'Dan'] },
  dojoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dojo', required: true },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Sensei' },
  modalidades: {
    kataIndividual: { type: Boolean, default: false },
    kataEquipos: { type: Boolean, default: false },
    kumiteIndividual: { type: Boolean, default: false },
    kumiteEquipos: { type: Boolean, default: false },
    kihonIppon: { type: Boolean, default: false }
  }
}, { timestamps: true });

// Schema para Rangos de Edad configurables
const rangoEdadSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true }, // ej: "0-11", "12-15"
  edadMin: { type: Number, required: true, min: 0 },
  edadMax: { type: Number, required: true, max: 150 },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

// Schema para Disciplinas configurables
const disciplinaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, unique: true }, // ej: "Kata Equipos", "Kumite Equipos"
  codigo: { type: String, required: true, trim: true, unique: true }, // ej: "kata", "kumite"
  requiereGenero: { type: Boolean, default: false }, // kumite requiere separación por género
  mixto: { type: Boolean, default: false }, // kata es mixto
  activo: { type: Boolean, default: true }
}, { timestamps: true });

// Schema para Categorías (combinación de disciplina + rango + género + nivel)
const categoriaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true }, // auto-generado: "Kata Novicio Damas 6-8"
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  rangoEdadId: { type: mongoose.Schema.Types.ObjectId, ref: 'RangoEdad', required: true },
  genero: { type: String, enum: ['Masculino', 'Femenino', 'Mixto'] },
  nivel: { type: String, enum: ['Novicio', 'Avanzado', 'Libre'], default: 'Libre' }, // Para Kata: Novicio (10-7 KYU), Avanzado (6 KYU-DAN)
  modalidad: { type: String, enum: ['Individual', 'Equipos'], required: true }, // Individual o Equipos
  activo: { type: Boolean, default: true }
}, { timestamps: true });

// Índice único para evitar categorías duplicadas
categoriaSchema.index({ disciplinaId: 1, rangoEdadId: 1, genero: 1, nivel: 1, modalidad: 1 }, { unique: true });

// Schema para Equipos
const equipoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 100 },
  categoriaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria', required: true },
  dojoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dojo', required: true },
  miembros: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participante'
  }],
  numeroEquipo: { type: Number }, // auto-generado por dojo
  estado: {
    type: String,
    enum: ['borrador', 'activo'],
    default: 'borrador'
  },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Sensei' }
}, { timestamps: true });

// Índice para nombres únicos por dojo
equipoSchema.index({ nombre: 1, dojoId: 1 }, { unique: true });

// Schema para Configuración del sistema
const configuracionSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true },
  valor: { type: mongoose.Schema.Types.Mixed, required: true },
  descripcion: { type: String }
}, { timestamps: true });

// Schema para Brackets de Competición
const bracketSchema = new mongoose.Schema({
  categoriaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria', required: true, unique: true },
  modalidad: { type: String, enum: ['Individual', 'Equipos'], required: true },
  tokenPublico: { type: String, unique: true }, // Para compartir con senseis
  rondas: [{
    numeroRonda: { type: Number, required: true }, // 1 = Primera ronda, 2 = Cuartos, etc.
    nombreRonda: { type: String }, // "Primera Ronda", "Cuartos de Final", "Semifinal", "Final"
    combates: [{
      numeroCombate: { type: Number, required: true }, // Número secuencial único
      orden: { type: Number }, // Orden de ejecución (editable)
      competidor1: {
        tipo: { type: String, enum: ['Participante', 'Equipo'] },
        id: { type: mongoose.Schema.Types.ObjectId, refPath: 'rondas.combates.competidor1.tipo' },
        esBye: { type: Boolean, default: false } // true si pasa automáticamente
      },
      competidor2: {
        tipo: { type: String, enum: ['Participante', 'Equipo'] },
        id: { type: mongoose.Schema.Types.ObjectId, refPath: 'rondas.combates.competidor2.tipo' },
        esBye: { type: Boolean, default: false }
      },
      ganador: {
        tipo: { type: String, enum: ['Participante', 'Equipo'] },
        id: { type: mongoose.Schema.Types.ObjectId, refPath: 'rondas.combates.ganador.tipo' }
      },
      tatami: { type: Number }, // Opcional, asignado por admin
      estado: {
        type: String,
        enum: ['pendiente', 'en_curso', 'finalizado'],
        default: 'pendiente'
      },
      notas: { type: String } // Espacio para anotaciones del admin
    }]
  }],
  totalCompetidores: { type: Number, required: true },
  estado: {
    type: String,
    enum: ['generado', 'en_curso', 'finalizado'],
    default: 'generado'
  },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Sensei', required: true }
}, { timestamps: true });

const Dojo = mongoose.model('Dojo', dojoSchema);
const Sensei = mongoose.model('Sensei', senseiSchema);
const Participante = mongoose.model('Participante', participanteSchema);
const RangoEdad = mongoose.model('RangoEdad', rangoEdadSchema);
const Disciplina = mongoose.model('Disciplina', disciplinaSchema);
const Categoria = mongoose.model('Categoria', categoriaSchema);
const Equipo = mongoose.model('Equipo', equipoSchema);
const Configuracion = mongoose.model('Configuracion', configuracionSchema);
const Bracket = mongoose.model('Bracket', bracketSchema);

// Función para inicializar admin
async function initAdmin() {
  try {
    const adminCount = await Sensei.countDocuments({ rol: 'admin' });
    if (adminCount === 0) {
      const adminDojo = await Dojo.findOne({ nombre: 'Admin Dojo' }) || await Dojo.create({
        nombre: 'Admin Dojo',
        ubicacion: 'Sistema'
      });

      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Sensei.create({
        nombre: 'Administrador',
        usuario: 'admin',
        password: hashedPassword,
        dojoId: adminDojo._id,
        rol: 'admin'
      });
      console.log('✅ Usuario admin creado: usuario=admin, password=admin123');
    }
  } catch (error) {
    console.error('Error al crear admin:', error);
  }
}

// Función para inicializar datos por defecto del sistema
async function initSistema() {
  try {
    // Inicializar configuración: máximo de miembros por equipo
    const configMaxMiembros = await Configuracion.findOne({ clave: 'maxMiembrosEquipo' });
    if (!configMaxMiembros) {
      await Configuracion.create({
        clave: 'maxMiembrosEquipo',
        valor: 3,
        descripcion: 'Número máximo de integrantes por equipo'
      });
      console.log('✅ Configuración de max miembros creada: 3');
    }

    // Inicializar configuración: mínimo de miembros por equipo para activarlo
    const configMinMiembros = await Configuracion.findOne({ clave: 'minMiembrosEquipo' });
    if (!configMinMiembros) {
      await Configuracion.create({
        clave: 'minMiembrosEquipo',
        valor: 3,
        descripcion: 'Número mínimo de integrantes para activar un equipo'
      });
      console.log('✅ Configuración de min miembros creada: 3');
    }

    // Inicializar Disciplinas - TODAS las modalidades del torneo
    const disciplinasDefault = [
      { nombre: 'Kata Individual', codigo: 'kata-individual', requiereGenero: true, mixto: false },
      { nombre: 'Kata Equipos', codigo: 'kata-equipos', requiereGenero: false, mixto: true },
      { nombre: 'Kumite Individual', codigo: 'kumite-individual', requiereGenero: true, mixto: false },
      { nombre: 'Kumite Equipos', codigo: 'kumite-equipos', requiereGenero: true, mixto: false },
      { nombre: 'Kihon Ippon', codigo: 'kihon-ippon', requiereGenero: true, mixto: false }
    ];

    // Migrar disciplinas antiguas si existen
    const kataViejo = await Disciplina.findOne({ codigo: 'kata' });
    if (kataViejo) {
      await Disciplina.updateOne({ codigo: 'kata' }, { $set: { codigo: 'kata-equipos' } });
      console.log('✅ Disciplina migrada: kata -> kata-equipos');
    }

    const kumiteViejo = await Disciplina.findOne({ codigo: 'kumite' });
    if (kumiteViejo) {
      await Disciplina.updateOne({ codigo: 'kumite' }, { $set: { codigo: 'kumite-equipos' } });
      console.log('✅ Disciplina migrada: kumite -> kumite-equipos');
    }

    for (const disc of disciplinasDefault) {
      const existe = await Disciplina.findOne({ codigo: disc.codigo });
      if (!existe) {
        await Disciplina.create(disc);
        console.log(`✅ Disciplina creada: ${disc.nombre}`);
      }
    }

    // Inicializar Rangos de Edad - Todos los rangos necesarios
    const rangosDefault = [
      { nombre: '6-8', edadMin: 6, edadMax: 8 },
      { nombre: '9-10', edadMin: 9, edadMax: 10 },
      { nombre: '9-11', edadMin: 9, edadMax: 11 },
      { nombre: '11-12', edadMin: 11, edadMax: 12 },
      { nombre: '11-13', edadMin: 11, edadMax: 13 },
      { nombre: '12-14', edadMin: 12, edadMax: 14 },
      { nombre: '12-15', edadMin: 12, edadMax: 15 },
      { nombre: '13-14', edadMin: 13, edadMax: 14 },
      { nombre: '14-16', edadMin: 14, edadMax: 16 },
      { nombre: '15-16', edadMin: 15, edadMax: 16 },
      { nombre: '15-17', edadMin: 15, edadMax: 17 },
      { nombre: '16-19', edadMin: 16, edadMax: 19 },
      { nombre: '17-18', edadMin: 17, edadMax: 18 },
      { nombre: '17-19', edadMin: 17, edadMax: 19 },
      { nombre: '18-20', edadMin: 18, edadMax: 20 },
      { nombre: '19-20', edadMin: 19, edadMax: 20 },
      { nombre: '20-39', edadMin: 20, edadMax: 39 },
      { nombre: '21-39', edadMin: 21, edadMax: 39 },
      { nombre: '40+', edadMin: 40, edadMax: 150 },
      { nombre: 'hasta 11', edadMin: 0, edadMax: 11 }
    ];

    for (const rango of rangosDefault) {
      const existe = await RangoEdad.findOne({ nombre: rango.nombre });
      if (!existe) {
        await RangoEdad.create(rango);
        console.log(`✅ Rango de edad creado: ${rango.nombre}`);
      }
    }

    // Obtener disciplinas
    const kataIndividual = await Disciplina.findOne({ codigo: 'kata-individual' });
    const kataEquipos = await Disciplina.findOne({ codigo: 'kata-equipos' });
    const kumiteIndividual = await Disciplina.findOne({ codigo: 'kumite-individual' });
    const kumiteEquipos = await Disciplina.findOne({ codigo: 'kumite-equipos' });
    const kihonIppon = await Disciplina.findOne({ codigo: 'kihon-ippon' });

    // Crear función auxiliar para crear categorías
    const crearCategoria = async (nombre, disciplinaId, rangoNombre, genero, nivel, modalidad) => {
      const rango = await RangoEdad.findOne({ nombre: rangoNombre });
      if (!rango || !disciplinaId) return;

      const existe = await Categoria.findOne({
        disciplinaId,
        rangoEdadId: rango._id,
        genero,
        nivel,
        modalidad
      });

      if (!existe) {
        await Categoria.create({
          nombre,
          disciplinaId,
          rangoEdadId: rango._id,
          genero,
          nivel,
          modalidad
        });
        console.log(`✅ Categoría creada: ${nombre}`);
      }
    };

    // KATA INDIVIDUAL - Novicio (10°-7° KYU)
    const rangosKataNovicio = ['6-8', '9-11', '12-14', '15-17', '18-20', '21-39', '40+'];
    for (const rango of rangosKataNovicio) {
      await crearCategoria(`Kata Novicio Damas ${rango}`, kataIndividual._id, rango, 'Femenino', 'Novicio', 'Individual');
      await crearCategoria(`Kata Novicio Varones ${rango}`, kataIndividual._id, rango, 'Masculino', 'Novicio', 'Individual');
    }

    // KATA INDIVIDUAL - Avanzado (6° KYU-DAN)
    const rangosKataAvanzado = ['6-8', '9-11', '12-14', '15-17', '18-20', '21-39', '40+'];
    for (const rango of rangosKataAvanzado) {
      await crearCategoria(`Kata Avanzado Damas ${rango}`, kataIndividual._id, rango, 'Femenino', 'Avanzado', 'Individual');
      await crearCategoria(`Kata Avanzado Varones ${rango}`, kataIndividual._id, rango, 'Masculino', 'Avanzado', 'Individual');
    }

    // KATA EQUIPOS - Mixto (sin nivel)
    const rangosKataEquipos = ['hasta 11', '12-15', '16-19', '20-39', '40+'];
    for (const rango of rangosKataEquipos) {
      await crearCategoria(`Kata Equipo Mixto ${rango}`, kataEquipos._id, rango, 'Mixto', 'Libre', 'Equipos');
    }

    // KIHON IPPON
    await crearCategoria('Kihon Ippon Femenino 6-8', kihonIppon._id, '6-8', 'Femenino', 'Libre', 'Individual');
    await crearCategoria('Kihon Ippon Masculino 6-8', kihonIppon._id, '6-8', 'Masculino', 'Libre', 'Individual');
    await crearCategoria('Kihon Ippon Femenino 9-10', kihonIppon._id, '9-10', 'Femenino', 'Libre', 'Individual');
    await crearCategoria('Kihon Ippon Masculino 9-10', kihonIppon._id, '9-10', 'Masculino', 'Libre', 'Individual');

    // KUMITE INDIVIDUAL - Libre (sin grado)
    const rangosKumiteIndividual = ['11-12', '13-14', '15-16', '17-18', '19-20', '21-39', '40+'];
    for (const rango of rangosKumiteIndividual) {
      await crearCategoria(`Kumite Libre Damas ${rango}`, kumiteIndividual._id, rango, 'Femenino', 'Libre', 'Individual');
      await crearCategoria(`Kumite Libre Varones ${rango}`, kumiteIndividual._id, rango, 'Masculino', 'Libre', 'Individual');
    }

    // KUMITE EQUIPOS - Por género (sin grado)
    const rangosKumiteEquipos = ['11-13', '14-16', '17-19', '20-39', '40+'];
    for (const rango of rangosKumiteEquipos) {
      await crearCategoria(`Kumite Equipos Damas ${rango}`, kumiteEquipos._id, rango, 'Femenino', 'Libre', 'Equipos');
      await crearCategoria(`Kumite Equipos Varones ${rango}`, kumiteEquipos._id, rango, 'Masculino', 'Libre', 'Equipos');
    }

  } catch (error) {
    console.error('Error al inicializar sistema:', error);
  }
}

// Middleware de autenticación
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key-copa-samurai-2025');
    const sensei = await Sensei.findById(decoded.id).populate('dojoId');
    
    if (!sensei) throw new Error();
    
    req.user = { ...sensei.toObject(), id: sensei._id.toString(), dojo: sensei.dojoId };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Por favor autentícate' });
  }
};

// Rutas de autenticación
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    const sensei = await Sensei.findOne({ usuario }).populate('dojoId');
    
    if (!sensei || !(await bcrypt.compare(password, sensei.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign({ id: sensei._id }, process.env.JWT_SECRET || 'secret-key-copa-samurai-2025');
    res.json({ 
      token, 
      user: { 
        id: sensei._id, 
        nombre: sensei.nombre, 
        rol: sensei.rol,
        dojo: sensei.dojoId
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

app.post('/api/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const sensei = await Sensei.findById(req.user.id);
    
    if (!(await bcrypt.compare(currentPassword, sensei.password))) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }
    
    sensei.password = await bcrypt.hash(newPassword, 10);
    await sensei.save();
    
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Rutas de Dojos
app.get('/api/dojos', auth, async (req, res) => {
  try {
    const dojos = await Dojo.find().sort({ nombre: 1 });
    res.json(dojos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener dojos' });
  }
});

app.post('/api/dojos', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const dojo = new Dojo(req.body);
    await dojo.save();
    res.status(201).json(dojo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/dojos/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const dojo = await Dojo.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!dojo) return res.status(404).json({ error: 'Dojo no encontrado' });
    res.json(dojo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/dojos/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const dojo = await Dojo.findByIdAndDelete(req.params.id);
    if (!dojo) return res.status(404).json({ error: 'Dojo no encontrado' });
    res.json({ message: 'Dojo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar dojo' });
  }
});

// Rutas de Senseis
app.get('/api/senseis', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const senseis = await Sensei.find().populate('dojoId').sort({ nombre: 1 });
    res.json(senseis);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener senseis' });
  }
});

app.post('/api/senseis', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { password, ...data } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const sensei = new Sensei({ ...data, password: hashedPassword });
    await sensei.save();
    const populated = await Sensei.findById(sensei._id).populate('dojoId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/senseis/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { password, ...data } = req.body;
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }
    const sensei = await Sensei.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).populate('dojoId');
    if (!sensei) return res.status(404).json({ error: 'Sensei no encontrado' });
    res.json(sensei);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/senseis/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const sensei = await Sensei.findByIdAndDelete(req.params.id);
    if (!sensei) return res.status(404).json({ error: 'Sensei no encontrado' });
    res.json({ message: 'Sensei eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar sensei' });
  }
});

// ========== RUTAS DE DISCIPLINAS ==========
app.get('/api/disciplinas', auth, async (req, res) => {
  try {
    const disciplinas = await Disciplina.find({ activo: true }).sort({ nombre: 1 });
    res.json(disciplinas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener disciplinas' });
  }
});

app.post('/api/disciplinas', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const disciplina = new Disciplina(req.body);
    await disciplina.save();
    res.status(201).json(disciplina);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/disciplinas/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const disciplina = await Disciplina.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!disciplina) return res.status(404).json({ error: 'Disciplina no encontrada' });
    res.json(disciplina);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/disciplinas/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const disciplina = await Disciplina.findByIdAndDelete(req.params.id);
    if (!disciplina) return res.status(404).json({ error: 'Disciplina no encontrada' });
    res.json({ message: 'Disciplina eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar disciplina' });
  }
});

// ========== RUTAS DE RANGOS DE EDAD ==========
app.get('/api/rangos-edad', auth, async (req, res) => {
  try {
    const rangos = await RangoEdad.find({ activo: true }).sort({ edadMin: 1 });
    res.json(rangos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener rangos de edad' });
  }
});

app.post('/api/rangos-edad', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const rango = new RangoEdad(req.body);
    await rango.save();
    res.status(201).json(rango);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/rangos-edad/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const rango = await RangoEdad.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!rango) return res.status(404).json({ error: 'Rango de edad no encontrado' });
    res.json(rango);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/rangos-edad/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const rango = await RangoEdad.findByIdAndDelete(req.params.id);
    if (!rango) return res.status(404).json({ error: 'Rango de edad no encontrado' });
    res.json({ message: 'Rango de edad eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar rango de edad' });
  }
});

// ========== RUTAS DE CATEGORÍAS ==========
app.get('/api/categorias', auth, async (req, res) => {
  try {
    const categorias = await Categoria.find({ activo: true })
      .populate('disciplinaId')
      .populate('rangoEdadId')
      .sort({ nombre: 1 });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

app.post('/api/categorias', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const categoria = new Categoria(req.body);
    await categoria.save();
    const populated = await Categoria.findById(categoria._id)
      .populate('disciplinaId')
      .populate('rangoEdadId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/categorias/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const categoria = await Categoria.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('disciplinaId')
      .populate('rangoEdadId');
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(categoria);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/categorias/:id', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const categoria = await Categoria.findByIdAndDelete(req.params.id);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

// ========== RUTAS DE CONFIGURACIÓN ==========
app.get('/api/configuracion', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const config = await Configuracion.find();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

app.get('/api/configuracion/:clave', auth, async (req, res) => {
  try {
    const config = await Configuracion.findOne({ clave: req.params.clave });
    if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

app.put('/api/configuracion/:clave', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const config = await Configuracion.findOneAndUpdate(
      { clave: req.params.clave },
      { valor: req.body.valor },
      { new: true, runValidators: true }
    );
    if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Rutas de Participantes
app.get('/api/participantes', auth, async (req, res) => {
  try {
    const { search, dojoId } = req.query;
    let query = {};
    
    if (req.user.rol === 'sensei') {
      query.dojoId = req.user.dojo._id;
    } else if (dojoId) {
      query.dojoId = dojoId;
    }
    
    if (search) {
      query.nombre = { $regex: search, $options: 'i' };
    }
    
    const participantes = await Participante.find(query)
      .populate('dojoId')
      .populate('creadoPor', 'nombre')
      .sort({ nombre: 1 });
    
    res.json(participantes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener participantes' });
  }
});

app.post('/api/participantes', auth, async (req, res) => {
  try {
    let data = { ...req.body };
    
    if (req.user.rol === 'sensei') {
      data.dojoId = req.user.dojo._id;
      data.creadoPor = req.user.id;
    }
    
    const participante = new Participante(data);
    await participante.save();
    const populated = await Participante.findById(participante._id)
      .populate('dojoId')
      .populate('creadoPor', 'nombre');
    
    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Ya existe un participante con ese nombre' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/participantes/:id', auth, async (req, res) => {
  try {
    const participante = await Participante.findById(req.params.id);
    
    if (!participante) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }
    
    if (req.user.rol === 'sensei' && participante.dojoId.toString() !== req.user.dojo._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    let data = { ...req.body };
    if (req.user.rol === 'sensei') {
      data.dojoId = req.user.dojo._id;
    }
    
    const updated = await Participante.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate('dojoId')
      .populate('creadoPor', 'nombre');
    
    res.json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Ya existe un participante con ese nombre' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/participantes/:id', auth, async (req, res) => {
  try {
    const participante = await Participante.findById(req.params.id);
    
    if (!participante) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }
    
    if (req.user.rol === 'sensei' && participante.dojoId.toString() !== req.user.dojo._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    await Participante.findByIdAndDelete(req.params.id);
    res.json({ message: 'Participante eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar participante' });
  }
});

// ========== RUTAS DE EQUIPOS ==========
// Obtener todos los equipos (con filtros por rol)
app.get('/api/equipos', auth, async (req, res) => {
  try {
    const { dojoId, categoriaId } = req.query;
    let query = {};

    // Senseis solo ven equipos de su dojo
    if (req.user.rol === 'sensei') {
      query.dojoId = req.user.dojo._id;
    } else if (dojoId) {
      query.dojoId = dojoId;
    }

    if (categoriaId) {
      query.categoriaId = categoriaId;
    }

    const equipos = await Equipo.find(query)
      .populate('categoriaId')
      .populate('dojoId')
      .populate('miembros')
      .populate('creadoPor', 'nombre')
      .sort({ nombre: 1 });

    res.json(equipos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener equipos' });
  }
});

// Obtener un equipo por ID
app.get('/api/equipos/:id', auth, async (req, res) => {
  try {
    const equipo = await Equipo.findById(req.params.id)
      .populate({
        path: 'categoriaId',
        populate: [
          { path: 'disciplinaId' },
          { path: 'rangoEdadId' }
        ]
      })
      .populate('dojoId')
      .populate('miembros')
      .populate('creadoPor', 'nombre');

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Verificar permisos
    if (req.user.rol === 'sensei' && equipo.dojoId._id.toString() !== req.user.dojo._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    res.json(equipo);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

// Crear equipo
app.post('/api/equipos', auth, async (req, res) => {
  try {
    let data = { ...req.body };

    // Senseis auto-asignan su dojo
    if (req.user.rol === 'sensei') {
      data.dojoId = req.user.dojo._id;
      data.creadoPor = req.user.id;
    }

    // Validar que la categoría existe
    const categoria = await Categoria.findById(data.categoriaId)
      .populate('disciplinaId')
      .populate('rangoEdadId');

    if (!categoria) {
      return res.status(400).json({ error: 'Categoría no encontrada' });
    }

    // Obtener configuración de máximo de miembros
    const configMaxMiembros = await Configuracion.findOne({ clave: 'maxMiembrosEquipo' });
    const maxMiembros = configMaxMiembros ? configMaxMiembros.valor : 3;

    // Inicializar miembros como array vacío si no se proporciona
    if (!data.miembros) {
      data.miembros = [];
    }

    // Validar número de miembros (ahora permitimos equipos vacíos)
    if (data.miembros.length > maxMiembros) {
      return res.status(400).json({ error: `El equipo no puede tener más de ${maxMiembros} miembros` });
    }

    // Solo validar miembros si hay alguno
    if (data.miembros.length > 0) {
      // Validar que no hay miembros duplicados
      const miembrosUnicos = [...new Set(data.miembros.map(m => m.toString()))];
      if (miembrosUnicos.length !== data.miembros.length) {
        return res.status(400).json({ error: 'No se pueden agregar participantes duplicados al equipo' });
      }

      // Obtener información de los participantes
      const participantes = await Participante.find({ _id: { $in: data.miembros } });

      if (participantes.length !== data.miembros.length) {
        return res.status(400).json({ error: 'Uno o más participantes no existen' });
      }

      // Validar que todos los participantes pertenecen al mismo dojo
      const dojoIds = [...new Set(participantes.map(p => p.dojoId.toString()))];
      if (dojoIds.length > 1 || dojoIds[0] !== data.dojoId.toString()) {
        return res.status(400).json({ error: 'Todos los participantes deben pertenecer al mismo dojo del equipo' });
      }

      // Validar elegibilidad por edad
      const rangoEdad = categoria.rangoEdadId;
      for (const participante of participantes) {
        if (participante.edad < rangoEdad.edadMin || participante.edad > rangoEdad.edadMax) {
          return res.status(400).json({
            error: `El participante ${participante.nombre} (edad ${participante.edad}) no es elegible para la categoría ${categoria.nombre} (${rangoEdad.nombre} años)`
          });
        }
      }

      // Validar género según la categoría
      if (categoria.genero !== 'Mixto') {
        const generosInvalidos = participantes.filter(p => p.genero !== categoria.genero);
        if (generosInvalidos.length > 0) {
          return res.status(400).json({
            error: `Todos los participantes deben ser de género ${categoria.genero} para esta categoría`
          });
        }
      }

      // Verificar que los participantes no estén ya en otro equipo de la misma categoría
      const equiposExistentes = await Equipo.find({
        categoriaId: data.categoriaId,
        miembros: { $in: data.miembros }
      }).populate('miembros');

      if (equiposExistentes.length > 0) {
        const participanteOcupado = equiposExistentes[0].miembros.find(m =>
          data.miembros.includes(m._id.toString())
        );
        return res.status(400).json({
          error: `El participante ${participanteOcupado.nombre} ya está en otro equipo de la categoría ${categoria.nombre}`
        });
      }
    }

    // Generar número de equipo automático para el dojo
    const equiposDelDojo = await Equipo.countDocuments({
      dojoId: data.dojoId,
      categoriaId: data.categoriaId
    });
    data.numeroEquipo = equiposDelDojo + 1;

    // Crear el equipo
    const equipo = new Equipo(data);
    await equipo.save();

    const populated = await Equipo.findById(equipo._id)
      .populate({
        path: 'categoriaId',
        populate: [
          { path: 'disciplinaId' },
          { path: 'rangoEdadId' }
        ]
      })
      .populate('dojoId')
      .populate('miembros')
      .populate('creadoPor', 'nombre');

    res.status(201).json(populated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Ya existe un equipo con ese nombre en este dojo' });
    }
    res.status(400).json({ error: error.message });
  }
});

// Actualizar equipo
app.put('/api/equipos/:id', auth, async (req, res) => {
  try {
    const equipoExistente = await Equipo.findById(req.params.id);

    if (!equipoExistente) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Verificar permisos
    if (req.user.rol === 'sensei' && equipoExistente.dojoId.toString() !== req.user.dojo._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    let data = { ...req.body };

    // Senseis no pueden cambiar el dojo
    if (req.user.rol === 'sensei') {
      data.dojoId = req.user.dojo._id;
    }

    // Si se actualizan los miembros, realizar validaciones
    if (data.miembros) {
      // Validar que la categoría existe
      const categoriaId = data.categoriaId || equipoExistente.categoriaId;
      const categoria = await Categoria.findById(categoriaId)
        .populate('disciplinaId')
        .populate('rangoEdadId');

      if (!categoria) {
        return res.status(400).json({ error: 'Categoría no encontrada' });
      }

      // Obtener configuración de máximo de miembros
      const configMaxMiembros = await Configuracion.findOne({ clave: 'maxMiembrosEquipo' });
      const maxMiembros = configMaxMiembros ? configMaxMiembros.valor : 3;

      // Validar número de miembros (ahora permitimos equipos vacíos)
      if (data.miembros.length > maxMiembros) {
        return res.status(400).json({ error: `El equipo no puede tener más de ${maxMiembros} miembros` });
      }

      // Solo validar miembros si hay alguno
      if (data.miembros.length > 0) {
        // Validar que no hay miembros duplicados
        const miembrosUnicos = [...new Set(data.miembros.map(m => m.toString()))];
        if (miembrosUnicos.length !== data.miembros.length) {
          return res.status(400).json({ error: 'No se pueden agregar participantes duplicados al equipo' });
        }

        // Obtener información de los participantes
        const participantes = await Participante.find({ _id: { $in: data.miembros } });

        if (participantes.length !== data.miembros.length) {
          return res.status(400).json({ error: 'Uno o más participantes no existen' });
        }

        const dojoId = data.dojoId || equipoExistente.dojoId;

        // Validar que todos los participantes pertenecen al mismo dojo
        const dojoIds = [...new Set(participantes.map(p => p.dojoId.toString()))];
        if (dojoIds.length > 1 || dojoIds[0] !== dojoId.toString()) {
          return res.status(400).json({ error: 'Todos los participantes deben pertenecer al mismo dojo del equipo' });
        }

        // Validar elegibilidad por edad
        const rangoEdad = categoria.rangoEdadId;
        for (const participante of participantes) {
          if (participante.edad < rangoEdad.edadMin || participante.edad > rangoEdad.edadMax) {
            return res.status(400).json({
              error: `El participante ${participante.nombre} (edad ${participante.edad}) no es elegible para la categoría ${categoria.nombre} (${rangoEdad.nombre} años)`
            });
          }
        }

        // Validar género según la categoría
        if (categoria.genero !== 'Mixto') {
          const generosInvalidos = participantes.filter(p => p.genero !== categoria.genero);
          if (generosInvalidos.length > 0) {
            return res.status(400).json({
              error: `Todos los participantes deben ser de género ${categoria.genero} para esta categoría`
            });
          }
        }

        // Verificar que los participantes no estén en otro equipo de la misma categoría (excepto este equipo)
        const equiposExistentes = await Equipo.find({
          _id: { $ne: req.params.id },
          categoriaId: categoriaId,
          miembros: { $in: data.miembros }
        }).populate('miembros');

        if (equiposExistentes.length > 0) {
          const participanteOcupado = equiposExistentes[0].miembros.find(m =>
            data.miembros.includes(m._id.toString())
          );
          return res.status(400).json({
            error: `El participante ${participanteOcupado.nombre} ya está en otro equipo de la categoría ${categoria.nombre}`
          });
        }
      }
    }

    // Activación/desactivación automática según cantidad de miembros
    if (data.miembros !== undefined) {
      const configMinMiembros = await Configuracion.findOne({ clave: 'minMiembrosEquipo' });
      const minMiembros = configMinMiembros ? configMinMiembros.valor : 3;

      // Si cumple el mínimo de miembros, activar automáticamente
      if (data.miembros.length >= minMiembros) {
        data.estado = 'activo';
      } else {
        // Si no cumple el mínimo, desactivar automáticamente
        data.estado = 'borrador';
      }
    }

    const updated = await Equipo.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate({
        path: 'categoriaId',
        populate: [
          { path: 'disciplinaId' },
          { path: 'rangoEdadId' }
        ]
      })
      .populate('dojoId')
      .populate('miembros')
      .populate('creadoPor', 'nombre');

    res.json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Ya existe un equipo con ese nombre en este dojo' });
    }
    res.status(400).json({ error: error.message });
  }
});

// Eliminar equipo
app.delete('/api/equipos/:id', auth, async (req, res) => {
  try {
    const equipo = await Equipo.findById(req.params.id);

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Verificar permisos
    if (req.user.rol === 'sensei' && equipo.dojoId.toString() !== req.user.dojo._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await Equipo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Equipo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar equipo' });
  }
});

// ========== ENDPOINTS ESPECIALES ==========
// Obtener participantes disponibles para una categoría (con filtros)
app.get('/api/participantes-disponibles', auth, async (req, res) => {
  try {
    const { categoriaId, equipoId, nombre, edad, genero, grado } = req.query;

    if (!categoriaId) {
      return res.status(400).json({ error: 'Se requiere categoriaId' });
    }

    // Obtener la categoría
    const categoria = await Categoria.findById(categoriaId)
      .populate('disciplinaId')
      .populate('rangoEdadId');

    if (!categoria) {
      return res.status(400).json({ error: 'Categoría no encontrada' });
    }

    // Construir query base
    let query = {};

    // Filtrar por dojo según rol
    if (req.user.rol === 'sensei') {
      query.dojoId = req.user.dojo._id;
    } else if (req.query.dojoId) {
      query.dojoId = req.query.dojoId;
    }

    // Aplicar filtros de búsqueda
    if (nombre) {
      query.nombre = { $regex: nombre, $options: 'i' };
    }

    if (genero) {
      query.genero = genero;
    }

    if (grado) {
      query.grado = grado;
    }

    // Filtrar por elegibilidad de edad (siempre aplicar el rango de la categoría)
    const rangoEdad = categoria.rangoEdadId;

    // Si se especifica una edad exacta, validar que esté dentro del rango
    if (edad) {
      const edadNum = parseInt(edad);
      if (edadNum >= rangoEdad.edadMin && edadNum <= rangoEdad.edadMax) {
        query.edad = edadNum;
      } else {
        // Si la edad especificada está fuera del rango, no devolver ningún resultado
        return res.json([]);
      }
    } else {
      // Si no se especifica edad, aplicar el rango completo
      query.edad = {
        $gte: rangoEdad.edadMin,
        $lte: rangoEdad.edadMax
      };
    }

    // Filtrar por género si la categoría lo requiere
    if (categoria.genero !== 'Mixto') {
      query.genero = categoria.genero;
    }

    // Obtener todos los participantes que cumplen los criterios básicos
    const participantes = await Participante.find(query)
      .populate('dojoId')
      .sort({ nombre: 1 });

    // Obtener equipos existentes en esta categoría
    const equiposEnCategoria = await Equipo.find({
      categoriaId,
      ...(equipoId && { _id: { $ne: equipoId } }) // Excluir el equipo actual si estamos editando
    });

    // Crear set de IDs de participantes ya ocupados
    const participantesOcupados = new Set();
    equiposEnCategoria.forEach(equipo => {
      equipo.miembros.forEach(miembroId => {
        participantesOcupados.add(miembroId.toString());
      });
    });

    // Filtrar participantes disponibles
    const disponibles = participantes.filter(p => !participantesOcupados.has(p._id.toString()));

    res.json(disponibles);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener participantes disponibles' });
  }
});

// Panel general: obtener todas las categorías con sus equipos
app.get('/api/panel-general', auth, async (req, res) => {
  try {
    let dojoFilter = {};

    // Senseis solo ven su dojo
    if (req.user.rol === 'sensei') {
      dojoFilter = { dojoId: req.user.dojo._id };
    } else if (req.query.dojoId) {
      dojoFilter = { dojoId: req.query.dojoId };
    }

    const categorias = await Categoria.find({ activo: true })
      .populate('disciplinaId')
      .populate('rangoEdadId')
      .sort({ nombre: 1 });

    const resultado = await Promise.all(categorias.map(async (categoria) => {
      const equipos = await Equipo.find({
        categoriaId: categoria._id,
        ...dojoFilter
      })
        .populate('dojoId')
        .populate('miembros')
        .populate('creadoPor', 'nombre')
        .sort({ numeroEquipo: 1 });

      return {
        categoria: {
          _id: categoria._id,
          nombre: categoria.nombre,
          disciplina: categoria.disciplinaId,
          rangoEdad: categoria.rangoEdadId,
          genero: categoria.genero
        },
        equipos: equipos.map(equipo => ({
          _id: equipo._id,
          nombre: equipo.nombre,
          numeroEquipo: equipo.numeroEquipo,
          dojo: equipo.dojoId,
          miembros: equipo.miembros,
          creadoPor: equipo.creadoPor
        })),
        totalEquipos: equipos.length,
        totalParticipantes: equipos.reduce((sum, eq) => sum + eq.miembros.length, 0)
      };
    }));

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener panel general' });
  }
});

// ============================================
// FUNCIONES AUXILIARES PARA BRACKETS
// ============================================

// Función para obtener la próxima potencia de 2
function getNextPowerOf2(n) {
  let power = 1;
  while (power < n) {
    power *= 2;
  }
  return power;
}

// Función para determinar el nombre de la ronda
function getNombreRonda(numeroRonda, totalRondas) {
  const rondasFaltantes = totalRondas - numeroRonda + 1;
  if (rondasFaltantes === 1) return 'Final';
  if (rondasFaltantes === 2) return 'Semifinal';
  if (rondasFaltantes === 3) return 'Cuartos de Final';
  if (rondasFaltantes === 4) return 'Octavos de Final';
  return `Ronda ${numeroRonda}`;
}

// Algoritmo de generación de brackets con separación de dojos (PRIORIDAD ALTA)
function generarBracket(competidores, modalidad) {
  const totalCompetidores = competidores.length;
  const bracketSize = getNextPowerOf2(totalCompetidores);
  const totalByes = bracketSize - totalCompetidores;

  // Agrupar competidores por dojo
  const porDojo = {};
  competidores.forEach(comp => {
    const dojoId = comp.dojoId._id.toString();
    if (!porDojo[dojoId]) {
      porDojo[dojoId] = [];
    }
    porDojo[dojoId].push(comp);
  });

  const dojos = Object.keys(porDojo);

  // Estrategia: Distribuir competidores del mismo dojo en diferentes mitades del bracket
  // para evitar enfrentamientos tempranos
  let bracket = [];

  if (dojos.length === 1) {
    // Si todos son del mismo dojo, simplemente aleatorizar
    bracket = [...competidores].sort(() => Math.random() - 0.5);
  } else {
    // Distribuir competidores alternando entre dojos
    const competidoresPorDojo = dojos.map(dojoId => ({
      dojoId,
      competidores: [...porDojo[dojoId]].sort(() => Math.random() - 0.5)
    }));

    // Ordenar dojos por cantidad de competidores (mayor a menor)
    competidoresPorDojo.sort((a, b) => b.competidores.length - a.competidores.length);

    // Distribuir en serpiente: primera mitad y segunda mitad alternadas
    const mitad1 = [];
    const mitad2 = [];

    competidoresPorDojo.forEach((dojo, idx) => {
      dojo.competidores.forEach((comp, compIdx) => {
        // Alternar entre mitades para cada competidor del dojo
        if (compIdx % 2 === 0) {
          mitad1.push(comp);
        } else {
          mitad2.push(comp);
        }
      });
    });

    // Intercalar entre mitades
    bracket = [...mitad1, ...mitad2];
  }

  // Insertar byes de manera distribuida
  if (totalByes > 0) {
    const byesPositions = [];
    const step = Math.floor(bracket.length / totalByes) || 1;

    for (let i = 0; i < totalByes; i++) {
      byesPositions.push(i * step);
    }

    // Insertar byes en las posiciones calculadas
    byesPositions.reverse().forEach(pos => {
      bracket.splice(pos, 0, null); // null = bye
    });
  }

  // Generar rondas
  const totalRondas = Math.log2(bracketSize);
  const rondas = [];
  let numeroCombateGlobal = 1;

  // Primera ronda
  const primeraRonda = {
    numeroRonda: 1,
    nombreRonda: getNombreRonda(1, totalRondas),
    combates: []
  };

  for (let i = 0; i < bracket.length; i += 2) {
    const comp1 = bracket[i];
    const comp2 = bracket[i + 1];

    const combate = {
      numeroCombate: numeroCombateGlobal++,
      orden: primeraRonda.combates.length + 1,
      competidor1: comp1 ? {
        tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo',
        id: comp1._id,
        esBye: false
      } : {
        tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo',
        id: null,
        esBye: true
      },
      competidor2: comp2 ? {
        tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo',
        id: comp2._id,
        esBye: false
      } : {
        tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo',
        id: null,
        esBye: true
      },
      ganador: {},
      estado: 'pendiente'
    };

    // Si hay bye, establecer ganador automático
    if (!comp1 && comp2) {
      combate.ganador = { tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo', id: comp2._id };
      combate.estado = 'finalizado';
    } else if (comp1 && !comp2) {
      combate.ganador = { tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo', id: comp1._id };
      combate.estado = 'finalizado';
    }

    primeraRonda.combates.push(combate);
  }

  rondas.push(primeraRonda);

  // Rondas subsecuentes (vacías, se llenan con ganadores)
  for (let ronda = 2; ronda <= totalRondas; ronda++) {
    const combatesPorRonda = Math.pow(2, totalRondas - ronda);
    const rondaObj = {
      numeroRonda: ronda,
      nombreRonda: getNombreRonda(ronda, totalRondas),
      combates: []
    };

    for (let i = 0; i < combatesPorRonda; i++) {
      rondaObj.combates.push({
        numeroCombate: numeroCombateGlobal++,
        orden: i + 1,
        competidor1: { tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo', id: null, esBye: false },
        competidor2: { tipo: modalidad === 'Individual' ? 'Participante' : 'Equipo', id: null, esBye: false },
        ganador: {},
        estado: 'pendiente'
      });
    }

    rondas.push(rondaObj);
  }

  return rondas;
}

// Función para generar token público único
function generarTokenPublico() {
  return require('crypto').randomBytes(16).toString('hex');
}

// ============================================
// ENDPOINTS DE BRACKETS
// ============================================

// Generar brackets para todas las categorías (solo admin)
app.post('/api/brackets/generar', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden generar brackets' });
    }

    const categorias = await Categoria.find({ activo: true })
      .populate('disciplinaId')
      .populate('rangoEdadId');

    const resultados = {
      generados: [],
      advertencias: [],
      errores: []
    };

    for (const categoria of categorias) {
      try {
        // Verificar si ya existe bracket para esta categoría
        const bracketExistente = await Bracket.findOne({ categoriaId: categoria._id });
        if (bracketExistente) {
          resultados.advertencias.push({
            categoria: categoria.nombre,
            mensaje: 'Ya existe un bracket para esta categoría'
          });
          continue;
        }

        let competidores = [];
        const modalidad = categoria.modalidad;

        // Obtener competidores según modalidad
        if (modalidad === 'Individual') {
          // Obtener participantes inscritos en la modalidad correcta
          const modalidadField = categoria.disciplinaId.codigo === 'kata-individual' ? 'kataIndividual' :
                                 categoria.disciplinaId.codigo === 'kumite-individual' ? 'kumiteIndividual' :
                                 'kihonIppon';

          const query = {
            [`modalidades.${modalidadField}`]: true,
            edad: { $gte: categoria.rangoEdadId.edadMin, $lte: categoria.rangoEdadId.edadMax }
          };

          // Filtrar por género si no es mixto
          if (categoria.genero !== 'Mixto') {
            query.genero = categoria.genero;
          }

          // Filtrar por nivel (grado) si aplica
          if (categoria.nivel === 'Novicio') {
            query.grado = { $in: ['10 Kyu', '9 Kyu', '8 Kyu', '7 Kyu'] };
          } else if (categoria.nivel === 'Avanzado') {
            query.grado = { $in: ['6 Kyu', '5 Kyu', '4 Kyu', '3 Kyu', '2 Kyu', '1 Kyu', 'Dan'] };
          }

          competidores = await Participante.find(query).populate('dojoId');
        } else if (modalidad === 'Equipos') {
          // Obtener equipos de la categoría
          competidores = await Equipo.find({
            categoriaId: categoria._id,
            estado: 'activo'
          }).populate('dojoId').populate('miembros');
        }

        // Validar número de competidores
        if (competidores.length === 0) {
          resultados.advertencias.push({
            categoria: categoria.nombre,
            mensaje: 'No hay competidores inscritos en esta categoría'
          });
          continue;
        }

        if (competidores.length === 1) {
          resultados.advertencias.push({
            categoria: categoria.nombre,
            mensaje: 'Solo hay 1 competidor inscrito',
            competidor: modalidad === 'Individual' ? competidores[0].nombre : competidores[0].nombre
          });
          continue;
        }

        // Generar bracket
        const rondas = generarBracket(competidores, modalidad);

        const bracket = await Bracket.create({
          categoriaId: categoria._id,
          modalidad,
          tokenPublico: generarTokenPublico(),
          rondas,
          totalCompetidores: competidores.length,
          estado: 'generado',
          creadoPor: req.user._id
        });

        resultados.generados.push({
          categoria: categoria.nombre,
          bracketId: bracket._id,
          competidores: competidores.length,
          rondas: rondas.length
        });

      } catch (error) {
        resultados.errores.push({
          categoria: categoria.nombre,
          error: error.message
        });
      }
    }

    res.json(resultados);

  } catch (error) {
    res.status(500).json({ error: 'Error al generar brackets' });
  }
});

// Listar todos los brackets
app.get('/api/brackets', auth, async (req, res) => {
  try {
    const query = {};

    // Si es sensei, filtrar por brackets donde participan sus atletas
    if (req.user.rol === 'sensei') {
      // Obtener categorías donde participan sus atletas/equipos
      const participantesIds = await Participante.find({ dojoId: req.user.dojoId }).distinct('_id');
      const equiposIds = await Equipo.find({ dojoId: req.user.dojoId }).distinct('_id');

      // Buscar brackets que contengan estos IDs en sus rondas
      const brackets = await Bracket.find()
        .populate({
          path: 'categoriaId',
          populate: [
            { path: 'disciplinaId' },
            { path: 'rangoEdadId' }
          ]
        })
        .lean();

      // Filtrar brackets donde participan
      const bracketsFiltered = brackets.filter(bracket => {
        return bracket.rondas.some(ronda =>
          ronda.combates.some(combate => {
            const comp1Id = combate.competidor1?.id?.toString();
            const comp2Id = combate.competidor2?.id?.toString();

            if (bracket.modalidad === 'Individual') {
              return participantesIds.some(pid =>
                pid.toString() === comp1Id || pid.toString() === comp2Id
              );
            } else {
              return equiposIds.some(eid =>
                eid.toString() === comp1Id || eid.toString() === comp2Id
              );
            }
          })
        );
      });

      return res.json(bracketsFiltered);
    }

    // Admin ve todos
    const brackets = await Bracket.find(query)
      .populate({
        path: 'categoriaId',
        populate: [
          { path: 'disciplinaId' },
          { path: 'rangoEdadId' }
        ]
      })
      .sort({ createdAt: -1 });

    res.json(brackets);

  } catch (error) {
    res.status(500).json({ error: 'Error al obtener brackets' });
  }
});

// Obtener bracket específico con población completa
app.get('/api/brackets/:id', auth, async (req, res) => {
  try {
    const bracket = await Bracket.findById(req.params.id)
      .populate({
        path: 'categoriaId',
        populate: [
          { path: 'disciplinaId' },
          { path: 'rangoEdadId' }
        ]
      })
      .lean();

    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    // Poblar competidores en cada combate
    for (const ronda of bracket.rondas) {
      for (const combate of ronda.combates) {
        if (combate.competidor1?.id && !combate.competidor1.esBye) {
          if (bracket.modalidad === 'Individual') {
            combate.competidor1.datos = await Participante.findById(combate.competidor1.id).populate('dojoId').lean();
          } else {
            combate.competidor1.datos = await Equipo.findById(combate.competidor1.id).populate('dojoId').populate('miembros').lean();
          }
        }

        if (combate.competidor2?.id && !combate.competidor2.esBye) {
          if (bracket.modalidad === 'Individual') {
            combate.competidor2.datos = await Participante.findById(combate.competidor2.id).populate('dojoId').lean();
          } else {
            combate.competidor2.datos = await Equipo.findById(combate.competidor2.id).populate('dojoId').populate('miembros').lean();
          }
        }

        if (combate.ganador?.id) {
          if (bracket.modalidad === 'Individual') {
            combate.ganador.datos = await Participante.findById(combate.ganador.id).populate('dojoId').lean();
          } else {
            combate.ganador.datos = await Equipo.findById(combate.ganador.id).populate('dojoId').populate('miembros').lean();
          }
        }
      }
    }

    res.json(bracket);

  } catch (error) {
    res.status(500).json({ error: 'Error al obtener bracket' });
  }
});

// Actualizar resultado de combate
app.put('/api/brackets/:id/combate/:rondaNum/:combateNum', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden actualizar resultados' });
    }

    const { id, rondaNum, combateNum } = req.params;
    const { ganadorId, tatami, notas } = req.body;

    const bracket = await Bracket.findById(id);
    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    const ronda = bracket.rondas.find(r => r.numeroRonda === parseInt(rondaNum));
    if (!ronda) {
      return res.status(404).json({ error: 'Ronda no encontrada' });
    }

    const combate = ronda.combates.find(c => c.numeroCombate === parseInt(combateNum));
    if (!combate) {
      return res.status(404).json({ error: 'Combate no encontrado' });
    }

    // Actualizar ganador
    if (ganadorId) {
      combate.ganador = {
        tipo: bracket.modalidad,
        id: ganadorId
      };
      combate.estado = 'finalizado';

      // Avanzar ganador a siguiente ronda
      if (parseInt(rondaNum) < bracket.rondas.length) {
        const siguienteRonda = bracket.rondas.find(r => r.numeroRonda === parseInt(rondaNum) + 1);
        if (siguienteRonda) {
          const indiceCombateSiguiente = Math.floor((combate.orden - 1) / 2);
          const esPrimerCompetidor = (combate.orden - 1) % 2 === 0;

          if (siguienteRonda.combates[indiceCombateSiguiente]) {
            if (esPrimerCompetidor) {
              siguienteRonda.combates[indiceCombateSiguiente].competidor1 = {
                tipo: bracket.modalidad,
                id: ganadorId,
                esBye: false
              };
            } else {
              siguienteRonda.combates[indiceCombateSiguiente].competidor2 = {
                tipo: bracket.modalidad,
                id: ganadorId,
                esBye: false
              };
            }
          }
        }
      }
    }

    // Actualizar tatami y notas
    if (tatami !== undefined) combate.tatami = tatami;
    if (notas !== undefined) combate.notas = notas;

    // Verificar si todos los combates están finalizados
    const todosCombatesFinalizados = bracket.rondas.every(r =>
      r.combates.every(c => c.estado === 'finalizado')
    );

    if (todosCombatesFinalizados) {
      bracket.estado = 'finalizado';
    } else {
      bracket.estado = 'en_curso';
    }

    await bracket.save();

    res.json(bracket);

  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar combate' });
  }
});

// Eliminar bracket de una categoría para regenerar
app.delete('/api/brackets/:categoriaId', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden eliminar brackets' });
    }

    const bracket = await Bracket.findOne({ categoriaId: req.params.categoriaId });

    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    await Bracket.deleteOne({ _id: bracket._id });

    res.json({ message: 'Bracket eliminado correctamente' });

  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar bracket' });
  }
});

// Editar emparejamientos (intercambiar competidores)
app.put('/api/brackets/:id/emparejamientos', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden editar emparejamientos' });
    }

    const { intercambios } = req.body; // Array de {combate1: {ronda, combate, posicion}, combate2: {ronda, combate, posicion}}

    const bracket = await Bracket.findById(req.params.id);
    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    // Realizar intercambios
    for (const intercambio of intercambios) {
      const ronda1 = bracket.rondas.find(r => r.numeroRonda === intercambio.combate1.ronda);
      const combate1 = ronda1?.combates.find(c => c.numeroCombate === intercambio.combate1.combate);

      const ronda2 = bracket.rondas.find(r => r.numeroRonda === intercambio.combate2.ronda);
      const combate2 = ronda2?.combates.find(c => c.numeroCombate === intercambio.combate2.combate);

      if (combate1 && combate2) {
        const temp = combate1[intercambio.combate1.posicion];
        combate1[intercambio.combate1.posicion] = combate2[intercambio.combate2.posicion];
        combate2[intercambio.combate2.posicion] = temp;
      }
    }

    await bracket.save();

    res.json(bracket);

  } catch (error) {
    res.status(500).json({ error: 'Error al editar emparejamientos' });
  }
});

// Cambiar orden de combates
app.put('/api/brackets/:id/orden', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden cambiar el orden' });
    }

    const { rondaNum, nuevosOrdenes } = req.body; // nuevosOrdenes: [{numeroCombate, nuevoOrden}]

    const bracket = await Bracket.findById(req.params.id);
    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    const ronda = bracket.rondas.find(r => r.numeroRonda === rondaNum);
    if (!ronda) {
      return res.status(404).json({ error: 'Ronda no encontrada' });
    }

    // Actualizar órdenes
    for (const cambio of nuevosOrdenes) {
      const combate = ronda.combates.find(c => c.numeroCombate === cambio.numeroCombate);
      if (combate) {
        combate.orden = cambio.nuevoOrden;
      }
    }

    await bracket.save();

    res.json(bracket);

  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar orden de combates' });
  }
});

// Duplicar bracket a otra categoría
app.post('/api/brackets/:id/duplicar', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden duplicar brackets' });
    }

    const { categoriaIdDestino } = req.body;

    const bracketOriginal = await Bracket.findById(req.params.id).lean();
    if (!bracketOriginal) {
      return res.status(404).json({ error: 'Bracket original no encontrado' });
    }

    // Verificar que no exista bracket en categoría destino
    const existe = await Bracket.findOne({ categoriaId: categoriaIdDestino });
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un bracket en la categoría destino' });
    }

    // Crear copia con nueva categoría
    const nuevoBracket = {
      ...bracketOriginal,
      _id: undefined,
      categoriaId: categoriaIdDestino,
      tokenPublico: generarTokenPublico(),
      creadoPor: req.user._id
    };

    const bracketCreado = await Bracket.create(nuevoBracket);

    res.json(bracketCreado);

  } catch (error) {
    res.status(500).json({ error: 'Error al duplicar bracket' });
  }
});

// Resetear bracket (borrar todos los resultados)
app.put('/api/brackets/:id/resetear', auth, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden resetear brackets' });
    }

    const bracket = await Bracket.findById(req.params.id);
    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    // Resetear todos los combates (excepto byes automáticos)
    for (const ronda of bracket.rondas) {
      for (const combate of ronda.combates) {
        // Solo resetear si no es un bye automático
        if (!combate.competidor1.esBye && !combate.competidor2.esBye) {
          combate.ganador = {};
          combate.estado = 'pendiente';
          combate.tatami = undefined;
          combate.notas = undefined;
        }
      }
    }

    // Limpiar competidores de rondas posteriores a la primera
    for (let i = 1; i < bracket.rondas.length; i++) {
      for (const combate of bracket.rondas[i].combates) {
        combate.competidor1 = { tipo: bracket.modalidad, id: null, esBye: false };
        combate.competidor2 = { tipo: bracket.modalidad, id: null, esBye: false };
        combate.ganador = {};
        combate.estado = 'pendiente';
      }
    }

    bracket.estado = 'generado';
    await bracket.save();

    res.json(bracket);

  } catch (error) {
    res.status(500).json({ error: 'Error al resetear bracket' });
  }
});

// Obtener bracket público (sin autenticación, con token)
app.get('/api/brackets/publico/:token', async (req, res) => {
  try {
    const bracket = await Bracket.findOne({ tokenPublico: req.params.token })
      .populate({
        path: 'categoriaId',
        populate: [
          { path: 'disciplinaId' },
          { path: 'rangoEdadId' }
        ]
      })
      .lean();

    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    // Poblar competidores
    for (const ronda of bracket.rondas) {
      for (const combate of ronda.combates) {
        if (combate.competidor1?.id && !combate.competidor1.esBye) {
          if (bracket.modalidad === 'Individual') {
            combate.competidor1.datos = await Participante.findById(combate.competidor1.id).populate('dojoId').lean();
          } else {
            combate.competidor1.datos = await Equipo.findById(combate.competidor1.id).populate('dojoId').populate('miembros').lean();
          }
        }

        if (combate.competidor2?.id && !combate.competidor2.esBye) {
          if (bracket.modalidad === 'Individual') {
            combate.competidor2.datos = await Participante.findById(combate.competidor2.id).populate('dojoId').lean();
          } else {
            combate.competidor2.datos = await Equipo.findById(combate.competidor2.id).populate('dojoId').populate('miembros').lean();
          }
        }

        if (combate.ganador?.id) {
          if (bracket.modalidad === 'Individual') {
            combate.ganador.datos = await Participante.findById(combate.ganador.id).populate('dojoId').lean();
          } else {
            combate.ganador.datos = await Equipo.findById(combate.ganador.id).populate('dojoId').populate('miembros').lean();
          }
        }
      }
    }

    res.json(bracket);

  } catch (error) {
    res.status(500).json({ error: 'Error al obtener bracket público' });
  }
});

// Generar PDF del bracket
app.get('/api/brackets/:id/pdf', auth, async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const QRCode = require('qrcode');

    // Obtener bracket completo
    const bracket = await Bracket.findById(req.params.id)
      .populate({
        path: 'categoriaId',
        populate: [
          { path: 'disciplinaId' },
          { path: 'rangoEdadId' }
        ]
      })
      .lean();

    if (!bracket) {
      return res.status(404).json({ error: 'Bracket no encontrado' });
    }

    // Poblar competidores
    for (const ronda of bracket.rondas) {
      for (const combate of ronda.combates) {
        if (combate.competidor1?.id && !combate.competidor1.esBye) {
          if (bracket.modalidad === 'Individual') {
            combate.competidor1.datos = await Participante.findById(combate.competidor1.id).populate('dojoId').lean();
          } else {
            combate.competidor1.datos = await Equipo.findById(combate.competidor1.id).populate('dojoId').populate('miembros').lean();
          }
        }

        if (combate.competidor2?.id && !combate.competidor2.esBye) {
          if (bracket.modalidad === 'Individual') {
            combate.competidor2.datos = await Participante.findById(combate.competidor2.id).populate('dojoId').lean();
          } else {
            combate.competidor2.datos = await Equipo.findById(combate.competidor2.id).populate('dojoId').populate('miembros').lean();
          }
        }
      }
    }

    // Crear documento PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bracket-${bracket.categoriaId.nombre.replace(/ /g, '-')}.pdf`);

    // Pipe del PDF a la respuesta
    doc.pipe(res);

    // ============ ENCABEZADO ============
    doc.fontSize(20).font('Helvetica-Bold').text('⚔️ COPA SAMURAI 2025', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).text(bracket.categoriaId.nombre, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica')
       .text(`${bracket.categoriaId.disciplinaId.nombre} | ${bracket.categoriaId.rangoEdadId.nombre} años | ${bracket.categoriaId.genero}`, { align: 'center' });

    if (bracket.categoriaId.nivel !== 'Libre') {
      doc.fontSize(9).text(`Nivel: ${bracket.categoriaId.nivel}`, { align: 'center' });
    }

    doc.moveDown(0.5);
    doc.fontSize(9).text(`Modalidad: ${bracket.modalidad} | Total Competidores: ${bracket.totalCompetidores}`, { align: 'center' });

    // Línea separadora
    doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke();
    doc.moveDown(1.5);

    // ============ GENERAR QR CODE ============
    const urlPublica = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bracket/${bracket.tokenPublico}`;
    const qrDataUrl = await QRCode.toDataURL(urlPublica, { width: 80 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

    // Posicionar QR en esquina superior derecha
    doc.image(qrBuffer, 490, 40, { width: 60 });
    doc.fontSize(7).text('Escanea para', 490, 105, { width: 60, align: 'center' });
    doc.text('ver en línea', 490, 113, { width: 60, align: 'center' });

    // ============ LISTA DE COMBATES POR RONDA ============
    let yPosition = doc.y;

    for (const ronda of bracket.rondas) {
      // Verificar si necesitamos nueva página
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 40;
      }

      // Título de la ronda
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text(ronda.nombreRonda, 40, yPosition);

      yPosition += 25;
      doc.fontSize(10).font('Helvetica').fillColor('#000');

      // Dibujar tabla de combates
      for (const combate of ronda.combates) {
        // Verificar espacio para el combate
        if (yPosition > 720) {
          doc.addPage();
          yPosition = 40;
        }

        // Número de combate
        doc.fontSize(9).font('Helvetica-Bold')
           .text(`Combate #${combate.numeroCombate}`, 45, yPosition);

        if (combate.tatami) {
          doc.fontSize(8).font('Helvetica')
             .fillColor('#666')
             .text(`Tatami ${combate.tatami}`, 140, yPosition);
        }

        yPosition += 18;
        doc.fillColor('#000');

        // Rectángulo del combate
        const boxHeight = bracket.modalidad === 'Individual' ? 80 : 100;
        doc.rect(45, yPosition, 510, boxHeight).stroke();

        // Competidor 1
        let comp1Y = yPosition + 10;
        if (combate.competidor1?.datos) {
          const comp1 = combate.competidor1.datos;
          if (bracket.modalidad === 'Individual') {
            doc.fontSize(11).font('Helvetica-Bold').text(comp1.nombre, 55, comp1Y, { width: 200 });
            doc.fontSize(8).font('Helvetica')
               .text(`${comp1.dojoId.nombre} | ${comp1.grado} | ${comp1.edad} años`, 55, comp1Y + 15, { width: 200 });
          } else {
            doc.fontSize(11).font('Helvetica-Bold').text(comp1.nombre, 55, comp1Y, { width: 200 });
            doc.fontSize(8).font('Helvetica')
               .text(`${comp1.dojoId.nombre} | Equipo #${comp1.numeroEquipo}`, 55, comp1Y + 15, { width: 200 });
            const miembrosNombres = comp1.miembros.map(m => m.nombre).join(', ');
            doc.fontSize(7).text(`Integrantes: ${miembrosNombres}`, 55, comp1Y + 28, { width: 200 });
          }
        } else if (combate.competidor1?.esBye) {
          doc.fontSize(10).font('Helvetica-Oblique').fillColor('#999').text('BYE', 55, comp1Y);
          doc.fillColor('#000');
        } else {
          doc.fontSize(9).font('Helvetica-Oblique').fillColor('#999').text('(Por definir)', 55, comp1Y);
          doc.fillColor('#000');
        }

        // VS
        doc.fontSize(14).font('Helvetica-Bold').text('VS', 265, yPosition + 30, { width: 40, align: 'center' });

        // Competidor 2
        let comp2Y = yPosition + 10;
        if (combate.competidor2?.datos) {
          const comp2 = combate.competidor2.datos;
          if (bracket.modalidad === 'Individual') {
            doc.fontSize(11).font('Helvetica-Bold').text(comp2.nombre, 320, comp2Y, { width: 200 });
            doc.fontSize(8).font('Helvetica')
               .text(`${comp2.dojoId.nombre} | ${comp2.grado} | ${comp2.edad} años`, 320, comp2Y + 15, { width: 200 });
          } else {
            doc.fontSize(11).font('Helvetica-Bold').text(comp2.nombre, 320, comp2Y, { width: 200 });
            doc.fontSize(8).font('Helvetica')
               .text(`${comp2.dojoId.nombre} | Equipo #${comp2.numeroEquipo}`, 320, comp2Y + 15, { width: 200 });
            const miembrosNombres = comp2.miembros.map(m => m.nombre).join(', ');
            doc.fontSize(7).text(`Integrantes: ${miembrosNombres}`, 320, comp2Y + 28, { width: 200 });
          }
        } else if (combate.competidor2?.esBye) {
          doc.fontSize(10).font('Helvetica-Oblique').fillColor('#999').text('BYE', 320, comp2Y);
          doc.fillColor('#000');
        } else {
          doc.fontSize(9).font('Helvetica-Oblique').fillColor('#999').text('(Por definir)', 320, comp2Y);
          doc.fillColor('#000');
        }

        // Espacio para resultado
        const resultY = yPosition + boxHeight - 25;
        doc.fontSize(8).font('Helvetica').fillColor('#666')
           .text('Ganador:', 55, resultY);
        doc.rect(105, resultY - 2, 150, 15).stroke();

        doc.text('Firma Juez:', 270, resultY);
        doc.rect(325, resultY - 2, 150, 15).stroke();

        doc.fillColor('#000');

        yPosition += boxHeight + 15;
      }

      yPosition += 10;
    }

    // ============ PIE DE PÁGINA ============
    const numPages = doc.bufferedPageRange().count;
    for (let i = 0; i < numPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font('Helvetica').fillColor('#999')
         .text(`Copa Samurai 2025 | Generado: ${new Date().toLocaleDateString('es-ES')} | Página ${i + 1} de ${numPages}`,
               40, 780, { align: 'center', width: 515 });
    }

    // Finalizar PDF
    doc.end();

  } catch (error) {
    console.error('Error generando PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar PDF' });
    }
  }
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ message: '⚔️ Copa Samurai 2025 API - Backend funcionando correctamente' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Copa Samurai 2025 API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});