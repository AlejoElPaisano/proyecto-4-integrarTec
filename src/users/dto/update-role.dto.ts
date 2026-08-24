import { IsEnum } from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class UpdateRoleDto {
  @IsEnum(Role, { message: 'El rol no es válido' })
  role!: Role;
}
