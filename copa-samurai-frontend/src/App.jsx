import { useState, useEffect } from 'react';
import { Swords, LogOut, X, Search, Filter, FileDown, Printer, Plus, Edit2, Trash2 } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [activeTab, setActiveTab] = useState('participantes');
  
  // Estados para datos
  const [dojos, setDojos] = useState([]);
  const [senseis, setSenseis] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  
  // Estados para filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDojo, setSelectedDojo] = useState('');
  
  // Estados para modales
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'dojo', 'sensei', 'participante'
  const [editingItem, setEditingItem] = useState(null);
  
  // Estados para formularios
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, activeTab, searchTerm, selectedDojo]);

  const loadData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      if (activeTab === 'dojos' || user?.rol === 'admin') {
        const dojosRes = await fetch(`${API_URL}/dojos`, { headers });
        if (dojosRes.ok) setDojos(await dojosRes.json());
      }
      
      if (activeTab === 'senseis') {
        const senseisRes = await fetch(`${API_URL}/senseis`, { headers });
        if (senseisRes.ok) setSenseis(await senseisRes.json());
      }
      
      if (activeTab === 'participantes') {
        let url = `${API_URL}/participantes?`;
        if (searchTerm) url += `search=${searchTerm}&`;
        if (selectedDojo) url += `dojoId=${selectedDojo}`;
        
        const partRes = await fetch(url, { headers });
        if (partRes.ok) setParticipantes(await partRes.json());
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const usuario = e.target.usuario.value;
    const password = e.target.password.value;
    
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      } else {
        alert(data.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setSearchTerm('');
    setSelectedDojo('');
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    if (type === 'dojo') {
      setFormData(item || { nombre: '', ubicacion: '' });
    } else if (type === 'sensei') {
      setFormData(item || { nombre: '', usuario: '', password: '', dojoId: '' });
    } else if (type === 'participante') {
      setFormData(item || {
        nombre: '',
        edad: '',
        genero: '',
        grado: '',
        dojoId: user?.rol === 'sensei' ? user.dojo._id : '',
        modalidades: {
          kataIndividual: false,
          kataEquipos: false,
          kumiteIndividual: false,
          kumiteEquipos: false,
          kihonIppon: false
        }
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      let url = `${API_URL}/${modalType}s`;
      let method = 'POST';
      
      if (editingItem) {
        url += `/${editingItem._id}`;
        method = 'PUT';
      }
      
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(editingItem ? 'Actualizado correctamente' : 'Creado correctamente');
        closeModal();
        loadData();
      } else {
        alert(data.error || 'Error al guardar');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    
    try {
      const res = await fetch(`${API_URL}/${type}s/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        alert('Eliminado correctamente');
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  const exportCSV = () => {
    const headers = ['Nombre', 'Edad', 'Género', 'Grado', 'Dojo', 'Kata Individual', 'Kata Equipos', 'Kumite Individual', 'Kumite Equipos', 'Kihon Ippon'];
    const rows = participantes.map(p => [
      p.nombre,
      p.edad,
      p.genero,
      p.grado,
      p.dojoId?.nombre || '',
      p.modalidades.kataIndividual ? 'Sí' : 'No',
      p.modalidades.kataEquipos ? 'Sí' : 'No',
      p.modalidades.kumiteIndividual ? 'Sí' : 'No',
      p.modalidades.kumiteEquipos ? 'Sí' : 'No',
      p.modalidades.kihonIppon ? 'Sí' : 'No'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `participantes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportPDF = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Copa Samurai 2025 - Participantes</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; color: #DC2626; }
            h2 { text-align: center; color: #666; font-size: 18px; }
            .info { text-align: center; margin: 10px 0; color: #999; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #FEE2E2; color: #DC2626; padding: 10px; border: 1px solid #ddd; }
            td { padding: 8px; border: 1px solid #ddd; }
            tr:nth-child(even) { background: #f9f9f9; }
            .total { text-align: right; margin-top: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>⚔️ COPA SAMURAI 2025 ⚔️</h1>
          <h2>Lista Oficial de Participantes</h2>
          <div class="info">Generado: ${new Date().toLocaleString('es-ES')}</div>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Edad</th>
                <th>Género</th>
                <th>Grado</th>
                <th>Dojo</th>
                <th>Kata Ind.</th>
                <th>Kata Eq.</th>
                <th>Kumite Ind.</th>
                <th>Kumite Eq.</th>
                <th>Kihon Ippon</th>
              </tr>
            </thead>
            <tbody>
              ${participantes.map(p => `
                <tr>
                  <td>${p.nombre}</td>
                  <td>${p.edad}</td>
                  <td>${p.genero}</td>
                  <td>${p.grado}</td>
                  <td>${p.dojoId?.nombre || ''}</td>
                  <td>${p.modalidades.kataIndividual ? '✓' : ''}</td>
                  <td>${p.modalidades.kataEquipos ? '✓' : ''}</td>
                  <td>${p.modalidades.kumiteIndividual ? '✓' : ''}</td>
                  <td>${p.modalidades.kumiteEquipos ? '✓' : ''}</td>
                  <td>${p.modalidades.kihonIppon ? '✓' : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">Total de participantes: ${participantes.length}</div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // LOGIN SCREEN
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Swords className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Copa Samurai 2025</h1>
            <p className="text-gray-600 mt-2">Sistema de Gestión</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-red-600 mb-2">Usuario</label>
              <input
                type="text"
                name="usuario"
                required
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-red-600 mb-2">Contraseña</label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none transition"
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Copa Samurai 2025</h1>
              <p className="text-sm text-red-100">{user?.nombre} ({user?.rol})</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
        
        {/* Tabs */}
        <div className="container mx-auto px-4">
          <div className="flex gap-1 border-b border-red-500">
            {user?.rol === 'admin' && (
              <>
                <button
                  onClick={() => { setActiveTab('dojos'); setShowModal(false); }}
                  className={`px-6 py-3 font-semibold transition ${
                    activeTab === 'dojos'
                      ? 'bg-white text-red-600 rounded-t-lg'
                      : 'text-white hover:bg-red-500'
                  }`}
                >
                  Dojos
                </button>
                <button
                  onClick={() => { setActiveTab('senseis'); setShowModal(false); }}
                  className={`px-6 py-3 font-semibold transition ${
                    activeTab === 'senseis'
                      ? 'bg-white text-red-600 rounded-t-lg'
                      : 'text-white hover:bg-red-500'
                  }`}
                >
                  Senseis
                </button>
              </>
            )}
            <button
              onClick={() => { setActiveTab('participantes'); setShowModal(false); }}
              className={`px-6 py-3 font-semibold transition ${
                activeTab === 'participantes'
                  ? 'bg-white text-red-600 rounded-t-lg'
                  : 'text-white hover:bg-red-500'
              }`}
            >
              Participantes
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* DOJOS TAB */}
        {activeTab === 'dojos' && user?.rol === 'admin' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Gestión de Dojos</h2>
              <button
                onClick={() => openModal('dojo')}
                className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nuevo Dojo
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Nombre</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Ubicación</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {dojos.map((dojo, idx) => (
                    <tr key={dojo._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">{dojo.nombre}</td>
                      <td className="px-6 py-4">{dojo.ubicacion}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => openModal('dojo', dojo)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete('dojo', dojo._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SENSEIS TAB */}
        {activeTab === 'senseis' && user?.rol === 'admin' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Gestión de Senseis</h2>
              <button
                onClick={() => openModal('sensei')}
                className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nuevo Sensei
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Nombre</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Usuario</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Dojo</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {senseis.map((sensei, idx) => (
                    <tr key={sensei._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">{sensei.nombre}</td>
                      <td className="px-6 py-4">{sensei.usuario}</td>
                      <td className="px-6 py-4">{sensei.dojoId?.nombre}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => openModal('sensei', sensei)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete('sensei', sensei._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PARTICIPANTES TAB */}
        {activeTab === 'participantes' && (
          <div>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Participantes {searchTerm || selectedDojo ? `(${participantes.length})` : ''}
              </h2>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportCSV}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition flex items-center gap-2"
                >
                  <FileDown className="w-5 h-5" />
                  CSV
                </button>
                <button
                  onClick={exportPDF}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  PDF
                </button>
                <button
                  onClick={() => openModal('participante')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo
                </button>
              </div>
            </div>
            
            {/* Filtros */}
            <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-semibold text-red-600 mb-2">
                  <Search className="w-4 h-4 inline mr-1" />
                  Buscar por nombre
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Escribe para buscar..."
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                />
              </div>
              
              {user?.rol === 'admin' && (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-semibold text-red-600 mb-2">
                    <Filter className="w-4 h-4 inline mr-1" />
                    Filtrar por dojo
                  </label>
                  <select
                    value={selectedDojo}
                    onChange={(e) => setSelectedDojo(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                  >
                    <option value="">Todos los dojos</option>
                    {dojos.map(dojo => (
                      <option key={dojo._id} value={dojo._id}>{dojo.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Nombre</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Edad</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Género</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Grado</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Dojo</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Modalidades</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-red-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {participantes.map((p, idx) => (
                    <tr key={p._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">{p.nombre}</td>
                      <td className="px-6 py-4">{p.edad}</td>
                      <td className="px-6 py-4">{p.genero}</td>
                      <td className="px-6 py-4">{p.grado}</td>
                      <td className="px-6 py-4">{p.dojoId?.nombre}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          {p.modalidades.kataIndividual && <div>✓ Kata Ind.</div>}
                          {p.modalidades.kataEquipos && <div>✓ Kata Eq.</div>}
                          {p.modalidades.kumiteIndividual && <div>✓ Kumite Ind.</div>}
                          {p.modalidades.kumiteEquipos && <div>✓ Kumite Eq.</div>}
                          {p.modalidades.kihonIppon && <div>✓ Kihon Ippon</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => openModal('participante', p)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete('participante', p._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingItem ? 'Editar' : 'Nuevo'} {modalType === 'dojo' ? 'Dojo' : modalType === 'sensei' ? 'Sensei' : 'Participante'}
              </h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* DOJO FORM */}
              {modalType === 'dojo' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre || ''}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Ubicación *</label>
                    <input
                      type="text"
                      required
                      value={formData.ubicacion || ''}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    />
                  </div>
                </>
              )}

              {/* SENSEI FORM */}
              {modalType === 'sensei' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre || ''}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Usuario *</label>
                    <input
                      type="text"
                      required
                      value={formData.usuario || ''}
                      onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">
                      Contraseña {editingItem ? '(dejar vacío para mantener)' : '*'}
                    </label>
                    <input
                      type="password"
                      required={!editingItem}
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Dojo *</label>
                    <select
                      required
                      value={formData.dojoId || ''}
                      onChange={(e) => setFormData({ ...formData, dojoId: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {dojos.map(dojo => (
                        <option key={dojo._id} value={dojo._id}>{dojo.nombre}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* PARTICIPANTE FORM */}
              {modalType === 'participante' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={formData.nombre || ''}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-red-600 mb-2">Edad *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="100"
                        value={formData.edad || ''}
                        onChange={(e) => {
                          const edad = parseInt(e.target.value);
                          const newModalidades = { ...formData.modalidades };
                          
                          // Aplicar restricciones
                          if (edad < 10) {
                            newModalidades.kumiteIndividual = false;
                            newModalidades.kumiteEquipos = false;
                          }
                          if (edad < 6 || edad > 10) {
                            newModalidades.kihonIppon = false;
                          }
                          
                          setFormData({ ...formData, edad, modalidades: newModalidades });
                        }}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-red-600 mb-2">Género *</label>
                      <select
                        required
                        value={formData.genero || ''}
                        onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Grado *</label>
                    <select
                      required
                      value={formData.grado || ''}
                      onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                    >
                      <option value="">Seleccionar...</option>
                      {['10 Kyu', '9 Kyu', '8 Kyu', '7 Kyu', '6 Kyu', '5 Kyu', '4 Kyu', '3 Kyu', '2 Kyu', '1 Kyu', 'Dan'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  
                  {user?.rol === 'admin' && (
                    <div>
                      <label className="block text-sm font-semibold text-red-600 mb-2">Dojo *</label>
                      <select
                        required
                        value={formData.dojoId || ''}
                        onChange={(e) => setFormData({ ...formData, dojoId: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-200 outline-none"
                      >
                        <option value="">Seleccionar...</option>
                        {dojos.map(dojo => (
                          <option key={dojo._id} value={dojo._id}>{dojo.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-semibold text-red-600 mb-2">Modalidades * (seleccionar al menos 1)</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.modalidades?.kataIndividual || false}
                          onChange={(e) => setFormData({
                            ...formData,
                            modalidades: { ...formData.modalidades, kataIndividual: e.target.checked }
                          })}
                          className="w-5 h-5 text-red-600"
                        />
                        <span>Kata Individual</span>
                      </label>
                      
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.modalidades?.kataEquipos || false}
                          onChange={(e) => setFormData({
                            ...formData,
                            modalidades: { ...formData.modalidades, kataEquipos: e.target.checked }
                          })}
                          className="w-5 h-5 text-red-600"
                        />
                        <span>Kata Equipos</span>
                      </label>
                      
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.modalidades?.kumiteIndividual || false}
                          disabled={!formData.edad || formData.edad < 10}
                          onChange={(e) => setFormData({
                            ...formData,
                            modalidades: { ...formData.modalidades, kumiteIndividual: e.target.checked }
                          })}
                          className="w-5 h-5 text-red-600 disabled:opacity-50"
                        />
                        <span className={!formData.edad || formData.edad < 10 ? 'text-gray-400' : ''}>
                          Kumite Individual {(!formData.edad || formData.edad < 10) && '(solo 10+ años)'}
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.modalidades?.kumiteEquipos || false}
                          disabled={!formData.edad || formData.edad < 10}
                          onChange={(e) => setFormData({
                            ...formData,
                            modalidades: { ...formData.modalidades, kumiteEquipos: e.target.checked }
                          })}
                          className="w-5 h-5 text-red-600 disabled:opacity-50"
                        />
                        <span className={!formData.edad || formData.edad < 10 ? 'text-gray-400' : ''}>
                          Kumite Equipos {(!formData.edad || formData.edad < 10) && '(solo 10+ años)'}
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.modalidades?.kihonIppon || false}
                          disabled={!formData.edad || formData.edad < 6 || formData.edad > 10}
                          onChange={(e) => setFormData({
                            ...formData,
                            modalidades: { ...formData.modalidades, kihonIppon: e.target.checked }
                          })}
                          className="w-5 h-5 text-red-600 disabled:opacity-50"
                        />
                        <span className={!formData.edad || formData.edad < 6 || formData.edad > 10 ? 'text-gray-400' : ''}>
                          Kihon Ippon {(!formData.edad || formData.edad < 6 || formData.edad > 10) && '(solo 6-10 años)'}
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-400 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition"
                >
                  {editingItem ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;