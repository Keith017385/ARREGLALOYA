import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';

/**
 * Un unico proveedor DbService (singleton) para todos los casos de uso.
 * Al ser global, los modulos de funcionalidad no necesitan importarlo.
 */
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DatabaseModule {}
