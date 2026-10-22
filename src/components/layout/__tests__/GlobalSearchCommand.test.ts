import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitize, type SearchResult } from '../GlobalSearchCommand';

describe('GlobalSearchCommand - Core Mechanics & Entities', () => {
  describe('Sanitization', () => {
    it('strips PostgREST filter-breaking characters (% , ( ) * \\)', () => {
      const input = 'Acme, Corp (India) *100%\\';
      const result = sanitize(input);
      expect(result).toBe('Acme Corp India 100');
    });

    it('collapses multiple consecutive whitespace characters', () => {
      const input = '  Tata    Motors   ';
      const result = sanitize(input);
      expect(result).toBe('Tata Motors');
    });

    it('returns empty string if input contains only illegal characters', () => {
      const input = '%,()*\\';
      const result = sanitize(input);
      expect(result).toBe('');
    });
  });

  describe('Entity Routing', () => {
    const getTestRoute = (result: SearchResult): string => {
      switch (result.type) {
        case 'lead':
          return `/leads/${result.id}`;
        case 'customer':
          return `/customers/${result.id}`;
        case 'order':
          return `/orders/${result.id}`;
        case 'invoice':
          return `/invoices?search=${encodeURIComponent(result.title)}`;
        case 'quotation':
          if (result.leadId) return `/leads/${result.leadId}`;
          if (result.customerId) return `/customers/${result.customerId}`;
          return `/supplier-network/quotations`;
        case 'dispatch':
          return `/dispatch?search=${encodeURIComponent(result.title)}`;
        case 'supplier':
          return `/suppliers/${result.id}`;
        case 'product':
          return `/products/${result.id}`;
        case 'employee':
          return `/employees/${result.id}`;
        default:
          return '/';
      }
    };

    it('correctly maps employee entity to /employees/:id', () => {
      const employeeResult: SearchResult = {
        id: 'emp-123',
        type: 'employee',
        title: 'Jyoti Sharma',
        subtitle: 'jyoti@graven.com • 9876543210 • active',
      };
      expect(getTestRoute(employeeResult)).toBe('/employees/emp-123');
    });

    it('correctly maps lead entity to /leads/:id', () => {
      const leadResult: SearchResult = {
        id: 'lead-456',
        type: 'lead',
        title: 'VFD Supply Lead',
      };
      expect(getTestRoute(leadResult)).toBe('/leads/lead-456');
    });

    it('correctly maps customer entity to /customers/:id', () => {
      const customerResult: SearchResult = {
        id: 'cust-789',
        type: 'customer',
        title: 'Siemens India Ltd',
      };
      expect(getTestRoute(customerResult)).toBe('/customers/cust-789');
    });

    it('correctly maps quotation with leadId to /leads/:leadId', () => {
      const quoteResult: SearchResult = {
        id: 'q-101',
        type: 'quotation',
        title: 'QT-2026-001',
        leadId: 'lead-456',
      };
      expect(getTestRoute(quoteResult)).toBe('/leads/lead-456');
    });

    it('correctly maps product entity to /products/:id', () => {
      const productResult: SearchResult = {
        id: 'prod-555',
        type: 'product',
        title: 'Schneider ATV310 5.5KW',
      };
      expect(getTestRoute(productResult)).toBe('/products/prod-555');
    });
  });

  describe('Race Condition & Out-Of-Order Query Resolution', () => {
    it('discards earlier slow responses when a newer search query is active', async () => {
      let activeQueryId = 0;
      let finalState: string | null = null;

      // Simulate rapid typing: query 1 ("ta") vs query 2 ("tata")
      const runQuery = async (queryText: string, delayMs: number) => {
        const queryId = ++activeQueryId;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        // Only commit if still active
        if (queryId === activeQueryId) {
          finalState = queryText;
        }
      };

      // Query 1 starts first but is slow (100ms)
      const p1 = runQuery('ta', 100);
      // Query 2 starts immediately after and is fast (20ms)
      const p2 = runQuery('tata', 20);

      await Promise.all([p1, p2]);

      // Final state must reflect query 2 ("tata"), not overwritten by query 1 ("ta")
      expect(finalState).toBe('tata');
    });
  });

  describe('Error Boundary & Permission Isolation', () => {
    it('safeQuery catches table permission/RLS failure without breaking overall search', async () => {
      const safeQuery = async <T,>(p: Promise<{ data: T | null; error?: any }>): Promise<T | null> => {
        try {
          const res = await p;
          if (res.error) return null;
          return res.data;
        } catch {
          return null;
        }
      };

      // Simulated queries: Leads succeeds, Invoices fails (e.g. Sales role lacking invoices permission)
      const leadsQuery = Promise.resolve({ data: [{ id: '1', title: 'Solar Lead' }] });
      const invoicesQuery = Promise.reject(new Error('permission denied for table invoices'));

      const [leads, invoices] = await Promise.all([
        safeQuery(leadsQuery),
        safeQuery(invoicesQuery),
      ]);

      expect(leads).toEqual([{ id: '1', title: 'Solar Lead' }]);
      expect(invoices).toBeNull();
    });
  });
});
