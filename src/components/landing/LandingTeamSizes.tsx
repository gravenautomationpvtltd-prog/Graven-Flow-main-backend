import { User, Users, Building } from 'lucide-react';
import { motion } from 'framer-motion';

const tiers = [
  {
    icon: User,
    title: 'Small Teams',
    size: '1–5 people',
    highlights: [
      'Lead tracking & follow-ups',
      'Quotations & invoicing',
      'Basic inventory management',
      'Attendance tracking',
    ],
  },
  {
    icon: Users,
    title: 'Growing Teams',
    size: '5–25 people',
    featured: true,
    highlights: [
      'Multi-role access control',
      'Procurement & supplier management',
      'Inventory across warehouses',
      'Task assignments & escalations',
    ],
  },
  {
    icon: Building,
    title: 'Large Organizations',
    size: '25+ people',
    highlights: [
      'Multi-office support',
      'Payroll & salary management',
      'Executive analytics dashboard',
      'Full audit trail & activity logs',
    ],
  },
];

export function LandingTeamSizes() {
  return (
    <section id="team-sizes" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Built for Every Team
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Whether you're a startup or an enterprise, Graven scales with you.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`p-6 rounded-xl border transition-colors ${
                t.featured
                  ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                  : 'bg-card border-border hover:border-primary/20'
              }`}
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <t.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{t.title}</h3>
              <p className="text-sm text-primary font-medium mb-4">{t.size}</p>
              <ul className="space-y-2.5">
                {t.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
