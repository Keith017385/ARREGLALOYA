import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Categoria } from './catalogo/categoria';
import { TrabajadorDemo } from './trabajadores/trabajador-demo';
import { CatalogoService } from './catalogo/catalogo.service';
import { TRABAJADORES_DEMO } from './trabajadores/demostracion';
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

  constructor(private readonly catalogo: CatalogoService) {}
  ngOnInit(): void {
    const parametros = new URLSearchParams(window.location.search);
    const casosReserva: Array<[string, string]> = [
      ['reserva', 'pago'],
      ['calificarReserva', 'calificacion'],
      ['reclamoReserva', 'reclamo'],
      ['asistenciaReserva', 'asistencia'],
      ['cancelarReserva', 'cancelacion'],
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
    // El acceso a solicitudes se habilitará con autenticación real.
    this.modal = 'sesion-requerida';
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
