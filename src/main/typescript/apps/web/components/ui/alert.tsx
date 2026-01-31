import * as React from 'react';
import { cn } from './utils';

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn('rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800', className)} {...props} />
}

