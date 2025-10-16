const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://copa-samurai-frontend.vercel.app'],
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copa-samurai')
  .then(() => console.log('✅ MongoDB conectado'))
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
  nombre: { type: String, required: true, trim: true, maxlength: 100 },
  edad: { type: Number, required: true, min: 1, max: 100 },
  genero: { type: String, required: true, enum: ['Masculino', 'Femenino'] },
  grado: { type: String, required: true, enum: ['10 Kyu', '9 Kyu', '8 Kyu', '7 Kyu', '6 Kyu', '5 Kyu', '4 Kyu', '3 Kyu', '2 Kyu', '1 Kyu', 'Dan'] },
  dojoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dojo', required: true },
  modalidades: {
    kataIndividual: { type: Boolean, default: false },
    kataEquipos: { type: Boolean, default: false },
    kumiteIndividual: { type: Boolean, default: false },
    kumiteEquipos: { type: Boolean, default: false },
    kihonIppon: { type: Boolean, default: false }
  },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Sensei' }
}, { timestamps: true });

const Dojo = mongoose.model('Dojo', dojoSchema);
const Sensei = mongoose.model('Sensei', senseiSchema);
const Participante = mongoose.model('Participante', participanteSchema);

// Middleware de autenticación
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key-copa-samurai-2025');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Por favor autentícate' });
  }
};

// Middleware admin only
const adminOnly = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores' });
  }
  next();
};

// Inicializar admin por defecto
const initAdmin = async () => {
  try {
    const adminExists = await Sensei.findOne({ usuario: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const dojo = await Dojo.findOne() || await Dojo.create({ nombre: 'Admin Dojo', ubicacion: 'Central' });
      await Sensei.create({
        nombre: 'Administrador',
        usuario: 'admin',
        password: hashedPassword,
        dojoId: dojo._id,
        rol: 'admin'
      });
      console.log('✅ Usuario admin creado');
    }
  } catch (error) {
    console.error('Error al crear admin:', error);
  }
};

initAdmin();

// ==================== RUTAS DE AUTENTICACIÓN ====================

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    const sensei = await Sensei.findOne({ usuario }).populate('dojoId');
    if (!sensei) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    
    const isMatch = await bcrypt.compare(password, sensei.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    
    const token = jwt.sign(
      { 
        id: sensei._id, 
        usuario: sensei.usuario, 
        rol: sensei.rol,
        nombre: sensei.nombre,
        dojoId: sensei.dojoId._id
      },
      process.env.JWT_SECRET || 'secret-key-copa-samurai-2025',
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: {
        id: sensei._id,
        nombre: sensei.nombre,
        usuario: sensei.usuario,
        rol: sensei.rol,
        dojo: sensei.dojoId
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ==================== RUTAS DE DOJOS ====================

app.get('/api/dojos', auth, async (req, res) => {
  try {
    const dojos = await Dojo.find().sort({ nombre: 1 });
    res.json(dojos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener dojos' });
  }
});

app.post('/api/dojos', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, ubicacion } = req.body;
    
    if (!nombre?.trim() || !ubicacion?.trim()) {
      return res.status(400).json({ error: 'Nombre y ubicación son obligatorios' });
    }
    
    const dojo = new Dojo({ nombre: nombre.trim(), ubicacion: ubicacion.trim() });
    await dojo.save();
    res.status(201).json(dojo);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear dojo' });
  }
});

app.put('/api/dojos/:id', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, ubicacion } = req.body;
    
    if (!nombre?.trim() || !ubicacion?.trim()) {
      return res.status(400).json({ error: 'Nombre y ubicación son obligatorios' });
    }
    
    const dojo = await Dojo.findByIdAndUpdate(
      req.params.id,
      { nombre: nombre.trim(), ubicacion: ubicacion.trim() },
      { new: true, runValidators: true }
    );
    
    if (!dojo) {
      return res.status(404).json({ error: 'Dojo no encontrado' });
    }
    
    res.json(dojo);
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar dojo' });
  }
});

app.delete('/api/dojos/:id', auth, adminOnly, async (req, res) => {
  try {
    const dojo = await Dojo.findByIdAndDelete(req.params.id);
    if (!dojo) {
      return res.status(404).json({ error: 'Dojo no encontrado' });
    }
    res.json({ message: 'Dojo eliminado correctamente' });
  } catch (error) {
    res.status(400).json({ error: 'Error al eliminar dojo' });
  }
});

// ==================== RUTAS DE SENSEIS ====================

app.get('/api/senseis', auth, adminOnly, async (req, res) => {
  try {
    const senseis = await Sensei.find({ rol: 'sensei' }).populate('dojoId').sort({ nombre: 1 });
    res.json(senseis);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener senseis' });
  }
});

app.post('/api/senseis', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, usuario, password, dojoId } = req.body;
    
    if (!nombre?.trim() || !usuario?.trim() || !password || !dojoId) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    
    const existeUsuario = await Sensei.findOne({ usuario: usuario.trim() });
    if (existeUsuario) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const sensei = new Sensei({
      nombre: nombre.trim(),
      usuario: usuario.trim(),
      password: hashedPassword,
      dojoId,
      rol: 'sensei'
    });
    
    await sensei.save();
    const senseiPopulated = await Sensei.findById(sensei._id).populate('dojoId');
    res.status(201).json(senseiPopulated);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear sensei' });
  }
});

app.put('/api/senseis/:id', auth, adminOnly, async (req, res) => {
  try {
    const { nombre, usuario, password, dojoId } = req.body;
    
    if (!nombre?.trim() || !usuario?.trim() || !dojoId) {
      return res.status(400).json({ error: 'Nombre, usuario y dojo son obligatorios' });
    }
    
    const existeUsuario = await Sensei.findOne({ 
      usuario: usuario.trim(), 
      _id: { $ne: req.params.id } 
    });
    
    if (existeUsuario) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    
    const updateData = {
      nombre: nombre.trim(),
      usuario: usuario.trim(),
      dojoId
    };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    const sensei = await Sensei.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('dojoId');
    
    if (!sensei) {
      return res.status(404).json({ error: 'Sensei no encontrado' });
    }
    
    res.json(sensei);
  } catch (error) {
    res.status(400).json({ error: 'Error al actualizar sensei' });
  }
});

app.delete('/api/senseis/:id', auth, adminOnly, async (req, res) => {
  try {
    const sensei = await Sensei.findByIdAndDelete(req.params.id);
    if (!sensei) {
      return res.status(404).json({ error: 'Sensei no encontrado' });
    }
    res.json({ message: 'Sensei eliminado correctamente' });
  } catch (error) {
    res.status(400).json({ error: 'Error al eliminar sensei' });
  }
});

// ==================== RUTAS DE PARTICIPANTES ====================

app.get('/api/participantes', auth, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.rol === 'sensei') {
      query.creadoPor = req.user.id;
    }
    
    if (req.query.dojoId && req.user.rol === 'admin') {
      query.dojoId = req.query.dojoId;
    }
    
    if (req.query.search) {
      query.nombre = { $regex: req.query.search, $options: 'i' };
    }
    
    const participantes = await Participante.find(query)
      .populate('dojoId')
      .sort({ nombre: 1 });
    
    res.json(participantes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener participantes' });
  }
});

app.post('/api/participantes', auth, async (req, res) => {
  try {
    const { nombre, edad, genero, grado, dojoId, modalidades } = req.body;
    
    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!edad || edad < 1 || edad > 100) {
      return res.status(400).json({ error: 'La edad debe estar entre 1 y 100' });
    }
    if (!genero) {
      return res.status(400).json({ error: 'El género es obligatorio' });
    }
    if (!grado) {
      return res.status(400).json({ error: 'El grado es obligatorio' });
    }
    
    const { kataIndividual, kataEquipos, kumiteIndividual, kumiteEquipos, kihonIppon } = modalidades || {};
    
    if (!kataIndividual && !kataEquipos && !kumiteIndividual && !kumiteEquipos && !kihonIppon) {
      return res.status(400).json({ error: 'Debe seleccionar al menos una modalidad' });
    }
    
    if (kumiteIndividual && edad < 10) {
      return res.status(400).json({ error: 'Kumite Individual solo para 10+ años' });
    }
    if (kumiteEquipos && edad < 10) {
      return res.status(400).json({ error: 'Kumite Equipos solo para 10+ años' });
    }
    if (kihonIppon && (edad < 6 || edad > 10)) {
      return res.status(400).json({ error: 'Kihon Ippon solo para 6-10 años' });
    }
    
    let finalDojoId = dojoId;
    if (req.user.rol === 'sensei') {
      finalDojoId = req.user.dojoId;
    }
    
    if (!finalDojoId) {
      return res.status(400).json({ error: 'El dojo es obligatorio' });
    }
    
    const participante = new Participante({
      nombre: nombre.trim(),
      edad,
      genero,
      grado,
      dojoId: finalDojoId,
      modalidades: {
        kataIndividual: !!kataIndividual,
        kataEquipos: !!kataEquipos,
        kumiteIndividual: !!kumiteIndividual,
        kumiteEquipos: !!kumiteEquipos,
        kihonIppon: !!kihonIppon
      },
      creadoPor: req.user.id
    });
    
    await participante.save();
    const participantePopulated = await Participante.findById(participante._id).populate('dojoId');
    res.status(201).json(participantePopulated);
  } catch (error) {
    console.error('Error al crear participante:', error);
    res.status(400).json({ error: 'Error al crear participante: ' + error.message });
  }
});

app.put('/api/participantes/:id', auth, async (req, res) => {
  try {
    const { nombre, edad, genero, grado, dojoId, modalidades } = req.body;
    
    const participante = await Participante.findById(req.params.id);
    if (!participante) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }
    
    if (req.user.rol === 'sensei' && participante.creadoPor.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para editar este participante' });
    }
    
    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!edad || edad < 1 || edad > 100) {
      return res.status(400).json({ error: 'La edad debe estar entre 1 y 100' });
    }
    if (!genero) {
      return res.status(400).json({ error: 'El género es obligatorio' });
    }
    if (!grado) {
      return res.status(400).json({ error: 'El grado es obligatorio' });
    }
    
    const { kataIndividual, kataEquipos, kumiteIndividual, kumiteEquipos, kihonIppon } = modalidades || {};
    
    if (!kataIndividual && !kataEquipos && !kumiteIndividual && !kumiteEquipos && !kihonIppon) {
      return res.status(400).json({ error: 'Debe seleccionar al menos una modalidad' });
    }
    
    if (kumiteIndividual && edad < 10) {
      return res.status(400).json({ error: 'Kumite Individual solo para 10+ años' });
    }
    if (kumiteEquipos && edad < 10) {
      return res.status(400).json({ error: 'Kumite Equipos solo para 10+ años' });
    }
    if (kihonIppon && (edad < 6 || edad > 10)) {
      return res.status(400).json({ error: 'Kihon Ippon solo para 6-10 años' });
    }
    
    let finalDojoId = dojoId;
    if (req.user.rol === 'sensei') {
      finalDojoId = req.user.dojoId;
    }
    
    if (!finalDojoId) {
      return res.status(400).json({ error: 'El dojo es obligatorio' });
    }
    
    const participanteActualizado = await Participante.findByIdAndUpdate(
      req.params.id,
      {
        nombre: nombre.trim(),
        edad,
        genero,
        grado,
        dojoId: finalDojoId,
        modalidades: {
          kataIndividual: !!kataIndividual,
          kataEquipos: !!kataEquipos,
          kumiteIndividual: !!kumiteIndividual,
          kumiteEquipos: !!kumiteEquipos,
          kihonIppon: !!kihonIppon
        }
      },
      { new: true, runValidators: true }
    ).populate('dojoId');
    
    res.json(participanteActualizado);
  } catch (error) {
    console.error('Error al actualizar participante:', error);
    res.status(400).json({ error: 'Error al actualizar participante: ' + error.message });
  }
});

app.delete('/api/participantes/:id', auth, async (req, res) => {
  try {
    const participante = await Participante.findById(req.params.id);
    if (!participante) {
      return res.status(404).json({ error: 'Participante no encontrado' });
    }
    
    if (req.user.rol === 'sensei' && participante.creadoPor.toString() !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este participante' });
    }
    
    await Participante.findByIdAndDelete(req.params.id);
    res.json({ message: 'Participante eliminado correctamente' });
  } catch (error) {
    res.status(400).json({ error: 'Error al eliminar participante' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Copa Samurai 2025 API' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`⚔️ Servidor corriendo en puerto ${PORT}`);
});