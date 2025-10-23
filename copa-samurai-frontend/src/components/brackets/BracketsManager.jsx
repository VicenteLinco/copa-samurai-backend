import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Componente principal de gestión de brackets (Admin)
export default function BracketsManager({ user }) {
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [activeTab, setActiveTab] = useState('kata-individual');
  const [selectedBracket, setSelectedBracket] = useState(null);
  const [showResultModal, setShowResultModal] = useState(null);
  const [showBracketView, setShowBracketView] = useState(null);
  const [orientation, setOrientation] = useState('horizontal'); // horizontal | vertical

  // Tabs por tipo de competencia
  const tabs = [
    { id: 'kata-individual', label: 'Kata Individual', icon: '🥋' },
    { id: 'kata-equipos', label: 'Kata Equipos', icon: '👥' },
    { id: 'kumite-individual', label: 'Kumite Individual', icon: '🥊' },
    { id: 'kumite-equipos', label: 'Kumite Equipos', icon: '⚔️' },
    { id: 'kihon-ippon', label: 'Kihon Ippon', icon: '👊' }
  ];

  useEffect(() => {
    cargarBrackets();
  }, []);

  const cargarBrackets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/brackets`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setBrackets(response.data);
    } catch (error) {
      console.error('Error cargando brackets:', error);
      alert('Error al cargar brackets');
    } finally {
      setLoading(false);
    }
  };

  const generarBrackets = async () => {
    if (!confirm('¿Generar brackets para todas las categorías con competidores inscritos?')) return;

    try {
      setGenerando(true);
      const response = await axios.post(`${API_URL}/brackets/generar`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      const { generados, advertencias, errores } = response.data;

      // Mostrar resultados
      let mensaje = `✅ Brackets generados: ${generados.length}\n\n`;

      if (advertencias.length > 0) {
        mensaje += `⚠️ Advertencias (${advertencias.length}):\n`;
        advertencias.forEach(adv => {
          mensaje += `- ${adv.categoria}: ${adv.mensaje}\n`;
        });
        mensaje += '\n';
      }

      if (errores.length > 0) {
        mensaje += `❌ Errores (${errores.length}):\n`;
        errores.forEach(err => {
          mensaje += `- ${err.categoria}: ${err.error}\n`;
        });
      }

      alert(mensaje);
      await cargarBrackets();
    } catch (error) {
      console.error('Error generando brackets:', error);
      alert('Error al generar brackets');
    } finally {
      setGenerando(false);
    }
  };

  const descargarPDF = async (bracketId, nombreCategoria) => {
    try {
      const response = await axios.get(`${API_URL}/brackets/${bracketId}/pdf`, {
        headers: { Authorization: `Bearer ${user.token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bracket-${nombreCategoria.replace(/ /g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert('Error al descargar PDF');
    }
  };

  const resetearBracket = async (bracketId) => {
    if (!confirm('¿Resetear este bracket? Se borrarán todos los resultados.')) return;

    try {
      await axios.put(`${API_URL}/brackets/${bracketId}/resetear`, {}, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      alert('Bracket reseteado correctamente');
      await cargarBrackets();
    } catch (error) {
      console.error('Error reseteando bracket:', error);
      alert('Error al resetear bracket');
    }
  };

  const compartirBracket = (bracket) => {
    const url = `${window.location.origin}/bracket/${bracket.tokenPublico}`;
    navigator.clipboard.writeText(url);
    alert('¡Link copiado al portapapeles!\n\n' + url);
  };

  const eliminarBracket = async (bracket) => {
    if (!confirm(`¿Eliminar bracket de "${bracket.categoriaId.nombre}"?`)) return;

    try {
      await axios.delete(`${API_URL}/brackets/${bracket.categoriaId._id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      alert('Bracket eliminado correctamente');
      await cargarBrackets();
    } catch (error) {
      console.error('Error eliminando bracket:', error);
      alert('Error al eliminar bracket');
    }
  };

  // Filtrar brackets por tab activo
  const bracketsFiltrados = brackets.filter(bracket => {
    const codigo = bracket.categoriaId?.disciplinaId?.codigo || '';
    return codigo === activeTab;
  });

  // Calcular estadísticas de progreso
  const calcularProgreso = (bracket) => {
    let totalCombates = 0;
    let combatesCompletados = 0;

    bracket.rondas?.forEach(ronda => {
      ronda.combates?.forEach(combate => {
        totalCombates++;
        if (combate.estado === 'finalizado') {
          combatesCompletados++;
        }
      });
    });

    return { totalCombates, combatesCompletados, porcentaje: Math.round((combatesCompletados / totalCombates) * 100) || 0 };
  };

  // Color del badge según estado
  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'generado': return 'bg-yellow-100 text-yellow-800';
      case 'en_curso': return 'bg-blue-100 text-blue-800';
      case 'finalizado': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case 'generado': return 'Sin iniciar';
      case 'en_curso': return 'En curso';
      case 'finalizado': return 'Finalizado';
      default: return estado;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando brackets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">⚔️ Gestión de Brackets</h1>
            <p className="text-gray-600 mt-1">Copa Samurai 2025</p>
          </div>
          <button
            onClick={generarBrackets}
            disabled={generando}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            {generando ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generando...
              </>
            ) : (
              <>
                <span>🎯</span>
                Generar Brackets
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200">
          {tabs.map(tab => {
            const count = brackets.filter(b => b.categoriaId?.disciplinaId?.codigo === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
                {count > 0 && (
                  <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Brackets */}
      {bracketsFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-600 text-lg">No hay brackets generados para esta categoría</p>
          <p className="text-gray-500 text-sm mt-2">Presiona "Generar Brackets" para crear los brackets de competición</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bracketsFiltrados.map(bracket => {
            const progreso = calcularProgreso(bracket);
            return (
              <div key={bracket._id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                {/* Header de la card */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight flex-1">
                      {bracket.categoriaId.nombre}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(bracket.estado)}`}>
                      {getEstadoTexto(bracket.estado)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>{bracket.modalidad}</span>
                    <span>•</span>
                    <span>{bracket.totalCompetidores} competidores</span>
                  </div>
                </div>

                {/* Progreso */}
                <div className="p-4 bg-gray-50">
                  <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                    <span>Progreso</span>
                    <span className="font-semibold">{progreso.combatesCompletados}/{progreso.totalCombates} combates</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progreso.porcentaje}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">{progreso.porcentaje}%</p>
                </div>

                {/* Acciones */}
                <div className="p-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowBracketView(bracket)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                  >
                    👁️ Ver
                  </button>
                  <button
                    onClick={() => descargarPDF(bracket._id, bracket.categoriaId.nombre)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                    title="Descargar PDF"
                  >
                    🖨️ PDF
                  </button>
                  <button
                    onClick={() => compartirBracket(bracket)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                    title="Copiar link público"
                  >
                    🔗 Compartir
                  </button>
                  <button
                    onClick={() => resetearBracket(bracket._id)}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                    title="Resetear bracket"
                  >
                    🔄 Resetear
                  </button>
                  <button
                    onClick={() => eliminarBracket(bracket)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                    title="Eliminar bracket"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de visualización del bracket */}
      {showBracketView && (
        <BracketViewModal
          bracket={showBracketView}
          onClose={() => setShowBracketView(null)}
          onReload={cargarBrackets}
          user={user}
          orientation={orientation}
          setOrientation={setOrientation}
        />
      )}
    </div>
  );
}

// Modal de visualización del bracket
function BracketViewModal({ bracket: bracketProp, onClose, onReload, user, orientation, setOrientation }) {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCombate, setSelectedCombate] = useState(null);

  useEffect(() => {
    cargarBracketCompleto();
  }, [bracketProp]);

  const cargarBracketCompleto = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/brackets/${bracketProp._id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setBracket(response.data);
    } catch (error) {
      console.error('Error cargando bracket completo:', error);
      alert('Error al cargar el bracket');
    } finally {
      setLoading(false);
    }
  };

  const registrarResultado = async (combate, ganadorId) => {
    try {
      await axios.put(
        `${API_URL}/brackets/${bracket._id}/combate/${combate.numeroRonda}/${combate.numeroCombate}`,
        { ganadorId },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      alert('Resultado registrado correctamente');
      await cargarBracketCompleto();
      await onReload();
      setSelectedCombate(null);
    } catch (error) {
      console.error('Error registrando resultado:', error);
      alert('Error al registrar el resultado');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Cargando bracket...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{bracket.categoriaId.nombre}</h2>
              <p className="text-gray-600 text-sm mt-1">
                {bracket.categoriaId.disciplinaId.nombre} | {bracket.categoriaId.rangoEdadId.nombre} años | {bracket.categoriaId.genero}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setOrientation('horizontal')}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                orientation === 'horizontal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ↔️ Horizontal
            </button>
            <button
              onClick={() => setOrientation('vertical')}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                orientation === 'vertical'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ↕️ Vertical
            </button>
          </div>
        </div>

        {/* Contenido - Lista de combates por ronda */}
        <div className="p-6">
          {bracket.rondas.map((ronda, rondaIdx) => (
            <div key={rondaIdx} className="mb-8">
              <h3 className="text-xl font-bold text-blue-700 mb-4">{ronda.nombreRonda}</h3>
              <div className="space-y-4">
                {ronda.combates.map((combate, combateIdx) => (
                  <div key={combateIdx} className="border border-gray-300 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-gray-700">Combate #{combate.numeroCombate}</span>
                      {combate.estado === 'finalizado' && <span className="text-green-600 font-semibold">✅ Finalizado</span>}
                      {combate.estado === 'pendiente' && <span className="text-yellow-600 font-semibold">⏳ Pendiente</span>}
                    </div>

                    <div className="grid grid-cols-3 gap-4 items-center">
                      {/* Competidor 1 */}
                      <div className="text-left">
                        {combate.competidor1?.datos ? (
                          <div>
                            <p className="font-semibold">{combate.competidor1.datos.nombre}</p>
                            <p className="text-sm text-gray-600">{combate.competidor1.datos.dojoId.nombre}</p>
                            {bracket.modalidad === 'Individual' && (
                              <p className="text-xs text-gray-500">{combate.competidor1.datos.grado} | {combate.competidor1.datos.edad} años</p>
                            )}
                          </div>
                        ) : combate.competidor1?.esBye ? (
                          <p className="text-gray-400 italic">BYE</p>
                        ) : (
                          <p className="text-gray-400 italic">(Por definir)</p>
                        )}
                      </div>

                      {/* VS */}
                      <div className="text-center">
                        <span className="text-2xl font-bold text-gray-400">VS</span>
                      </div>

                      {/* Competidor 2 */}
                      <div className="text-right">
                        {combate.competidor2?.datos ? (
                          <div>
                            <p className="font-semibold">{combate.competidor2.datos.nombre}</p>
                            <p className="text-sm text-gray-600">{combate.competidor2.datos.dojoId.nombre}</p>
                            {bracket.modalidad === 'Individual' && (
                              <p className="text-xs text-gray-500">{combate.competidor2.datos.grado} | {combate.competidor2.datos.edad} años</p>
                            )}
                          </div>
                        ) : combate.competidor2?.esBye ? (
                          <p className="text-gray-400 italic">BYE</p>
                        ) : (
                          <p className="text-gray-400 italic">(Por definir)</p>
                        )}
                      </div>
                    </div>

                    {/* Botón de registrar resultado */}
                    {combate.estado === 'pendiente' && combate.competidor1?.datos && combate.competidor2?.datos && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => setSelectedCombate({ ...combate, numeroRonda: ronda.numeroRonda })}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
                        >
                          📝 Registrar Resultado
                        </button>
                      </div>
                    )}

                    {/* Mostrar ganador */}
                    {combate.ganador?.datos && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-center">
                        <p className="text-sm text-gray-600">Ganador:</p>
                        <p className="font-semibold text-green-700">{combate.ganador.datos.nombre}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal de registro de resultado */}
        {selectedCombate && (
          <ResultModal
            combate={selectedCombate}
            onClose={() => setSelectedCombate(null)}
            onSubmit={registrarResultado}
            bracket={bracket}
          />
        )}
      </div>
    </div>
  );
}

// Modal para registrar resultado
function ResultModal({ combate, onClose, onSubmit, bracket }) {
  const [ganadorSeleccionado, setGanadorSeleccionado] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ganadorSeleccionado) {
      alert('Por favor selecciona un ganador');
      return;
    }
    onSubmit(combate, ganadorSeleccionado);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold mb-4">Registrar Resultado - Combate #{combate.numeroCombate}</h3>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona el ganador:</label>

              {/* Opción 1 */}
              <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50 mb-2">
                <input
                  type="radio"
                  name="ganador"
                  value={combate.competidor1.id}
                  checked={ganadorSeleccionado === combate.competidor1.id}
                  onChange={(e) => setGanadorSeleccionado(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold">{combate.competidor1.datos.nombre}</p>
                  <p className="text-sm text-gray-600">{combate.competidor1.datos.dojoId.nombre}</p>
                </div>
              </label>

              {/* Opción 2 */}
              <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="ganador"
                  value={combate.competidor2.id}
                  checked={ganadorSeleccionado === combate.competidor2.id}
                  onChange={(e) => setGanadorSeleccionado(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <p className="font-semibold">{combate.competidor2.datos.nombre}</p>
                  <p className="text-sm text-gray-600">{combate.competidor2.datos.dojoId.nombre}</p>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              Confirmar Resultado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
