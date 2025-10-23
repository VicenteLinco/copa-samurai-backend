import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Componente de visualización de brackets para Senseis (solo lectura)
export default function BracketsView({ user }) {
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBracket, setSelectedBracket] = useState(null);

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
        <h1 className="text-3xl font-bold text-gray-900">⚔️ Brackets de Competencia</h1>
        <p className="text-gray-600 mt-1">Copa Samurai 2025 - Vista de Senseis</p>
        <p className="text-sm text-gray-500 mt-2">
          Aquí puedes ver los brackets donde participan tus atletas. Solo lectura.
        </p>
      </div>

      {/* Lista de Brackets */}
      {brackets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-600 text-lg">No hay brackets disponibles</p>
          <p className="text-gray-500 text-sm mt-2">Tus atletas aún no están participando en ningún bracket</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {brackets.map(bracket => {
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
                <div className="p-4 flex gap-2">
                  <button
                    onClick={() => setSelectedBracket(bracket)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                  >
                    👁️ Ver Bracket
                  </button>
                  <button
                    onClick={() => descargarPDF(bracket._id, bracket.categoriaId.nombre)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors"
                  >
                    🖨️ Descargar PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de visualización */}
      {selectedBracket && (
        <BracketViewModalSensei
          bracket={selectedBracket}
          onClose={() => setSelectedBracket(null)}
          user={user}
        />
      )}
    </div>
  );
}

// Modal de visualización para senseis (solo lectura)
function BracketViewModalSensei({ bracket: bracketProp, onClose, user }) {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);

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
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{bracket.categoriaId.nombre}</h2>
              <p className="text-gray-600 text-sm mt-1">
                {bracket.categoriaId.disciplinaId.nombre} | {bracket.categoriaId.rangoEdadId.nombre} años | {bracket.categoriaId.genero}
              </p>
              <p className="text-xs text-blue-600 mt-2">👁️ Vista de solo lectura</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
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
                  <div key={combateIdx} className="border border-gray-300 rounded-lg p-4 bg-white">
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
      </div>
    </div>
  );
}
