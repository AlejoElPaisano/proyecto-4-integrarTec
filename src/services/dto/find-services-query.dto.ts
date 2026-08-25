import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class FindServicesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La categoría debe ser un número entero' })
  @Min(1, { message: 'La categoría debe ser un entero positivo' })
  categoryId?: number;

  @IsOptional()
  @IsUUID('4', { message: 'El proveedor debe ser un UUID válido' })
  providerId?: string;

  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser un texto' })
  @IsNotEmpty({ message: 'La búsqueda no puede estar vacía' })
  @Matches(/\S/, { message: 'La búsqueda no puede estar vacía' })
  @MaxLength(100, { message: 'La búsqueda no puede superar los 100 caracteres' })
  search?: string;
}
