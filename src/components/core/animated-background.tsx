import { cn } from '../../lib/utils';
import { AnimatePresence, type Transition, motion, useReducedMotion } from 'motion/react';
import {
  Children,
  cloneElement,
  type ReactElement,
  useEffect,
  useState,
  useId,
} from 'react';
import React from 'react';

export type AnimatedBackgroundProps = {
  children:
    | ReactElement<{ 'data-id': string; className?: string; children?: React.ReactNode; onClick?: React.MouseEventHandler }>[]
    | ReactElement<{ 'data-id': string; className?: string; children?: React.ReactNode; onClick?: React.MouseEventHandler }>;
  defaultValue?: string;
  onValueChange?: (newActiveId: string | null) => void;
  className?: string;
  transition?: Transition;
  enableHover?: boolean;
};

export function AnimatedBackground({
  children,
  defaultValue,
  onValueChange,
  className,
  transition,
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const uniqueId = useId();
  const shouldReduceMotion = useReducedMotion();

  const handleSetActiveId = (id: string | null) => {
    setActiveId(id);

    if (onValueChange) {
      onValueChange(id);
    }
  };

  useEffect(() => {
    if (defaultValue !== undefined) {
      setActiveId(defaultValue);
    }
  }, [defaultValue]);

  return Children.map(children, (child: any, index) => {
    if (!child) return null;
    const id = child.props['data-id'];

    const interactionProps = enableHover
      ? {
          onMouseEnter: () => handleSetActiveId(id),
          onMouseLeave: () => handleSetActiveId(null),
        }
      : {
          onClick: (e: React.MouseEvent) => {
            child.props.onClick?.(e);
            handleSetActiveId(id);
          },
        };

    const isChecked = activeId === id;

    return cloneElement(
      child,
      {
        key: id || index,
        className: cn('relative inline-flex', child.props.className),
        'data-checked': isChecked ? 'true' : 'false',
        ...interactionProps,
      },
      <>
        <AnimatePresence initial={false}>
          {isChecked && (
            <motion.div
              layoutId={shouldReduceMotion ? undefined : `background-${uniqueId}`}
              className={cn('absolute inset-0', className)}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : (transition ?? {
                      type: 'spring',
                      stiffness: 400,
                      damping: 32,
                    })
              }
              initial={{ opacity: defaultValue ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
        <span className="relative z-10 flex items-center justify-center gap-1 sm:gap-1.5 w-full h-full pointer-events-none">
          {child.props.children}
        </span>
      </>
    );
  });
}
