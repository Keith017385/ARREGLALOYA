export type EstadoReclamo = 'abierto' | 'en_revision' | 'resuelto' | 'todos';
export type CausalReclamo =
  | 'cliente_anticipada'
  | 'cliente_tardia'
  | 'trabajador_cancela'
  | 'trabajador_no_asiste'
  | 'cliente_no_asiste'
  | 'fuerza_mayor'
  | 'otro';

export interface DatosResolucionReclamo {
  causal: CausalReclamo;
  resolucion: string;
}

const CAUSALES_PERMITIDAS: CausalReclamo[] = [
  'cliente_anticipada', 'cliente_tardia', 'trabajador_cancela',
  'trabajador_no_asiste', 'cliente_no_asiste', 'fuerza_mayor', 'otro',
];

/** Valida el filtro de la bandeja de reclamos. */
export function prepararFiltroReclamos(valor: unknown): EstadoReclamo {
  const filtro = valor == null || valor === '' ? 'abierto' : valor;
  const permitidos: EstadoReclamo[] = ['abierto', 'en_revision', 'resuelto', 'todos'];
  if (typeof filtro !== 'string' || !permitidos.includes(filtro as EstadoReclamo)) {
    throw new Error('El filtro de reclamos no es válido.');
  }
  return filtro as EstadoReclamo;
}

/** Construye una resolución administrativa válida y con fundamento obligatorio. */
export function prepararResolucionReclamo(causal: unknown, resolucion: unknown): DatosResolucionReclamo {
  if (typeof causal !== 'string' || !CAUSALES_PERMITIDAS.includes(causal as CausalReclamo)) {
    throw new Error('La causal determinada no es válida.');
  }
  if (typeof resolucion !== 'string') {
    throw new Error('La resolución es obligatoria.');
  }
  const fundamento = resolucion.trim();
  if (!fundamento || fundamento.length > 2000 || fundamento.includes('\0')) {
    throw new Error('La resolución debe tener entre 1 y 2000 caracteres.');
  }
  return { causal: causal as CausalReclamo, resolucion: fundamento };
}
