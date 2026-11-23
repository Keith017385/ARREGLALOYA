export interface DatosSancion {
  motivo: string;
  inicio: Date;
  fin: Date;
}

function textoObligatorio(valor: unknown, mensaje: string): string {
  if (typeof valor !== 'string') {
    throw new Error(mensaje);
  }

  const texto = valor.trim();
  if (!texto || texto.includes('\0')) {
    throw new Error(mensaje);
  }

  return texto;
}

export function prepararDescripcionIncidente(descripcion: unknown): string {
  return textoObligatorio(descripcion, 'La descripcion del incidente es obligatoria.');
}

export function prepararSancion(motivo: unknown, inicio: Date, fin: Date): DatosSancion {
  const texto = textoObligatorio(motivo, 'El motivo de la sancion es obligatorio.');

  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime())) {
    throw new Error('Las fechas de la sancion no son validas.');
  }

  if (fin <= inicio) {
    throw new Error('El fin de la sancion debe ser posterior al inicio.');
  }

  return { motivo: texto, inicio, fin };
}
