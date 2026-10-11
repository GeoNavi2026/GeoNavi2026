/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// The GeoNavi logo: blue globe mark + wordmark, in the two sizes the Figma file uses.
const SIZES = {
  lg: {
    gap: "gap-[14px]",
    mark: "size-[52px] rounded-[14px]",
    icon: { src: "/figma/icon-globe-lg.svg", size: 30 },
    text: "text-[48px] leading-[56px] tracking-[-1.44px]",
  },
  sm: {
    gap: "gap-[10px]",
    mark: "size-[32px] rounded-[9px]",
    icon: { src: "/figma/icon-globe-sm.svg", size: 18 },
    text: "text-[20px] leading-[28px] tracking-[-0.4px]",
  },
};

export default function Logo({ size = "sm", as: Tag = "span" }: { size?: keyof typeof SIZES; as?: "span" | "h1" }) {
  const s = SIZES[size];
  return (
    <Tag className={`flex items-center ${s.gap}`}>
      <span className={`flex shrink-0 items-center justify-center bg-accent ${s.mark}`}>
        <img src={s.icon.src} width={s.icon.size} height={s.icon.size} alt="" />
      </span>
      <span className={`font-semibold whitespace-nowrap text-ink ${s.text}`}>GeoNavi</span>
    </Tag>
  );
}
