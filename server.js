// ════════════════════════════════════════════════════════════════
// Mini-servicio: recibe markdown + datos -> devuelve DOCX bonito
// Basado en la identidad visual de la skill escuela-docs de Daniel
// ════════════════════════════════════════════════════════════════
const express = require('express');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak
} = require('docx');

const app = express();
app.use(express.json({ limit: '5mb' }));

// ---- paleta por materia (de la skill) ----
const COLORES = {
  'base de datos': '1F3A68', 'informatica': '1F3A68', 'bd': '1F3A68',
  'programacion': '1E5128', 'software': '1E5128',
  'redes': 'B85C00', 'telecom': 'B85C00',
  'sistemas operativos': '2C3E50',
  'matematicas': '8B1F2E', 'fisica': '8B1F2E',
  'quimica': '2D5016', 'biologia': '2D5016',
  'historia': '5D3A1F', 'sociales': '5D3A1F',
  'literatura': '5B1A2D', 'filosofia': '5B1A2D',
  'ingles': '1A3A5C', 'idiomas': '1A3A5C',
  'diseno': '4A1D5F', 'arte': '4A1D5F'
};
function colorPorMateria(materia){
  if(!materia) return '1F3A68';
  const m = materia.toLowerCase();
  for(const k in COLORES){ if(m.includes(k)) return COLORES[k]; }
  return '1F3A68';
}
function aclarar(hex){
  // versión clara para cajas: subir luminosidad
  const r=parseInt(hex.substr(0,2),16), g=parseInt(hex.substr(2,2),16), b=parseInt(hex.substr(4,2),16);
  const mix=(c)=>Math.round(c+(255-c)*0.82).toString(16).padStart(2,'0');
  return mix(r)+mix(g)+mix(b);
}

const FUENTE = 'Lexend';

// ---- parser de markdown a bloques ----
function parseMarkdown(md){
  const lines = md.split('\n');
  const blocks = [];
  let table = null, list = null;
  for(let raw of lines){
    const line = raw.replace(/\r$/,'');
    // tabla
    if(/^\s*\|.*\|\s*$/.test(line)){
      if(list){ blocks.push({type:'list', items:list}); list=null; }
      if(/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue; // separador
      const cells = line.split('|').map(c=>c.trim()).filter((c,i,a)=>!(i===0&&c==='')&&!(i===a.length-1&&c===''));
      if(!table){ table={header:cells, rows:[]}; } else { table.rows.push(cells); }
      continue;
    } else if(table){ blocks.push({type:'table', ...table}); table=null; }
    if(/^\s*---+\s*$/.test(line)) continue;
    let m;
    if(m=line.match(/^#\s+(.*)/)){ if(list){blocks.push({type:'list',items:list});list=null;} blocks.push({type:'h1', text:m[1]}); continue; }
    if(m=line.match(/^##\s+(.*)/)){ if(list){blocks.push({type:'list',items:list});list=null;} blocks.push({type:'h2', text:m[1]}); continue; }
    if(m=line.match(/^###\s+(.*)/)){ if(list){blocks.push({type:'list',items:list});list=null;} blocks.push({type:'h3', text:m[1]}); continue; }
    if(m=line.match(/^[-*]\s+(.*)/)){ if(!list)list=[]; list.push(m[1]); continue; }
    else if(list){ blocks.push({type:'list', items:list}); list=null; }
    if(line.trim()==='') continue;
    blocks.push({type:'p', text:line});
  }
  if(table) blocks.push({type:'table', ...table});
  if(list) blocks.push({type:'list', items:list});
  return blocks;
}

// ---- runs con **bold** e *italic* ----
function runs(text){
  const out=[]; let rest=text; const re=/(\*\*(.+?)\*\*|\*(.+?)\*)/;
  let m;
  while((m=rest.match(re))){
    const before=rest.slice(0,m.index);
    if(before) out.push(new TextRun({text:before, font:FUENTE}));
    if(m[2]!==undefined) out.push(new TextRun({text:m[2], bold:true, font:FUENTE}));
    else out.push(new TextRun({text:m[3], italics:true, font:FUENTE}));
    rest=rest.slice(m.index+m[0].length);
  }
  if(rest) out.push(new TextRun({text:rest, font:FUENTE}));
  return out.length?out:[new TextRun({text:text, font:FUENTE})];
}

function buildDoc({ titulo, materia, alumno, grupo, plantel, fecha, contenido }){
  const COLOR = colorPorMateria(materia);
  const CLARO = aclarar(COLOR);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' };
  const borders = { top:border, bottom:border, left:border, right:border };
  const blocks = parseMarkdown(contenido);

  const children = [];

  // ===== PORTADA =====
  // banda de color con título (usando shading de párrafo)
  if(materia){
    children.push(new Paragraph({
      shading:{ type:ShadingType.CLEAR, fill:COLOR },
      spacing:{ before:0, after:0 },
      children:[new TextRun({ text: materia.toUpperCase(), color:'FFFFFF', bold:true, font:FUENTE, size:20, characterSpacing:40 })]
    }));
  }
  children.push(new Paragraph({
    shading:{ type:ShadingType.CLEAR, fill:COLOR },
    spacing:{ before:0, after:0 },
    children:[new TextRun({ text: titulo, color:'FFFFFF', bold:true, font:FUENTE, size:52 })]
  }));
  // datos del alumno dentro de la banda
  const metaLine = (label,val)=> new Paragraph({
    shading:{ type:ShadingType.CLEAR, fill:COLOR },
    spacing:{ before:0, after:0 },
    children:[ new TextRun({text:label+'  ', color:'FFFFFF', bold:true, font:FUENTE, size:22}),
               new TextRun({text:val||'', color:'FFFFFF', font:FUENTE, size:22}) ]
  });
  if(alumno) children.push(metaLine('Alumno:', alumno));
  const linea2 = [];
  if(grupo) linea2.push('Grupo: '+grupo);
  if(plantel) linea2.push('Plantel: '+plantel);
  if(linea2.length) children.push(new Paragraph({ shading:{type:ShadingType.CLEAR, fill:COLOR}, spacing:{before:0,after:0}, children:[new TextRun({text:linea2.join('    '), color:'FFFFFF', font:FUENTE, size:22})] }));
  if(fecha) children.push(metaLine('Fecha:', fecha));
  // espacio después de portada
  children.push(new Paragraph({ spacing:{before:0, after:360}, children:[new TextRun({text:'', font:FUENTE})] }));

  // ===== CONTENIDO =====
  for(const b of blocks){
    if(b.type==='h1'){ continue; } // el título ya está en portada
    if(b.type==='h2'){
      children.push(new Paragraph({
        spacing:{before:280, after:120},
        border:{ bottom:{ style:BorderStyle.SINGLE, size:6, color:CLARO } },
        children:[new TextRun({text:b.text, bold:true, font:FUENTE, size:34, color:COLOR})]
      }));
    } else if(b.type==='h3'){
      children.push(new Paragraph({ spacing:{before:180,after:80}, children:[new TextRun({text:b.text, bold:true, font:FUENTE, size:26, color:'333333'})] }));
    } else if(b.type==='p'){
      children.push(new Paragraph({ spacing:{after:140, line:320}, children:runs(b.text) }));
    } else if(b.type==='list'){
      for(const it of b.items){
        children.push(new Paragraph({ bullet:{level:0}, spacing:{after:60, line:300}, children:runs(it) }));
      }
    } else if(b.type==='table'){
      const headerRow = new TableRow({ tableHeader:true, cantSplit:true, children: b.header.map(h=>new TableCell({
        borders, shading:{fill:COLOR, type:ShadingType.CLEAR}, margins:{top:60,bottom:60,left:140,right:140},
        children:[new Paragraph({children:[new TextRun({text:h, bold:true, color:'FFFFFF', font:FUENTE, size:22})]})]
      })) });
      const dataRows = b.rows.map(r=> new TableRow({ cantSplit:true, children: r.map(c=>new TableCell({
        borders, shading:{fill:'FFFFFF', type:ShadingType.CLEAR}, margins:{top:60,bottom:60,left:140,right:140},
        children:[new Paragraph({children:[new TextRun({text:c, font:FUENTE, size:22})]})]
      })) }));
      children.push(new Table({ width:{size:100, type:WidthType.PERCENTAGE}, rows:[headerRow, ...dataRows] }));
      children.push(new Paragraph({ spacing:{after:120}, children:[new TextRun({text:'', font:FUENTE})] }));
    }
  }

  return new Document({
    styles:{ default:{ document:{ run:{ font:FUENTE } } } },
    sections:[{ properties:{ page:{ margin:{ top:0, right:0, bottom:720, left:0 } } },
      children: children.map((c,i)=> c) }]
  });
}

app.get('/', (req,res)=> res.send('DOCX service OK. POST /generate'));

app.post('/generate', async (req,res)=>{
  try{
    const doc = buildDoc(req.body || {});
    const buffer = await Packer.toBuffer(doc);
    const nombre = (req.body.titulo || 'Tarea').replace(/[^\w\s-]/g,'').trim();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.docx"`);
    res.send(buffer);
  }catch(e){
    console.error(e);
    res.status(500).json({error:String(e)});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('DOCX service on '+PORT));
