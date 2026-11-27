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

interface ZonaRegistro { id: string; nombre: string; }
interface SeccionPanel { vista: string; titulo: string; detalle: string; navTitulo?: string; }
interface EjemploDemo { nombre: string; detalle: string; accion: string; resultado: string; }
interface CredencialesCuenta {
  nombre: string;
  identificadorAcceso: string;
  contrasena: string;
  rol: 'cliente' | 'trabajador';
  zonaId: string;
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
  private destinoInicialEspecifico = false;
  datosPerfil = { nombre: '', telefono: '', correoContacto: '', direccion: '' };
  credenciales: CredencialesCuenta = {
    nombre: '', identificadorAcceso: '', contrasena: '', rol: 'cliente', zonaId: '',
  };
  errorCuenta = '';
  guardandoCuenta = false;
  mensajeCuenta = '';
  zonasRegistro: ZonaRegistro[] = [];
  errorZonasRegistro = '';
  cargandoZonasRegistro = false;

  moduloAdministrativo = 'documentacion-trabajador';
  readonly seccionesPorPanel: { [panel: string]: SeccionPanel[] } = {
    'panel-administracion': [
      { vista: 'documentacion-trabajador', titulo: 'Documentación de trabajadores', navTitulo: 'Trabajadores', detalle: 'Revisa los documentos y registra el resultado.' },
      { vista: 'gestion-reclamos', titulo: 'Reclamos formales', navTitulo: 'Reclamos', detalle: 'Analiza los antecedentes y resuelve casos.' },
      { vista: 'revision-pagos', titulo: 'Discrepancias de pago', navTitulo: 'Pagos', detalle: 'Revisa declaraciones de pago en disputa.' },
      { vista: 'incidentes', titulo: 'Incidentes y sanciones', navTitulo: 'Incidentes', detalle: 'Registra incidentes confirmados y aplica medidas.' },
      { vista: 'aprobacion-desembolsos', titulo: 'Aprobación de desembolsos', navTitulo: 'Desembolsos', detalle: 'Consulta respaldos y registra una decisión.' },
    ],
    'panel-superadministracion': [
      { vista: 'revisiones-asistencia', titulo: 'Revisión de casos escalados', navTitulo: 'Revisiones', detalle: 'Resuelve revisiones excepcionales de asistencia.' },
      { vista: 'candidatos-asistencia', titulo: 'Casos para escalar', navTitulo: 'Escalamientos', detalle: 'Supervisa casos que requieren intervención global.' },
            { vista: 'dictamen-asistencia', titulo: 'Resolución de discrepancias de asistencia', navTitulo: 'Discrepancias', detalle: 'Registra la resolución y actualiza el estado del servicio.' },
    ],
  };
  readonly seccionesTrabajador: SeccionPanel[] = [
    { vista: 'solicitudes-trabajador', titulo: 'Solicitudes y ofertas', navTitulo: 'Solicitudes', detalle: 'Encuentra trabajos y envía tus propuestas.' },
    { vista: 'perfil-trabajador', titulo: 'Perfil y servicios', navTitulo: 'Perfil', detalle: 'Administra tu perfil y las categorías que atiendes.' },
    { vista: 'documentos-trabajador', titulo: 'Mis documentos', navTitulo: 'Documentos', detalle: 'Presenta y consulta el estado de tus documentos.' },
    { vista: 'cuenta-trabajador', titulo: 'Mi cuenta de trabajador', navTitulo: 'Mi cuenta', detalle: 'Consulta el estado y administra tu cuenta.' },
  ];
  readonly ejemplosDemo: EjemploDemo[] = [
    { nombre: 'Enviar una oferta', detalle: 'El trabajador revisa la solicitud y propone una visita.', accion: 'Simular envío de oferta', resultado: 'La oferta de demostración quedó enviada.' },
    { nombre: 'Aceptar una cotización', detalle: 'El cliente compara la propuesta antes de reservar.', accion: 'Simular aceptación', resultado: 'La cotización de demostración quedó aceptada.' },
    { nombre: 'Finalizar un servicio', detalle: 'Cliente y trabajador confirman que el trabajo terminó.', accion: 'Simular finalización', resultado: 'La finalización de demostración quedó registrada.' },
  ];
  demoActual: EjemploDemo = this.ejemplosDemo[0];
  demoMensaje = '';

  constructor(private readonly catalogo: CatalogoService, private readonly http: HttpClient) {}

  cargarCuenta(abrirAreaInicial = false): void {
    this.http.get<PerfilCuenta>('/api/usuarios/perfil').subscribe(
      perfil => {
        this.cuenta = perfil;
        if (abrirAreaInicial && !this.destinoInicialEspecifico) {
          this.navegar(perfil.estado === 'activo' ? this.panelPrincipal : 'mi-cuenta');
        }
      },
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
    this.mensajeCuenta = '';
    if (registro && this.credenciales.rol === 'trabajador' && !this.credenciales.zonaId) {
      this.errorCuenta = 'Selecciona tu zona de atención.';
      return;
    }
    this.guardandoCuenta = true;
    const datos = registro ? this.credenciales : {
      identificadorAcceso: this.credenciales.identificadorAcceso,
      contrasena: this.credenciales.contrasena,
    };
    this.http.post('/api/usuarios/' + (registro ? 'registro' : 'sesion'), datos).subscribe(
      () => {
        this.guardandoCuenta = false;
        this.credenciales.contrasena = '';
        if (registro) {
          this.modal = 'sesion';
          this.mensajeCuenta = 'Cuenta creada. Ahora inicia sesión con tu correo y contraseña.';
          return;
        }
        this.modal = '';
        this.cargarCuenta(true);
      },
      error => {
        this.guardandoCuenta = false;
        this.errorCuenta = (error.error && error.error.message) || 'No se pudo completar la operación.';
      }
    );
  }

  abrirSesion(): void {
    this.modal = 'sesion';
    this.errorCuenta = '';
    this.mensajeCuenta = '';
    this.menuAbierto = false;
  }

  abrirRegistro(): void {
    this.modal = 'registro';
    this.errorCuenta = '';
    this.mensajeCuenta = '';
    this.credenciales.nombre = '';
    this.credenciales.rol = 'cliente';
    this.credenciales.zonaId = '';
    this.menuAbierto = false;
    this.errorZonasRegistro = '';
  }

  alternarAcceso(): void {
    if (this.modal === 'sesion') { this.abrirRegistro(); }
    else { this.abrirSesion(); }
  }

  cerrarModal(): void {
    this.modal = '';
    this.errorCuenta = '';
    this.mensajeCuenta = '';
  }

  cambiarRolRegistro(rol: string): void {
    this.credenciales.rol = rol === 'trabajador' ? 'trabajador' : 'cliente';
    this.credenciales.zonaId = '';
    this.errorZonasRegistro = '';
    if (this.credenciales.rol !== 'trabajador') { return; }
    this.cargandoZonasRegistro = true;
    this.http.get<ZonaRegistro[]>('/api/usuarios/zonas').subscribe(
      zonas => {
        this.zonasRegistro = zonas || [];
        this.cargandoZonasRegistro = false;
        if (!this.zonasRegistro.length) { this.errorZonasRegistro = 'No hay zonas disponibles para el registro.'; }
      },
      () => {
        this.zonasRegistro = [];
        this.cargandoZonasRegistro = false;
        this.errorZonasRegistro = 'No pudimos cargar las zonas. Intenta de nuevo.';
      }
    );
  }

  cerrarSesion(): void {
    this.http.post('/api/usuarios/sesion/cerrar', {}).subscribe(
      () => { this.cuenta = null; this.destinoInicialEspecifico = false; this.navegar('inicio'); },
      () => { this.errorCuenta = 'No se pudo cerrar la sesión.'; }
    );
  }

  private tieneDestinoInicial(parametros: URLSearchParams): boolean {
    const clavesReserva = ['reserva', 'calificarReserva', 'reclamoReserva', 'asistenciaReserva',
      'cancelarReserva', 'cancelarServicio', 'modificarReserva', 'finalizarReserva'];
    if (clavesReserva.some(clave => {
      const id = parametros.get(clave);
      return !!id && /^[1-9][0-9]{0,18}$/.test(id);
    })) { return true; }

    const opinion = parametros.get('opinionCalificacion');
    if (opinion && /^[1-9][0-9]{0,18}$/.test(opinion)) { return true; }
    if (['avisosCancelacion', 'revisionPagos', 'incidentes', 'revisionesAsistencia', 'candidatosAsistencia']
      .some(clave => parametros.get(clave) === '1')) { return true; }

    const pantallas = ['perfil-trabajador', 'solicitudes-trabajador', 'cuenta-trabajador', 'desembolso-trabajador',
      'documentacion-trabajador', 'gestion-reclamos', 'aprobacion-desembolsos'];
    const pantalla = parametros.get('vista');
    return !!pantalla && pantallas.includes(pantalla);
  }

  ngOnInit(): void {
    const parametros = new URLSearchParams(window.location.search);
    this.destinoInicialEspecifico = this.tieneDestinoInicial(parametros);
    this.cargarCuenta(true);
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
    const panelModulo = this.panelParaModulo(vista);
    if (panelModulo && this.acceso(panelModulo)) {
      this.moduloAdministrativo = vista;
      this.vista = panelModulo;
    } else {
      this.vista = vista;
    }
    this.menuAbierto = false;
    window.scrollTo(0, 0);
    if (vista === 'panel-administracion' || vista === 'panel-superadministracion') {
      const secciones = this.seccionesPorPanel[vista] || [];
      if (!secciones.some(seccion => seccion.vista === this.moduloAdministrativo)) {
        this.moduloAdministrativo = secciones.length ? secciones[0].vista : '';
      }
    }
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

  acceso(vista: string): boolean {
    if (!this.cuenta || this.cuenta.estado !== 'activo') { return false; }
    if (vista === 'panel-trabajador' || ['perfil-trabajador', 'documentos-trabajador', 'solicitudes-trabajador', 'cuenta-trabajador', 'desembolso-trabajador'].includes(vista)) {
      return this.tieneRol('trabajador');
    }
    if (vista === 'panel-administracion' || ['documentacion-trabajador', 'gestion-reclamos', 'revision-pagos', 'incidentes', 'aprobacion-desembolsos'].includes(vista)) {
      return this.tieneRol('administrador');
    }
    if (vista === 'panel-superadministracion' || ['revisiones-asistencia', 'candidatos-asistencia', 'dictamen-asistencia'].includes(vista)) {      return this.tieneRol('superadministrador');
    }
    return false;
  }

  get areaAdministrativa(): string | null {
    if (this.vista === 'panel-administracion' && this.acceso(this.vista)) { return this.vista; }
    if (this.vista === 'panel-superadministracion' && this.acceso(this.vista)) { return this.vista; }
    return null;
  }

  get seccionesRol(): SeccionPanel[] {
    return this.acceso('panel-trabajador') ? this.seccionesTrabajador : [];
  }

  get panelPrincipal(): string {
    if (this.acceso('panel-superadministracion')) { return 'panel-superadministracion'; }
    if (this.acceso('panel-administracion')) { return 'panel-administracion'; }
    if (this.acceso('panel-trabajador')) { return 'panel-trabajador'; }
    return this.tieneRol('cliente') ? 'solicitud' : 'inicio';
  }

  private panelParaModulo(vista: string): string | null {
    for (const panel of Object.keys(this.seccionesPorPanel)) {
      if (this.seccionesPorPanel[panel].some(seccion => seccion.vista === vista)) { return panel; }
    }
    return null;
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
