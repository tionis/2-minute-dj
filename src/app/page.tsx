"use client";

import Link from "next/link";
import { Disc, Smartphone, Monitor, Languages, History } from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";

export default function Home() {
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-neutral-950 to-neutral-950 z-0" />
      
      {/* Language Switcher */}
      <div className="absolute top-8 right-8 z-20 flex items-center space-x-2 bg-neutral-900/50 p-1 rounded-full border border-neutral-800">
        <button 
          onClick={() => setLanguage("en")}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${language === "en" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-neutral-500 hover:text-neutral-300"}`}
        >
          EN
        </button>
        <button 
          onClick={() => setLanguage("de")}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${language === "de" ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-neutral-500 hover:text-neutral-300"}`}
        >
          DE
        </button>
      </div>

      <div className="z-10 flex flex-col items-center space-y-12 max-w-md w-full">
        <div className="text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-indigo-500/10 mb-4 animate-pulse">
            <Disc size={48} className="text-indigo-500" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            2-Minute DJ
          </h1>
          <p className="text-neutral-400 text-lg">
            {language === "de" ? "Das hochenergetische Musik-Party-Spiel." : "The high-energy music party game."}
          </p>
        </div>

        <div className="w-full space-y-4">
          <Link
            href="/host"
            className="group w-full flex items-center justify-between p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800 transition-all duration-300 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                <Monitor size={24} className="text-indigo-400" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl">{t("hostGame")}</h3>
                <p className="text-neutral-500 text-sm group-hover:text-neutral-400">{t("hostDesc")}</p>
              </div>
            </div>
            <div className="text-neutral-600 group-hover:text-indigo-400 transition-colors">→</div>
          </Link>

          <Link
            href="/join"
            className="group w-full flex items-center justify-between p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 hover:bg-neutral-800 transition-all duration-300 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <Smartphone size={24} className="text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl">{t("joinGame")}</h3>
                <p className="text-neutral-500 text-sm group-hover:text-neutral-400">{t("joinDesc")}</p>
              </div>
            </div>
            <div className="text-neutral-600 group-hover:text-purple-400 transition-colors">→</div>
          </Link>

          <Link
            href="/history"
            className="group w-full flex items-center justify-between p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900 transition-all duration-300 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors">
                <History size={18} className="text-neutral-400" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-sm text-neutral-300">{language === "de" ? "Session-Verlauf" : "Session History"}</h3>
                <p className="text-neutral-600 text-xs">{language === "de" ? "Vergangene Sessions ansehen" : "View past sessions"}</p>
              </div>
            </div>
            <div className="text-neutral-700 group-hover:text-neutral-500 transition-colors">→</div>
          </Link>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-neutral-600 text-sm">
        {t("poweredBy")}
        <a href="https://automerge.org/" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">Automerge</a>
        {" + "}
        <a href="https://oxism.com/trystero/" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">Trystero</a>
      </div>
    </div>
  );
}
