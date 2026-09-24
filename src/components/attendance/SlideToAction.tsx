import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { LogOut, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlideToActionProps {
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
  variant?: 'checkout' | 'checkin';
}

export function SlideToAction({ 
  onComplete, 
  disabled = false, 
  label = 'Slide to Check Out',
  variant = 'checkout'
}: SlideToActionProps) {
  const [completed, setCompleted] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [containerWidth, setContainerWidth] = useState(0);
  
  const buttonWidth = 56;
  const threshold = containerWidth - buttonWidth - 8;
  
  const opacity = useTransform(x, [0, threshold * 0.5], [1, 0]);
  const scale = useTransform(x, [threshold * 0.8, threshold], [1, 1.1]);
  const checkOpacity = useTransform(x, [threshold * 0.8, threshold], [0, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const currentX = x.get();
    if (currentX >= threshold * 0.95 && !disabled) {
      setCompleted(true);
      setTimeout(() => {
        onComplete();
        setCompleted(false);
        x.set(0);
      }, 300);
    }
  };

  const bgColor = variant === 'checkout' 
    ? 'bg-gradient-to-r from-red-500 to-red-600' 
    : 'bg-gradient-to-r from-green-500 to-green-600';

  const trackColor = variant === 'checkout'
    ? 'bg-red-100 dark:bg-red-950/50'
    : 'bg-green-100 dark:bg-green-950/50';

  return (
    <div 
      ref={(el) => {
        if (el && constraintsRef) {
          (constraintsRef as any).current = el;
          setContainerWidth(el.offsetWidth);
        }
      }}
      className={cn(
        "relative h-14 rounded-full overflow-hidden",
        trackColor,
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Label */}
      <motion.div 
        style={{ opacity }}
        className="absolute inset-0 flex items-center justify-center text-sm font-medium text-muted-foreground pointer-events-none"
      >
        {label} →
      </motion.div>

      {/* Slider Button */}
      <motion.div
        drag={disabled || completed ? false : "x"}
        dragConstraints={{ left: 0, right: Math.max(0, containerWidth - buttonWidth - 8) }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, scale }}
        className={cn(
          "absolute left-1 top-1 w-12 h-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg",
          bgColor,
          disabled && "cursor-not-allowed"
        )}
      >
        <motion.div style={{ opacity: checkOpacity }} className="absolute">
          <Check className="h-6 w-6 text-white" />
        </motion.div>
        <motion.div style={{ opacity: useTransform(checkOpacity, v => 1 - v) }}>
          <LogOut className="h-5 w-5 text-white" />
        </motion.div>
      </motion.div>

      {/* Success overlay */}
      {completed && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full",
            variant === 'checkout' ? 'bg-red-500' : 'bg-green-500'
          )}
        >
          <Check className="h-6 w-6 text-white" />
        </motion.div>
      )}
    </div>
  );
}
