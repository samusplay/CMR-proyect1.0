// dto/create-appointment.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsIsoDateWithTimezone } from './is-iso-date-with-timezone.decorator';

export class CreateAppointmentDto {
  @IsString({ message: 'El id del deal debe ser un texto' })
  @IsNotEmpty({ message: 'El id del deal es obligatorio' })
  dealId!: string;

  @IsIsoDateWithTimezone()
  scheduledAt!: string;

  @IsString({ message: 'El id del inspector debe ser un texto' })
  @IsOptional()
  inspectorId?: string;

  @IsString({ message: 'Las notas deben ser un texto' })
  @IsOptional()
  notes?: string;
}