export const INSPECTION_CREATED_EVENT = 'inspection.created';

export class InspectionCreatedEvent {
  constructor(
    public readonly inspectionId: string,
    public readonly dealId: string,
  ) {}
}