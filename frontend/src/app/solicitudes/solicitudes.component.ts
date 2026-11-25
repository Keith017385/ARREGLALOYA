import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnInit } from '@angular/core';
import { CatalogoService } from '../catalogo/catalogo.service';
import { Categoria } from '../catalogo/categoria';

interface Servicio {
  categoriaId: string;
  descripcion: string;
}

interface Solicitud {
  id: string;
  descripcion: string;
  ubicacion: string;
  estado: string;
  creadaEn: string;
  servicios: Servicio[];
}

interface Oferta {
  ofertaId: string;
  trabajador: string;
  estadoOferta: string;
  cotizacionId: string | null;
  precio: string | null;
  venceEn: string | null;
  decision: string | null;
  disponible: boolean;
}

interface ReservaInicial {
  precio: string;
  anticipo: string;
  comision: string;
  reservaId: string | null;
  estado: string | null;
}

interface Trabajador {
  id: string;
  nombre: string;
  zona: string;
  opiniones: number;
  puntuacion: string | null;
  seleccionado: boolean;
}

interface EventoSolicitud {
  registradaEn: string;
  estado: string;
  campos: string[];
}

@Component({
  selector: 'app-solicitudes',
  templateUrl: './solicitudes.component.html',
})
export class SolicitudesComponent implements OnInit {
  @Input() categoriaInicial = '';
  categorias: Categoria[] = [];
  zonas: Array<{ id: string; nombre: string }> = [];
  solicitudes: Solicitud[] = [];
  solicitudEditada = '';
  datosEdicion = { descripcion: '', ubicacion: '' };
  guardandoEdicion = false;
  historialId = '';
  historial: EventoSolicitud[] = [];
  errorHistorial = '';
  solicitudParaTrabajadores = '';
  trabajadores: Trabajador[] = [];
  cargandoTrabajadores = false;
  guardandoSeleccion = false;
  errorSeleccion = '';
  solicitudElegida = '';
  ofertas: Oferta[] = [];
  cargandoOfertas = false;
  decidiendo = false;
  errorOfertas = '';
  cotizacionReserva = '';
  reservaInicial: ReservaInicial | null = null;
  inicioReserva = '';
  guardandoReserva = false;
  errorReserva = '';
  descripcion = '';
  ubicacion = '';
  zonaId = '';
  urgente = false;
  servicios: Servicio[] = [];
  enviando = false;
  error = '';
  confirmacion = '';

  constructor(private readonly http: HttpClient, private readonly catalogo: CatalogoService) {}

  ngOnInit(): void {
    this.servicios = [{ categoriaId: this.categoriaInicial, descripcion: '' }];
    this.catalogo.buscar('').subscribe(datos => this.categorias = datos, error => this.mostrarError(error));
    this.http.get<Array<{ id: string; nombre: string }>>('/api/solicitudes/zonas')
      .subscribe(datos => this.zonas = datos, error => this.mostrarError(error));
    this.cargar();
  }

  agregarServicio(): void {
    if (this.servicios.length < 2) this.servicios.push({ categoriaId: '', descripcion: '' });
  }

  publicar(): void {
    this.enviando = true;
    this.error = '';
    this.confirmacion = '';
    const { descripcion, ubicacion, zonaId, urgente, servicios } = this;
    this.http.post<{ id: string }>('/api/solicitudes', { descripcion, ubicacion, zonaId, urgente, servicios }).subscribe(
      ({ id }) => {
        this.enviando = false;
        this.descripcion = '';
        this.ubicacion = '';
        this.zonaId = '';
        this.urgente = false;
        this.servicios = [{ categoriaId: this.categoriaInicial, descripcion: '' }];
        this.confirmacion = 'Solicitud #' + id + ' publicada.';
        this.cargar();
      },
      error => {
        this.enviando = false;
        this.mostrarError(error);
      }
    );
  }

  consultarOfertas(solicitudId: string): void {
    this.solicitudElegida = solicitudId;
    this.cotizacionReserva = '';
    this.reservaInicial = null;
    this.ofertas = [];
    this.errorOfertas = '';
    this.cargandoOfertas = true;
    this.http.get<Oferta[]>('/api/solicitudes/' + solicitudId + '/ofertas').subscribe(
      datos => {
        if (this.solicitudElegida !== solicitudId) return;
        this.ofertas = datos;
        this.cargandoOfertas = false;
      },
      error => {
        if (this.solicitudElegida !== solicitudId) return;
        this.errorOfertas = error.error && error.error.message || 'No se pudieron cargar las ofertas.';
        this.cargandoOfertas = false;
      },
    );
  }

  decidirOferta(solicitudId: string, cotizacionId: string, decision: 'aceptada' | 'rechazada'): void {
    this.decidiendo = true;
    this.errorOfertas = '';
    const ruta = '/api/solicitudes/' + solicitudId + '/cotizaciones/' + cotizacionId + '/decision';
    this.http.post(ruta, { decision }).subscribe(
      () => {
        this.decidiendo = false;
        this.cargar();
        this.consultarOfertas(solicitudId);
      },
      error => {
        this.decidiendo = false;
        this.errorOfertas = error.error && error.error.message || 'No se pudo registrar la decisión.';
      },
    );
  }

  consultarReserva(cotizacionId: string): void {
    this.cotizacionReserva = cotizacionId;
    this.reservaInicial = null;
    this.errorReserva = '';
    this.http.get<ReservaInicial>('/api/solicitudes/cotizaciones/' + cotizacionId + '/reserva').subscribe(
      resumen => { if (this.cotizacionReserva === cotizacionId) this.reservaInicial = resumen; },
      error => { if (this.cotizacionReserva === cotizacionId) this.errorReserva = error.error && error.error.message || 'No se pudo consultar la reserva.'; },
    );
  }

  crearReserva(formulario: string): void {
    const inicio = new Date(formulario);
    if (!Number.isFinite(inicio.getTime())) {
      this.errorReserva = 'Selecciona una fecha y hora válidas.';
      return;
    }
    this.guardandoReserva = true;
    this.errorReserva = '';
    const id = this.cotizacionReserva;
    this.http.post<ReservaInicial>('/api/solicitudes/cotizaciones/' + id + '/reserva', { inicio: inicio.toISOString() }).subscribe(
      resumen => {
        this.guardandoReserva = false;
        if (this.cotizacionReserva === id) this.reservaInicial = resumen;
      },
      error => {
        this.guardandoReserva = false;
        this.errorReserva = error.error && error.error.message || 'No se pudo registrar la reserva.';
      },
    );
  }

  consultarTrabajadores(id: string): void {
    this.solicitudParaTrabajadores = id;
    this.trabajadores = [];
    this.errorSeleccion = '';
    this.cargandoTrabajadores = true;
    this.http.get<Trabajador[]>('/api/solicitudes/' + id + '/trabajadores').subscribe(
      trabajadores => {
        if (this.solicitudParaTrabajadores !== id) return;
        this.trabajadores = trabajadores;
        this.cargandoTrabajadores = false;
      },
      error => {
        if (this.solicitudParaTrabajadores !== id) return;
        this.errorSeleccion = error.error && error.error.message || 'No se pudo buscar trabajadores.';
        this.cargandoTrabajadores = false;
      },
    );
  }

  seleccionarTrabajador(id: string, trabajadorId: string): void {
    this.guardandoSeleccion = true;
    this.errorSeleccion = '';
    this.http.post('/api/solicitudes/' + id + '/seleccion', { trabajadorId }).subscribe(
      () => { this.guardandoSeleccion = false; this.consultarTrabajadores(id); },
      error => {
        this.guardandoSeleccion = false;
        this.errorSeleccion = error.error && error.error.message || 'No se pudo guardar la selección.';
      },
    );
  }

  editarSolicitud(solicitud: Solicitud): void {
    this.solicitudEditada = solicitud.id;
    this.datosEdicion = { descripcion: solicitud.descripcion, ubicacion: solicitud.ubicacion };
    this.errorHistorial = '';
  }

  guardarSolicitud(id: string): void {
    this.guardandoEdicion = true;
    this.errorHistorial = '';
    this.http.put('/api/solicitudes/' + id, this.datosEdicion).subscribe(
      () => {
        this.guardandoEdicion = false;
        this.solicitudEditada = '';
        this.cargar();
        this.consultarHistorial(id);
      },
      error => {
        this.guardandoEdicion = false;
        this.errorHistorial = error.error && error.error.message || 'No se pudo actualizar la solicitud.';
      },
    );
  }

  consultarHistorial(id: string): void {
    this.historialId = id;
    this.historial = [];
    this.errorHistorial = '';
    this.http.get<EventoSolicitud[]>('/api/solicitudes/' + id + '/historial').subscribe(
      eventos => { if (this.historialId === id) this.historial = eventos; },
      error => { if (this.historialId === id) this.errorHistorial = error.error && error.error.message || 'No se pudo consultar el historial.'; },
    );
  }

  private cargar(): void {
    this.http.get<Solicitud[]>('/api/solicitudes')
      .subscribe(datos => this.solicitudes = datos, error => this.mostrarError(error));
  }

  private mostrarError(error: HttpErrorResponse): void {
    this.error = (error.error && error.error.message) || 'No se pudo completar la operación.';
  }
}
