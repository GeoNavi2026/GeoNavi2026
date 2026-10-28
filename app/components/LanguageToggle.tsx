"use client";

import { LANGS, useI18n } from "@/lib/i18n";

// EN / PT switch
export default function LanguageToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <div role="group" aria-label={t("lang.label")} className="flex shrink-0 gap-[2px] rounded-[8px] border border-line bg-canvas p-[2px]">
      {LANGS.map(({ code, short, name }) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-label={name}
            aria-pressed={active}
            onClick={() => setLang(code)}
            className={`cursor-pointer rounded-[6px] px-[8px] py-[3px] text-[12px] leading-[16px] font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-text ${
              active ? "bg-chip text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}
