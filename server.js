// ════════════════════════════════════════════════════════════════
// SERVICIO PDF — Documentos escolares estilo ESCALA OS
// Recibe { materia, titulo, subtitulo, bloques, alumno... } -> PDF
// Resuelve imágenes desde Wikimedia antes de generar.
// Blindado: timeouts + manejo de errores (nunca se cuelga)
// ════════════════════════════════════════════════════════════════
const express = require('express');
const { generar } = require('./generador.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'PDF escolar ESCALA OS', endpoint: 'POST /generate' });
});

// ── Helpers de imagen (Wikimedia) ──
function getJSON(url){
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'EscalaDocsBot/1.0 (escolar)' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e){ reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout json')); });
  });
}
function descargarArchivo(url, destino, redirects){
  redirects = redirects || 0;
  return new Promise((resolve, reject) => {
    if(redirects > 5){ return reject(new Error('demasiados redirects')); }
    const file = fs.createWriteStream(destino);
    const req = https.get(url, { headers: { 'User-Agent': 'EscalaDocsBot/1.0 (escolar)' } }, res => {
      // seguir redirecciones (301/302/307/308)
      if([301,302,307,308].includes(res.statusCode) && res.headers.location){
        file.close(); fs.unlink(destino,()=>{});
        return resolve(descargarArchivo(res.headers.location, destino, redirects+1));
      }
      if(res.statusCode !== 200){ file.close(); fs.unlink(destino,()=>{}); return reject(new Error('status '+res.statusCode)); }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destino)));
    });
    req.on('error', e => { fs.unlink(destino,()=>{}); reject(e); });
    req.setTimeout(10000, () => { req.destroy(); fs.unlink(destino,()=>{}); reject(new Error('timeout descarga')); });
  });
}

// Busca una imagen en Wikimedia Commons por query y la descarga. Devuelve ruta local o null.
async function buscarImagenWikimedia(query){
  // intenta con el query completo y, si falla, con una versión simplificada
  const intentos = [query];
  // versión simplificada: primeras 2 palabras (ej. "puma mountain lion full body" -> "puma mountain")
  const palabras = query.trim().split(/\s+/);
  if(palabras.length > 2){ intentos.push(palabras.slice(0,2).join(' ')); }
  if(palabras.length > 1){ intentos.push(palabras[0]); }  // solo la primera palabra

  for(const q of intentos){
    const ruta = await intentarBusqueda(q);
    if(ruta){ return ruta; }
  }
  return null;
}

async function intentarBusqueda(query){
  try {
    console.log('[IMG]   intento con:', query);
    const apiBusqueda = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search'
      + '&gsrsearch=' + encodeURIComponent(query)
      + '&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=900';
    const data = await getJSON(apiBusqueda);
    if(!data || !data.query || !data.query.pages){ console.log('[IMG]   sin resultados de la API'); return null; }

    // palabras del query (para puntuar relevancia por el nombre del archivo)
    const palabrasQuery = query.toLowerCase().split(/\s+/).filter(w=>w.length>2);
    // palabras "basura" que indican que la imagen NO es lo que buscamos
    const BASURA = ['map','mapa','range','distribution','logo','seal','coat','arms','escudo','flag','bandera',
      'car','auto','vehicle','mercury','aircraft','helicopter','plane','engine','stamp','sello','coin','moneda',
      'chart','graph','diagram','icon','symbol','sign','label','poster','book','cover','stadium','team','jersey',
      'football','soccer','logo','brand','company','helicopter','tank','ship','boat','missile'];

    // puntuar cada página por su título
    const scored = Object.values(data.query.pages).map(pg => {
      const titulo = (pg.title || '').toLowerCase();
      let score = 0;
      // +2 por cada palabra del query que aparece en el nombre del archivo
      for(const w of palabrasQuery){ if(titulo.includes(w)) score += 2; }
      // -3 por cada palabra basura
      for(const b of BASURA){ if(titulo.includes(b)) score -= 3; }
      // respeta un poco el ranking original de búsqueda
      score -= (pg.index || 0) * 0.05;
      return { pg, score, titulo };
    });
    // ordenar por mejor puntaje
    scored.sort((a,b)=>b.score - a.score);

    console.log('[IMG]   evaluando', scored.length, 'resultados por relevancia del título');
    let candidatos = 0;
    for(const item of scored){
      // descartar los que tienen puntaje muy negativo (claramente no es el tema)
      if(item.score < 0) { continue; }
      const info = item.pg.imageinfo && item.pg.imageinfo[0];
      if(!info) continue;
      const mime = info.mime || '';
      if(!/image\/(png|jpeg|jpg)/i.test(mime)) continue;
      const url = info.thumburl || info.url;
      if(!url) continue;
      candidatos++;
      const ext = mime.includes('png') ? '.png' : '.jpg';
      const destino = path.join(os.tmpdir(), 'img_' + Date.now() + '_' + Math.floor(Math.random()*1000) + ext);
      try {
        await descargarArchivo(url, destino);
        if(fs.existsSync(destino) && fs.statSync(destino).size > 2000){
          console.log('[IMG]   elegida:', item.titulo, '(score', item.score.toFixed(1), ')');
          return destino;
        }
        try{ fs.unlinkSync(destino); }catch(e){}
      } catch(e){ console.log('[IMG]   falló descarga:', e && e.message); }
    }
    console.log('[IMG]   candidatos válidos:', candidatos, '(ninguno apto)');
    return null;
  } catch(e){
    console.error('[IMG]   error API:', e && e.message);
    return null;
  }
}

// Resuelve todos los bloques imagen: busca y descarga, pone la ruta local.
async function resolverImagenes(data){
  if(!Array.isArray(data.bloques)) return [];
  const rutasTemp = [];
  for(const b of data.bloques){
    if(b && b.tipo === 'imagen' && b.query && !b.ruta){
      console.log('[IMG] buscando:', b.query);
      const ruta = await buscarImagenWikimedia(b.query);
      if(ruta){
        b.ruta = ruta; rutasTemp.push(ruta);
        console.log('[IMG] OK ->', ruta);
      } else {
        console.log('[IMG] no se encontró imagen apta para:', b.query);
      }
    }
  }
  return rutasTemp;
}

app.post('/generate', async (req, res) => {
  let respondido = false;
  const guard = setTimeout(() => {
    if (!respondido) { respondido = true; console.error('Timeout global'); try { res.status(504).json({ error: 'Timeout generando PDF' }); } catch(e){} }
  }, 40000);  // 40s: da margen para descargar imagen + generar

  let rutasTemp = [];
  try {
    const data = req.body || {};
    if (!data.titulo) data.titulo = 'Tarea';
    if (!data.materia) data.materia = 'General';
    if (!Array.isArray(data.bloques)) data.bloques = [];

    // resolver imágenes (busca en Wikimedia y descarga). Si falla, sigue sin imagen.
    try { rutasTemp = await resolverImagenes(data) || []; } catch(e){ console.error('img:', e && e.message); }

    const tmpFile = path.join(os.tmpdir(), 'doc_' + Date.now() + '.pdf');
    await generar(data, tmpFile);
    await new Promise(r => setTimeout(r, 200));

    const limpiar = () => { try{ fs.unlinkSync(tmpFile); }catch(e){} rutasTemp.forEach(r=>{ try{ fs.unlinkSync(r); }catch(e){} }); };

    if (respondido) { limpiar(); return; }
    if (!fs.existsSync(tmpFile)) throw new Error('El PDF no se generó');

    respondido = true;
    clearTimeout(guard);

    const nombre = (data.titulo || 'documento').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '').trim() || 'documento';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end', limpiar);
    stream.on('error', () => { try { res.end(); } catch(e){} limpiar(); });

  } catch (err) {
    console.error('Error generando PDF:', err);
    rutasTemp.forEach(r=>{ try{ fs.unlinkSync(r); }catch(e){} });
    if (!respondido) { respondido = true; clearTimeout(guard); res.status(500).json({ error: 'No se pudo generar el PDF', detalle: String(err && err.message || err) }); }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servicio PDF escolar corriendo en puerto ' + PORT));
