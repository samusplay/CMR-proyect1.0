import { PartialType } from '@nestjs/mapped-types';
import { InspectionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateInspectionDto } from './create-inspection.dto';

export class UpdateInspectionDto extends PartialType(CreateInspectionDto) {
  @IsEnum(InspectionStatus, { message: 'El estado debe ser PENDIENTE, APROBADA o RECHAZADA' })
  @IsOptional()
  status?: InspectionStatus;
}