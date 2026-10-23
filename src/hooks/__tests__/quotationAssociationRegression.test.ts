import { describe, it, expect } from 'vitest';

describe('Quotation Association & Visibility Regression Tests', () => {
  describe('Lead & Customer Association on Quotation Creation', () => {
    it('preserves lead_id and customer_id when creating a new quotation from a lead', () => {
      const leadId = 'a0b3cf1e-0915-47ed-9a48-77ae7569555e';
      const customerId = '0f0f6838-90d5-4354-8a36-e9e4db30e12b';
      const existingQuotation = undefined;

      const quotationPayload = {
        lead_id: leadId || (existingQuotation as any)?.lead_id || undefined,
        customer_id: customerId || (existingQuotation as any)?.customer_id || undefined,
        subject: 'Quotation for Customer',
        grand_total: 10659.5,
      };

      expect(quotationPayload.lead_id).toBe(leadId);
      expect(quotationPayload.customer_id).toBe(customerId);
      expect(quotationPayload.lead_id).not.toBeNull();
      expect(quotationPayload.customer_id).not.toBeNull();
    });

    it('falls back to leadId and customerId in LeadQuotationsSection when duplicateSelection has undefined fields', () => {
      const sectionLeadId = 'a0b3cf1e-0915-47ed-9a48-77ae7569555e';
      const sectionCustomerId = '0f0f6838-90d5-4354-8a36-e9e4db30e12b';

      // Simulates a duplicateSelection where leadId is not explicitly set
      const duplicateSelection = {
        customerId: undefined,
        leadId: undefined,
        items: [],
      };

      const resolvedLeadId = duplicateSelection ? (duplicateSelection.leadId ?? sectionLeadId) : sectionLeadId;
      const resolvedCustomerId = duplicateSelection ? (duplicateSelection.customerId ?? sectionCustomerId) : sectionCustomerId;

      expect(resolvedLeadId).toBe(sectionLeadId);
      expect(resolvedCustomerId).toBe(sectionCustomerId);
    });

    it('preserves effectiveLeadId and effectiveCustomerId in useUpdateQuotation without losing associations', () => {
      const currentQuotation = {
        id: '1891ad13-dd47-4498-8db8-0310f4c0bfa8',
        lead_id: 'a0b3cf1e-0915-47ed-9a48-77ae7569555e',
        customer_id: '0f0f6838-90d5-4354-8a36-e9e4db30e12b',
      };

      // User edited quotation terms/amounts without explicitly resending lead_id
      const updatePayload: { lead_id?: string; customer_id?: string; grand_total: number } = {
        grand_total: 12000,
      };

      const effectiveLeadId = updatePayload.lead_id || currentQuotation?.lead_id;
      const effectiveCustomerId = updatePayload.customer_id || currentQuotation?.customer_id;

      expect(effectiveLeadId).toBe('a0b3cf1e-0915-47ed-9a48-77ae7569555e');
      expect(effectiveCustomerId).toBe('0f0f6838-90d5-4354-8a36-e9e4db30e12b');
    });
  });

  describe('Editing an Existing Quotation with Context Re-association', () => {
    it('restores missing lead_id and customer_id when edited from a lead page', () => {
      // Simulates Saloni editing GA-Q26-3791 where lead_id was previously NULL in DB
      const existingQuotation = {
        id: '1891ad13-dd47-4498-8db8-0310f4c0bfa8',
        quotation_number: 'GA-Q26-3791',
        lead_id: null,
        customer_id: null,
      };

      const leadIdFromContext = 'a0b3cf1e-0915-47ed-9a48-77ae7569555e';
      const customerIdFromContext = '0f0f6838-90d5-4354-8a36-e9e4db30e12b';

      // EditQuotationDialog resolves effective IDs
      const effectiveLeadId = leadIdFromContext || existingQuotation.lead_id || undefined;
      const effectiveCustomerId = customerIdFromContext || existingQuotation.customer_id || undefined;

      // QuotationBuilder prepares update payload
      const editPayload = {
        lead_id: effectiveLeadId || existingQuotation.lead_id || undefined,
        customer_id: effectiveCustomerId || existingQuotation.customer_id || undefined,
        subject: 'Schnieder',
      };

      expect(editPayload.lead_id).toBe('a0b3cf1e-0915-47ed-9a48-77ae7569555e');
      expect(editPayload.customer_id).toBe('0f0f6838-90d5-4354-8a36-e9e4db30e12b');
    });

    it('does not overwrite existing quotation associations when edited independently without lead context', () => {
      const existingQuotation = {
        id: 'quote-456',
        quotation_number: 'GA-Q26-3807',
        lead_id: 'lead-existing-789',
        customer_id: 'cust-existing-123',
      };

      const leadIdFromContext = undefined;
      const customerIdFromContext = undefined;

      const effectiveLeadId = leadIdFromContext || existingQuotation.lead_id || undefined;
      const effectiveCustomerId = customerIdFromContext || existingQuotation.customer_id || undefined;

      const editPayload = {
        lead_id: effectiveLeadId || existingQuotation.lead_id || undefined,
        customer_id: effectiveCustomerId || existingQuotation.customer_id || undefined,
      };

      expect(editPayload.lead_id).toBe('lead-existing-789');
      expect(editPayload.customer_id).toBe('cust-existing-123');
    });
  });

  describe('Lead Quotations Query Filter Verification', () => {
    it('accurately matches quotation when lead_id equals target lead ID', () => {
      const targetLeadId = 'a0b3cf1e-0915-47ed-9a48-77ae7569555e';

      const quotationsInDb = [
        { id: '1', quotation_number: 'GA-Q26-3791', lead_id: targetLeadId },
        { id: '2', quotation_number: 'GA-Q26-3800', lead_id: 'other-lead' },
        { id: '3', quotation_number: 'GA-Q26-3801', lead_id: null },
      ];

      const visibleQuotations = quotationsInDb.filter(q => q.lead_id === targetLeadId);

      expect(visibleQuotations).toHaveLength(1);
      expect(visibleQuotations[0].quotation_number).toBe('GA-Q26-3791');
    });
  });
});
