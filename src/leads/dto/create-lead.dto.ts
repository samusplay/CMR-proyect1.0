import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLeadDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  name !: string;

  @IsEmail({}, { message: 'El email no es válido' })
  email !: string;

  @IsString({ message: 'El teléfono debe ser un texto' })
  @IsOptional()
  phone?: string;

  @IsString({ message: 'El id de campaña debe ser un texto' })
  @IsOptional()
  campaignId?: string;
}