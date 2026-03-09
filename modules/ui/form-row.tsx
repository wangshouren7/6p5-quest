"use client";

import { cn } from "@/modules/ui/jsx";

export interface FormRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** label 宽度类名，默认 w-16 */
  labelWidth?: string;
}

export function FormRow({
  label,
  children,
  className,
  labelWidth = "w-16",
}: FormRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className={cn("label-text shrink-0", labelWidth)}>{label}</span>
      {children}
    </div>
  );
}
