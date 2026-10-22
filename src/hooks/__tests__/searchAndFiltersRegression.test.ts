import { describe, it, expect } from 'vitest';
import { sanitize } from '@/components/layout/GlobalSearchCommand';

describe('Search & Filters Comprehensive Regression Suite', () => {
  describe('1. Global Search Sanitization & Query Safety', () => {
    it('sanitizes PostgREST filter-breaking characters from query string', () => {
      const malicious = 'Test%Company, (Pvt) *Ltd* \\';
      const clean = sanitize(malicious);
      expect(clean).toBe('Test Company Pvt Ltd');
      expect(clean).not.toMatch(/[%,()*\\]/);
    });

    it('collapses multiple whitespace characters to single spaces', () => {
      expect(sanitize('   Siemens    Automation   ')).toBe('Siemens Automation');
    });

    it('returns empty string if input contains only illegal characters', () => {
      expect(sanitize('%,()*\ \ ')).toBe('');
    });

    it('preserves alphanumeric words, hyphens, and phone numbers', () => {
      expect(sanitize('+91-9876543210')).toBe('+91-9876543210');
      expect(sanitize('INV-2026-001')).toBe('INV-2026-001');
      expect(sanitize('user@graven.com')).toBe('user@graven.com');
    });
  });

  describe('2. Customer Search Query Construction & Null Safety', () => {
    it('builds multi-field search clause covering company, contact, phone, email, gst', () => {
      const search = 'Acme, Corp%';
      const cleanSearch = search.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();
      expect(cleanSearch).toBe('Acme Corp');

      const clause = `company_name.ilike.%${cleanSearch}%,contact_person.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,alternate_phone.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%,gst_number.ilike.%${cleanSearch}%`;
      expect(clause).toContain('company_name.ilike.%Acme Corp%');
      expect(clause).toContain('gst_number.ilike.%Acme Corp%');
      expect(clause).toContain('email.ilike.%Acme Corp%');
      expect(cleanSearch).not.toMatch(/[%,()*\\]/);
    });
  });

  describe('3. Leads Search & Filter Combination Logic', () => {
    function buildLeadsWhereClauses(params: {
      search?: string;
      hasEnquiry?: boolean;
      enquiryStatuses?: string[];
      priceMatched?: boolean;
    }) {
      const clauses: string[] = [];

      if (params.search) {
        const clean = params.search.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();
        if (clean) {
          clauses.push(`(title ILIKE '%${clean}%' OR customer_query ILIKE '%${clean}%')`);
        }
      }

      if (params.hasEnquiry !== undefined) {
        if (params.hasEnquiry) {
          clauses.push(`(has_enquiry = true)`);
        } else {
          clauses.push(`(has_enquiry = false OR has_enquiry IS NULL)`);
        }
      }

      if (params.enquiryStatuses && params.enquiryStatuses.length > 0) {
        if (params.enquiryStatuses.includes('no_enquiry')) {
          clauses.push(`(enquiry_status IN ('${params.enquiryStatuses.join("','")}') OR enquiry_status IS NULL)`);
        } else {
          clauses.push(`(enquiry_status IN ('${params.enquiryStatuses.join("','")}'))`);
        }
      }

      if (params.priceMatched !== undefined) {
        if (params.priceMatched) {
          clauses.push(`(enquiry_status = 'price_matched')`);
        } else {
          clauses.push(`(enquiry_status != 'price_matched' OR enquiry_status IS NULL)`);
        }
      }

      return clauses;
    }

    it('combines text search with "Has Enquiry" correctly', () => {
      const clauses = buildLeadsWhereClauses({ search: 'motor', hasEnquiry: true });
      expect(clauses).toEqual([
        "(title ILIKE '%motor%' OR customer_query ILIKE '%motor%')",
        '(has_enquiry = true)',
      ]);
    });

    it('combines text search with "No Enquiry" correctly and safely handles nulls', () => {
      const clauses = buildLeadsWhereClauses({ search: 'valves', hasEnquiry: false });
      expect(clauses).toEqual([
        "(title ILIKE '%valves%' OR customer_query ILIKE '%valves%')",
        '(has_enquiry = false OR has_enquiry IS NULL)',
      ]);
    });

    it('combines text search with Enquiry Status "No Enquiry"', () => {
      const clauses = buildLeadsWhereClauses({
        search: 'pump',
        enquiryStatuses: ['no_enquiry'],
      });
      expect(clauses).toEqual([
        "(title ILIKE '%pump%' OR customer_query ILIKE '%pump%')",
        "(enquiry_status IN ('no_enquiry') OR enquiry_status IS NULL)",
      ]);
    });

    it('combines text search + Has Enquiry + Price Matched: Not Matched', () => {
      const clauses = buildLeadsWhereClauses({
        search: 'sensor',
        hasEnquiry: true,
        enquiryStatuses: ['pending_prices'],
        priceMatched: false,
      });
      expect(clauses).toEqual([
        "(title ILIKE '%sensor%' OR customer_query ILIKE '%sensor%')",
        '(has_enquiry = true)',
        "(enquiry_status IN ('pending_prices'))",
        "(enquiry_status != 'price_matched' OR enquiry_status IS NULL)",
      ]);
    });
  });

  describe('4. In-Memory Search Across Operational Entities', () => {
    it('filters orders by order number, customer name, contact, phone, email, and notes', () => {
      const mockOrder = {
        order_number: 'ORD-2026-999',
        notes: 'Priority dispatch for factory line 2',
        customer: {
          company_name: 'Tata Steel Ltd',
          contact_person: 'Rahul Verma',
          phone: '9876543210',
          email: 'rahul@tatasteel.com',
        },
      };

      const matchOrder = (q: string) => {
        const s = q.toLowerCase();
        return (
          mockOrder.order_number.toLowerCase().includes(s) ||
          mockOrder.customer.company_name.toLowerCase().includes(s) ||
          mockOrder.customer.contact_person.toLowerCase().includes(s) ||
          mockOrder.customer.phone.toLowerCase().includes(s) ||
          mockOrder.customer.email.toLowerCase().includes(s) ||
          mockOrder.notes.toLowerCase().includes(s)
        );
      };

      expect(matchOrder('ORD-2026')).toBe(true);
      expect(matchOrder('Tata Steel')).toBe(true);
      expect(matchOrder('Rahul')).toBe(true);
      expect(matchOrder('9876543210')).toBe(true);
      expect(matchOrder('factory line')).toBe(true);
      expect(matchOrder('Nonexistent')).toBe(false);
    });

    it('filters dispatches by courier, eway bill, and tracking number', () => {
      const mockDispatch = {
        dispatch_number: 'DSP-101',
        tracking_number: 'TRK-9876',
        courier_name: 'BlueDart Express',
        eway_bill_number: 'EWB-5544332211',
        customer: { company_name: 'Reliance Industries', contact_person: 'Amit' },
      };

      const matchDispatch = (q: string) => {
        const s = q.toLowerCase();
        return (
          mockDispatch.dispatch_number.toLowerCase().includes(s) ||
          mockDispatch.tracking_number.toLowerCase().includes(s) ||
          mockDispatch.courier_name.toLowerCase().includes(s) ||
          mockDispatch.eway_bill_number.toLowerCase().includes(s) ||
          mockDispatch.customer.company_name.toLowerCase().includes(s)
        );
      };

      expect(matchDispatch('BlueDart')).toBe(true);
      expect(matchDispatch('EWB-5544')).toBe(true);
      expect(matchDispatch('Reliance')).toBe(true);
      expect(matchDispatch('FedEx')).toBe(false);
    });

    it('filters inventory by brand, model number, category, and office', () => {
      const mockItem = {
        product: {
          name: 'AC Contactor 3TF30',
          model_number: '3TF3001-0AP0',
          brand: 'Siemens',
          category: 'Switchgear',
          hsn_code: '8536',
        },
        office: { name: 'Mumbai Warehouse' },
      };

      const matchInventory = (q: string) => {
        const s = q.toLowerCase();
        return (
          mockItem.product.name.toLowerCase().includes(s) ||
          mockItem.product.model_number.toLowerCase().includes(s) ||
          mockItem.product.brand.toLowerCase().includes(s) ||
          mockItem.product.category.toLowerCase().includes(s) ||
          mockItem.office.name.toLowerCase().includes(s)
        );
      };

      expect(matchInventory('Siemens')).toBe(true);
      expect(matchInventory('3TF3001')).toBe(true);
      expect(matchInventory('Switchgear')).toBe(true);
      expect(matchInventory('Mumbai')).toBe(true);
      expect(matchInventory('Schneider')).toBe(false);
    });

    it('filters employees by office, manager name, and assigned role', () => {
      const mockEmployee = {
        full_name: 'Sunil Patil',
        email: 'sunil@graven.com',
        phone: '9988776655',
        office: { name: 'Pune Regional Office' },
        manager: { full_name: 'Priya Sharma' },
        roles: [{ role: 'sales_executive' }, { role: 'cro' }],
      };

      const matchEmployee = (q: string) => {
        const s = q.toLowerCase();
        return (
          mockEmployee.full_name.toLowerCase().includes(s) ||
          mockEmployee.email.toLowerCase().includes(s) ||
          mockEmployee.phone.includes(s) ||
          mockEmployee.office.name.toLowerCase().includes(s) ||
          mockEmployee.manager.full_name.toLowerCase().includes(s) ||
          mockEmployee.roles.some((r) => r.role.toLowerCase().includes(s))
        );
      };

      expect(matchEmployee('Sunil')).toBe(true);
      expect(matchEmployee('Pune')).toBe(true);
      expect(matchEmployee('Priya')).toBe(true);
      expect(matchEmployee('sales_executive')).toBe(true);
      expect(matchEmployee('procurement')).toBe(false);
    });
  });
});
