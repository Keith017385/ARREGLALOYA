import { Component, Input, OnInit } from '@angular/core';
import { CasoAbierto, ResultadoAsistencia } from './dictamen-asistencia';
import { DictamenAsistenciaService } from './dictamen-asistencia.service';

@Component({ selector: 'app-dictamen-asistencia', templateUrl: './dictamen-asistencia.component.html' })
export class DictamenAsistenciaComponent implements OnInit {
  // El id del superadministrador que inició sesión llega desde app.component.html.
  @Input() usuarioId: string | number = '';
  casos: CasoAbierto[] = [];
  elegido: CasoAbierto | null = null;
  resultado: ResultadoAsistencia | '' = '';
  explicacion = '';
  cargando = false; guardando = false; error = ''; mensaje = '';

  constructor(private readonly api: DictamenAsistenciaService) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando = true; this.error = '';
    this.api.listar().subscribe(
      casos => { this.casos = casos; this.cargando = false; },
      e => { this.error = this.textoError(e, 'No pudimos cargar los casos.'); this.cargando = false; }
    );
  }

  elegir(caso: CasoAbierto) {
    this.elegido = caso; this.resultado = ''; this.explicacion = ''; this.error = ''; this.mensaje = '';
  }

  guardar() {
    if (!this.elegido || !this.resultado) { return; }
    if (!window.confirm('Resolver es definitivo y no se puede repetir. ¿Continuar?')) { return; }
    this.guardando = true; this.error = ''; this.mensaje = '';
    this.api.dictaminar(this.elegido.respuestaId, {
      responsableId: String(this.usuarioId),
      resultado: this.resultado,
      explicacion: this.explicacion
    }).subscribe(
      () => {
        this.mensaje = 'Resolución registrada.';
        this.elegido = null; this.guardando = false; this.cargar();
      },
      e => { this.error = this.textoError(e, 'No pudimos registrar la resolución.'); this.guardando = false; }
    );
  }

  private textoError(e: any, porDefecto: string): string {
    const mensaje = e && e.error && e.error.message;
    return typeof mensaje === 'string' ? mensaje : porDefecto;
  }
}