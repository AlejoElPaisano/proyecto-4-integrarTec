import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class BalanceGrantDto {
  @IsInt({ message: 'La cantidad debe ser un entero' })
  @Min(1, { message: 'La cantidad debe ser mayor a cero' })
  amount!: number;

  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo no puede estar vacío' })
  @Matches(/\S/, { message: 'El motivo no puede estar vacío' })
  @MaxLength(500, { message: 'El motivo no puede superar los 500 caracteres' })
  reason!: string;
}
