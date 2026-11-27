import {
  type DecisionApelacion,
  type EvidenciaApelacionNueva,
  type SancionPropia,
} from '../../CORE/apelacion-sancion/apelacion-sancion';
import type { ApelacionSancionRepository } from '../../CORE/apelacion-sancion/apelacion-sancion.repository';

const MAX_BYTES_EVIDENCIA = 5 * 1024 * 1024;
const MAX_EVIDENCIAS = 3;

function validarTexto(valor: unknown, minimo: number, maximo: number, mensaje: string): string {
  if (typeof valor !== 'string') {
    throw new Error(mensaje);
  }

  const texto = valor.trim();
  if (texto.length < minimo || texto.length > maximo || texto.includes('\0')) {
    throw new Error(mensaje);
  }

  return texto;
}

function prepararEvidencias(valor: unknown): EvidenciaApelacionNueva[] {
  if (valor == null) {
    return [];
  }
  if (!Array.isArray(valor) || valor.length > MAX_EVIDENCIAS) {
    throw new Error('Adjunta como máximo 3 evidencias.');
  }

  return valor.map((archivo: unknown) => {
    if (typeof archivo !== 'object' || archivo === null) {
      throw new Error('Una evidencia no es válida.');
    }

    const evidencia = archivo as { nombreArchivo?: unknown; contenido?: unknown };
    const nombreArchivo = validarTexto(
      evidencia.nombreArchivo,
      1,
      180,
      'El nombre del archivo debe tener entre 1 y 180 caracteres.',
    );

    if (!(evidencia.contenido instanceof Uint8Array)) {
      throw new Error('El contenido de la evidencia no es válido.');
    }
    if (evidencia.contenido.byteLength < 5 || evidencia.contenido.byteLength > MAX_BYTES_EVIDENCIA) {
      throw new Error('Cada evidencia debe pesar entre 5 bytes y 5 MB.');
    }

    return {
      nombreArchivo,
      contenido: evidencia.contenido,
    };
  });
}

export class ApelacionSancionService {
  constructor(private readonly repositorio: ApelacionSancionRepository) {}

  async crear(
    actorId: string,
    sancionId: string,
    justificacion: unknown,
    evidencias: unknown,
  ) {
    const texto = validarTexto(
      justificacion,
      20,
      3000,
      'La justificación debe tener entre 20 y 3000 caracteres.',
    );
    const archivos = prepararEvidencias(evidencias);
    const resultado = await this.repositorio.crear(actorId, sancionId, texto, archivos);

    switch (resultado.estado) {
      case 'sin_permiso':
        throw new Error('Se requiere una cuenta de trabajador activa.');
      case 'sancion_no_encontrada':
        throw new Error('No se encontró la sanción.');
      case 'sancion_no_propia':
        throw new Error('Solo puedes apelar tus propias sanciones.');
      case 'ya_pendiente':
        throw new Error('Ya existe una apelación pendiente para esta sanción.');
      case 'creada':
        return resultado.apelacion;
    }
  }

  async listarPropias(actorId: string) {
    const resultado = await this.repositorio.listarPropias(actorId);
    if (resultado.estado === 'sin_permiso') {
      throw new Error('Se requiere una cuenta de trabajador activa.');
    }
    return resultado.apelaciones;
  }

  async listarPendientes(actorId: string) {
    const resultado = await this.repositorio.listarPendientes(actorId);
    if (resultado.estado === 'sin_permiso') {
      throw new Error('Se requiere un administrador activo.');
    }
    return resultado.apelaciones;
  }

  async consultar(actorId: string, apelacionId: string) {
    const resultado = await this.repositorio.consultar(actorId, apelacionId);

    switch (resultado.estado) {
      case 'sin_permiso':
        throw new Error('No tienes permiso para consultar esta apelación.');
      case 'no_encontrada':
        throw new Error('No se encontró la apelación.');
      case 'encontrada':
        return resultado.apelacion;
    }
  }

  async resolver(
    actorId: string,
    apelacionId: string,
    decision: unknown,
    fundamento: unknown,
  ) {
    if (decision !== 'aprobada' && decision !== 'rechazada') {
      throw new Error('La decisión debe ser aprobada o rechazada.');
    }

    const texto = validarTexto(
      fundamento,
      10,
      2000,
      'El fundamento debe tener entre 10 y 2000 caracteres.',
    );
    const resultado = await this.repositorio.resolver(
      actorId,
      apelacionId,
      decision as DecisionApelacion,
      texto,
    );

    switch (resultado.estado) {
      case 'sin_permiso':
        throw new Error('Se requiere un administrador activo.');
      case 'no_encontrada':
        throw new Error('No se encontró la apelación.');
      case 'ya_resuelta':
        throw new Error('La apelación ya tiene una decisión.');
      case 'resuelta':
        return resultado.apelacion;
    }
  }
  async descargarEvidencia(actorId: string, apelacionId: string, evidenciaId: string) {
  const resultado = await this.repositorio.descargarEvidencia(
    actorId,
    apelacionId,
    evidenciaId,
  );

  switch (resultado.estado) {
    case 'sin_permiso':
      throw new Error('No tienes permiso para descargar esta evidencia.');
    case 'no_encontrada':
      throw new Error('No se encontró la evidencia solicitada.');
    case 'encontrada':
      return resultado.evidencia;
  }
}

  async listarSancionesPropias(actorId: string): Promise<SancionPropia[]> {
    const resultado = await this.repositorio.listarSancionesPropias(actorId);
    if (resultado.estado === 'sin_permiso') {
      throw new Error('Se requiere una cuenta de trabajador activa.');
    }
    return resultado.sanciones;
  }
}