import { ArgumentsHost, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { mapPrismaError, PrismaConflictFilter } from './prisma-conflict.filter';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
}

describe('mapPrismaError', () => {
  it('maps P2034 (write conflict or deadlock) to a 409', () => {
    const mapped = mapPrismaError(prismaError('P2034'));
    expect(mapped).toBeInstanceOf(ConflictException);
    expect((mapped as ConflictException).getResponse()).toEqual({
      statusCode: 409,
      message: 'Conflicting update, please retry',
      error: 'Conflict',
    });
  });

  it('leaves other Prisma errors unchanged', () => {
    const error = prismaError('P2025');
    expect(mapPrismaError(error)).toBe(error);
  });

  it('leaves non-Prisma errors unchanged', () => {
    const error = new Error('P2034');
    expect(mapPrismaError(error)).toBe(error);
  });
});

describe('PrismaConflictFilter', () => {
  const host = {} as ArgumentsHost;
  const baseCatch = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation();
  const filter = new PrismaConflictFilter();

  afterEach(() => baseCatch.mockClear());
  afterAll(() => baseCatch.mockRestore());

  it('hands the 409 to the default handler for P2034', () => {
    filter.catch(prismaError('P2034'), host);
    expect(baseCatch).toHaveBeenCalledWith(expect.any(ConflictException), host);
  });

  it('hands other Prisma errors to the default handler as is', () => {
    const error = prismaError('P2002');
    filter.catch(error, host);
    expect(baseCatch).toHaveBeenCalledWith(error, host);
  });
});
