import { Color, Size } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateDuckDto {
  @IsEnum(Color)
  color: Color;

  @IsEnum(Size)
  size: Size;

  // At most 2 decimal places so merge matching on a DOUBLE column stays exact.
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsPositive()
  price: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
