import { AnchorType, ChargerMountType, SystemType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

//Adaptar pasos en el frontend 
export class CreateInspectionDto {
  // Relación
  @IsString({ message: 'El id del deal debe ser un texto' })
  @IsNotEmpty({ message: 'El id del deal es obligatorio' })
  dealId !: string;

  // 1. Información general
  @IsString({ message: 'El nombre del inspector debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre del inspector es obligatorio' })
  inspectorName !: string;

  @IsString({ message: 'La ubicación debe ser un texto' })
  @IsOptional()
  location?: string;

  @IsString({ message: 'El número de parqueadero debe ser un texto' })
  @IsOptional()
  parkingNumber?: string;

  // 2. Red eléctrica existente
  @IsEnum(SystemType, { message: 'El tipo de sistema debe ser MONOFASICO, BIFASICO o TRIFASICO' })
  systemType !: SystemType;

  @IsString({ message: 'El detalle del sistema debe ser un texto' })
  @IsOptional()
  systemDetail?: string;

  @IsString({ message: 'El punto de origen debe ser un texto' })
  @IsNotEmpty({ message: 'El punto de origen es obligatorio' })
  originPoint !: string;

  @IsString({ message: 'La identificación del tablero debe ser un texto' })
  @IsOptional()
  panelIdentification?: string;

  @IsString({ message: 'La capacidad del breaker debe ser un texto' })
  @IsOptional()
  breakerCapacity?: string;

  @IsBoolean({ message: 'hasPanelSpace debe ser verdadero o falso' })
  hasPanelSpace !: boolean;

  @IsString({ message: 'Los espacios disponibles deben ser un texto' })
  @IsOptional()
  availablePanelSpaces?: string;

  @IsBoolean({ message: 'requiresDrilling debe ser verdadero o falso' })
  requiresDrilling !: boolean;

  @IsString({ message: 'La ubicación de perforación debe ser un texto' })
  @IsOptional()
  drillingLocation?: string;

  // 3. Trayectoria y canalización
  @IsString({ message: 'El tipo de canalización debe ser un texto' })
  @IsOptional()
  conduitType?: string;

  @IsString({ message: 'La condición de la tubería debe ser un texto' })
  @IsOptional()
  conduitCondition?: string;

  @IsNumber({}, { message: 'La longitud de tubería debe ser un número' })
  @IsOptional()
  conduitLength?: number;

  @IsNumber({}, { message: 'La longitud de cable debe ser un número' })
  @IsOptional()
  cableLength?: number;

  @IsString({ message: 'El calibre del cable debe ser un texto' })
  @IsOptional()
  cableGauge?: string;

  // 4. Instalación física y anclajes
  @IsString({ message: 'La superficie de montaje debe ser un texto' })
  @IsOptional()
  mountSurface?: string;

  @IsString({ message: 'La condición del muro debe ser un texto' })
  @IsOptional()
  wallCondition?: string;

  @IsEnum(AnchorType, { message: 'El tipo de anclaje debe ser CHAZOS, TORNILLOS o UNISTRUT' })
  @IsOptional()
  anchorType?: AnchorType;

  @IsString({ message: 'Los herrajes requeridos deben ser un texto' })
  @IsOptional()
  requiredHardware?: string;

  @IsEnum(ChargerMountType, { message: 'El montaje del cargador debe ser ADOSADO_A_MURO o PEDESTAL' })
  @IsOptional()
  chargerMountType?: ChargerMountType;

  @IsString({ message: 'El modelo del cargador debe ser un texto' })
  @IsOptional()
  chargerModel?: string;

  // 5. Seguridad
  @IsBoolean({ message: 'differentialProtectionRequired debe ser verdadero o falso' })
  differentialProtectionRequired !: boolean;

  @IsString({ message: 'El tipo de protección diferencial debe ser un texto' })
  @IsOptional()
  differentialType?: string;

  @IsNumber({}, { message: 'La resistencia a tierra debe ser un número' })
  @IsOptional()
  groundResistanceOhms?: number;

  @IsString({ message: 'La lectura neutro-tierra debe ser un texto' })
  @IsOptional()
  neutralGroundReading?: string;

  @IsNumber({}, { message: 'El voltaje medido debe ser un número' })
  @IsOptional()
  measuredVoltage?: number;

  @IsString({ message: 'La condición de iluminación debe ser un texto' })
  @IsOptional()
  lightingCondition?: string;

  // 6. Observaciones
  @IsString({ message: 'Las observaciones deben ser un texto' })
  @IsOptional()
  observations?: string;
}