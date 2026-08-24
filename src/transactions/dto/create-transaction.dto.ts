import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CreateTransactionDto {
  @Type(() => Number)
  @IsInt({ message: 'El servicio debe ser un número entero' })
  @Min(1, { message: 'El servicio debe ser un entero positivo' })
  @Max(Number.MAX_SAFE_INTEGER, {
    message: 'El servicio debe ser un número válido',
  })
  serviceId!: number;
}
