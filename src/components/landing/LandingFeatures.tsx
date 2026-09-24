import { TrendingUp, FileText, ShoppingCart, Receipt, Package, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: TrendingUp,
    title: 'Lead & Customer Management',
    description: 'Track leads, manage customers, and close deals faster with built-in CRM tools.',
  },
  {
    icon: FileText,
    title: 'Quotations & Sales Orders',
    description: 'Create professional quotations, convert to sales orders, and track every stage.',
  },
  {
    icon: ShoppingCart,
    title: 'Procurement & Supplier Network',
    description: 'Manage suppliers, send RFQs, compare pricing, and streamline purchasing.',
  },
  {
    icon: Receipt,
    title: 'Invoicing & Accounts',
    description: 'Generate GST-compliant invoices, track payments, and manage receivables.',
  },
  {
    icon: Package,
    title: 'Inventory & Dispatch',
    description: 'Real-time stock tracking, multi-warehouse support, and dispatch management.',
  },
  {
    icon: Clock,
    title: 'Attendance & Payroll',
    description: 'Automated attendance, leave management, salary calculation, and payslips.',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Operate
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Six powerful modules that replace a dozen disconnected tools.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors group"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
