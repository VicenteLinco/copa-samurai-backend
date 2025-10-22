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

// Schema para Categorías (combinación de disciplina + rango + género)
const categoriaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true }, // auto-generado: "Kata Mixto 12-15"
  disciplinaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disciplina', required: true },
  rangoEdadId: { type: mongoose.Schema.Types.ObjectId, ref: 'RangoEdad', required: true },
  genero: { type: String, enum: ['Masculino', 'Femenino', 'Mixto'] },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

// Índice único para evitar categorías duplicadas
categoriaSchema.index({ disciplinaId: 1, rangoEdadId: 1, genero: 1 }, { unique: true });

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

const Dojo = mongoose.model('Dojo', dojoSchema);
const Sensei = mongoose.model('Sensei', senseiSchema);
const Participante = mongoose.model('Participante', participanteSchema);
const RangoEdad = mongoose.model('RangoEdad', rangoEdadSchema);
const Disciplina = mongoose.model('Disciplina', disciplinaSchema);
const Categoria = mongoose.model('Categoria', categoriaSchema);
const Equipo = mongoose.model('Equipo', equipoSchema);
const Configuracion = mongoose.model('Configuracion', configuracionSchema);

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

    // Inicializar Disciplinas
    const disciplinasDefault = [
      { nombre: 'Kata Equipos', codigo: 'kata', requiereGenero: false, mixto: true },
      { nombre: 'Kumite Equipos', codigo: 'kumite', requiereGenero: true, mixto: false }
    ];

    for (const disc of disciplinasDefault) {
      const existe = await Disciplina.findOne({ codigo: disc.codigo });
      if (!existe) {
        await Disciplina.create(disc);
        console.log(`✅ Disciplina creada: ${disc.nombre}`);
      }
    }

    // Inicializar Rangos de Edad
    const rangosDefault = [
      { nombre: '0-11', edadMin: 0, edadMax: 11 },
      { nombre: '12-15', edadMin: 12, edadMax: 15 },
      { nombre: '16-19', edadMin: 16, edadMax: 19 },
      { nombre: '20-39', edadMin: 20, edadMax: 39 },
      { nombre: '40+', edadMin: 40, edadMax: 150 },
      { nombre: '11-13', edadMin: 11, edadMax: 13 },
      { nombre: '14-16', edadMin: 14, edadMax: 16 },
      { nombre: '17-19', edadMin: 17, edadMax: 19 }
    ];

    for (const rango of rangosDefault) {
      const existe = await RangoEdad.findOne({ nombre: rango.nombre });
      if (!existe) {
        await RangoEdad.create(rango);
        console.log(`✅ Rango de edad creado: ${rango.nombre}`);
      }
    }

    // Inicializar Categorías
    const kata = await Disciplina.findOne({ codigo: 'kata' });
    const kumite = await Disciplina.findOne({ codigo: 'kumite' });

    if (kata) {
      const rangosKata = await RangoEdad.find({
        nombre: { $in: ['0-11', '12-15', '16-19', '20-39', '40+'] }
      });

      for (const rango of rangosKata) {
        const existe = await Categoria.findOne({
          disciplinaId: kata._id,
          rangoEdadId: rango._id,
          genero: 'Mixto'
        });

        if (!existe) {
          await Categoria.create({
            nombre: `Kata Mixto ${rango.nombre}`,
            disciplinaId: kata._id,
            rangoEdadId: rango._id,
            genero: 'Mixto'
          });
          console.log(`✅ Categoría creada: Kata Mixto ${rango.nombre}`);
        }
      }
    }

    if (kumite) {
      const rangosKumite = await RangoEdad.find({
        nombre: { $in: ['11-13', '14-16', '17-19', '20-39', '40+'] }
      });

      for (const rango of rangosKumite) {
        for (const genero of ['Masculino', 'Femenino']) {
          const existe = await Categoria.findOne({
            disciplinaId: kumite._id,
            rangoEdadId: rango._id,
            genero
          });

          if (!existe) {
            await Categoria.create({
              nombre: `Kumite ${genero === 'Masculino' ? 'Varones' : 'Damas'} ${rango.nombre}`,
              disciplinaId: kumite._id,
              rangoEdadId: rango._id,
              genero
            });
            console.log(`✅ Categoría creada: Kumite ${genero === 'Masculino' ? 'Varones' : 'Damas'} ${rango.nombre}`);
          }
        }
      }
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

// Activar/Completar equipo (cambiar de borrador a activo)
app.post('/api/equipos/:id/activar', auth, async (req, res) => {
  try {
    const equipo = await Equipo.findById(req.params.id)
      .populate('categoriaId')
      .populate('miembros');

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Verificar permisos
    if (req.user.rol === 'sensei' && equipo.dojoId.toString() !== req.user.dojo._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Verificar que no esté ya activo
    if (equipo.estado === 'activo') {
      return res.status(400).json({ error: 'El equipo ya está activo' });
    }

    // Obtener configuración de mínimo de miembros
    const configMinMiembros = await Configuracion.findOne({ clave: 'minMiembrosEquipo' });
    const minMiembros = configMinMiembros ? configMinMiembros.valor : 3;

    // Validar que tenga el mínimo de miembros
    if (equipo.miembros.length < minMiembros) {
      return res.status(400).json({
        error: `Para activar el equipo debe tener al menos ${minMiembros} miembros. Actualmente tiene ${equipo.miembros.length}.`
      });
    }

    // Activar equipo
    equipo.estado = 'activo';
    await equipo.save();

    const updated = await Equipo.findById(equipo._id)
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
    res.status(500).json({ error: 'Error al activar equipo' });
  }
});

// Desactivar equipo (cambiar de activo a borrador)
app.post('/api/equipos/:id/desactivar', auth, async (req, res) => {
  try {
    const equipo = await Equipo.findById(req.params.id);

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Verificar permisos
    if (req.user.rol === 'sensei' && equipo.dojoId.toString() !== req.user.dojo._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Verificar que esté activo
    if (equipo.estado === 'borrador') {
      return res.status(400).json({ error: 'El equipo ya está en borrador' });
    }

    // Desactivar equipo
    equipo.estado = 'borrador';
    await equipo.save();

    const updated = await Equipo.findById(equipo._id)
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
    res.status(500).json({ error: 'Error al desactivar equipo' });
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

    if (edad) {
      query.edad = parseInt(edad);
    }

    if (genero) {
      query.genero = genero;
    }

    if (grado) {
      query.grado = grado;
    }

    // Filtrar por elegibilidad de edad
    const rangoEdad = categoria.rangoEdadId;
    query.edad = {
      ...query.edad,
      $gte: rangoEdad.edadMin,
      $lte: rangoEdad.edadMax
    };

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