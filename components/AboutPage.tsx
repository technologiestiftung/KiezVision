import React from "react";
import type { NavigateFunction } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export interface AboutPageProps {
  language: "en" | "de";
  navigate: NavigateFunction;
  title: string;
  backLabel: string;
  intro: string;
  body: string;
  kiezlaborTitle: string;
  kiezlaborBody: string;
  linksTitle: string;
  appLabel: string;
  appUrl: string;
  projectLabel: string;
  projectUrl: string;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  language,
  navigate,
  title,
  backLabel,
  intro,
  body,
  kiezlaborTitle,
  kiezlaborBody,
  linksTitle,
  appLabel,
  appUrl,
  projectLabel,
  projectUrl,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-eb-900 font-black border-2 border-eb-900 px-4 h-10 bg-coral-100 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none transition-all mb-10"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {backLabel}
      </button>

      <div className="bg-white border-4 border-eb-900 p-8 sm:p-10 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)]">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tighter mb-6">
          {title}
        </h2>
        <p className="text-base sm:text-lg font-bold text-eb-900/80 leading-relaxed mb-4">
          <strong>KiezVision</strong> {intro}
        </p>
        <p className="text-sm font-bold text-eb-900/70 leading-relaxed mb-8">
          {body}
        </p>

        <div className="border-t-2 border-eb-900/10 pt-8 mb-8">
          <h3 className="text-lg font-black tracking-tight mb-3">
            {kiezlaborTitle}
          </h3>
          <p className="text-sm font-bold text-eb-900/70 leading-relaxed">
            {kiezlaborBody}
          </p>
        </div>

        <div className="border-t-2 border-eb-900/10 pt-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-eb-900/50 mb-4">
            {linksTitle}
          </h3>
          <ul className="space-y-2 text-sm font-black">
            <li>
              <a
                href={appUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-coral-500 transition-colors"
              >
                {appLabel}
              </a>
            </li>
            <li>
              <a
                href={projectUrl}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-coral-500 transition-colors"
              >
                {projectLabel}
              </a>
            </li>
            <li>
              <a
                href={
                  language === "de"
                    ? "https://citylab-berlin.org/de/start/"
                    : "https://citylab-berlin.org/en/start/"
                }
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-coral-500 transition-colors"
              >
                CityLAB Berlin
              </a>
            </li>
            <li>
              <a
                href="https://www.technologiestiftung-berlin.de/"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-coral-500 transition-colors"
              >
                Technologiestiftung Berlin
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
