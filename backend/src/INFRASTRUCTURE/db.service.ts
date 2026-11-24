import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Una instancia de Pool compartida por toda la aplicacion.
 * max: 5 es el limite de conexiones reutilizables, NO cinco bases de datos.
 * pg obtiene PGHOST, PGPORT, PGDATABASE, PGUSER y PGPASSWORD del entorno.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);

  readonly pool = new Pool({
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 5000,
  });

  constructor() {
    this.pool.on('error', (error: Error) => {
      this.logger.error('Conexion inactiva con PostgreSQL perdida.', error.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
