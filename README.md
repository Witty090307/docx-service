# DOCX Service — Generador de tareas escolares bonitas

Mini-servicio que recibe el contenido de una tarea (markdown + datos del alumno)
y devuelve un archivo **.docx** con portada y diseño profesional, listo para entregar.

Usa la identidad visual de la skill `escuela-docs`:
- Portada con banda de color (color según materia)
- Títulos con color y líneas finas
- Tablas con header de color, sin descuadres
- Fuente Lexend (con fallback automático)

## Cómo se usa (desde n8n)

POST al endpoint `/generate` con este JSON:

```json
{
  "titulo": "Investigación sobre Normalización",
  "materia": "Programación",
  "alumno": "Diego Alcaraz",
  "grupo": "4°A Vespertino",
  "plantel": "CETIS",
  "fecha": "15 de junio de 2026",
  "contenido": "# Título\n\n## Sección\nTexto con **negritas**...\n\n| Col1 | Col2 |\n|------|------|\n| a | b |"
}
```

Devuelve el archivo `.docx` directo (binario).

## Colores por materia (automático)
Base de datos → azul · Programación → verde · Redes → naranja ·
Matemáticas → rojo · Química/Biología → verde botánico · etc.
