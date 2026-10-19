// Paso 2. Mostrar el mapa
const CENTRO_INICIAL = [5.0689, -75.5174]; // Manizales, por si falla la ubicación

const mapa = L.map('mapa').setView(CENTRO_INICIAL, 15);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ'
}).addTo(mapa);

// Paso 3. Geolocalización
let marcadorUsuario = null;
let circuloPrecision = null;

function mostrarInfo(texto) {
  document.getElementById('info').textContent = texto;
}

function mensajeErrorGeo(err) {
  const mensajes = {
    1: 'Permiso denegado. Activa la ubicación en el navegador.',
    2: 'No se pudo determinar la ubicación.',
    3: 'Se agotó el tiempo de espera.'
  };
  return mensajes[err.code] || 'Error desconocido.';
}

function ubicarUsuario() {
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.');
    return;
  }
  mostrarInfo('Buscando tu ubicación...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const punto = [latitude, longitude];

      if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
      if (circuloPrecision) mapa.removeLayer(circuloPrecision);

      marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí').openPopup();
      circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1 }).addTo(mapa);
      mapa.setView(punto, 17);
      mostrarInfo(`Ubicación encontrada (precisión: ${Math.round(accuracy)} m). Haz clic para dibujar.`);
    },
    (err) => mostrarInfo(mensajeErrorGeo(err)),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

document.getElementById('btnUbicar').addEventListener('click', ubicarUsuario);
ubicarUsuario();

// Paso 4. Capturar vértices con clics
let puntos = []; // array de [lat, lng]
let vertices = []; // marcadores visibles de cada vértice
let poligono = null;
const lineaGuia = L.polyline([], { color: '#e67e22', dashArray: '6 6' }).addTo(mapa);

function agregarVertice(lat, lng) {
  puntos.push([lat, lng]);

  const v = L.circleMarker([lat, lng], { radius: 6, color: '#e67e22', fillOpacity: 1 }).addTo(mapa);
  vertices.push(v);

  lineaGuia.setLatLngs(puntos);
  actualizarBotones();
  actualizarTabla();
  guardarEnLocalStorage();
  mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`);
}

mapa.on('click', (e) => {
  if (poligono) return; // si ya está cerrado, no se agregan más puntos
  agregarVertice(e.latlng.lat, e.latlng.lng);
});

// Reto 4. Agregar un vértice con la ubicación actual del usuario
function agregarVerticeAqui() {
  if (poligono) {
    mostrarInfo('El polígono ya está cerrado. Usa Limpiar para empezar de nuevo.');
    return;
  }
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.');
    return;
  }
  mostrarInfo('Obteniendo tu posición actual...');

  navigator.geolocation.getCurrentPosition(
    (pos) => agregarVertice(pos.coords.latitude, pos.coords.longitude),
    (err) => mostrarInfo(mensajeErrorGeo(err)),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

document.getElementById('btnAgregarAqui').addEventListener('click', agregarVerticeAqui);

function actualizarBotones() {
  document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;
  document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;
  document.getElementById('btnExportar').disabled = poligono === null;
}

// Reto 1. Tabla de coordenadas con 6 decimales
function actualizarTabla() {
  const cuerpo = document.getElementById('cuerpoTablaVertices');
  cuerpo.innerHTML = '';

  puntos.forEach(([lat, lng], indice) => {
    const fila = document.createElement('tr');

    const celdaIndice = document.createElement('td');
    celdaIndice.textContent = indice + 1;

    const celdaLat = document.createElement('td');
    celdaLat.textContent = lat.toFixed(6);

    const celdaLng = document.createElement('td');
    celdaLng.textContent = lng.toFixed(6);

    fila.append(celdaIndice, celdaLat, celdaLng);
    cuerpo.appendChild(fila);
  });
}

// Paso 5. Cerrar el polígono y medirlo
function aGeoJSON() {
  const anillo = puntos.map(([lat, lng]) => [lng, lat]);
  anillo.push(anillo[0]); // cerrar el anillo
  const nombre = document.getElementById('nombrePoligono').value.trim() || 'Mi polígono';
  return turf.polygon([anillo], { nombre, creado: new Date().toISOString() });
}

function medir() {
  const geo = aGeoJSON();
  const area = turf.area(geo); // metros cuadrados
  const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' });
  return { area, perimetro };
}

function cerrarPoligono() {
  const color = document.getElementById('colorPoligono').value;
  poligono = L.polygon(puntos, { color, fillOpacity: 0.35 }).addTo(mapa);
  lineaGuia.setLatLngs([]);
  mapa.fitBounds(poligono.getBounds());

  const { area, perimetro } = medir();

  // Reto 9. Advertir si el polígono se cruza consigo mismo
  const seCruza = turf.kinks(aGeoJSON()).features.length > 0;
  const advertencia = seCruza
    ? '<br><strong>⚠ El polígono se cruza a sí mismo: el área puede estar mal calculada.</strong>'
    : '';

  poligono.bindPopup(`Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m${advertencia}`).openPopup();
  mostrarInfo(`Polígono cerrado. Área: ${area.toFixed(1)} m² (${(area / 10000).toFixed(3)} ha).${seCruza ? ' ⚠ Se cruza a sí mismo.' : ''}`);
  actualizarBotones();
}

document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);

// Reto 2. Elegir el color del polígono
document.getElementById('colorPoligono').addEventListener('input', (e) => {
  if (poligono) {
    poligono.setStyle({ color: e.target.value });
  }
});

// Paso 6. Deshacer y limpiar
function deshacerPunto() {
  puntos.pop();
  mapa.removeLayer(vertices.pop());
  lineaGuia.setLatLngs(puntos);
  actualizarBotones();
  actualizarTabla();
  guardarEnLocalStorage();
  mostrarInfo(`${puntos.length} vértice(s).`);
}

function limpiar() {
  puntos = [];
  vertices.forEach((v) => mapa.removeLayer(v));
  vertices = [];
  lineaGuia.setLatLngs([]);
  if (poligono) {
    mapa.removeLayer(poligono);
    poligono = null;
  }
  actualizarBotones();
  actualizarTabla();
  guardarEnLocalStorage();
  mostrarInfo('Mapa limpio. Haz clic para empezar de nuevo.');
}

document.getElementById('btnDeshacer').addEventListener('click', deshacerPunto);
document.getElementById('btnLimpiar').addEventListener('click', limpiar);

// Paso 7. Exportar a GeoJSON
function exportar() {
  const texto = JSON.stringify(aGeoJSON(), null, 2);
  const blob = new Blob([texto], { type: 'application/geo+json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'poligono.geojson';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

document.getElementById('btnExportar').addEventListener('click', exportar);

// Reto 5. Guardar el polígono en localStorage y recuperarlo al recargar
const CLAVE_PUNTOS = 'geocolocalizacion.puntos';

function guardarEnLocalStorage() {
  localStorage.setItem(CLAVE_PUNTOS, JSON.stringify(puntos));
}

function cargarDeLocalStorage() {
  const guardado = localStorage.getItem(CLAVE_PUNTOS);
  if (!guardado) return;

  const puntosGuardados = JSON.parse(guardado);
  if (!Array.isArray(puntosGuardados) || puntosGuardados.length === 0) return;

  puntosGuardados.forEach(([lat, lng]) => agregarVertice(lat, lng));
  mapa.fitBounds(lineaGuia.getBounds());
}

cargarDeLocalStorage();

// Reto 6. Importar un archivo .geojson y dibujarlo en el mapa
let capaImportada = null;

document.getElementById('archivoGeoJSON').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = () => {
    try {
      const datos = JSON.parse(lector.result);
      if (capaImportada) mapa.removeLayer(capaImportada);
      capaImportada = L.geoJSON(datos).addTo(mapa);
      mapa.fitBounds(capaImportada.getBounds());
      mostrarInfo('Archivo GeoJSON importado correctamente.');
    } catch (error) {
      mostrarInfo('El archivo no es un GeoJSON válido.');
    }
  };
  lector.readAsText(archivo);
});

// Reto 7. Detectar si la ubicación del usuario está dentro o fuera del polígono
function verificarDentroPoligono() {
  if (!poligono) {
    mostrarInfo('Primero cierra el polígono para poder verificar tu ubicación.');
    return;
  }
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.');
    return;
  }
  mostrarInfo('Verificando tu ubicación respecto al polígono...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const punto = turf.point([longitude, latitude]);
      const estaDentro = turf.booleanPointInPolygon(punto, aGeoJSON());
      mostrarInfo(estaDentro ? 'Estás DENTRO del polígono.' : 'Estás FUERA del polígono.');
    },
    (err) => mostrarInfo(mensajeErrorGeo(err)),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

document.getElementById('btnDentroFuera').addEventListener('click', verificarDentroPoligono);

// Reto 8. Rastrear al usuario en tiempo real y avisar si sale del polígono (geocerca)
let idVigilancia = null;
let dentroActual = null;

function iniciarGeocerca() {
  if (!poligono) {
    mostrarInfo('Primero cierra el polígono para activar la geocerca.');
    return;
  }
  if (!('geolocation' in navigator)) {
    mostrarInfo('Tu navegador no soporta geolocalización.');
    return;
  }

  dentroActual = null;
  document.getElementById('btnGeocerca').textContent = 'Detener geocerca';
  mostrarInfo('Geocerca activada. Rastreando tu posición...');

  idVigilancia = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

      if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
      marcadorUsuario = L.marker([latitude, longitude]).addTo(mapa).bindPopup('Estás aquí');

      const estaDentro = turf.booleanPointInPolygon(turf.point([longitude, latitude]), aGeoJSON());
      if (estaDentro !== dentroActual) {
        dentroActual = estaDentro;
        mostrarInfo(estaDentro ? 'Geocerca: entraste al polígono.' : 'Geocerca: ¡saliste del polígono!');
      }
    },
    (err) => mostrarInfo(mensajeErrorGeo(err)),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function detenerGeocerca() {
  navigator.geolocation.clearWatch(idVigilancia);
  idVigilancia = null;
  document.getElementById('btnGeocerca').textContent = 'Iniciar geocerca';
  mostrarInfo('Geocerca detenida.');
}

document.getElementById('btnGeocerca').addEventListener('click', () => {
  if (idVigilancia === null) {
    iniciarGeocerca();
  } else {
    detenerGeocerca();
  }
});
