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
  const fecha = new Date(0);

  // UTC permite sumar dias a la fecha de calendario ya convertida a Bolivia.
  fecha.setUTCFullYear(anio, mes - 1, dia);
  return fecha;
}

export function vencioPlazoRevisionAsistencia(rechazadaEn: Date, ahora: Date): boolean {
  if (!Number.isFinite(rechazadaEn.getTime()) || !Number.isFinite(ahora.getTime())) {
    throw new Error('Las fechas de la revision de asistencia no son validas.');
  }

  if (ahora < rechazadaEn) {
    return false;
  }

  const vencimiento = fechaLocalComoUtc(rechazadaEn);
  let diasHabiles = 0;

  while (diasHabiles < 2) {
    vencimiento.setUTCDate(vencimiento.getUTCDate() + 1);
    const diaSemana = vencimiento.getUTCDay();
    if (diaSemana >= 1 && diaSemana <= 5) {
      diasHabiles += 1;
    }
  }

  return fechaLocalComoUtc(ahora) > vencimiento;
}
