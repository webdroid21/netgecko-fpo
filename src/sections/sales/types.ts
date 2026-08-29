export type SalesOrder = {
  id: string;
  createdTime?: string;
  fields: Record<string, any>;
};

export type Buyer = {
  id: string;
  fields: Record<string, any>;
};

export type InventoryItem = {
  id: string;
  fields: Record<string, any>;
};
