import{ Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class SaludoService {
  constructor(private http: HttpClient) {}
     obtenerSaludo() {
      return this.http.get('http://localhost:3000/', { responseType: 'text' });
    }
}