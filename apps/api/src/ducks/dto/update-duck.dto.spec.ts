import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateDuckDto } from './update-duck.dto';

function errorsFor(body: object) {
  return validateSync(plainToInstance(UpdateDuckDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('UpdateDuckDto', () => {
  it.each([{ price: 12.5 }, { quantity: 3 }, { quantity: 0 }, { price: 1, quantity: 2 }])(
    'accepts %j',
    (body) => {
      expect(errorsFor(body)).toEqual([]);
    },
  );

  it('requires at least one of price or quantity', () => {
    const [error] = errorsFor({});
    expect(error.constraints).toEqual({
      hasAnyEditableField: 'at least one of price, quantity is required',
    });
  });

  it.each([
    { price: null },
    { quantity: null },
    { price: 0 },
    { price: 1.234 },
    { quantity: -1 },
    { quantity: 1.5 },
    { color: 'Red', quantity: 1 },
    { size: 'Large', quantity: 1 },
  ])('rejects %j', (body) => {
    expect(errorsFor(body)).not.toEqual([]);
  });
});
