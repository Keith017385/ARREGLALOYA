import { Input } from '@angular/core';
import { Component, OnInit } from '@angular/core';
import { CatalogoService } from '../catalogo/catalogo.service';
import { Categoria } from '../catalogo/categoria';
import { DatosPerfil, ServicioTrabajador } from './perfil-trabajador';
import { PerfilTrabajadorService } from './perfil-trabajador.service';

@Component({ selector: 'app-perfil-trabajador', templateUrl: './perfil-trabajador.component.html' })
export class PerfilTrabajadorComponent implements OnInit {
  // Temporal: cuando exista el inicio de sesión, este id vendrá del trabajador autenticado.
  @Input() usuarioId = '';
  datos: DatosPerfil = { nombre: '', telefono: null, correoContacto: null, direccion: null };
  servicios: ServicioTrabajador[] = [];
  catalogo: Categoria[] = [];
  categoriaElegida = '';
  cargando = false; guardando = false; error = ''; mensaje = '';
  constructor(
    private readonly perfiles: PerfilTrabajadorService,
    private readonly catalogoApi: CatalogoService
  ) {}
  ngOnInit() { this.cargar(); }
  get disponibles(): Categoria[] {
    return this.catalogo.filter(c => !this.servicios.some(s => s.id === c.id));
  }
  cargar() {
    this.cargando = true; this.error = '';
    this.perfiles.obtenerPerfil(this.usuarioId).subscribe(
      perfil => {
        this.datos = {
          nombre: perfil.nombre || '', telefono: perfil.telefono,
          correoContacto: perfil.correoContacto, direccion: perfil.direccion
        };
        this.cargando = false;
      },
      () => { this.error = 'No pudimos cargar tu perfil. Vuelve a intentar.'; this.cargando = false; }
    );
    this.recargarServicios();
    this.catalogoApi.buscar('').subscribe(datos => { this.catalogo = datos; }, () => { this.catalogo = []; });
  }
  recargarServicios() {
    this.perfiles.listarServicios(this.usuarioId).subscribe(
      datos => { this.servicios = datos; },
      () => { this.error = 'No pudimos cargar tus servicios.'; }
    );
  }
  guardar() {
    this.guardando = true; this.error = ''; this.mensaje = '';
    this.perfiles.guardarPerfil(this.usuarioId, this.datos).subscribe(
      () => { this.mensaje = 'Perfil guardado.'; this.guardando = false; },
      e => { this.error = this.textoError(e, 'No pudimos guardar el perfil.'); this.guardando = false; }
    );
  }
  agregarServicio() {
    if (!this.categoriaElegida) { return; }
    this.error = ''; this.mensaje = '';
    this.perfiles.agregarServicio(this.usuarioId, this.categoriaElegida).subscribe(
      () => { this.categoriaElegida = ''; this.recargarServicios(); },
      e => { this.error = this.textoError(e, 'No pudimos agregar el servicio.'); }
    );
  }
  quitarServicio(servicio: ServicioTrabajador) {
    this.error = ''; this.mensaje = '';
    this.perfiles.quitarServicio(this.usuarioId, servicio.id).subscribe(
      () => { this.recargarServicios(); },
      e => { this.error = this.textoError(e, 'No pudimos quitar el servicio.'); }
    );
  }
  private textoError(e: any, porDefecto: string): string {
    const mensaje = e && e.error && e.error.message;
    return typeof mensaje === 'string' ? mensaje : porDefecto;
  }
}