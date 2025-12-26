import Link from "next/link";
import { Disc, Smartphone, Monitor } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-neutral-950 to-neutral-950 z-0" />
      
      <div className="z-10 flex flex-col items-center space-y-12 max-w-md w-full">
        <div className="text-center space-y-4">
          <div className="inline-block p-4 rounded-full bg-indigo-500/10 mb-4 animate-pulse">
            <Disc size={48} className="text-indigo-500" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            2-Minute DJ
          </h1>
          <p className="text-neutral-400 text-lg">
            High-energy music sharing party game.
          </p>
        </div>

        <div className="w-full space-y-4">
          <Link
            href="/host"
            className="group w-full flex items-center justify-between p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800 transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                <Monitor size={24} className="text-indigo-400" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl">Host a Game</h3>
                <p className="text-neutral-500 text-sm group-hover:text-neutral-400">Use this device as the TV</p>
              </div>
            </div>
            <div className="text-neutral-600 group-hover:text-indigo-400 transition-colors">→</div>
          </Link>

          <Link
            href="/join"
            className="group w-full flex items-center justify-between p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 hover:bg-neutral-800 transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <Smartphone size={24} className="text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl">Join Game</h3>
                <p className="text-neutral-500 text-sm group-hover:text-neutral-400">Use your phone to play</p>
              </div>
            </div>
            <div className="text-neutral-600 group-hover:text-purple-400 transition-colors">→</div>
          </Link>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-neutral-600 text-sm">
        Powered by InstantDB
      </div>
    </div>
  );
}