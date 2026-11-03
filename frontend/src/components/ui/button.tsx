import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const variants = cva('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400 disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: {
    default: 'bg-violet-500 text-white hover:bg-violet-600',
    outline: 'border border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800',
    ghost: 'text-slate-200 hover:bg-slate-800',
  } }, defaultVariants: { variant: 'default' },
});
type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants> & { asChild?: boolean };
export const Button = forwardRef<HTMLButtonElement, Props>(({ className, variant, asChild, type = 'button', ...props }, ref) => {
  const Component = asChild ? Slot : 'button';
  return <Component ref={ref} className={cn(variants({ variant }), className)} type={type} {...props}/>;
});
Button.displayName = 'Button';
