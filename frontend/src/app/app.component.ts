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
  constructor(private readonly catalogo: CatalogoService) {}
  ngOnInit() { this.cargar(); }
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
