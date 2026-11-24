import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatosPerfil, PerfilTrabajador, ServicioTrabajador } from './perfil-trabajador';
@Injectable({ providedIn: 'root' })
export class PerfilTrabajadorService {
  constructor(private readonly http: HttpClient) {}
  obtenerPerfil(usuarioId: string) {
    return this.http.get<PerfilTrabajador>(`/api/trabajadores/${usuarioId}/perfil`);
  }
  guardarPerfil(usuarioId: string, datos: DatosPerfil) {
    return this.http.put<PerfilTrabajador>(`/api/trabajadores/${usuarioId}/perfil`, datos);
  }
  listarServicios(usuarioId: string) {
    return this.http.get<ServicioTrabajador[]>(`/api/trabajadores/${usuarioId}/servicios`);
  }
  agregarServicio(usuarioId: string, categoriaId: string) {
    return this.http.post(`/api/trabajadores/${usuarioId}/servicios`, { categoriaId });
  }
  quitarServicio(usuarioId: string, categoriaId: string) {
    return this.http.delete(`/api/trabajadores/${usuarioId}/servicios/${categoriaId}`);
  }
}