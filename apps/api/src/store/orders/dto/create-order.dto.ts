import { Color, Size } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ShippingMode } from '../../packaging/packaging.enums';

export class CreateOrderDto {
  @IsEnum(Color)
  color: Color;

  @IsEnum(Size)
  size: Size;

  @IsInt()
  @Min(1)
  quantity: number;

  // Trimmed before validation, so "   " is rejected as empty. CountryTaxRule does the
  // case-insensitive matching and aliases.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  country: string;

  @IsEnum(ShippingMode)
  shippingMode: ShippingMode;
}
