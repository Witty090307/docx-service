// ════════════════════════════════════════════════════════════════
// SERVICIO PDF — Documentos escolares estilo ESCALA OS
// Recibe { materia, titulo, subtitulo, bloques, alumno... } -> PDF
// Blindado: timeout interno + manejo de errores (nunca se cuelga)
// ════════════════════════════════════════════════════════════════
const express = require('express');
const { generar } = require('./generador.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'PDF escolar ESCALA OS', endpoint: 'POST /generate' });
});

app.post('/generate', async (req, res) => {
  // timeout de seguridad: si en 25s no terminó, responde error (no deja colgado a n8n)
  let respondido = false;
  const guard = setTimeout(() => {
    if (!respondido) {
      respondido = true;
      console.error('Timeout: la generación tardó demasiado');
      try { res.status(504).json({ error: 'Timeout generando PDF' }); } catch(e){}
    }
  }, 25000);

  try {
    const data = req.body || {};
    if (!data.titulo) data.titulo = 'Tarea';
    if (!data.materia) data.materia = 'General';
    if (!Array.isArray(data.bloques)) data.bloques = [];

    const tmpFile = path.join(os.tmpdir(), 'doc_' + Date.now() + '.pdf');

    await generar(data, tmpFile);
    await new Promise(r => setTimeout(r, 250));

    if (respondido) { try{ fs.unlinkSync(tmpFile); }catch(e){} return; }
    if (!fs.existsSync(tmpFile)) throw new Error('El PDF no se generó');

    respondido = true;
    clearTimeout(guard);

    const nombre = (data.titulo || 'documento').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '').trim() || 'documento';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(tmpFile); } catch(e){} });
    stream.on('error', () => { try { res.end(); } catch(e){} });

  } catch (err) {
    console.error('Error generando PDF:', err);
    if (!respondido) {
      respondido = true;
      clearTimeout(guard);
      res.status(500).json({ error: 'No se pudo generar el PDF', detalle: String(err && err.message || err) });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servicio PDF escolar corriendo en puerto ' + PORT));
