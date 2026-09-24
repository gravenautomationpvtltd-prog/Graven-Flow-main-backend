import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  direction?: 'up' | 'down';
  duration?: number;
  formatFn?: (value: number) => string;
  className?: string;
}

export function AnimatedCounter({
  value,
  direction = 'up',
  duration = 1.5,
  formatFn = (val) => val.toLocaleString(),
  className = '',
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === 'down' ? value : 0);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
    duration: duration * 1000,
  });
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [displayValue, setDisplayValue] = useState(direction === 'down' ? value : 0);

  useEffect(() => {
    if (isInView) {
      motionValue.set(direction === 'down' ? 0 : value);
    }
  }, [motionValue, isInView, value, direction]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return unsubscribe;
  }, [springValue]);

  return (
    <span ref={ref} className={className}>
      {formatFn(displayValue)}
    </span>
  );
}

interface AnimatedPercentageProps {
  value: number;
  duration?: number;
  className?: string;
  showSign?: boolean;
}

export function AnimatedPercentage({
  value,
  duration = 1.5,
  className = '',
  showSign = false,
}: AnimatedPercentageProps) {
  const formatFn = (val: number) => {
    const formatted = val.toFixed(1);
    if (showSign && val > 0) return `+${formatted}%`;
    return `${formatted}%`;
  };

  return (
    <AnimatedCounter
      value={value}
      duration={duration}
      formatFn={formatFn}
      className={className}
    />
  );
}

interface AnimatedCurrencyProps {
  value: number;
  duration?: number;
  className?: string;
  currency?: string;
  locale?: string;
}

export function AnimatedCurrency({
  value,
  duration = 1.5,
  className = '',
  currency = 'INR',
  locale = 'en-IN',
}: AnimatedCurrencyProps) {
  const formatFn = (val: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <AnimatedCounter
      value={value}
      duration={duration}
      formatFn={formatFn}
      className={className}
    />
  );
}
