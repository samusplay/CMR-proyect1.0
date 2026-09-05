import { InstallationType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateDealDto {
  @IsString({ message: 'El id del lead debe ser un texto' })
  @IsNotEmpty({ message: 'El id del lead no puede estar vacío' })
  leadId !: string;

  @IsEnum(InstallationType, {
    message: 'El tipo de instalación debe ser SOLAR, CARGADOR o AMBOS',
  })
  installationType !: InstallationType;

  @IsInt({ message: 'El valor estimado debe ser un número entero' })
  @IsPositive({ message: 'El valor estimado debe ser mayor a cero' })
  estimatedValue !: number;

  @IsDateString({}, { message: 'La fecha esperada de cierre no es válida' })
  @IsOptional()
  expectedCloseDate?: string;

  @IsString({ message: 'Las notas deben ser un texto' })
  @IsOptional()
  notes?: string;

  @IsString({ message: 'El id del vendedor asignado debe ser un texto' })
  @IsOptional()
  assignedToId?: string;
}