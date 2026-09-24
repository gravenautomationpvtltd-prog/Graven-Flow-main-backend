import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit test: Dual-role (SPT + LQT) lead creation behaviour.
 *
 * Verifies the contract between the frontend safeInsertLead helper and the
 * backend create_lead_secure RPC:
 *  1. The payload sent to the RPC is shaped correctly (valid enum source,
 *     pre-generated id, tenant_id resolved).
 *  2. We never call .insert() on the leads table directly — every path goes
 *     through the SECURITY DEFINER RPC.
 *  3. An invalid / missing source is normalised to 'manual' so the backend
 *     trigger (which decides LQT-first routing) always receives a valid lead.
 *
 * The actual "creator-is-LQT → assigned_to = creator" routing rule lives in
 * the auto_assign_lead_on_insert DB trigger and is asserted by the SQL
 * migration `2026...assert_dual_role_lqt_routing.sql` (DO block + RAISE).
 */

const rpcMock = vi.fn();
const fromMock = vi.fn();
const getUserMock = vi.fn();
const refreshSessionMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
    auth: {
      getUser: () => getUserMock(),
      refreshSession: () => refreshSessionMock(),
    },
  },
}));

vi.mock("@/utils/sessionGuard", () => ({
  ensureFreshSession: vi.fn().mockResolvedValue(undefined),
  isPermissionError: () => false,
}));

import { safeInsertLead } from "@/hooks/useLeads";

describe("safeInsertLead — dual-role LQT routing contract", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    getUserMock.mockReset();
    refreshSessionMock.mockReset();

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-spt-lqt-1" } },
    });

    // tenant_users lookup
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: { tenant_id: "tenant-1" },
              }),
            }),
          }),
        }),
      }),
    });

    rpcMock.mockResolvedValue({ data: "lead-uuid-from-rpc", error: null });
  });

  it("routes lead creation through create_lead_secure RPC (never raw insert)", async () => {
    await safeInsertLead({
      title: "Test lead",
      source: "manual",
      customer_id: null,
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_lead_secure",
      expect.objectContaining({
        payload: expect.objectContaining({
          title: "Test lead",
          source: "manual",
          tenant_id: "tenant-1",
        }),
      }),
    );
  });

  it("normalises invalid/missing source to 'manual' before hitting backend", async () => {
    await safeInsertLead({ title: "X", source: "Other" });
    await safeInsertLead({ title: "Y" });

    const sources = rpcMock.mock.calls.map(
      (c: any[]) => c[1].payload.source,
    );
    expect(sources).toEqual(["manual", "manual"]);
  });

  it("pre-generates a client-side lead id so triggers can reassign safely", async () => {
    await safeInsertLead({ title: "Z", source: "manual" });
    const payload = rpcMock.mock.calls[0][1].payload;
    expect(payload.id).toMatch(/[0-9a-f-]{8,}/i);
  });

  it("returns the lead id from the RPC (used by UI to navigate / toast)", async () => {
    const result = await safeInsertLead({ title: "A", source: "manual" });
    // The RPC returned 'lead-uuid-from-rpc' so safeInsertLead should surface it
    expect(result.id).toBe("lead-uuid-from-rpc");
  });
});
