// dto/find-appointments-query.dto.ts
import { AppointmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IsIsoDateWithTimezone } from './is-iso-date-with-timezone.decorator';

export class FindAppointmentsQueryDto {
  @IsIsoDateWithTimezone()
  @IsOptional()
  from?: string;

  @IsIsoDateWithTimezone()
  @IsOptional()
  to?: string;

  @IsString({ message: 'El id del inspector debe ser un texto' })
  @IsOptional()
  inspectorId?: string;

  @IsString({ message: 'El id del deal debe ser un texto' })
  @IsOptional()
  dealId?: string;

  @IsEnum(AppointmentStatus, {
    message: 'El estado debe ser PROGRAMADA, REPROGRAMADA, COMPLETADA o CANCELADA',
  })
  @IsOptional()
  status?: AppointmentStatus;
}