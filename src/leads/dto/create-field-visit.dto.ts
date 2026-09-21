// leads/dto/create-field-visit.dto.ts
import { InstallationType } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFieldVisitDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string;

  @IsEmail({}, { message: 'El correo debe ser válido' })
  email!: string;

  @IsString({ message: 'El teléfono debe ser un texto' })
  @IsOptional()
  phone?: string;

  @IsEnum(InstallationType, { message: 'El tipo debe ser SOLAR, CARGADOR o AMBOS' })
  installationType!: InstallationType;

  @IsString({ message: 'El id de la campaña debe ser un texto' })
  @IsOptional()
  campaignId?: string;
}