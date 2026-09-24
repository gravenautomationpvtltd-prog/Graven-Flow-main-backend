import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingCTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto text-center rounded-2xl bg-primary/5 border border-primary/20 p-10 sm:p-14"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Ready to Streamline Your Business?
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
          Join hundreds of businesses that manage their entire operation with Graven. Start your free 30-day demo today.
        </p>
        <Button size="lg" asChild className="h-12 px-8 text-base">
          <Link to="/auth?tab=signup">
            Start Free Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </motion.div>
    </section>
  );
}
