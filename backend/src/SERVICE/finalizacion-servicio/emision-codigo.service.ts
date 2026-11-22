import { createHash, randomBytes } from 'node:crypto';

interface RepositorioEmisionCodigo {
  guardar(
    reservaId: string,
    trabajadorId: string,
    hash: string,
  ): Promise<{ id: string; generadoEn: Date }>;
}

export class EmisionCodigoService {
  constructor(private readonly repositorio: RepositorioEmisionCodigo) {}

  async emitir(reservaId: string, trabajadorId: string) {
    const codigo = randomBytes(24).toString('base64url');
    const hash = createHash('sha256').update(codigo, 'utf8').digest('hex');

    const guardado = await this.repositorio.guardar(
      reservaId,
      trabajadorId,
      hash,
    );

    return {
      codigoId: guardado.id,
      reservaId,
      codigo,
      generadoEn: guardado.generadoEn,
    };
  }
}