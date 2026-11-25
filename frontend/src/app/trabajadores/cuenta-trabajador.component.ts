import { Component, OnInit } from '@angular/core';
import { CuentaTrabajador } from './cuenta-trabajador';
import { CuentaTrabajadorService } from './cuenta-trabajador.service';

@Component({ selector: 'app-cuenta-trabajador', templateUrl: './cuenta-trabajador.component.html' })
export class CuentaTrabajadorComponent implements OnInit {
  // Temporal: cuando exista el inicio de sesión, este id vendrá del trabajador autenticado.
  usuarioId = '10';
  cuenta: CuentaTrabajador | null = null;
  cargando = false; trabajando = false; error = ''; mensaje = '';

  constructor(private readonly cuentas: CuentaTrabajadorService) {}

  ngOnInit() { this.cargar(); }

  get etiquetaEstado(): string {
    switch (this.cuenta && this.cuenta.estado) {
      case 'activo': return 'Activa';
      case 'suspendido_voluntario': return 'Suspendida por ti';
      case 'suspendido_sancion': return 'Suspendida por sanción';
      case 'eliminado': return 'Eliminada';
      default: return '';
    }
  }

  cargar() {
    this.cargando = true; this.error = '';
    this.cuentas.obtener(this.usuarioId).subscribe(
      cuenta => { this.cuenta = cuenta; this.cargando = false; },
      e => { this.error = this.textoError(e, 'No pudimos cargar tu cuenta.'); this.cargando = false; }
    );
  }

  suspender() {
    if (!window.confirm('¿Seguro que quieres suspender tu cuenta? Podrás reactivarla cuando quieras.')) { return; }
    this.cambiar(this.cuentas.suspender(this.usuarioId), 'Tu cuenta quedó suspendida.', 'No pudimos suspender la cuenta.');
  }

  reactivar() {
    this.cambiar(this.cuentas.reactivar(this.usuarioId), 'Tu cuenta quedó activa de nuevo.', 'No pudimos reactivar la cuenta.');
  }

  private cambiar(llamada: any, exito: string, porDefecto: string) {
    this.trabajando = true; this.error = ''; this.mensaje = '';
    llamada.subscribe(
      (cuenta: CuentaTrabajador) => { this.cuenta = cuenta; this.mensaje = exito; this.trabajando = false; },
      (e: any) => { this.error = this.textoError(e, porDefecto); this.trabajando = false; }
    );
  }

  private textoError(e: any, porDefecto: string): string {
    const mensaje = e && e.error && e.error.message;
    return typeof mensaje === 'string' ? mensaje : porDefecto;
  }
}