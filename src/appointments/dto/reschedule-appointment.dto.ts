// dto/reschedule-appointment.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsIsoDateWithTimezone } from './is-iso-date-with-timezone.decorator';

export class RescheduleAppointmentDto {
  @IsIsoDateWithTimezone()
  scheduledAt!: string;

  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo de la reprogramación es obligatorio' })
  reason!: string;

  // permite cambiar de inspector al mismo tiempo que se mueve la fecha
  @IsString({ message: 'El id del inspector debe ser un texto' })
  @IsOptional()
  inspectorId?: string;
}