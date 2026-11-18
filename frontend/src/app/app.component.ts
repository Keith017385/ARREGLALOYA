import { Component, OnInit } from '@angular/core';
import { SaludoService } from './servicios/saludo.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'frontend';
  mensajeBackend = 'Cargando Saludo...';

  constructor(private saludoService: SaludoService) {}
  
  ngOnInit() : void{

    this.saludoService.obtenerSaludo().subscribe(mensaje => {
      this.mensajeBackend = mensaje;
    },
    () => {
      this.mensajeBackend = 'Error al obtener el saludo';
    }
  );
 }
}
