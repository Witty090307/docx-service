// ════════════════════════════════════════════════════════════════
// GENERADOR DE DOCUMENTOS ESCOLARES — estilo ESCALA OS
// Diseño: tarjetas redondeadas, sombras suaves, color por materia
// Soporta: párrafos, tablas (opcionales), diagramas, imágenes, listas
// Regla clave: NO parte párrafos ni tablas a media hoja
// ════════════════════════════════════════════════════════════════
const PDFDocument = require('pdfkit');
const fs = require('fs');

// ---------- PALETAS por tipo de materia ----------
const PALETAS = {
  azul:     { main:'#1B2B6B', mid:'#3B5BDB', soft:'#6B8CFF', eyebrow:'#AEBEFF', sub:'#D8E0FF', tintRow:'#F6F8FE' },
  verde:    { main:'#14532D', mid:'#22A155', soft:'#5BC97E', eyebrow:'#A7E6BE', sub:'#D6F0DF', tintRow:'#F2FBF5' },
  naranja:  { main:'#9A3412', mid:'#EA580C', soft:'#FB923C', eyebrow:'#FCC49B', sub:'#FBE3D2', tintRow:'#FEF6F0' },
  vino:     { main:'#7A1F2B', mid:'#C0392B', soft:'#E8857E', eyebrow:'#F0B5B0', sub:'#F7DEDB', tintRow:'#FDF3F2' },
  morado:   { main:'#4A1D6E', mid:'#7C3AED', soft:'#A78BFA', eyebrow:'#CDBAF5', sub:'#E7DEFB', tintRow:'#F8F5FE' },
  cafe:     { main:'#5A3A1F', mid:'#9A6A3A', soft:'#C9A176', eyebrow:'#E0C9AC', sub:'#EFE3D4', tintRow:'#FAF6F0' },
  gris:     { main:'#2C3E50', mid:'#5D7088', soft:'#9AAAC0', eyebrow:'#C3CEDD', sub:'#DCE3EC', tintRow:'#F5F7F9' },
};

// mapeo materia -> paleta (por palabras clave)
function paletaPorMateria(materia){
  // normaliza acentos para que "Química" matchee "quimic"
  const m = (materia||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const reglas = [
    { k:['program','base de dato','bd','software','c++','java','python','desarrollo'], p:'azul' },
    { k:['quimic','biolog','ciencias natural','anatom','ecolog'], p:'verde' },
    { k:['red','telecom','conectiv','networking','infraestructura'], p:'naranja' },
    { k:['matemat','calcul','algebra','geometr','fisic','estadist'], p:'vino' },
    { k:['historia','social','civic','geograf','etica','filosof'], p:'cafe' },
    { k:['litera','espanol','lectura','redacc','ingles','idioma'], p:'morado' },
    { k:['sistema','operativ','windows','linux','hardware'], p:'gris' },
  ];
  for(const r of reglas){ if(r.k.some(kw=>m.includes(kw))) return r.p; }
  return 'azul'; // default
}

// ---------- helpers de dibujo ----------
function crearDoc(rutaSalida){
  const doc = new PDFDocument({ size:'A4', margins:{top:0,left:0,right:0,bottom:0} });
  const stream = fs.createWriteStream(rutaSalida);
  doc.pipe(stream);
  doc._outStream = stream;   // guardamos referencia al stream del archivo
  return doc;
}

// ════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// data = { materia, titulo, subtitulo, alumno, grupo, fecha, bloques:[...] }
// bloques: {tipo:'h2'|'p'|'tabla'|'lista'|'diagrama'|'imagen', ...}
// ════════════════════════════════════════════════════════════════
async function generar(data, rutaSalida){
  const colorKey = data.colorForzado || paletaPorMateria(data.materia);
  const P = PALETAS[colorKey];
  const INK='#1E2630', BODY='#3D4654', LINE='#E7EBF1', WHITE='#FFFFFF', BG='#FFFFFF';
  const M=52;

  const doc = crearDoc(rutaSalida);
  const PW=doc.page.width, PH=doc.page.height, CW=PW-M*2;
  const BOTTOM = PH-50;

  function rr(x,y,w,h,r,c){ doc.roundedRect(x,y,w,h,r).fill(c); }
  function shadow(x,y,w,h,r){
    doc.save();
    for(let i=4;i>=1;i--){ doc.fillOpacity(0.04).roundedRect(x-i,y+i+1,w+i*2,h+i,r+i).fill(P.main); }
    doc.restore(); doc.fillOpacity(1);
  }
  function nuevaPagina(){ doc.addPage(); doc.rect(0,0,PW,PH).fill(BG); doc.y=52; }
  function espacio(h){ if(doc.y+h>BOTTOM){ nuevaPagina(); } }

  doc.rect(0,0,PW,PH).fill(BG);

  // ───── PORTADA ─────
  const heroH=192;
  shadow(M,44,CW,heroH,18);
  rr(M,44,CW,heroH,18,P.main);
  doc.save();
  doc.roundedRect(M,44,CW,heroH,18).clip();
  doc.fillOpacity(0.13).circle(M+CW-20,70,130).fill(P.soft);
  doc.fillOpacity(0.08).circle(M+CW-110,195,95).fill(WHITE);
  doc.restore(); doc.fillOpacity(1);

  let y=66;
  doc.fillColor(P.eyebrow).font('Helvetica-Bold').fontSize(9).text(data.plantel||'CETis #128', M+30, y, {characterSpacing:2});
  y+=26;
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(26).text(data.titulo, M+30, y, {width:CW-150, lineGap:1});
  y=doc.y+7;
  if(data.subtitulo){ doc.fillColor(P.sub).font('Helvetica').fontSize(11).text(data.subtitulo, M+30, y, {width:CW-160, lineGap:2}); }

  // tarjeta de datos
  const fy=44+heroH+16, fh=60;
  shadow(M,fy,CW,fh,14);
  rr(M,fy,CW,fh,14,WHITE);
  doc.roundedRect(M,fy,CW,fh,14).lineWidth(0.8).strokeColor(LINE).stroke();
  function dato(label,val,x,w){
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor(P.mid).text((label||'').toUpperCase(), x, fy+15, {characterSpacing:1.5, width:w});
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(val||'', x, fy+27, {width:w});
  }
  const x0=M+22, wA=128,wG=140,wM=95,wF=100;
  dato('Alumno', data.alumno, x0, wA);
  dato('Grupo', data.grupo, x0+wA+8, wG);
  dato('Materia', data.materia, x0+wA+wG+16, wM);
  dato('Fecha', data.fecha, x0+wA+wG+wM+24, wF);
  rr(M, fy+16, 4, fh-32, 2, P.mid);

  doc.y=fy+fh+28;

  // ───── helpers de contenido ─────
  let sec=0;
  function h2(t){
    espacio(80); // asegura que el título no quede solo al final
    sec++;
    const yy=doc.y+4;
    rr(M, yy, 22, 22, 7, P.main);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(10.5).text(String(sec), M, yy+6, {width:22, align:'center'});
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(15).text(t, M+32, yy+3, {width:CW-32});
    doc.y=Math.max(doc.y, yy+22)+8;
  }
  // mide alto de un párrafo con bold
  function medirParrafo(txt){
    const limpio = txt.replace(/\*\*/g,'');
    return doc.font('Helvetica').fontSize(10.5).heightOfString(limpio, {width:CW, lineGap:3.5});
  }
  function parrafo(txt){
    const h = medirParrafo(txt);
    // REGLA: si el párrafo completo no cabe (y no es gigante), saltarlo entero
    if(doc.y + h > BOTTOM && h < (PH-120)){ nuevaPagina(); }
    else { espacio(20); }
    const parts=[]; let rest=txt; const re=/\*\*(.+?)\*\*/; let m;
    while((m=rest.match(re))){ if(rest.slice(0,m.index)) parts.push({t:rest.slice(0,m.index),b:false}); parts.push({t:m[1],b:true}); rest=rest.slice(m.index+m[0].length); }
    if(rest) parts.push({t:rest,b:false});
    doc.fontSize(10.5).fillColor(BODY);
    parts.forEach((pp,i)=>{ doc.font(pp.b?'Helvetica-Bold':'Helvetica'); doc.text(pp.t, i===0?M:doc.x, undefined, {width:CW, continued:i<parts.length-1, lineGap:3.5, align:'left'}); });
    doc.moveDown(0.5);
  }
  function lista(items){
    items.forEach(it=>{
      const h = doc.font('Helvetica').fontSize(10.5).heightOfString(it,{width:CW-18});
      if(doc.y+h>BOTTOM){ nuevaPagina(); }
      const by=doc.y;
      doc.circle(M+4, by+6, 2).fill(P.mid);
      doc.fillColor(BODY).font('Helvetica').fontSize(10.5).text(it, M+16, by, {width:CW-16, lineGap:3});
      doc.moveDown(0.2);
    });
    doc.moveDown(0.4);
  }
  function tabla(headers, rows){
    const cols=headers.length, colW=CW/cols, padX=11, padY=7.5, fs=9.5;
    const headH=fs+padY*2;
    const rowHs=rows.map(r=>{ let mh=0; r.forEach(c=>{ mh=Math.max(mh, doc.font('Helvetica').fontSize(fs).heightOfString(String(c),{width:colW-padX*2})); }); return mh+padY*2; });
    const totalH=headH+rowHs.reduce((a,b)=>a+b,0);
    // REGLA: tabla completa no se parte; si no cabe, salta de hoja
    if(doc.y + totalH + 6 > BOTTOM && totalH < (PH-120)){ nuevaPagina(); }
    const startY=doc.y+2;
    shadow(M,startY,CW,totalH,11);
    doc.save();
    doc.roundedRect(M,startY,CW,totalH,11).clip();
    doc.rect(M,startY,CW,headH).fill(P.main);
    headers.forEach((h,i)=>{ doc.font('Helvetica-Bold').fontSize(fs).fillColor(WHITE).text(h, M+i*colW+padX, startY+padY, {width:colW-padX*2}); });
    let yR=startY+headH;
    rows.forEach((r,ri)=>{ const rh=rowHs[ri]; if(ri%2===1){ doc.rect(M,yR,CW,rh).fill(P.tintRow); } r.forEach((c,i)=>{ doc.font('Helvetica').fontSize(fs).fillColor(BODY).text(String(c), M+i*colW+padX, yR+padY, {width:colW-padX*2}); }); yR+=rh; });
    doc.restore();
    doc.roundedRect(M,startY,CW,totalH,11).lineWidth(0.8).strokeColor(LINE).stroke();
    doc.y=startY+totalH;
    doc.moveDown(1.1); // espacio generoso después de tabla
  }
  // imagen (ruta local ya descargada) — va sola, SIN texto/caption debajo
  function imagen(ruta, caption, maxH){
    if(!fs.existsSync(ruta)) return;
    maxH = maxH || 230;
    // tarjeta redondeada que contiene la imagen
    try {
      const img = doc.openImage(ruta);
      const ratio = img.width/img.height;
      let w = CW, h = w/ratio;
      if(h>maxH){ h=maxH; w=h*ratio; }
      const totalH = h + 16;
      if(doc.y+totalH>BOTTOM){ nuevaPagina(); }
      const startY=doc.y;
      const x = M + (CW-w)/2;
      shadow(x-8, startY, w+16, h+16, 12);
      rr(x-8, startY, w+16, h+16, 12, WHITE);
      doc.roundedRect(x-8,startY,w+16,h+16,12).lineWidth(0.8).strokeColor(LINE).stroke();
      doc.save();
      doc.roundedRect(x, startY+8, w, h, 8).clip();
      doc.image(ruta, x, startY+8, {width:w, height:h});
      doc.restore();
      doc.y = startY + h + 16;
      // (sin caption: las imágenes van solas, sin texto debajo)
      doc.moveDown(0.6);
    } catch(e){ /* si la imagen falla, se omite sin romper */ }
  }

  // ───── render de bloques (cada uno blindado: si uno falla, se salta) ─────
  for(const b of (Array.isArray(data.bloques)?data.bloques:[])){
    try {
      if(!b || !b.tipo) continue;
      if(b.tipo==='h2' && b.texto) h2(String(b.texto));
      else if(b.tipo==='p' && b.texto) parrafo(String(b.texto));
      else if(b.tipo==='lista' && Array.isArray(b.items) && b.items.length) lista(b.items.map(String));
      else if(b.tipo==='tabla' && Array.isArray(b.headers) && Array.isArray(b.rows) && b.headers.length){
        // normalizar filas: cada fila debe tener el mismo numero de columnas
        const nc = b.headers.length;
        const rows = b.rows.filter(r=>Array.isArray(r)).map(r=>{
          const rr = r.map(String); while(rr.length<nc) rr.push(''); return rr.slice(0,nc);
        });
        tabla(b.headers.map(String), rows);
      }
      else if(b.tipo==='imagen'){
        if(b.ruta && typeof b.ruta==='string' && !/^https?:/i.test(b.ruta) && fs.existsSync(b.ruta)){
          imagen(b.ruta, b.caption, b.maxH);
        }
        // si trae query/url o no existe, se omite sin colgar
      }
      else if(b.tipo==='diagrama_er'){
        diagramaER(doc, b, {M,CW,P,INK,BODY,LINE,WHITE,BOTTOM,rr,shadow,nuevaPagina,PH});
      }
      else if(b.tipo==='diagrama_flujo' && Array.isArray(b.pasos) && b.pasos.length){
        diagramaFlujo(doc, b, {M,CW,P,INK,BODY,LINE,WHITE,BOTTOM,rr,shadow,nuevaPagina,PH});
      }
    } catch(e){
      // si un bloque truena, lo saltamos y seguimos (nunca colgamos)
      console.error('Bloque omitido por error:', e && e.message);
    }
  }

  doc.end();
  // resolver cuando el archivo TERMINE de escribirse en disco (evento del stream)
  return new Promise((resolve, reject)=>{
    const stream = doc._outStream;
    if(!stream){ return resolve(); }
    stream.on('finish', resolve);
    stream.on('error', reject);
    // red de seguridad: si en 20s no terminó, resolvemos igual para no colgar
    setTimeout(resolve, 20000);
  });
}

// ───── DIAGRAMA entidad-relación simple (chilo) ─────
function diagramaER(doc, b, ctx){
  const {M,CW,P,INK,BODY,LINE,WHITE,BOTTOM,rr,shadow,nuevaPagina,PH}=ctx;
  // b.entidades = [{nombre, campos:[...]}], se acomodan en fila
  // blindaje: normalizar entidades, asegurar que campos sea arreglo
  let ents = Array.isArray(b.entidades) ? b.entidades : [];
  ents = ents.map(e => ({
    nombre: (e && e.nombre) ? String(e.nombre) : 'Tabla',
    campos: (e && Array.isArray(e.campos)) ? e.campos.map(String) : []
  })).filter(e => e.nombre);
  if (ents.length === 0) return;  // nada que dibujar
  const n = ents.length;
  const gap = n > 3 ? 16 : 24;          // menos gap si hay muchas tablas
  // cajas más anchas para que quepa el texto (mínimo razonable)
  const boxW = Math.max(70, Math.min(165, (CW-(n-1)*gap)/n));
  const headH = 30;                      // header un poco más alto
  const padX = 9;

  // helper: achica la fuente del título hasta que quepa en una línea
  function fontTitulo(texto, maxW){
    let fs = 10;
    while(fs > 6.5){
      doc.font('Helvetica-Bold').fontSize(fs);
      if(doc.widthOfString(texto) <= maxW) break;
      fs -= 0.5;
    }
    return fs;
  }
  // helper: recorta un campo con … si no cabe
  function recorta(texto, maxW, fs){
    doc.font('Helvetica').fontSize(fs);
    if(doc.widthOfString(texto) <= maxW) return texto;
    let t = texto;
    while(t.length > 1 && doc.widthOfString(t+'…') > maxW){ t = t.slice(0,-1); }
    return t + '…';
  }

  const maxCampos = Math.max(1, ...ents.map(e=>e.campos.length));
  const boxH = headH + maxCampos*15 + 10;
  if(doc.y+boxH+20>BOTTOM){ nuevaPagina(); }
  const startY=doc.y+4;
  let x = M + (CW - (boxW*n+gap*(n-1)))/2;

  ents.forEach((e,idx)=>{
    shadow(x,startY,boxW,boxH,10);
    rr(x,startY,boxW,boxH,10,WHITE);
    doc.roundedRect(x,startY,boxW,boxH,10).lineWidth(1).strokeColor(LINE).stroke();
    // header de la entidad (fondo de color)
    doc.save(); doc.roundedRect(x,startY,boxW,headH,10).clip(); doc.rect(x,startY,boxW,headH).fill(P.main); doc.restore();
    // título: fuente que quepa, centrado vertical y horizontalmente
    const fsTit = fontTitulo(e.nombre, boxW - padX*2);
    const altoTit = doc.font('Helvetica-Bold').fontSize(fsTit).heightOfString(e.nombre, {width:boxW-padX*2});
    doc.fillColor(WHITE).text(e.nombre, x+padX, startY + (headH-altoTit)/2, {width:boxW-padX*2, align:'center', lineBreak:false});
    // campos (recortados si son largos)
    let cy=startY+headH+6;
    e.campos.forEach(c=>{
      const txt = recorta('• '+c, boxW-padX*2, 8);
      doc.font('Helvetica').fontSize(8).fillColor(BODY).text(txt, x+padX, cy, {width:boxW-padX*2, lineBreak:false});
      cy+=15;
    });
    // línea conectora a la siguiente
    if(idx<n-1){
      const lx=x+boxW, ly=startY+boxH/2;
      doc.moveTo(lx,ly).lineTo(lx+gap,ly).lineWidth(1.5).strokeColor(P.mid).stroke();
      doc.circle(lx,ly,2.5).fill(P.mid); doc.circle(lx+gap,ly,2.5).fill(P.mid);
    }
    x+=boxW+gap;
  });
  doc.y=startY+boxH+18;
}

// ───── DIAGRAMA DE FLUJO (pasos verticales conectados con flechas) ─────
function diagramaFlujo(doc, b, ctx){
  const {M,CW,P,INK,BODY,LINE,WHITE,BOTTOM,rr,shadow,nuevaPagina}=ctx;
  let pasos = Array.isArray(b.pasos) ? b.pasos.map(String).filter(Boolean) : [];
  if(pasos.length === 0) return;

  const boxW = Math.min(360, CW - 80);
  const x = M + (CW - boxW)/2;
  const padX = 16, padY = 11, fs = 10.5, gapFlecha = 26;

  pasos.forEach((paso, i) => {
    // medir alto de la caja
    doc.font('Helvetica').fontSize(fs);
    const txtH = doc.heightOfString(paso, {width: boxW - padX*2 - 30});
    const boxH = txtH + padY*2;

    // salto de página si no cabe la caja + la flecha
    if(doc.y + boxH + gapFlecha > BOTTOM){ nuevaPagina(); }

    const yBox = doc.y;
    // sombra + caja redondeada
    shadow(x, yBox, boxW, boxH, 12);
    rr(x, yBox, boxW, boxH, 12, WHITE);
    doc.roundedRect(x, yBox, boxW, boxH, 12).lineWidth(1).strokeColor(LINE).stroke();
    // número en círculo de color a la izquierda
    const cd = 22;
    rr(x+12, yBox + (boxH-cd)/2, cd, cd, cd/2, P.main);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(11).text(String(i+1), x+12, yBox+(boxH-cd)/2+6, {width:cd, align:'center'});
    // texto del paso
    doc.fillColor(BODY).font('Helvetica').fontSize(fs).text(paso, x+padX+30, yBox+padY, {width: boxW - padX*2 - 30});

    doc.y = yBox + boxH;

    // flecha hacia el siguiente paso
    if(i < pasos.length-1){
      const cx = x + boxW/2;
      const y1 = doc.y + 5, y2 = doc.y + gapFlecha - 7;
      doc.moveTo(cx, y1).lineTo(cx, y2).lineWidth(2).strokeColor(P.mid).stroke();
      // punta de flecha
      doc.moveTo(cx-4, y2-4).lineTo(cx, y2).lineTo(cx+4, y2-4).lineWidth(2).strokeColor(P.mid).stroke();
      doc.y = doc.y + gapFlecha;
    }
  });
  doc.moveDown(0.8);
}

module.exports = { generar, paletaPorMateria, PALETAS };
