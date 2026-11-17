import type { Inspection, SystemType } from '@prisma/client';

// Línea que el sistema sugiere a partir de la inspección, antes de buscar el material en el catálogo
export interface DraftOfferLine {
  materialCode?: string; // código que se busca en el catálogo; sin código = el vendedor debe completarla
  description: string; // texto de respaldo si el material no existe en el catálogo
  quantity: number;
  unitCode: string;
  groupLabel: string;
}

// Solo los campos de la inspección que intervienen en las reglas
export type InspectionForOffer = Pick<
  Inspection,
  | 'systemType'
  | 'cableLength'
  | 'cableGauge'
  | 'conduitLength'
  | 'conduitType'
  | 'chargerModel'
  | 'chargerMountType'
  | 'anchorType'
  | 'differentialProtectionRequired'
  | 'differentialType'
  | 'requiresDrilling'
  | 'drillingLocation'
>;

// Conductores que lleva el cable según el sistema (incluye neutro y tierra). Ajustar si el negocio lo define distinto
export const CONDUCTORS_BY_SYSTEM: Record<SystemType, number> = {
  MONOFASICO: 3,
  BIFASICO: 3,
  TRIFASICO: 5,
};

// Para comparar códigos sin que importen mayúsculas, espacios, guiones o guiones bajos:
// '8 awg', '8-AWG' y '8AWG' son el mismo código
export const normalizeCode = (code: string): string => code.toUpperCase().replace(/[\s_-]+/g, '');

const round2 = (value: number): number => Math.round(value * 100) / 100;

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '';

const hasPositive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && value > 0;


//Luego Migrar a Tabla de Reglas para la oferta cuando esta cresca
export function buildOfferLinesFromInspection(inspection: InspectionForOffer): DraftOfferLine[] {
  const lines: DraftOfferLine[] = [];

  // Cargador y su montaje
  if (hasText(inspection.chargerModel)) {
    lines.push({
      materialCode: `CGR-${inspection.chargerModel.trim()}`,
      description: `Cargador ${inspection.chargerModel.trim()}`,
      quantity: 1,
      unitCode: 'UN',
      groupLabel: 'Cargador',
    });
  }

  if (inspection.chargerMountType === 'ADOSADO_A_MURO') {
    lines.push({
      materialCode: 'MNT-MURO',
      description: 'Montaje adosado a muro',
      quantity: 1,
      unitCode: 'UN',
      groupLabel: 'Cargador',
    });
  } else if (inspection.chargerMountType === 'PEDESTAL') {
    lines.push({
      materialCode: 'MNT-PEDESTAL',
      description: 'Montaje en pedestal',
      quantity: 1,
      unitCode: 'UN',
      groupLabel: 'Cargador',
    });
  }

  // Cableado: metros de cable = longitud del recorrido × conductores del sistema
  if (hasPositive(inspection.cableLength)) {
    const conductors = CONDUCTORS_BY_SYSTEM[inspection.systemType];
    const gauge = hasText(inspection.cableGauge) ? inspection.cableGauge.trim() : undefined;

    lines.push({
      materialCode: gauge ? `CAB-${gauge}` : undefined,
      description: gauge ? `Cable ${gauge}` : 'Cable (calibre sin definir en la inspección)',
      quantity: round2(inspection.cableLength * conductors),
      unitCode: 'ML',
      groupLabel: 'Cableado',
    });
  }

  // Canalización
  if (hasPositive(inspection.conduitLength)) {
    const type = hasText(inspection.conduitType) ? inspection.conduitType.trim() : undefined;

    lines.push({
      materialCode: type ? `CAN-${type}` : undefined,
      description: type ? `Canalización ${type}` : 'Canalización (tipo sin definir en la inspección)',
      quantity: round2(inspection.conduitLength),
      unitCode: 'ML',
      groupLabel: 'Canalización',
    });
  }

  // Anclajes
  if (inspection.anchorType) {
    lines.push({
      materialCode: `ANC-${inspection.anchorType}`,
      description: `Anclajes y herrajes (${inspection.anchorType.toLowerCase()})`,
      quantity: 1,
      unitCode: 'UN',
      groupLabel: 'Anclajes',
    });
  }

  // Protecciones
  if (inspection.differentialProtectionRequired) {
    const type = hasText(inspection.differentialType) ? ` ${inspection.differentialType.trim()}` : '';

    lines.push({
      materialCode: 'PRO-DIFERENCIAL',
      description: `Protección diferencial${type}`,
      quantity: 1,
      unitCode: 'UN',
      groupLabel: 'Protecciones',
    });
  }

  // Mano de obra
  if (inspection.requiresDrilling) {
    const place = hasText(inspection.drillingLocation) ? ` en ${inspection.drillingLocation.trim()}` : '';

    lines.push({
      materialCode: 'MOB-PERFORACION',
      description: `Perforación${place}`,
      quantity: 1,
      unitCode: 'UN',
      groupLabel: 'Mano de obra',
    });
  }

  lines.push({
    materialCode: 'MOB-INSTALACION',
    description: 'Instalación y puesta en marcha',
    quantity: 1,
    unitCode: 'UN',
    groupLabel: 'Mano de obra',
  });

  return lines;
}