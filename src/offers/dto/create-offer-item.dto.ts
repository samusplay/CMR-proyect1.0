import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Matches, Min } from 'class-validator';

// Línea de catálogo: materialId + quantity.
// Línea libre: description + unitPrice + quantity (unitCode opcional).
export class CreateOfferItemDto {
  @IsString({ message: 'El id del material debe ser un texto' })
  @IsNotEmpty({ message: 'El id del material no puede estar vacío' })
  @IsOptional()
  materialId?: string;

  @IsString({ message: 'La descripción debe ser un texto' })
  @Matches(/\S/, { message: 'La descripción no puede estar vacía' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'La unidad debe ser un texto' })
  @IsOptional()
  unitCode?: string;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @IsPositive({ message: 'La cantidad debe ser mayor a cero' })
  quantity!: number;

   // Se permite 0 para guardar un borrador incompleto; una oferta con precios en 0 no se puede enviar
  @IsInt({ message: 'El precio unitario debe ser un número entero (pesos)' })
  @Min(0, { message: 'El precio unitario no puede ser negativo' })
  @IsOptional()
  unitPrice?: number;

  @IsString({ message: 'El grupo debe ser un texto' })
  @IsOptional()
  groupLabel?: string;
}