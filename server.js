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

const Dojo = mongoose.model('Dojo', dojoSchema);
const Sensei = mongoose.model('Sensei', senseiSchema);
const Participante = mongoose.model('Participante', participanteSchema);

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