import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt({ message: 'La transacción debe ser un número entero' })
  @Min(1, { message: 'La transacción debe ser un entero positivo' })
  transactionId!: number;

  @Type(() => Number)
  @IsInt({ message: 'La calificación debe ser un número entero' })
  @Min(1, { message: 'La calificación debe estar entre 1 y 5' })
  @Max(5, { message: 'La calificación debe estar entre 1 y 5' })
  rating!: number;

  @IsOptional()
  @IsString({ message: 'El comentario debe ser un texto' })
  @MaxLength(1000, { message: 'El comentario no puede superar los 1000 caracteres' })
  comment?: string;
}
