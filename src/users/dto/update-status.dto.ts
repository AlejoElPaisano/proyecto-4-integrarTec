import { IsBoolean } from 'class-validator';

export class UpdateStatusDto {
  @IsBoolean({ message: 'El estado debe ser booleano' })
  isActive!: boolean;
}
