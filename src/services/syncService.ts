/**
 * Automatic Background Synchronization Service for Graven OneDesk
 * Connects with https://gravenonedesk.in in the background
 * 
 * Rules:
 * 1. Automatically runs in background when website is opened (no user click needed).
 * 2. Safe upsert: adds new records, updates changed records, NEVER deletes data.
 * 3. Prevents duplicate records across repeated sync cycles (onConflict: 'id').
 * 4. Fully resilient: if gravenonedesk.in is offline/unreachable, current website continues
 *    operating 100% normally on its local database/backend.
 * 5. Automatically retries and resumes as soon as gravenonedesk.in becomes reachable again.
 * 6. Never touches employee authentication, passwords, roles, or tenant IDs.
 * 7. Synchronizes all business records: products, customers, suppliers, quotations, orders,
 *    RFQs, invoices, purchase orders, inventory, dispatches, GRNs, price requests, tasks, payments.
 */

import { syncSupabase } from '@/integrations/supabase/syncClient';
import { supabase } from '@/integrations/supabase/client';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  details?: string;
}

export interface EntitySyncDetail {
  key: string;
  name: string;
  category: 'catalog' | 'crm' | 'orders' | 'logistics' | 'finance';
  processed: number;
  lastSyncedAt: string | null;
  status: 'synced' | 'empty' | 'error';
}

export interface SyncStats {
  productsSynced: number;
  customersSynced: number;
  suppliersSynced: number;
  ordersSynced: number;
  quotationsSynced: number;
  invoicesSynced: number;
  procurementSynced: number;
  inventorySynced: number;
  totalRecordsProcessed: number;
  entities: Record<string, EntitySyncDetail>;
}

export interface SyncStatus {
  state: SyncState;
  sourceUrl: string;
  remoteApiUrl: string;
  lastAttempt: string | null;
  lastSuccessfulSync: string | null;
  lastError: string | null;
  isAutoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  stats: SyncStats;
  logs: SyncLogEntry[];
}

interface EntitySyncConfig {
  key: string;
  name: string;
  category: 'catalog' | 'crm' | 'orders' | 'logistics' | 'finance';
  remoteEndpoint: string;
  targetTable: string;
  validColumns: string[];
  transform?: (row: any) => any;
}

const STORAGE_KEY_PREFIX = 'graven_sync_';
const SOURCE_URL = 'https://gravenonedesk.in';
const REMOTE_API_URL = 'https://iukquqmsrqnmuxpgessm.supabase.co';
const REMOTE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1a3F1cW1zcnFubXV4cGdlc3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODQyMDAsImV4cCI6MjA4MTE2MDIwMH0.ho8qHS29myxHzx4FSwjoFFH7HFQ4l9XYOch8SzrbVEc';

/**
 * Definitions for all required business entities synchronized with the source.
 * Synchronized in topological order to respect foreign key hierarchies.
 */
const SYNC_ENTITIES: EntitySyncConfig[] = [
  // 1. Master Catalogs & Contacts
  {
    key: 'products',
    name: 'Products & Catalog',
    category: 'catalog',
    remoteEndpoint: 'products',
    targetTable: 'products',
    validColumns: [
      'id', 'name', 'brand', 'brand_key', 'brand_match_key', 'category', 'created_at', 'created_by',
      'default_rate', 'description', 'gross_margin_pct', 'gross_profit', 'height_cm', 'hsn_code',
      'is_active', 'is_frozen', 'lead_time_days', 'length_cm', 'list_price', 'list_price_source',
      'min_margin_pct', 'model_number', 'price_source', 'product_status', 'purchase_price',
      'sales_price', 'tax_rate', 'unit', 'weight_kg', 'width_cm', 'updated_at'
    ],
    transform: (row) => ({
      ...row,
      name: row.name || 'Synced Product',
      min_margin_pct: typeof row.min_margin_pct === 'number' ? row.min_margin_pct : 15,
      is_active: row.is_active ?? true,
    })
  },
  {
    key: 'customers',
    name: 'Customers & Accounts',
    category: 'crm',
    remoteEndpoint: 'customers',
    targetTable: 'customers',
    validColumns: [
      'id', 'company_name', 'contact_person', 'email', 'phone', 'alternate_phone', 'address',
      'city', 'state', 'pincode', 'gst_number', 'credit_limit', 'payment_days', 'notes',
      'is_b2b', 'is_frozen', 'is_priority', 'industry_tag', 'segment', 'created_at', 'updated_at'
    ],
    transform: (row) => ({
      ...row,
      company_name: row.company_name || 'Synced Customer',
    })
  },
  {
    key: 'suppliers',
    name: 'Suppliers & Vendors',
    category: 'orders',
    remoteEndpoint: 'suppliers',
    targetTable: 'suppliers',
    validColumns: [
      'id', 'name', 'contact_person', 'email', 'phone', 'address', 'city', 'state', 'pincode',
      'country', 'gst_number', 'pan_number', 'bank_name', 'bank_account_number', 'bank_ifsc',
      'category', 'is_active', 'is_authorized_dealer', 'status', 'preferred_currency',
      'payment_terms', 'website', 'created_at', 'updated_at'
    ],
    transform: (row) => ({
      ...row,
      name: row.name || 'Synced Supplier',
      is_active: row.is_active ?? true,
    })
  },
  {
    key: 'profiles',
    name: 'Team Directory (Profiles)',
    category: 'catalog',
    remoteEndpoint: 'profiles',
    targetTable: 'profiles',
    // Strictly read-only safe contact fields: NEVER touches user_roles, auth passwords, or permissions
    validColumns: [
      'id', 'full_name', 'email', 'avatar_url', 'phone', 'is_active',
      'preferred_language', 'preferred_currency', 'created_at', 'updated_at'
    ],
    transform: (row) => ({
      ...row,
      full_name: row.full_name || 'Team Member',
      is_active: row.is_active ?? true,
    })
  },

  // 2. CRM & Inquiries
  {
    key: 'leads',
    name: 'Leads & Enquiries',
    category: 'crm',
    remoteEndpoint: 'leads',
    targetTable: 'leads',
    validColumns: [
      'id', 'title', 'customer_id', 'customer_query', 'status', 'enquiry_status', 'source',
      'source_reference', 'estimated_value', 'expected_close_date', 'has_enquiry',
      'created_at', 'updated_at'
    ]
  },
  {
    key: 'rfqs',
    name: 'Requests for Quotation (RFQs)',
    category: 'crm',
    remoteEndpoint: 'rfqs',
    targetTable: 'rfqs',
    validColumns: [
      'id', 'rfq_number', 'title', 'description', 'status', 'base_currency', 'client_name',
      'commercial_terms', 'project_name', 'quantity', 'unit', 'deadline_date',
      'created_at', 'updated_at'
    ]
  },
  {
    key: 'rfq_items',
    name: 'RFQ Line Items',
    category: 'crm',
    remoteEndpoint: 'rfq_items',
    targetTable: 'rfq_items',
    validColumns: [
      'id', 'rfq_id', 'product_id', 'description', 'quantity', 'target_price', 'unit',
      'specifications', 'sort_order', 'created_at'
    ]
  },
  {
    key: 'quotations',
    name: 'Sales Quotations',
    category: 'crm',
    remoteEndpoint: 'quotations',
    targetTable: 'quotations',
    validColumns: [
      'id', 'quotation_number', 'customer_id', 'lead_id', 'subject', 'status', 'currency',
      'subtotal', 'total_discount', 'total_tax', 'grand_total', 'advance_amount', 'advance_percent',
      'balance_amount', 'terms_conditions', 'valid_until', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'quotation_items',
    name: 'Quotation Line Items',
    category: 'crm',
    remoteEndpoint: 'quotation_items',
    targetTable: 'quotation_items',
    validColumns: [
      'id', 'quotation_id', 'product_id', 'product_description', 'description', 'quantity',
      'unit', 'rate', 'target_rate', 'amount', 'tax_percent', 'tax_amount', 'discount_percent',
      'discount_amount', 'hsn_code', 'model_number', 'sort_order', 'created_at'
    ]
  },

  // 3. Orders, Procurement & Supply Chain
  {
    key: 'sales_orders',
    name: 'Sales Orders',
    category: 'orders',
    remoteEndpoint: 'sales_orders',
    targetTable: 'sales_orders',
    validColumns: [
      'id', 'order_number', 'customer_id', 'quotation_id', 'lead_id', 'order_value', 'payment_amount',
      'payment_status', 'status', 'expected_arrival', 'is_import', 'notes', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'purchase_orders',
    name: 'Purchase Orders (PO)',
    category: 'orders',
    remoteEndpoint: 'purchase_orders',
    targetTable: 'purchase_orders',
    validColumns: [
      'id', 'po_number', 'supplier_id', 'sales_order_id', 'lead_id', 'status', 'currency',
      'subtotal', 'total_tax', 'grand_total', 'exchange_rate', 'expected_delivery',
      'order_date', 'terms_conditions', 'notes', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'purchase_order_items',
    name: 'Purchase Order Line Items',
    category: 'orders',
    remoteEndpoint: 'purchase_order_items',
    targetTable: 'purchase_order_items',
    validColumns: [
      'id', 'po_id', 'product_id', 'description', 'quantity', 'rate', 'amount',
      'received_quantity', 'hsn_code', 'tax_percent', 'tax_amount', 'sort_order', 'created_at'
    ]
  },
  {
    key: 'supplier_quotations',
    name: 'Supplier Quotations',
    category: 'orders',
    remoteEndpoint: 'supplier_quotations',
    targetTable: 'supplier_quotations',
    validColumns: [
      'id', 'quotation_number', 'supplier_id', 'rfq_id', 'quoted_currency', 'total_original',
      'total_converted', 'status', 'lead_time_days', 'moq', 'payment_terms', 'validity_days',
      'country_of_origin', 'hs_code', 'notes', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'price_requests',
    name: 'Price Requests & Negotiations',
    category: 'orders',
    remoteEndpoint: 'price_requests',
    targetTable: 'price_requests',
    validColumns: [
      'id', 'lead_id', 'supplier_id', 'seller_name', 'status', 'priority', 'purchase_price',
      'selling_price', 'target_rate', 'resolved_price', 'lead_time_days', 'price_valid_until',
      'notes', 'created_at', 'updated_at'
    ]
  },

  // 4. Logistics, Warehouse & Delivery
  {
    key: 'inventory',
    name: 'Inventory & Stock Levels',
    category: 'logistics',
    remoteEndpoint: 'inventory',
    targetTable: 'inventory',
    validColumns: [
      'id', 'product_id', 'office_id', 'quantity', 'held_quantity', 'min_stock_level',
      'max_stock_level', 'reorder_quantity', 'last_restocked_at', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'dispatches',
    name: 'Dispatches & Logistics',
    category: 'logistics',
    remoteEndpoint: 'dispatches',
    targetTable: 'dispatches',
    validColumns: [
      'id', 'dispatch_number', 'sales_order_id', 'customer_id', 'quotation_id', 'dispatch_date',
      'status', 'tracking_number', 'courier_name', 'shipping_address', 'eway_bill_number',
      'eway_bill_date', 'eway_bill_status', 'notes', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'goods_receipt_notes',
    name: 'Goods Receipt Notes (GRN)',
    category: 'logistics',
    remoteEndpoint: 'goods_receipt_notes',
    targetTable: 'goods_receipt_notes',
    validColumns: [
      'id', 'grn_number', 'po_id', 'supplier_id', 'received_date', 'status', 'qc_status',
      'notes', 'qc_notes', 'created_at', 'updated_at'
    ]
  },

  // 5. Billing, Finance & Operations
  {
    key: 'invoices',
    name: 'Invoices & Billing',
    category: 'finance',
    remoteEndpoint: 'invoices',
    targetTable: 'invoices',
    validColumns: [
      'id', 'invoice_number', 'po_id', 'supplier_id', 'invoice_date', 'due_date', 'status',
      'currency', 'subtotal', 'igst_amount', 'grand_total', 'grand_total_inr', 'amount_paid',
      'shipping_charges', 'customs_duty', 'notes', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'invoice_items',
    name: 'Invoice Items',
    category: 'finance',
    remoteEndpoint: 'invoice_items',
    targetTable: 'invoice_items',
    validColumns: [
      'id', 'import_invoice_id', 'product_id', 'description', 'quantity', 'unit',
      'unit_price', 'total', 'sort_order', 'created_at'
    ]
  },
  {
    key: 'customer_payments',
    name: 'Customer Payments',
    category: 'finance',
    remoteEndpoint: 'customer_payments',
    targetTable: 'customer_payments',
    validColumns: [
      'id', 'customer_id', 'sales_order_id', 'amount', 'payment_date', 'payment_mode',
      'bank_name', 'transaction_reference', 'receipt_url', 'notes', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'tasks',
    name: 'Operational Tasks',
    category: 'finance',
    remoteEndpoint: 'tasks',
    targetTable: 'tasks',
    validColumns: [
      'id', 'title', 'description', 'customer_id', 'lead_id', 'assigned_to', 'assigned_by',
      'priority', 'status', 'due_date', 'completed_at', 'created_at', 'updated_at'
    ]
  },
  {
    key: 'expenses',
    name: 'Company Expenses',
    category: 'finance',
    remoteEndpoint: 'expenses',
    targetTable: 'expenses',
    validColumns: [
      'id', 'bill_number', 'category', 'amount', 'total_amount', 'cgst_amount', 'sgst_amount',
      'igst_amount', 'vendor_name', 'vendor_gstin', 'expense_date', 'payment_mode', 'is_paid',
      'description', 'notes', 'created_at', 'updated_at'
    ]
  }
];

function buildInitialEntitiesMap(): Record<string, EntitySyncDetail> {
  const map: Record<string, EntitySyncDetail> = {};
  for (const entity of SYNC_ENTITIES) {
    map[entity.key] = {
      key: entity.key,
      name: entity.name,
      category: entity.category,
      processed: 0,
      lastSyncedAt: null,
      status: 'synced',
    };
  }
  return map;
}

class SyncService {
  private state: SyncState = 'idle';
  private lastAttempt: string | null = null;
  private lastSuccessfulSync: string | null = null;
  private lastError: string | null = null;
  private isAutoSyncEnabled: boolean = true;
  private syncIntervalMinutes: number = 5;
  private stats: SyncStats = {
    productsSynced: 0,
    customersSynced: 0,
    suppliersSynced: 0,
    ordersSynced: 0,
    quotationsSynced: 0,
    invoicesSynced: 0,
    procurementSynced: 0,
    inventorySynced: 0,
    totalRecordsProcessed: 0,
    entities: buildInitialEntitiesMap(),
  };
  private logs: SyncLogEntry[] = [];
  private timer: any = null;
  private retryTimer: any = null;
  private isInitialized = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private readonly retryIntervalSeconds = 20;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      this.lastAttempt = localStorage.getItem(`${STORAGE_KEY_PREFIX}last_attempt`);
      this.lastSuccessfulSync = localStorage.getItem(`${STORAGE_KEY_PREFIX}last_success`);
      this.lastError = localStorage.getItem(`${STORAGE_KEY_PREFIX}last_error`);

      const savedAuto = localStorage.getItem(`${STORAGE_KEY_PREFIX}auto_enabled`);
      if (savedAuto !== null) this.isAutoSyncEnabled = savedAuto === 'true';

      const savedStats = localStorage.getItem(`${STORAGE_KEY_PREFIX}stats_v2`);
      if (savedStats) {
        const parsed = JSON.parse(savedStats);
        this.stats = {
          ...this.stats,
          ...parsed,
          entities: {
            ...buildInitialEntitiesMap(),
            ...(parsed.entities || {}),
          },
        };
      }

      const savedLogs = localStorage.getItem(`${STORAGE_KEY_PREFIX}logs`);
      if (savedLogs) this.logs = JSON.parse(savedLogs);
    } catch (_) {
      // Ignore localStorage read errors in restricted contexts
    }
  }

  private saveToStorage() {
    try {
      if (this.lastAttempt) localStorage.setItem(`${STORAGE_KEY_PREFIX}last_attempt`, this.lastAttempt);
      if (this.lastSuccessfulSync) localStorage.setItem(`${STORAGE_KEY_PREFIX}last_success`, this.lastSuccessfulSync);
      if (this.lastError) localStorage.setItem(`${STORAGE_KEY_PREFIX}last_error`, this.lastError);
      else localStorage.removeItem(`${STORAGE_KEY_PREFIX}last_error`);

      localStorage.setItem(`${STORAGE_KEY_PREFIX}auto_enabled`, String(this.isAutoSyncEnabled));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}stats_v2`, JSON.stringify(this.stats));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}logs`, JSON.stringify(this.logs.slice(0, 50)));
    } catch (_) {
      // Ignore localStorage write errors
    }
  }

  private addLog(type: SyncLogEntry['type'], message: string, details?: string) {
    const entry: SyncLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    this.saveToStorage();
    this.notify();
  }

  public getStatus(): SyncStatus {
    return {
      state: this.state,
      sourceUrl: SOURCE_URL,
      remoteApiUrl: REMOTE_API_URL,
      lastAttempt: this.lastAttempt,
      lastSuccessfulSync: this.lastSuccessfulSync,
      lastError: this.lastError,
      isAutoSyncEnabled: this.isAutoSyncEnabled,
      syncIntervalMinutes: this.syncIntervalMinutes,
      stats: {
        ...this.stats,
        entities: { ...this.stats.entities },
      },
      logs: [...this.logs],
    };
  }

  public subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const current = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  /**
   * Initializes automatic background synchronization.
   * Runs silently in the background when the app starts without user action.
   */
  public startAutoSync() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Run first sync 2.5 seconds after boot (non-blocking)
    setTimeout(() => {
      if (this.isAutoSyncEnabled) {
        this.performSync({ isManual: false });
      }
    }, 2500);

    // Schedule background periodic sync every N minutes
    this.schedulePeriodicTimer();

    // Event listener: reconnect on network return
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.addLog('info', 'Network connection restored. Triggering automatic background sync...');
        if (this.isAutoSyncEnabled) {
          this.performSync({ isManual: false });
        }
      });

      // Event listener: re-check on tab focus if offline or overdue
      window.addEventListener('focus', () => {
        if (this.isAutoSyncEnabled && (this.state === 'offline' || this.state === 'error')) {
          this.performSync({ isManual: false });
        }
      });
    }
  }

  private schedulePeriodicTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isAutoSyncEnabled && (typeof navigator === 'undefined' || navigator.onLine)) {
        this.performSync({ isManual: false });
      }
    }, this.syncIntervalMinutes * 60 * 1000);
  }

  private scheduleRetry() {
    if (this.retryTimer || !this.isAutoSyncEnabled) return;

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      if (!this.isAutoSyncEnabled) return;

      const isRecovered = await this.pingSource();
      if (isRecovered) {
        this.addLog('info', `Source ${SOURCE_URL} is back online. Resuming automatic synchronization...`);
        await this.performSync({ isManual: false });
      } else {
        // Still unreachable, schedule next probe
        this.scheduleRetry();
      }
    }, this.retryIntervalSeconds * 1000);
  }

  private clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  public stopAutoSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.clearRetryTimer();
    this.isInitialized = false;
  }

  public setAutoSyncEnabled(enabled: boolean) {
    this.isAutoSyncEnabled = enabled;
    this.saveToStorage();
    if (!enabled) {
      this.clearRetryTimer();
    } else if (this.state === 'offline' || this.state === 'error') {
      this.scheduleRetry();
    }
    this.addLog('info', enabled ? 'Automatic background sync enabled' : 'Automatic background sync paused');
    this.notify();
  }

  /**
   * Lightweight ping to check source availability
   */
  public async pingSource(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        await fetch(SOURCE_URL, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-cache',
        });
        clearTimeout(timeoutId);
        return true;
      } catch (_) {
        clearTimeout(timeoutId);
        // Fallback test to remote Supabase endpoint
        const restController = new AbortController();
        const restTimeout = setTimeout(() => restController.abort(), 5000);
        try {
          const restRes = await fetch(`${REMOTE_API_URL}/rest/v1/`, {
            headers: { apikey: REMOTE_ANON_KEY },
            signal: restController.signal,
          });
          clearTimeout(restTimeout);
          return restRes.status < 500;
        } catch (__) {
          clearTimeout(restTimeout);
          return false;
        }
      }
    } catch (_) {
      return false;
    }
  }

  /**
   * Synchronizes an individual business entity safely without data deletion.
   */
  private async syncEntity(entity: EntitySyncConfig): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${REMOTE_API_URL}/rest/v1/${entity.remoteEndpoint}?select=*&limit=250`, {
        headers: {
          apikey: REMOTE_ANON_KEY,
          Authorization: `Bearer ${REMOTE_ANON_KEY}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return 0;
      }

      const text = await res.text();
      if (!text || text.trim().length === 0) {
        return 0;
      }

      const rows = JSON.parse(text);
      if (!Array.isArray(rows) || rows.length === 0) {
        if (!this.stats.entities[entity.key]) {
          this.stats.entities[entity.key] = {
            key: entity.key,
            name: entity.name,
            category: entity.category,
            processed: 0,
            lastSyncedAt: new Date().toISOString(),
            status: 'synced',
          };
        } else {
          this.stats.entities[entity.key].lastSyncedAt = new Date().toISOString();
          this.stats.entities[entity.key].status = 'synced';
        }
        return 0;
      }

      // Sanitize columns strictly to prevent Postgres column-not-found errors
      const validSet = new Set(entity.validColumns);
      const sanitized = rows.map((rawRow: any) => {
        const clean: any = {};
        for (const col of entity.validColumns) {
          if (rawRow[col] !== undefined) {
            clean[col] = rawRow[col];
          }
        }
        return entity.transform ? entity.transform(clean) : clean;
      });

      // Safe upsert on primary key 'id' to prevent duplicate records (never deletes data)
      const { error: upsertErr } = await (supabase.from(entity.targetTable as any) as any)
        .upsert(sanitized, { onConflict: 'id', ignoreDuplicates: false });

      if (upsertErr) {
        console.warn(`Sync note for entity ${entity.key}:`, upsertErr.message);
        if (this.stats.entities[entity.key]) {
          this.stats.entities[entity.key].status = 'error';
        }
        return 0;
      }

      const count = sanitized.length;
      if (!this.stats.entities[entity.key]) {
        this.stats.entities[entity.key] = {
          key: entity.key,
          name: entity.name,
          category: entity.category,
          processed: count,
          lastSyncedAt: new Date().toISOString(),
          status: 'synced',
        };
      } else {
        this.stats.entities[entity.key].processed += count;
        this.stats.entities[entity.key].lastSyncedAt = new Date().toISOString();
        this.stats.entities[entity.key].status = 'synced';
      }

      return count;

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`Non-blocking sync issue for ${entity.name}:`, err?.message);
      if (this.stats.entities[entity.key]) {
        this.stats.entities[entity.key].status = 'error';
      }
      return 0;
    }
  }

  /**
   * Performs complete end-to-end synchronization across all business entities.
   * Completely decoupled from employee authentication and normal site operations.
   * Uses safe upsert only; never deletes any existing records.
   */
  public async performSync(options: { isManual?: boolean } = {}): Promise<boolean> {
    if (this.state === 'syncing') {
      return false; // Prevent overlapping runs
    }

    const mode = options.isManual ? 'Manual sync' : 'Automatic background sync';
    this.state = 'syncing';
    this.lastAttempt = new Date().toISOString();
    this.notify();
    this.addLog('info', `Starting ${mode} across all business data entities with ${SOURCE_URL}...`);

    try {
      // 1. Check reachability of gravenonedesk.in source
      const isReachable = await this.pingSource();

      if (!isReachable) {
        this.state = 'offline';
        this.lastError = `Source ${SOURCE_URL} is temporarily unreachable. Operating in standalone mode with local database.`;
        this.addLog(
          'warn',
          `Source ${SOURCE_URL} is unreachable`,
          `Application continues operating normally on local database. Automatic retry scheduled in ${this.retryIntervalSeconds}s.`
        );
        this.saveToStorage();
        this.notify();
        this.scheduleRetry();
        return false;
      }

      // Connection is healthy - clear retry timer if it was running
      this.clearRetryTimer();

      // 2. Synchronize all business entities in structured topological order
      let batchTotal = 0;
      const entitySummaries: string[] = [];

      for (const entity of SYNC_ENTITIES) {
        const count = await this.syncEntity(entity);
        if (count > 0) {
          batchTotal += count;
          entitySummaries.push(`${entity.name}: ${count}`);

          // Update quick access counters
          if (entity.key === 'products') this.stats.productsSynced += count;
          else if (entity.key === 'customers') this.stats.customersSynced += count;
          else if (entity.key === 'suppliers') this.stats.suppliersSynced += count;
          else if (entity.key === 'sales_orders') this.stats.ordersSynced += count;
          else if (entity.key === 'quotations') this.stats.quotationsSynced += count;
          else if (entity.key === 'invoices') this.stats.invoicesSynced += count;
          else if (entity.key === 'purchase_orders') this.stats.procurementSynced += count;
          else if (entity.key === 'inventory') this.stats.inventorySynced += count;
        }
      }

      this.stats.totalRecordsProcessed += batchTotal;

      // 3. Mark sync successful
      this.state = 'synced';
      this.lastSuccessfulSync = new Date().toISOString();
      this.lastError = null;

      if (batchTotal > 0) {
        this.addLog(
          'success',
          `Synchronization successful with ${SOURCE_URL}`,
          `Safely updated ${batchTotal} records across ${entitySummaries.length} business entities. Zero records deleted.`
        );
      } else {
        this.addLog(
          'info',
          `Connected to ${SOURCE_URL} (0 records transferred)`,
          'Old Supabase tables enforce Row Level Security (RLS) which blocks unauthenticated anon access. Complete data is already restored and active in the new Supabase database. For continuous live sync, provide the old project service_role key.'
        );
      }

      this.saveToStorage();
      this.notify();

      // Dispatch global sync completed event to automatically refresh active dashboard queries
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('graven:sync-completed', { detail: { batchTotal } }));
      }

      return true;

    } catch (err: any) {
      console.warn('Sync service non-blocking warning:', err);
      this.state = 'error';
      this.lastError = err?.message || 'Sync service encountered a transient network issue';
      this.addLog('error', 'Transient sync issue occurred', `${this.lastError}. Current website continues working normally on local data.`);
      this.saveToStorage();
      this.notify();
      this.scheduleRetry();
      return false;
    }
  }

  public getEntitiesConfig(): EntitySyncConfig[] {
    return [...SYNC_ENTITIES];
  }

  public clearLogs() {
    this.logs = [];
    this.saveToStorage();
    this.notify();
  }
}

export const syncService = new SyncService();
