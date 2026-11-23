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

  // UTC se usa aquí para operar con fechas de calendario ya convertidas a Bolivia.
  return new Date(Date.UTC(anio, mes - 1, dia));
}

export function estaEnPlazoDeDiscrepancia(
  finalizadaEn: Date,
  solicitadaEn: Date,
): boolean {
  if (
    !Number.isFinite(finalizadaEn.getTime())
    || !Number.isFinite(solicitadaEn.getTime())
    || solicitadaEn < finalizadaEn
  ) {
    return false;
  }

  const vencimiento = fechaLocalComoUtc(finalizadaEn);
  let diasHabiles = 0;

  while (diasHabiles < 3) {
    vencimiento.setUTCDate(vencimiento.getUTCDate() + 1);
    const diaSemana = vencimiento.getUTCDay();
    if (diaSemana >= 1 && diaSemana <= 5) {
      diasHabiles += 1;
    }
  }

  return fechaLocalComoUtc(solicitadaEn) <= vencimiento;
}
