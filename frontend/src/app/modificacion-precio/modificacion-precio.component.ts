import { Component } from '@angular/core';

type Decision = 'ACEPTADA' | 'RECHAZADA';

interface PropuestaDemo {
  variacionCentavos: number;
  motivo: string;
  decision: Decision | null;
}

@Component({
  selector: 'app-modificacion-precio',
  templateUrl: './modificacion-precio.component.html',
})
export class ModificacionPrecioComponent {
  precioVigenteCentavos = 20000;
  importe = '';
  motivo = '';
  error = '';
  propuesta: PropuestaDemo | null = null;

  proponer(): void {
    if (this.propuesta && this.propuesta.decision === null) {
      return;
    }

    this.error = '';

    const texto = this.importe.trim().replace(',', '.');
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(texto)) {
      this.error = 'Escribe un importe con hasta dos decimales, por ejemplo 10 o -5,50.';
      return;
    }

    const variacionCentavos = Math.round(Number(texto) * 100);
    const precioPropuesto = this.precioVigenteCentavos + variacionCentavos;

    if (
      !Number.isSafeInteger(variacionCentavos) ||
      variacionCentavos === 0 ||
      !Number.isSafeInteger(precioPropuesto) ||
      precioPropuesto <= 0
    ) {
      this.error = 'El cambio debe ser distinto de cero y dejar un precio mayor a Bs 0.';
      return;
    }

    const motivo = this.motivo.trim();
    if (!motivo) {
      this.error = 'Escribe el motivo del cambio.';
      return;
    }

    this.propuesta = { variacionCentavos, motivo, decision: null };
    this.importe = '';
    this.motivo = '';
  }

  decidir(decision: Decision): void {
    if (!this.propuesta || this.propuesta.decision !== null) {
      return;
    }

    if (decision === 'ACEPTADA') {
      this.precioVigenteCentavos += this.propuesta.variacionCentavos;
    }

    this.propuesta.decision = decision;
  }
}