// Backend'in döndürdüğü veri tipleri (C# record'larının karşılığı)

export type MemberRole = 'owner' | 'manager' | 'shepherd' | 'viewer';
export type AnimalSex = 'unknown' | 'female' | 'male';
export type AnimalStatus = 'active' | 'sold' | 'dead' | 'slaughtered' | 'lost';
export type TreatmentType = 'medication' | 'injection' | 'vaccine' | 'antiparasitic' | 'vitamin' | 'other';
export type AnimalLocation = 'pasture' | 'barn' | 'other';

export interface AuthResponse { token: string; userId: string; fullName: string }

export interface Farm { id: string; name: string; myRole: MemberRole; animalCount: number }

export interface Breed { id: number; name: string }
export interface Species { id: number; code: string; name: string; breeds: Breed[] }

export interface Shepherd { userId: string; fullName: string }
export interface Herd { id: string; name: string; notes: string | null; animalCount: number; shepherds: Shepherd[] }

export interface Member {
  userId: string; fullName: string; email: string | null; phone: string | null;
  role: MemberRole; joinedAt: string;
}

export interface AnimalListItem {
  id: string; earTag: string | null; name: string | null;
  speciesId: number; speciesName: string; breedName: string | null;
  sex: AnimalSex; birthDate: string | null; ageMonths: number | null;
  herdId: string | null; herdName: string | null; status: AnimalStatus;
  currentLocation: AnimalLocation | null; inWithdrawal: boolean;
}

export interface ParentRef { id: string; earTag: string | null; name: string | null }

export interface AnimalDetail {
  id: string; earTag: string | null; microchip: string | null; name: string | null;
  speciesId: number; speciesName: string; breedId: number | null; breedName: string | null;
  sex: AnimalSex; birthDate: string | null; birthDateEstimated: boolean; ageMonths: number | null;
  herdId: string | null; herdName: string | null;
  mother: ParentRef | null; father: ParentRef | null; offspring: ParentRef[];
  colorMarks: string | null; photoUrl: string | null;
  status: AnimalStatus; acquiredOn: string | null; exitedOn: string | null; notes: string | null;
  createdAt: string;
  currentLocation: AnimalLocation | null; locationSince: string | null;
  lastWeightKg: number | null; lastWeighedOn: string | null;
  meatWithdrawalUntil: string | null; milkWithdrawalUntil: string | null;
  canEdit: boolean; canAddRecords: boolean;
}

export interface AnimalRequest {
  speciesId: number; breedId: number | null; herdId: string | null;
  earTag: string | null; microchip: string | null; name: string | null;
  sex: AnimalSex; birthDate: string | null; birthDateEstimated: boolean;
  motherId: string | null; fatherId: string | null;
  colorMarks: string | null; acquiredOn: string | null; notes: string | null;
}

export interface TreatmentRecord {
  id: string; type: TreatmentType; medicineId: string | null; title: string;
  dose: number | null; doseUnit: string | null; route: string | null;
  administeredAt: string; description: string | null;
  meatWithdrawalUntil: string | null; milkWithdrawalUntil: string | null; batchId: string | null;
  recordedByName: string; canDelete: boolean;
}
export interface WeightRecord { id: string; weighedOn: string; weightKg: number; notes: string | null; recordedByName: string; canDelete: boolean }
export interface LocationRecord { id: string; location: AnimalLocation; since: string; notes: string | null; recordedByName: string; canDelete: boolean }
export interface BirthRecord {
  id: string; birthDate: string; offspringCount: number; aliveCount: number | null;
  difficulty: string | null; notes: string | null; recordedByName: string; canDelete: boolean;
}
export interface AnimalHistory {
  treatments: TreatmentRecord[]; weights: WeightRecord[];
  locations: LocationRecord[]; births: BirthRecord[];
}

export interface TreatmentRequest {
  type: TreatmentType; medicineId: string | null; medicineText: string | null;
  dose: number | null; doseUnit: string | null; route: string | null;
  administeredAt: string | null; description: string | null;
  meatWithdrawalUntil: string | null; milkWithdrawalUntil: string | null;
}

export interface Medicine {
  id: string; name: string; activeIngredient: string | null; defaultUnit: string;
  meatWithdrawalDays: number | null; milkWithdrawalDays: number | null; notes: string | null; isShared: boolean;
}

export interface Withdrawal {
  animalId: string; earTag: string | null; name: string | null; speciesName: string;
  meatBlockedUntil: string | null; milkBlockedUntil: string | null;
}

export interface FarmSummary {
  activeAnimals: number;
  bySpecies: { speciesId: number; speciesName: string; count: number }[];
  herdCount: number; inWithdrawal: number; birthsLast30Days: number;
  recentBirths: { motherId: string; motherEarTag: string | null; motherName: string | null; birthDate: string; offspringCount: number }[];
}

// ---------------------------------------------------------------- Tarım

export type OwnershipType = 'owned' | 'shared' | 'leasedIn' | 'sharecropped' | 'other';
export type OperationType = 'tillage' | 'sowing' | 'fertilizing' | 'spraying' | 'irrigation' | 'harvest' | 'other';

export interface TkgmItem { id: number; name: string }

export interface TkgmParcel {
  neighborhoodId: number | null; province: string; district: string; neighborhood: string;
  blockNo: number; parcelNo: number; areaM2: number | null; quality: string | null;
  locality: string | null; sheet: string | null;
  geometry: unknown | null; centerLat: number | null; centerLon: number | null;
}

export interface Crop { id: number; name: string }

export interface ParcelListItem {
  id: string; nickname: string | null; province: string; district: string; neighborhood: string;
  blockNo: number; parcelNo: number; locality: string | null; areaM2: number | null; ownership: OwnershipType;
  centerLat: number | null; centerLon: number | null; boundaryGeoJson: string | null;
  lastSeasonYear: number | null; lastCropName: string | null;
}

export interface SeasonRecord {
  id: string; year: number; cropId: number | null; cropName: string; variety: string | null;
  plantedAreaM2: number | null; sowingDate: string | null; harvestDate: string | null;
  yieldKg: number | null; yieldKgPerDecare: number | null; notes: string | null;
}
export interface OperationRecord {
  id: string; type: OperationType; performedOn: string; product: string | null; quantity: number | null;
  unit: string | null; cost: number | null; description: string | null; recordedByName: string;
}
export interface LeaseRecord {
  id: string; counterparty: string; startDate: string; endDate: string | null; terms: string | null;
  amount: number | null; notes: string | null; active: boolean;
}

export interface ParcelDetail extends Omit<ParcelListItem, 'lastSeasonYear' | 'lastCropName'> {
  tkgmNeighborhoodId: number | null; quality: string | null;
  shareNumerator: number | null; shareDenominator: number | null; titleOwner: string | null;
  tkgmFetchedAt: string | null; notes: string | null;
  seasons: SeasonRecord[]; operations: OperationRecord[]; leases: LeaseRecord[]; canEdit: boolean;
}

export interface ParcelRequest {
  province: string; district: string; neighborhood: string; tkgmNeighborhoodId: number | null;
  blockNo: number; parcelNo: number; nickname: string | null; locality: string | null; quality: string | null;
  areaM2: number | null; ownership: OwnershipType; shareNumerator: number | null; shareDenominator: number | null;
  titleOwner: string | null; boundaryGeoJson: string | null; centerLat: number | null; centerLon: number | null;
  fromTkgm: boolean; notes: string | null;
}

export interface ParcelSummary {
  parcelCount: number; totalAreaM2: number; ownedAreaM2: number; leasedAreaM2: number; year: number;
  cropsThisYear: { cropName: string; areaM2: number; parcelCount: number }[];
  operationCostThisYear: number;
}
