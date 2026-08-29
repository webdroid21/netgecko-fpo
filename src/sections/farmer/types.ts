export type Farmer = {
  id: string;
  createdTime?: string;
  fields: Record<string, any>;
};

export type FarmerListResponse = {
  records: Farmer[];
};
