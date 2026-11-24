export interface ReservaParaReclamo {
  clienteId: string;
  finalizadaEn: Date | null;
}

const calendarioBolivia = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/La_Paz',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function fechaLocalComoUtc(instante: Date): Date {
  const partes = calendarioBolivia.formatToParts(instante);
  const anio = Number(partes.find((parte) => parte.type === 'year')?.value);
  const mes = Number(partes.find((parte) => parte.type === 'month')?.value);
  const dia = Number(partes.find((parte) => parte.type === 'day')?.value);

  // Usamos UTC para sumar días a la fecha de calendario obtenida en Bolivia.
  const fecha = new Date(0);
  fecha.setUTCFullYear(anio, mes - 1, dia);
  return fecha;
}

export function estaEnPlazoDeReclamo(finalizadaEn: Date, presentadaEn: Date): boolean {
  if (
    !Number.isFinite(finalizadaEn.getTime())
    || !Number.isFinite(presentadaEn.getTime())
    || presentadaEn < finalizadaEn
  ) {
    return false;
  }

  const vencimiento = fechaLocalComoUtc(finalizadaEn);
  vencimiento.setUTCDate(vencimiento.getUTCDate() + 6);

  return fechaLocalComoUtc(presentadaEn) <= vencimiento;
}

export function prepararReclamo(
  reserva: ReservaParaReclamo,
  actorId: string,
  descripcion: unknown,
  presentadaEn: Date,
): string {
  if (reserva.clienteId !== actorId) {
    throw new Error('Solo el cliente de la reserva puede presentar un reclamo.');
  }

  if (!reserva.finalizadaEn) {
    throw new Error('La reserva no tiene una finalizacion registrada.');
  }

  if (!estaEnPlazoDeReclamo(reserva.finalizadaEn, presentadaEn)) {
    throw new Error('El reclamo debe presentarse dentro del plazo de seis dias.');
  }

  if (typeof descripcion !== 'string' || !descripcion.trim()) {
    throw new Error('La descripcion del reclamo es obligatoria.');
  }

  return descripcion.trim();
}
