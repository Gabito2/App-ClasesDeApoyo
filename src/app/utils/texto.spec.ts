import { coincideAlumno, normalizar } from './texto';

describe('normalizar', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizar('Pérez Muñoz')).toBe('perez munoz');
  });

  it('recorta espacios sobrantes', () => {
    expect(normalizar('  Ana  ')).toBe('ana');
  });
});

describe('coincideAlumno', () => {
  const alumno = { nombre: 'Juan', apellido: 'Pérez' };

  it('encuentra sin acentos', () => {
    expect(coincideAlumno(alumno, 'perez')).toBeTrue();
  });

  it('encuentra en orden apellido nombre', () => {
    expect(coincideAlumno(alumno, 'perez juan')).toBeTrue();
  });

  it('encuentra en orden nombre apellido', () => {
    expect(coincideAlumno(alumno, 'juan perez')).toBeTrue();
  });

  it('no matchea un término ajeno', () => {
    expect(coincideAlumno(alumno, 'gomez')).toBeFalse();
  });

  it('con término vacío devuelve todos', () => {
    expect(coincideAlumno(alumno, '   ')).toBeTrue();
  });
});
