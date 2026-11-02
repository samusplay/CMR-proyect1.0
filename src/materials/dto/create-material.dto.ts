import { MaterialCategory } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsPositive, IsString, Matches } from 'class-validator';

export class CreateMaterialDto {
  @IsString({ message: 'El código debe ser un texto' })
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @Matches(/\S/, { message: 'El código no puede estar vacío' })
  code!: string;

  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @Matches(/\S/, { message: 'La descripción no puede estar vacía' })
  description!: string;

  @IsEnum(MaterialCategory, {
    message:
      'La categoría debe ser CABLEADO, CANALIZACION, PROTECCIONES, CARGADOR, ANCLAJES, SOLAR, MANO_DE_OBRA u OTROS',
  })
  category!: MaterialCategory;

  @IsString({ message: 'La unidad debe ser un texto' })
  @IsNotEmpty({ message: 'La unidad es obligatoria' })
  @Matches(/\S/, { message: 'La unidad no puede estar vacía' })
  unitCode!: string; // UN, ML, etc.

  @IsInt({ message: 'El precio unitario debe ser un número entero (pesos)' })
  @IsPositive({ message: 'El precio unitario debe ser mayor a cero' })
  unitPrice!: number;
}