import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-desembolso-trabajador',
  templateUrl: './desembolso-trabajador.component.html',
})
export class DesembolsoTrabajadorComponent implements OnInit {
  reservas: Array<{ id: string; disponible: string }> = [];
  reservaId = '';
  importe = '';
  documento: File | null = null;
  error = '';
  confirmacion = '';
  cargando = false;
  enviando = false;
  private readonly ruta = '/api/trabajador/desembolsos/reservas';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void { this.cargar(); }

  elegir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    this.documento = campo.files && campo.files.item(0);
  }

  solicitar(archivo: HTMLInputElement): void {
    if (!this.documento || this.documento.size > 5 * 1024 * 1024) {
      this.error = 'Adjunta un PDF de hasta 5 MB.';
      return;
    }
    this.enviando = true;
    this.error = '';
    this.confirmacion = '';
    const datos = new FormData();
    datos.append('importe', this.importe.trim().replace(',', '.'));
    datos.append('documento', this.documento);
    this.http.post<{ solicitudId: string }>(this.ruta + '/' + this.reservaId, datos).subscribe(
      resultado => {
        this.enviando = false;
        this.confirmacion = 'Solicitud #' + resultado.solicitudId + ' enviada para revisión.';
        this.reservaId = '';
        this.importe = '';
        this.documento = null;
        archivo.value = '';
        this.cargar();
      },
      error => { this.enviando = false; this.mostrarError(error); },
    );
  }

  private cargar(): void {
    this.cargando = true;
    this.http.get<Array<{ id: string; disponible: string }>>(this.ruta).subscribe(
      reservas => { this.reservas = reservas; this.cargando = false; },
      error => { this.cargando = false; this.mostrarError(error); },
    );
  }

  private mostrarError(error: HttpErrorResponse): void {
    this.error = error.error && error.error.message || 'No se pudo completar la operación.';
  }
}
