import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateMaterialDto } from './create-material.dto';

export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {
  // Un material usado en ofertas no se borra: se desactiva
  @IsBoolean({ message: 'active debe ser verdadero o falso' })
  @IsOptional()
  active?: boolean;
}