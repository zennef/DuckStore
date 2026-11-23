import { ArgumentsHost, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/** Prisma's code for "Transaction failed due to a write conflict or a deadlock". */
export const WRITE_CONFLICT_CODE = 'P2034';

/**
 * Maps a Prisma write conflict or deadlock to a 409. The database rolled the transaction
 * back, so the client can safely retry. Any other error is returned unchanged.
 */
export function mapPrismaError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === WRITE_CONFLICT_CODE) {
    return new ConflictException('Conflicting update, please retry');
  }
  return error;
}

/**
 * Global filter so every service gets the mapping without wrapping each transaction.
 * Extends BaseExceptionFilter so unmapped Prisma errors keep Nest's default handling (500).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaConflictFilter extends BaseExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    super.catch(mapPrismaError(error), host);
  }
}
