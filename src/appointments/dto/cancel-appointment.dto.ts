// dto/cancel-appointment.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelAppointmentDto {
  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo de la cancelación es obligatorio' })
  reason!: string;
}