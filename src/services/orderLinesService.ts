import type { OrderLine } from "@/types/domain";
import { MOCK_ORDER_LINES } from "./mockData";

export interface OrderLinesService {
  listOrderLinesByDress(dressId: string): Promise<OrderLine[]>;
  listAllOrderLines(): Promise<OrderLine[]>;
}

class MockOrderLinesService implements OrderLinesService {
  async listOrderLinesByDress(dressId: string): Promise<OrderLine[]> {
    return MOCK_ORDER_LINES.filter((line) => line.dressId === dressId);
  }

  async listAllOrderLines(): Promise<OrderLine[]> {
    return [...MOCK_ORDER_LINES];
  }
}

export const orderLinesService: OrderLinesService = new MockOrderLinesService();
