// ════════════════════════════════════════════════════════════════
// Servicio: recibe markdown + datos -> devuelve PDF bonito y parejo
// Diseño basado en la identidad visual de escuela-docs
// ════════════════════════════════════════════════════════════════
const express = require('express');
const PDFDocument = require('pdfkit');

const app = express();
app.use(express.json({ limit: '5mb' }));

// ---- paleta por materia ----
const COLORES = {
  'base de datos':'#1F3A68','informatica':'#1F3A68','bd':'#1F3A68',
  'programacion':'#1E5128','software':'#1E5128',
  'redes':'#B85C00','telecom':'#B85C00',
  'sistemas operativos':'#2C3E50',
  'matematicas':'#8B1F2E','fisica':'#8B1F2E',
  'quimica':'#2D5016','biologia':'#2D5016',
  'historia':'#5D3A1F','sociales':'#5D3A1F',
  'literatura':'#5B1A2D','filosofia':'#5B1A2D',
  'ingles':'#1A3A5C','idiomas':'#1A3A5C',
  'diseno':'#4A1D5F','arte':'#4A1D5F'
};
function colorPorMateria(materia){
  if(!materia) return '#1F3A68';
  const m = materia.toLowerCase();
  for(const k in COLORES){ if(m.includes(k)) return COLORES[k]; }
  return '#1F3A68';
}
function aclarar(hex){
  const r=parseInt(hex.substr(1,2),16),g=parseInt(hex.substr(3,2),16),b=parseInt(hex.substr(5,2),16);
  const mix=c=>Math.round(c+(255-c)*0.88).toString(16).padStart(2,'0');
  return '#'+mix(r)+mix(g)+mix(b);
}

// ---- parser markdown -> bloques ----
function parseMarkdown(md){
  const lines=md.split('\n'); const blocks=[]; let table=null,list=null;
  for(let raw of lines){
    const line=raw.replace(/\r$/,'');
    const limpio=line.replace(/\*\*/g,'').trim().toLowerCase();
    // filtrar línea redundante tipo "Materia: X · Grupo: Y · Especialidad: Z"
    if(/^(materia|grupo|especialidad|plantel|alumno|fecha)\s*:/.test(limpio) &&
       (limpio.match(/:/g)||[]).length>=2){ continue; }
    if(/^\s*\|.*\|\s*$/.test(line)){
      if(list){blocks.push({type:'list',items:list});list=null;}
      if(/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue;
      const cells=line.split('|').map(c=>c.trim()).filter((c,i,a)=>!(i===0&&c==='')&&!(i===a.length-1&&c===''));
      if(!table){table={header:cells,rows:[]};}else{table.rows.push(cells);}
      continue;
    } else if(table){blocks.push({type:'table',...table});table=null;}
    if(/^\s*---+\s*$/.test(line)) continue;
    let m;
    if(m=line.match(/^#\s+(.*)/)){ continue; } // título va en portada
    if(m=line.match(/^##\s+(.*)/)){ if(list){blocks.push({type:'list',items:list});list=null;} blocks.push({type:'h2',text:m[1]}); continue; }
    if(m=line.match(/^###\s+(.*)/)){ if(list){blocks.push({type:'list',items:list});list=null;} blocks.push({type:'h3',text:m[1]}); continue; }
    if(m=line.match(/^[-*]\s+(.*)/)){ if(!list)list=[]; list.push(m[1]); continue; }
    else if(list){ blocks.push({type:'list',items:list}); list=null; }
    if(line.trim()==='') continue;
    blocks.push({type:'p',text:line});
  }
  if(table) blocks.push({type:'table',...table});
  if(list) blocks.push({type:'list',items:list});
  return blocks;
}

// ---- escribe texto con **bold** e *italic* en una línea fluida ----
function richText(doc, text, opts){
  const {x, width, size, color, lineGap} = opts;
  const parts=[]; let rest=text; const re=/(\*\*(.+?)\*\*|\*(.+?)\*)/;
  let m;
  while((m=rest.match(re))){
    const before=rest.slice(0,m.index);
    if(before) parts.push({t:before,b:false,i:false});
    if(m[2]!==undefined) parts.push({t:m[2],b:true,i:false});
    else parts.push({t:m[3],b:false,i:true});
    rest=rest.slice(m.index+m[0].length);
  }
  if(rest) parts.push({t:rest,b:false,i:false});
  if(!parts.length) parts.push({t:text,b:false,i:false});

  doc.fontSize(size).fillColor(color||'#1a1a1a');
  parts.forEach((p,idx)=>{
    const font = p.b ? 'Helvetica-Bold' : (p.i ? 'Helvetica-Oblique' : 'Helvetica');
    doc.font(font);
    const isLast = idx===parts.length-1;
    doc.text(p.t, idx===0?x:doc.x, undefined, {
      width, continued: !isLast, lineGap: lineGap||4
    });
  });
}

function buildPDF(res, data){
  const { titulo, materia, alumno, grupo, plantel, fecha, contenido } = data;
  const COLOR = colorPorMateria(materia);
  const CLARO = aclarar(COLOR);
  const blocks = parseMarkdown(contenido||'');

  const doc = new PDFDocument({ size:'A4', margins:{top:0,left:0,right:0,bottom:50} });
  const nombre = (titulo||'Tarea').replace(/[^\w\s-]/g,'').trim();
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition',`attachment; filename="${nombre}.pdf"`);
  doc.pipe(res);

  const PW = doc.page.width;          // 595
  const M = 55;                        // margen contenido
  const CW = PW - M*2;                 // ancho de contenido

  // ===== PORTADA (banda de color) =====
  let bandH = 150;
  doc.rect(0,0,PW,bandH).fill(COLOR);
  let y = 32;
  if(materia){
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF')
       .text(materia.toUpperCase(), M, y, {characterSpacing:3, width:CW});
    y += 22;
  }
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#FFFFFF')
     .text(titulo||'Tarea', M, y, {width:CW, lineGap:1});
  y = doc.y + 10;
  doc.fontSize(10.5).fillColor('#FFFFFF');
  const metaLines = [];
  if(alumno) metaLines.push(['Alumno: ', alumno]);
  const l2=[]; if(grupo) l2.push('Grupo: '+grupo); if(plantel) l2.push('Plantel: '+plantel);
  if(fecha) metaLines.push(['Fecha: ', fecha]);
  // dibujar alumno
  if(alumno){ doc.font('Helvetica-Bold').text('Alumno: ',M,y,{continued:true}).font('Helvetica').text(alumno); y=doc.y+1; }
  if(l2.length){ doc.font('Helvetica').text(l2.join('     '),M,y); y=doc.y+1; }
  if(fecha){ doc.font('Helvetica-Bold').text('Fecha: ',M,y,{continued:true}).font('Helvetica').text(fecha); y=doc.y; }

  // asegurar que la banda cubra el texto
  // (si el texto se pasó, repintar no es trivial; bandH fija suele bastar)
  doc.y = bandH + 28;

  // ===== CONTENIDO =====
  function ensureSpace(h){ if(doc.y + h > doc.page.height - 55){ doc.addPage(); doc.y = 50; } }

  for(const b of blocks){
    if(b.type==='h2'){
      ensureSpace(46);
      doc.moveDown(0.3);
      const yy=doc.y;
      doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR).text(b.text, M, yy, {width:CW});
      doc.moveTo(M, doc.y+3).lineTo(M+CW, doc.y+3).lineWidth(1.5).strokeColor(CLARO).stroke();
      doc.moveDown(0.5);
    } else if(b.type==='h3'){
      ensureSpace(28);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#333333').text(b.text, M, doc.y, {width:CW});
      doc.moveDown(0.3);
    } else if(b.type==='p'){
      ensureSpace(24);
      richText(doc, b.text, {x:M, width:CW, size:10.5, color:'#222222', lineGap:4});
      doc.moveDown(0.5);
    } else if(b.type==='list'){
      for(const it of b.items){
        ensureSpace(20);
        const by=doc.y;
        doc.circle(M+4, by+6, 1.8).fill(COLOR);
        richText(doc, it, {x:M+16, width:CW-16, size:10.5, color:'#222222', lineGap:3});
        doc.moveDown(0.25);
      }
      doc.moveDown(0.3);
    } else if(b.type==='table'){
      drawTable(doc, b, {x:M, width:CW, color:COLOR, claro:CLARO, ensureSpace});
      doc.moveDown(0.8);
    }
  }

  doc.end();
}

// ---- tabla con columnas de ANCHO IGUAL (parejo) ----
function drawTable(doc, b, opts){
  const {x, width, color, ensureSpace} = opts;
  const cols = b.header.length;
  const colW = width / cols;          // ANCHO IGUAL para todas
  const padX = 8, padY = 6;
  const fs = 9.5;

  function rowHeight(cells, bold){
    doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(fs);
    let max = 0;
    cells.forEach(c=>{
      const h = doc.heightOfString(String(c||''), {width: colW-padX*2});
      if(h>max) max=h;
    });
    return max + padY*2;
  }

  function drawRow(cells, {bold, fill, txtColor, borderC}){
    const h = rowHeight(cells, bold);
    ensureSpace(h+2);
    const y0 = doc.y;
    // fondo
    if(fill){ doc.rect(x, y0, width, h).fill(fill); }
    // texto + bordes por celda
    cells.forEach((c,i)=>{
      const cx = x + i*colW;
      doc.lineWidth(0.7).strokeColor(borderC||'#C9D4E3').rect(cx, y0, colW, h).stroke();
      doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(fs).fillColor(txtColor||'#222222');
      doc.text(String(c||''), cx+padX, y0+padY, {width: colW-padX*2});
    });
    doc.y = y0 + h;
  }

  // header
  drawRow(b.header, {bold:true, fill:color, txtColor:'#FFFFFF', borderC:color});
  // filas
  b.rows.forEach(r=>{
    // rellenar celdas faltantes para que cuadre
    const row = [...r]; while(row.length<cols) row.push('');
    drawRow(row.slice(0,cols), {bold:false, fill:null, txtColor:'#222222', borderC:'#C9D4E3'});
  });
}

app.get('/', (req,res)=> res.send('PDF service OK. POST /generate'));
app.post('/generate', (req,res)=>{
  try{ buildPDF(res, req.body||{}); }
  catch(e){ console.error(e); res.status(500).json({error:String(e)}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('PDF service on '+PORT));
