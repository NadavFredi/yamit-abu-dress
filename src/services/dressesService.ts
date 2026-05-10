import type { Dress } from "@/types/domain";
import { MOCK_DRESSES } from "./mockData";

export interface DressesService {
  listDresses(): Promise<Dress[]>;
  searchDresses(query: string): Promise<Dress[]>;
}

class MockDressesService implements DressesService {
  async listDresses(): Promise<Dress[]> {
    return [...MOCK_DRESSES];
  }

  async searchDresses(query: string): Promise<Dress[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [...MOCK_DRESSES];
    return MOCK_DRESSES.filter((d) =>
      d.name.toLowerCase().includes(trimmed) ||
      (d.description?.toLowerCase().includes(trimmed) ?? false)
    );
  }
}

export const dressesService: DressesService = new MockDressesService();
