
import { Component, OnInit } from '@angular/core';
import { SolicitudDisponible } from './solicitudes-trabajador';
import { SolicitudesTrabajadorService } from './solicitudes-trabajador.service';

@Component({
  selector: 'app-solicitudes-trabajador',
  templateUrl: './solicitudes-trabajador.component.html',
  styleUrls: ['./solicitudes-trabajador.component.css']
})
export class SolicitudesTrabajadorComponent implements OnInit {

  // ID temporal: reemplazar cuando exista autenticación.
  usuarioId = '10';

  solicitudes: SolicitudDisponible[] = [];
  cargando = false;
  error = '';

  constructor(
    private solicitudesService: SolicitudesTrabajadorService
  ) {}

  ngOnInit(): void {
    this.cargarSolicitudes();
  }

  cargarSolicitudes(): void {
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

  trackBySolicitud(index: number, solicitud: SolicitudDisponible): string {
    return solicitud.solicitudId;
  }
}
