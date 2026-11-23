/**
 * Normaliza texto para búsquedas: minúsculas, sin acentos y sin espacios
 * sobrantes. "Pérez" y "perez" quedan iguales.
 */
export function normalizar(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * `true` si el término aparece en "nombre apellido" o en "apellido nombre".
 * Así buscar "perez juan" también encuentra a "Juan Pérez".
 */
export function coincideAlumno(
  alumno: { nombre: string; apellido: string },
  termino: string
): boolean {
  const buscado = normalizar(termino);
  if (!buscado) return true;

  const nombre = normalizar(alumno.nombre);
  const apellido = normalizar(alumno.apellido);

  return (
    `${nombre} ${apellido}`.includes(buscado) ||
    `${apellido} ${nombre}`.includes(buscado)
  );
}
