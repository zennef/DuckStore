import {
  IsInt,
  IsNumber,
  IsPositive,
  Min,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
} from 'class-validator';

const EDITABLE_FIELDS = ['price', 'quantity'] as const;

/**
 * Fails unless at least one of the editable fields is present. Attached to a property
 * that never appears in the body, because class-validator has no class-level validators.
 */
function HasAnyEditableField() {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'hasAnyEditableField',
      target: target.constructor,
      propertyName,
      validator: {
        validate: (_value: unknown, args: ValidationArguments) => {
          const body = args.object as Record<string, unknown>;
          return EDITABLE_FIELDS.some((field) => body[field] !== undefined);
        },
        defaultMessage: () => `at least one of ${EDITABLE_FIELDS.join(', ')} is required`,
      },
    });
  };
}

/**
 * Only price and quantity are editable. Color and size are not declared here, so the
 * global ValidationPipe (forbidNonWhitelisted) rejects them with a 400.
 */
export class UpdateDuckDto {
  // ValidateIf instead of IsOptional so an explicit null is rejected rather than skipped.
  @ValidateIf((_obj, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  price?: number;

  // 0 is allowed: an order can drain stock to 0 and the edit form must still save.
  @ValidateIf((_obj, value) => value !== undefined)
  @IsInt()
  @Min(0)
  quantity?: number;

  @HasAnyEditableField()
  private readonly editableFieldCheck?: never;
}
