import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Categoria } from './catalogo/categoria';
import { TrabajadorDemo } from './trabajadores/trabajador-demo';
import { CatalogoService } from './catalogo/catalogo.service';
import { TRABAJADORES_DEMO } from './trabajadores/demostracion';
interface PerfilCuenta {
  usuarioId: string;
  estado: string;
  roles: string[];
  nombre: string;
  telefono: string | null;
  correoContacto: string | null;
  direccion: string | null;
}

@Component({ selector: 'app-root', templateUrl: './app.component.html' })
export class AppComponent implements OnInit, OnDestroy {
  vista = 'inicio'; q = ''; categorias: Categoria[] = [];
  catalogoCompleto: Categoria[] = [];
  private consulta?: Subscription;
  cargando = false; error = ''; filtros = false; categoriaActiva = '';
  seleccion = 'Plomería'; modal = ''; menuAbierto = false;
  trabajador: TrabajadorDemo = TRABAJADORES_DEMO[0];
  trabajadores = TRABAJADORES_DEMO;
  // Vistas de casos de uso: cada API valida permisos en el servidor.
  tipoOperacion = '';
  reservaIdOperacion = '';
  reservaIdConsulta = '';
  calificacionIdParaOpinion = '';
  rolFinalizacion: 'cliente' | 'trabajador' = 'cliente';
  propuestaIdConsulta = '';

  cuenta: PerfilCuenta | null = null;
  datosPerfil = { nombre: '', telefono: '', correoContacto: '', direccion: '' };
  credenciales = { nombre: '', identificadorAcceso: '', contrasena: '' };
  errorCuenta = '';
  guardandoCuenta = false;

  constructor(private readonly catalogo: CatalogoService, private readonly http: HttpClient) {}

  cargarCuenta(): void {
    this.http.get<PerfilCuenta>('/api/usuarios/perfil').subscribe(
      perfil => { this.cuenta = perfil; },
      () => { this.cuenta = null; }
    );
  }

  abrirPerfil(): void {
    if (!this.cuenta) return;
    const { nombre, telefono, correoContacto, direccion } = this.cuenta;
    this.datosPerfil = { nombre, telefono: telefono || '', correoContacto: correoContacto || '', direccion: direccion || '' };
    this.errorCuenta = '';
    this.modal = 'editar-perfil';
  }

  guardarPerfil(): void {
    this.errorCuenta = '';
    this.guardandoCuenta = true;
    this.http.put<PerfilCuenta>('/api/usuarios/perfil', this.datosPerfil).subscribe(
      perfil => {
        this.guardandoCuenta = false;
        this.cuenta = perfil;
        this.modal = '';
      },
      error => {
        this.guardandoCuenta = false;
        this.errorCuenta = (error.error && error.error.message) || 'No se pudo guardar el perfil.';
      }
    );
  }

  tieneRol(rol: string): boolean {
    return !!this.cuenta && this.cuenta.roles.includes(rol);
  }

  enviarCuenta(): void {
    const registro = this.modal === 'registro';
    this.errorCuenta = '';
    this.guardandoCuenta = true;
    this.http.post('/api/usuarios/' + (registro ? 'registro' : 'sesion'), this.credenciales).subscribe(
      () => {
        this.guardandoCuenta = false;
        this.credenciales.contrasena = '';
        this.modal = registro ? 'sesion' : '';
        if (!registro) { this.cargarCuenta(); }
      },
      error => {
        this.guardandoCuenta = false;
        this.errorCuenta = (error.error && error.error.message) || 'No se pudo completar la operación.';
      }
    );
  }

  cerrarSesion(): void {
    this.http.post('/api/usuarios/sesion/cerrar', {}).subscribe(
      () => { this.cuenta = null; this.navegar('inicio'); },
      () => { this.errorCuenta = 'No se pudo cerrar la sesión.'; }
    );
  }
  ngOnInit(): void {
    this.cargarCuenta();
    const parametros = new URLSearchParams(window.location.search);
    const casosReserva: Array<[string, string]> = [
      ['reserva', 'pago'],
      ['calificarReserva', 'calificacion'],
      ['reclamoReserva', 'reclamo'],
      ['asistenciaReserva', 'asistencia'],
      ['cancelarReserva', 'cancelacion'],
      ['cancelarServicio', 'cancelacion-trabajador'],
      ['modificarReserva', 'modificacion'],
      ['finalizarReserva', 'finalizacion'],
    ];
    for (const [clave, operacion] of casosReserva) {
      const id = parametros.get(clave);
      if (id && /^[1-9][0-9]{0,18}$/.test(id)) {
        this.reservaIdOperacion = id;
        this.reservaIdConsulta = id;
        this.tipoOperacion = operacion;
        if (operacion === 'finalizacion') {
          this.rolFinalizacion = parametros.get('rol') === 'trabajador' ? 'trabajador' : 'cliente';
        }
        this.navegar('solicitud');
        break;
      }
    }
    const calificacion = parametros.get('opinionCalificacion');
    if (calificacion && /^[1-9][0-9]{0,18}$/.test(calificacion)) {
      this.calificacionIdParaOpinion = calificacion;
      this.navegar('opinion-servicio');
    } else if (parametros.get('avisosCancelacion') === '1') {
      this.navegar('avisos-cancelacion');
    } else if (parametros.get('revisionPagos') === '1') {
      this.navegar('revision-pagos');
    } else if (parametros.get('incidentes') === '1') {
      this.navegar('incidentes');
    } else if (parametros.get('revisionesAsistencia') === '1') {
      this.navegar('revisiones-asistencia');
    } else if (parametros.get('candidatosAsistencia') === '1') {
      this.navegar('candidatos-asistencia');
    }
    const pantallas = ['perfil-trabajador', 'solicitudes-trabajador', 'cuenta-trabajador', 'desembolso-trabajador',
      'documentacion-trabajador', 'gestion-reclamos', 'aprobacion-desembolsos'];
    const pantalla = parametros.get('vista');
    if (pantalla && pantallas.includes(pantalla)) { this.navegar(pantalla); }
    this.cargar();
  }
  abrirOperacion(operacion: string): void {
    if (!/^[1-9][0-9]{0,18}$/.test(this.reservaIdConsulta)) {
      this.error = 'Introduce un ID de reserva numérico válido.';
      return;
    }
    this.error = '';
    this.reservaIdOperacion = this.reservaIdConsulta;
    this.tipoOperacion = operacion;
  }

  ngOnDestroy() { if (this.consulta) { this.consulta.unsubscribe(); } }
  cargar() {
    if (this.consulta) { this.consulta.unsubscribe(); }
    const busqueda = this.q.trim();
    this.cargando = true; this.error = '';
    this.consulta = this.catalogo.buscar(busqueda).subscribe(
      datos => {
        this.categorias = datos;
        if (!busqueda) { this.catalogoCompleto = datos; }
        this.cargando = false;
      },
      () => { this.categorias = []; this.error = 'No pudimos cargar los servicios. Comprueba la conexión y vuelve a intentar.'; this.cargando = false; }
    );
  }
  navegar(vista: string) {
    this.vista = vista; this.menuAbierto = false; window.scrollTo(0, 0);
    if (vista === 'inicio' && this.q) { this.filtrar(''); }
  }
  buscar() { this.categoriaActiva = ''; this.navegar('servicios'); this.cargar(); }
  filtrar(categoria: string) { this.categoriaActiva = categoria; this.q = categoria; this.cargar(); }
  elegir(categoria: Categoria) { this.seleccion = categoria.nombre; this.navegar('trabajadores'); }
  perfil(trabajador: TrabajadorDemo) { this.trabajador = trabajador; this.modal = 'perfil'; }
  solicitar() {
    if (!this.cuenta) { this.modal = 'sesion-requerida'; return; }
    this.modal = '';
    this.tipoOperacion = '';
    this.navegar('solicitud');
  }

  get categoriaSeleccionada(): string {
    const categoria = this.catalogoCompleto.find(item => item.nombre === this.seleccion);
    return categoria ? categoria.id : '';
  }
  icono(nombre: string) {
    const texto = nombre.toLowerCase();
    if (texto.includes('plom')) { return 'plomeria'; }
    if (texto.includes('electri')) { return 'electricidad'; }
    if (texto.includes('alba')) { return 'albanileria'; }
    if (texto.includes('carpin')) { return 'carpinteria'; }
    return 'herramienta';
  }
}
