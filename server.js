// ════════════════════════════════════════════════════════════════
// SERVICIO PDF — Documentos escolares estilo ESCALA OS
// Recibe JSON con { materia, titulo, subtitulo, bloques, alumno... }
// y devuelve un PDF generado con generador.js
// ════════════════════════════════════════════════════════════════
const express = require('express');
const { generar } = require('./generador.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

// healthcheck
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'PDF escolar ESCALA OS', endpoint: 'POST /generate' });
});

// endpoint principal
app.post('/generate', async (req, res) => {
  try {
    const data = req.body || {};

    // validación mínima
    if (!data.titulo) data.titulo = 'Tarea';
    if (!data.materia) data.materia = 'General';
    if (!Array.isArray(data.bloques)) data.bloques = [];

    // ruta temporal para el PDF
    const tmpFile = path.join(os.tmpdir(), 'doc_' + Date.now() + '.pdf');

    // generar el PDF
    await generar(data, tmpFile);

    // esperar un instante a que el archivo termine de escribirse
    await new Promise(r => setTimeout(r, 300));

    if (!fs.existsSync(tmpFile)) {
      throw new Error('El PDF no se generó');
    }

    // mandar el PDF como respuesta
    const nombre = (data.titulo || 'documento').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '').trim() || 'documento';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(tmpFile); } catch(e){} });

  } catch (err) {
    console.error('Error generando PDF:', err);
    res.status(500).json({ error: 'No se pudo generar el PDF', detalle: String(err && err.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servicio PDF escolar corriendo en puerto ' + PORT);
});
