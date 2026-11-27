
import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
 selector: 'app-moderacion-opiniones',
 template: `
 <section>
 <h2>{{ calificacionId ? 'Reportar calificación' : 'Moderación de opiniones' }}</h2>
 <p role="alert" *ngIf="error">{{ error }}</p>
 <p role="status" *ngIf="mensaje">{{ mensaje }}</p>
 <form *ngIf="calificacionId" (ngSubmit)="reportar()">
 <label>Motivo del reporte <textarea name="motivo" [(ngModel)]="motivo" required maxlength="2000"></textarea></label>
 <button class="btn" [disabled]="ocupado || enviado || !motivo.trim()">Enviar reporte</button>
 </form>
 <ng-container *ngIf="!calificacionId">
 <button class="btn" (click)="cargar()" [disabled]="ocupado">Actualizar reportes</button>
 <p *ngIf="!ocupado && !reportes.length">No hay reportes disponibles.</p>
 <article *ngFor="let r of reportes">
 <h3>Calificación #{{ r.calificacionId }} · {{ r.estado }}</h3>
 <p>Puntuación {{ r.puntuacion }} · {{ r.opinion }}</p>
 <p>Motivo del reporte · {{ r.motivo }}</p>
 <p *ngIf="r.decision">Decisión · {{ r.decision }}. {{ r.fundamento }}</p>
 <button class="btn" *ngIf="r.estado === 'pendiente'" [disabled]="ocupado" (click)="accion(r, 'revision')">Iniciar revisión</button>
 <form *ngIf="r.estado === 'en_revision'" (ngSubmit)="accion(r, 'resolucion')">
 <label>Decisión <select name="decision" [(ngModel)]="r.nuevaDecision" required>
 <option value="conservar">Conservar calificación</option><option value="invalidar">Invalidar calificación</option>
 </select></label>
 <label>Fundamento <textarea name="fundamento" [(ngModel)]="r.nuevoFundamento" required maxlength="2000"></textarea></label>
 <button class="btn" [disabled]="ocupado || !r.nuevoFundamento || !r.nuevoFundamento.trim()">Guardar resolución</button>
 </form>
 <p *ngIf="r.reputacion">Reputación vigente · {{ r.reputacion.promedio === null ? 'Sin calificaciones válidas' : r.reputacion.promedio }} ({{ r.reputacion.cantidad }})</p>
 </article>
 </ng-container>
 </section>`,
 styles: ['article {padding: 1rem; border-bottom: 1px solid #ddd} label {display: grid; margin: 1rem 0} textarea {min-height: 5rem; font: inherit}']
})
export class ModeracionOpinionesComponent implements OnInit {
 @Input() calificacionId = '';
 motivo = ''; error = ''; mensaje = ''; ocupado = false; enviado = false;
 reportes: any[] = [];
 constructor(private http: HttpClient) {}
 ngOnInit() { if (!this.calificacionId) this.cargar(); }
 fallo(e: any) { this.ocupado = false; this.error = e.error && e.error.message || 'No se pudo completar la operación.'; }
 cargar() {
 this.error = ''; this.ocupado = true;
 this.http.get<any[]>('/api/administracion/reportes-opiniones').subscribe(rows => {
 this.reportes = rows.map(r => ({...r, nuevaDecision: 'conservar', nuevoFundamento: ''})); this.ocupado = false;
 this.reportes.forEach(r => this.http.get('/api/trabajadores/' + r.trabajadorId + '/reputacion').subscribe(v => r.reputacion = v, () => {}));
 }, e => this.fallo(e));
 }
 reportar() {
 this.ocupado = true; this.error = '';
 this.http.post('/api/calificaciones/' + this.calificacionId + '/reportes', {motivo: this.motivo}).subscribe(() => {
 this.ocupado = false; this.enviado = true; this.mensaje = 'Reporte enviado para revisión.';
 }, e => this.fallo(e));
 }
 accion(r: any, tipo: string) {
 this.ocupado = true; this.error = '';
 this.http.post('/api/administracion/reportes-opiniones/' + r.id + '/' + tipo,
 {decision: r.nuevaDecision, fundamento: r.nuevoFundamento}).subscribe(() => { this.mensaje = 'Revisión guardada.'; this.cargar(); }, e => this.fallo(e));
 }
}
