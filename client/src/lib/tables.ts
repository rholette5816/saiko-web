export interface TableDef {
  id: string;
  number: number;
  capacity: string;
}

export const TABLES: TableDef[] = [
  { id: "T1", number: 1, capacity: "5-6 pax" },
  { id: "T2", number: 2, capacity: "5-6 pax" },
  { id: "T3", number: 3, capacity: "5-6 pax" },
  { id: "T4", number: 4, capacity: "5-6 pax" },
  { id: "T5", number: 5, capacity: "4 pax" },
  { id: "T6", number: 6, capacity: "4 pax" },
  { id: "T7", number: 7, capacity: "4 pax" },
  { id: "T8", number: 8, capacity: "4 pax" },
  { id: "T9", number: 9, capacity: "2 pax" },
  { id: "T10", number: 10, capacity: "2 pax" },
  { id: "T11", number: 11, capacity: "4 pax" },
  { id: "T12", number: 12, capacity: "2 pax" },
  { id: "T13", number: 13, capacity: "2 pax" },
  { id: "T14", number: 14, capacity: "4 pax" },
  { id: "T15", number: 15, capacity: "4 pax" },
  { id: "T16", number: 16, capacity: "4 pax" },
  { id: "T17", number: 17, capacity: "4 pax" },
  { id: "T18", number: 18, capacity: "4 pax" },
  { id: "T19", number: 19, capacity: "4 pax" },
  { id: "T20", number: 20, capacity: "4 pax" },
  { id: "T21", number: 21, capacity: "6-8 pax" },
  { id: "T22", number: 22, capacity: "6-8 pax" },
  { id: "T23", number: 23, capacity: "6-8 pax" },
];

export function getTable(id: string): TableDef | undefined {
  return TABLES.find((t) => t.id === id);
}
