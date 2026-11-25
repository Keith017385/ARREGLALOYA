import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DbService } from '../INFRASTRUCTURE/db.service';

@Injectable()
export class PropietarioTrabajadorGuard implements CanActivate {
  constructor(private readonly db: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      session: { usuarioId?: string };
      params: { usuarioId: string };
      path: string;
    }>();
    const usuarioId = req.session.usuarioId;
    if (!usuarioId) throw new UnauthorizedException('Inicia sesión para continuar.');
    if (usuarioId !== req.params.usuarioId) throw new ForbiddenException('No puedes operar otra cuenta.');
    const { rows } = await this.db.pool.query<{ estado: string }>(
      "SELECT u.estado FROM arreglalo.usuario u JOIN arreglalo.usuario_rol ur USING (usuario_id) JOIN arreglalo.rol r USING (rol_id) WHERE u.usuario_id = $1 AND r.codigo = 'trabajador'",
      [usuarioId],
    );
    const estado = rows[0]?.estado;
    if (estado === 'activo') return true;
    if (estado === 'suspendido_voluntario' && /\/cuenta(?:\/reactivacion)?$/.test(req.path)) return true;
    throw new ForbiddenException('Se requiere una cuenta de trabajador habilitada.');
  }
}
