export interface ReservaConFondo {
  id: string;
  disponible: string;
}

export abstract class SolicitudDesembolsoRepository {
  abstract listar(trabajadorId: string): Promise<ReservaConFondo[]>;
  abstract solicitar(trabajadorId: string, reservaId: string, importe: string, archivo: Buffer): Promise<string | null>;
  abstract documento(administradorId: string, solicitudId: string): Promise<Buffer | null>;
}
