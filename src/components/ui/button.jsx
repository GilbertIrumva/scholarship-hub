import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base: tracking-tight headlines, refined easing, motion-safe lift, accessible focus ring.
  'group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-tight transition-[transform,background-color,box-shadow,color,border-color] duration-200 ease-out [transition-timing-function:cubic-bezier(0.25,1,0.5,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-white shadow-elev-2 hover:bg-primary-dark hover:shadow-elev-3 motion-safe:hover:-translate-y-px',
        destructive:
          'bg-danger text-white shadow-elev-2 hover:bg-red-700 hover:shadow-elev-3 motion-safe:hover:-translate-y-px',
        outline:
          'border border-border bg-surface text-ink shadow-elev-1 hover:border-primary/40 hover:bg-surface-2',
        secondary:
          'bg-surface-2 text-ink hover:bg-border/60',
        ghost:
          'text-ink hover:bg-surface-2',
        link:
          'text-primary underline-offset-4 hover:underline',
        accent:
          'bg-accent text-ink shadow-elev-2 hover:bg-accent-dark hover:shadow-elev-3 motion-safe:hover:-translate-y-px',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-7 text-[0.95rem]',
        xl: 'h-14 px-9 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
