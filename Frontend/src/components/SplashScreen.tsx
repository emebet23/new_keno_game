import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { playSound } from "../lib/sound";

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Auto fade-out timer
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(onFinish, 400); // Allow fade animation to complete
    }, 2200);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      onClick={() => {
        playSound();
        setFade(true);
        setTimeout(onFinish, 200);
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#000000] text-white p-6 select-none cursor-pointer transition-opacity duration-500 ${
        fade ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#C084FC]/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[#22D3EE]/25 rounded-full blur-[120px] pointer-events-none" />

      {/* CENTER PIECE: "ኬኖ" Amharic Word & Glowing Aura */}
      <div className="flex flex-col items-center justify-center text-center my-auto space-y-4 animate-splash-pulse">
        {/* Decorative Badge Icon */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#C084FC] via-[#22D3EE] to-white flex items-center justify-center font-black text-black text-3xl shadow-2xl shadow-[#C084FC]/50 mb-2">
          ኬ
        </div>

        {/* Centered Amharic Word "ኬኖ" */}
        <h1 className="text-7xl sm:text-9xl font-black tracking-wider bg-gradient-to-r from-[#C084FC] via-[#22D3EE] to-white bg-clip-text text-transparent font-serif leading-none filter drop-shadow-2xl">
          ኬኖ
        </h1>

        <p className="text-base sm:text-xl font-bold tracking-widest text-slate-200">
          የቀጥታ እና ፈጣን የቁጥር ጨዋታ
        </p>
      </div>


    </div>
  );
}
