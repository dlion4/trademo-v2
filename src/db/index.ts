import { randomUUID } from "node:crypto";

export interface WaitlistSignupInput {
  email: string;
  role: "investor" | "operator";
  source: string;
  note?: string;
}

interface WaitlistSignupRecord extends WaitlistSignupInput {
  id: string;
  createdAt: string;
}

interface MockDatabaseState {
  waitlistSignups: Map<string, WaitlistSignupRecord>;
}

type MockDatabaseGlobal = typeof globalThis & {
  __tradeMoMockDatabase?: MockDatabaseState;
};

const globalForMockDb = globalThis as MockDatabaseGlobal;
const state =
  globalForMockDb.__tradeMoMockDatabase ??
  (globalForMockDb.__tradeMoMockDatabase = { waitlistSignups: new Map() });

export const mockDatabase = {
  mode: "mock" as const,
  waitlist: {
    add(input: WaitlistSignupInput): { record: WaitlistSignupRecord; inserted: boolean } {
      const existing = state.waitlistSignups.get(input.email);
      if (existing) return { record: existing, inserted: false };

      const record: WaitlistSignupRecord = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      state.waitlistSignups.set(input.email, record);
      return { record, inserted: true };
    },
    count(): number {
      return state.waitlistSignups.size;
    },
  },
};
