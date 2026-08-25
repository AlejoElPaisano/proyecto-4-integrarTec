import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString({ message: 'El título debe ser un texto' })
  @IsNotEmpty({ message: 'El título no puede estar vacío' })
  @MinLength(2, { message: 'El título debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El título no puede superar los 100 caracteres' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía' })
  @MinLength(1, { message: 'La descripción no puede estar vacía' })
  @MaxLength(2000, {
    message: 'La descripción no puede superar los 2000 caracteres',
  })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La duración debe ser un número entero' })
  @Min(1, { message: 'La duración debe ser mayor a 0 minutos' })
  @Max(1440, { message: 'La duración no puede superar los 1440 minutos' })
  durationMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La categoría debe ser un número entero' })
  @Min(1, { message: 'La categoría debe ser un entero positivo' })
  categoryId?: number;
}
