import type { ComponentPropsWithRef } from "react";

// Figma component "Button": Primary (filled) and Secondary (outlined).
const VARIANTS = {
  primary: "bg-accent text-white hover:bg-[#1d4ed8]",
  secondary: "border border-[#334155] bg-[#1e293b] text-[#e2e8f0] hover:bg-[#273449]",
};

// "icon" is a square button the same height as a labelled one.
const SIZES = {
  md: "px-[18px] py-[10px]",
  icon: "size-[42px]",
};

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export default function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-[14px] leading-[20px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text disabled:cursor-default disabled:opacity-60 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
