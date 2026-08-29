import type { ReactNode } from "react";
import { TaglineText } from "./TaglineText";

type StageBrandLockupProps = {
  children?: ReactNode;
};

/** Accepted START/returned-STOP branding paint, shared literally by RUNNING. */
export function StageBrandLockup({ children }: StageBrandLockupProps) {
  return (
    <div className="aiasap-brand-lockup absolute left-0 right-0 top-3 z-10 flex flex-col items-center pb-1 pt-1 sm:pt-2 md:top-[calc(var(--stage-top)+0.25rem)] md:pt-0">
      <div className="text-center px-4">
        <div className="flex items-start justify-center">
          <h1 className="aiasap-logo-mark relative top-[0.45rem] inline-block overflow-visible px-5 pt-1 pb-1 bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-[calc(var(--stage-width)*0.10)] font-bold italic leading-[1.12] tracking-normal text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
            aiASAP
          </h1>
        </div>
        <p className="aiasap-tablet-idle-tagline -mt-1 text-[calc(var(--stage-width)*0.025)] font-[540] tracking-[0.14976em] max-[599px]:scale-x-[0.9] md:mt-0 md:tracking-[0.12672em] xl:tracking-[0.14976em] uppercase bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
          <TaglineText />
        </p>
      </div>
      {children}
    </div>
  );
}
