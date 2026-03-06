import { clsx, type ClassValue } from "clsx";
import React from "react";
import { twMerge } from "tailwind-merge";

export interface IComponentBaseProps {
  className?: string;
  style?: React.CSSProperties;
}

export interface IControllableComponentProps<TValue> {
  value?: TValue;
  defaultValue?: TValue;
  onChange?: (value: TValue) => void;
  disabled?: boolean;
}

export interface IPageProps<
  TParams = Record<string, string>,
  TSearchParams = Record<string, string>,
> {
  params: Promise<TParams>;
  searchParams: Promise<TSearchParams>;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Merge props with jsx
 *
 * @param props
 * @param jsx
 * @returns
 */
export function mp(props: any = {}, jsx: React.ReactElement) {
  if (!React.isValidElement(jsx)) {
    return jsx;
  }

  if (React.Fragment === jsx.type) {
    return jsx;
  }

  if (!props?.className && !props?.style) {
    return jsx;
  }

  const originalProps = jsx.props as any;
  return React.cloneElement(jsx, {
    ...originalProps,
    className: cn(originalProps.className, props.className),
    style: { ...originalProps.style, ...props.style },
  });
}
