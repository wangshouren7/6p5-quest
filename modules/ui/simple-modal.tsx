"use client";

import { cn } from "@/modules/ui/jsx";
import React from "react";

export interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** 例如 max-w-2xl，默认 max-w-2xl */
  maxWidth?: string;
  className?: string;
}

export function SimpleModal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
  className,
}: SimpleModalProps) {
  if (!open) return null;
  const smMaxWidth = maxWidth.startsWith("max-w-")
    ? `sm:${maxWidth}`
    : maxWidth;
  return (
    <dialog
      open
      className="modal modal-open"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "modal-box max-h-[90vh] overflow-auto max-w-[95vw]",
          smMaxWidth,
          className,
        )}
      >
        {title != null && title !== "" && (
          <h3 className="font-bold text-lg mb-3">{title}</h3>
        )}
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">关闭</button>
      </form>
    </dialog>
  );
}
