import { Component, Input, OnChanges } from '@angular/core';
import { OfertaTrabajador, SolicitudDisponible } from './solicitudes-trabajador';
import { SolicitudesTrabajadorService } from './solicitudes-trabajador.service';

@Component({
  selector: 'app-solicitudes-trabajador',
  templateUrl: './solicitudes-trabajador.component.html',
  styleUrls: ['./solicitudes-trabajador.component.css']
})
export class SolicitudesTrabajadorComponent implements OnChanges {
  @Input() usuarioId = '';

  solicitudes: SolicitudDisponible[] = [];
  ofertas: OfertaTrabajador[] = [];
  usuarioIdValido = false;
  cargandoOfertas = false;
  falloCargaOfertas = false;
  ofertaEditada = '';
  fecha = '';
  manoObra = '';
  materiales = '0';
  transporte = '0';
  enviando = false;
  aviso = '';
  errorOferta = '';
  cargando = false;
  error = '';

  constructor(private solicitudesService: SolicitudesTrabajadorService) {}

  ngOnChanges(): void {
    this.usuarioIdValido = /^[1-9][0-9]{0,18}$/.test(this.usuarioId);
    if (!this.usuarioIdValido) {
      this.solicitudes = [];
      this.ofertas = [];
      this.cargando = false;
      this.cargandoOfertas = false;
      this.falloCargaOfertas = false;
      return;
    }
    this.cargarSolicitudes();
    this.cargarOfertas();
  }

  cargarSolicitudes(): void {
    if (!this.usuarioIdValido) return;
    this.cargando = true;
    this.error = '';

    this.solicitudesService.listar(this.usuarioId).subscribe({
      next: (datos) => {
        this.solicitudes = datos;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar solicitudes:', err);
        this.error = 'No pudimos cargar las solicitudes. Intenta nuevamente.';
        this.cargando = false;
      }
    });
  }

  presentar(solicitud: string): void {
    this.enviar('solicitudes/' + solicitud + '/oferta', {}, 'Oferta presentada.');
  }

  abrirOferta(id: string): void {
    this.ofertaEditada = id;
    this.fecha = '';
    this.manoObra = '';
    this.materiales = '0';
    this.transporte = '0';
  }

  programar(oferta: string): void {
    const fecha = this.fechaValida();
    if (fecha) this.enviar('ofertas/' + oferta + '/visita', { fecha }, 'Visita programada.');
  }

  realizar(oferta: string): void {
    this.enviar('ofertas/' + oferta + '/visita/realizar', {}, 'Visita realizada registrada.');
  }

  cotizar(oferta: string): void {
    const venceEn = this.fechaValida();
    if (!venceEn) return;
    const manoObra = this.manoObra.replace(',', '.');
    const materiales = this.materiales.replace(',', '.');
    const transporte = this.transporte.replace(',', '.');
    this.enviar('ofertas/' + oferta + '/cotizacion', { manoObra, materiales, transporte, venceEn }, 'Cotización enviada.');
  }

  private fechaValida(): string | null {
    const fecha = new Date(this.fecha);
    if (Number.isFinite(fecha.getTime())) return fecha.toISOString();
    this.errorOferta = 'Selecciona una fecha y hora válidas.';
    return null;
  }

  cargarOfertas(): void {
    if (!this.usuarioIdValido) return;
    this.cargandoOfertas = true;
    this.falloCargaOfertas = false;
    this.errorOferta = '';
    this.solicitudesService.ofertas(this.usuarioId).subscribe(
      ofertas => {
        this.ofertas = Array.isArray(ofertas) ? ofertas : [];
        this.cargandoOfertas = false;
      },
      error => {
        this.cargandoOfertas = false;
        this.falloCargaOfertas = true;
        this.errorOferta = error.error && error.error.message || 'No se pudieron cargar las ofertas.';
      },
    );
  }

  private enviar(operacion: string, datos: object, aviso: string): void {
    if (!this.usuarioIdValido) return;
    this.enviando = true;
    this.aviso = '';
    this.errorOferta = '';
    this.solicitudesService.enviar(this.usuarioId, operacion, datos).subscribe(
      () => {
        this.enviando = false;
        this.aviso = aviso;
        this.ofertaEditada = '';
        this.cargarSolicitudes();
        this.cargarOfertas();
      },
      error => {
        this.enviando = false;
        this.errorOferta = error.error && error.error.message || 'No se pudo completar la operación.';
      },
    );
  }

  trackBySolicitud(index: number, solicitud: SolicitudDisponible): string {
    return solicitud.solicitudId;
  }
}