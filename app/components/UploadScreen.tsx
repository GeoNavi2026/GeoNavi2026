"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icon exported from Figma */

// Figma page "1 · Upload": title card with a drag-and-drop upload box over the globe.

import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import { useUpload } from "@/lib/upload-store";
import { useI18n } from "@/lib/i18n";
import { useFileUpload } from "@/lib/use-file-upload";
import Button from "./Button";
import DashedOutline from "./DashedOutline";
import GlobeGraphic from "./GlobeGraphic";
import LanguageToggle from "./LanguageToggle";
import Logo from "./Logo";

export default function UploadScreen() {
  const router = useRouter();
  const { setUpload } = useUpload();
  const [dragging, setDragging] = useState(false);
  const { t } = useI18n();
  const { busy, error, uploadFile, loadSample, openPicker, inputProps } = useFileUpload(
    (upload) => {
      setUpload(upload);
      router.push("/explore");
    },
    { keepBusyOnSuccess: true }
  );

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-canvas px-4 py-10">
      <GlobeGraphic />
      <div className="absolute top-[16px] right-[16px] z-10">
        <LanguageToggle />
      </div>

      <div className="relative flex w-[600px] max-w-full flex-col items-center gap-[32px] rounded-[20px] border border-line bg-[rgb(2_3_8/0.82)] p-[48px] shadow-[0px_2px_6px_0px_rgba(0,0,0,0.04),0px_12px_40px_0px_rgba(0,0,0,0.06)] backdrop-blur-[12px] max-sm:p-[24px]">
        <div className="flex w-full flex-col items-center gap-[14px]">
          <Logo size="lg" as="h1" />
          <p className="text-center text-[17px] leading-[26px] text-ink-muted">
            {t("upload.tagline")}
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="relative flex w-full flex-col items-center gap-[12px] rounded-[14px] bg-canvas px-[32px] py-[40px]"
        >
          <DashedOutline radius={14} active={dragging} />
          <span className="flex size-[60px] items-center justify-center rounded-full bg-accent-soft">
            <img src="/figma/icon-cloud-upload.svg" width={28} height={28} alt="" />
          </span>
          <p className="text-center text-[16px] leading-[24px] font-medium text-ink">
            {busy ?? t("upload.drop")}
          </p>
          <p className="text-[13px] leading-[18px] text-ink-muted">{t("upload.or")}</p>
          <Button onClick={openPicker} disabled={busy !== null}>
            {t("upload.browse")}
          </Button>
          <p className="text-center text-[13px] leading-[18px] text-ink-muted">{t("upload.formats")}</p>
          {error && (
            <p role="alert" className="text-center text-[13px] leading-[18px] text-[#f87171]">
              {error}
            </p>
          )}
          <input {...inputProps} />
        </div>

        <p className="flex flex-wrap justify-center gap-[6px] text-[14px] leading-[20px]">
          <span className="text-ink-muted">{t("upload.noFile")}</span>
          <button
            type="button"
            onClick={loadSample}
            disabled={busy !== null}
            className="cursor-pointer font-medium text-accent-text hover:underline disabled:cursor-default"
          >
            {t("upload.sample")}
          </button>
        </p>
      </div>
    </main>
  );
}
