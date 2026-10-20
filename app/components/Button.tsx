import type { ButtonHTMLAttributes } from "react";

// Figma component "Button": Primary (filled) and Secondary (outlined).
const VARIANTS = {
  primary: "bg-accent text-white hover:bg-[#1d4ed8]",
  secondary: "border border-[#334155] bg-[#1e293b] text-[#e2e8f0] hover:bg-[#273449]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
};

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[8px] px-[18px] py-[10px] text-[14px] leading-[20px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text disabled:cursor-default disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
