const QUEUE_KEY = "saiko-offline-queue";

export interface QueuedAction {
  localId: string;
  type: "counter_order" | "table_round" | "table_round_edit" | "table_ticket_print";
  payload: Record<string, unknown>;
  createdAt: string;
}

function readQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage can be unavailable or full. Keep the cashier flow moving.
  }
}

export function enqueue(type: QueuedAction["type"], payload: Record<string, unknown>): QueuedAction {
  const entry: QueuedAction = {
    localId: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  writeQueue([...readQueue(), entry]);
  return entry;
}

export function getQueue(): QueuedAction[] {
  return readQueue();
}

export function removeFromQueue(localId: string): void {
  writeQueue(readQueue().filter((entry) => entry.localId !== localId));
}
