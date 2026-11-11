import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
@Injectable()
export class DbService implements OnModuleDestroy {
  // pg lee PGHOST, PGPORT, PGDATABASE, PGUSER y PGPASSWORD del entorno.
  readonly pool = new Pool({ max: 5, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, statement_timeout: 5000 });
  constructor() {
    this.pool.on('error', () => console.error('Conexión inactiva perdida; revise PostgreSQL/Tailscale.'));
  }
  async onModuleDestroy() { await this.pool.end(); }
}
