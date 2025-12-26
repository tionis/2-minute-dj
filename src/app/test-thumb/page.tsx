"use client";

import { useState } from "react";

export default function TestThumbPage() {
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ"); // Default to Rick Roll

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center space-y-8">
      <h1 className="text-2xl font-bold">Thumbnail Debugger</h1>
      
      <input 
        className="text-black p-2 rounded"
        value={videoId}
        onChange={(e) => setVideoId(e.target.value)}
        placeholder="Video ID"
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
            <p>hqdefault</p>
            <img 
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} 
                alt="HQ" 
                className="border border-white"
            />
        </div>
        <div className="space-y-2">
            <p>mqdefault</p>
            <img 
                src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} 
                alt="MQ" 
                className="border border-white"
            />
        </div>
         <div className="space-y-2">
            <p>0 (Max Res)</p>
            <img 
                src={`https://img.youtube.com/vi/${videoId}/0.jpg`} 
                alt="0" 
                className="border border-white"
            />
        </div>
      </div>
    </div>
  );
}
