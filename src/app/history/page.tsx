"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  History, 
  Trash2, 
  Download, 
  Share, 
  FileCode, 
  ChevronRight, 
  ArrowLeft,
  AlertTriangle,
  Music4,
  Users,
  Calendar
} from "lucide-react";
import { useI18n } from "@/components/LanguageProvider";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ShareLinkModal from "@/components/ui/ShareLinkModal";
import {
  SessionSnapshot,
  getSessionHistory,
  deleteSession,
  clearAllSessions,
  generateShareUrl,
  generateSessionHTML,
  generateSessionJSON,
} from "@/lib/session-history";

export default function HistoryPage() {
  const { t, language, setLanguage } = useI18n();
  const [sessions, setSessions] = useState<SessionSnapshot[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSessions(getSessionHistory());
  }, []);

  const handleDelete = (id: string) => {
    deleteSession(id);
    setSessions(getSessionHistory());
    setDeleteId(null);
  };

  const handleClearAll = () => {
    clearAllSessions();
    setSessions([]);
    setShowClearAll(false);
  };

  const handleShare = (session: SessionSnapshot) => {
    const url = generateShareUrl(session);
    setShareUrl(url);
    setShowShareModal(true);
  };

  const handleDownloadHTML = (session: SessionSnapshot) => {
    const html = generateSessionHTML(session);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `2mdj-session-${session.roomCode}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = (session: SessionSnapshot) => {
    const json = generateSessionJSON(session);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `2mdj-session-${session.roomCode}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return language === "de" ? "Heute" : "Today";
    } else if (diffDays === 1) {
      return language === "de" ? "Gestern" : "Yesterday";
    } else if (diffDays < 7) {
      return language === "de" ? `Vor ${diffDays} Tagen` : `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(language === "de" ? "de-DE" : "en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const calculateAvgScore = (session: SessionSnapshot) => {
    const allVotes = session.songs.flatMap(s => s.votes);
    if (allVotes.length === 0) return null;
    const sum = allVotes.reduce((a, b) => a + b, 0);
    return Math.round(sum / allVotes.length);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="p-2 rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center space-x-2">
                  <History size={28} className="text-indigo-400" />
                  <span>{language === "de" ? "Session-Verlauf" : "Session History"}</span>
                </h1>
                <p className="text-neutral-500 text-sm mt-1">
                  {language === "de" 
                    ? `${sessions.length} gespeicherte Sessions` 
                    : `${sessions.length} saved sessions`}
                </p>
              </div>
            </div>
            
            {/* Language Switcher */}
            <div className="flex items-center space-x-2 bg-neutral-900/50 p-1 rounded-full border border-neutral-800">
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
          </div>
          
          {sessions.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowClearAll(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                <span>{language === "de" ? "Alle löschen" : "Clear All"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {sessions.length === 0 && (
          <div className="text-center py-20 space-y-6">
            <div className="inline-block p-6 rounded-full bg-neutral-900 border border-neutral-800">
              <History size={48} className="text-neutral-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-neutral-400">
                {language === "de" ? "Noch keine Sessions" : "No sessions yet"}
              </h2>
              <p className="text-neutral-600 max-w-sm mx-auto">
                {language === "de" 
                  ? "Wenn du an Sessions teilnimmst oder sie hostest, werden sie hier gespeichert."
                  : "When you host or join sessions, they'll be saved here for later."}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center space-x-2 px-8 py-3 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 transition-colors"
            >
              <span>{language === "de" ? "Session starten" : "Start a Session"}</span>
            </Link>
          </div>
        )}

        {/* Sessions List */}
        <div className="space-y-4">
          {sessions.map((session) => {
            const avgScore = calculateAvgScore(session);
            const isExpanded = expandedId === session.id;
            
            return (
              <div 
                key={session.id}
                className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-colors"
              >
                {/* Session Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                      <span className="font-mono font-bold text-indigo-400">{session.roomCode}</span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">{language === "de" ? "Session" : "Session"} {session.roomCode}</span>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                          session.role === "host" 
                            ? "bg-yellow-500/20 text-yellow-500" 
                            : "bg-purple-500/20 text-purple-500"
                        }`}>
                          {session.role === "host" ? "Host" : "Player"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-sm text-neutral-500 mt-1">
                        <span className="flex items-center space-x-1">
                          <Music4 size={12} />
                          <span>{session.songs.length} {language === "de" ? "Songs" : "songs"}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Users size={12} />
                          <span>{session.playerCount}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar size={12} />
                          <span>{formatDate(session.endedAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {avgScore !== null && (
                      <div className={`px-3 py-1 rounded-lg font-mono font-bold text-sm ${
                        avgScore > 60 ? "bg-green-500/20 text-green-500" :
                        avgScore < 40 ? "bg-red-500/20 text-red-500" :
                        "bg-neutral-800 text-neutral-400"
                      }`}>
                        {avgScore}%
                      </div>
                    )}
                    <ChevronRight 
                      size={20} 
                      className={`text-neutral-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-neutral-800 p-4 sm:p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Song List Preview */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {session.songs.slice(0, 5).map((song, idx) => (
                        <div 
                          key={song.id}
                          className="flex items-center space-x-3 p-2 rounded-lg bg-neutral-800/50"
                        >
                          <span className="text-xs text-neutral-600 w-5">{idx + 1}</span>
                          <img
                            src={`https://img.youtube.com/vi/${song.video_id}/default.jpg`}
                            alt=""
                            className="w-10 h-8 rounded object-cover bg-neutral-700"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{song.video_title}</p>
                            <p className="text-xs text-neutral-500">DJ {song.player_nickname}</p>
                          </div>
                          {song.votes.length > 0 && (
                            <span className="text-xs font-mono text-neutral-500">
                              {Math.round(song.votes.reduce((a,b) => a+b, 0) / song.votes.length)}%
                            </span>
                          )}
                        </div>
                      ))}
                      {session.songs.length > 5 && (
                        <p className="text-xs text-neutral-600 text-center py-2">
                          +{session.songs.length - 5} {language === "de" ? "weitere" : "more"}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
                      <button
                        onClick={() => handleShare(session)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors text-sm font-medium"
                      >
                        <Share size={14} />
                        <span>{language === "de" ? "Teilen" : "Share"}</span>
                      </button>
                      <button
                        onClick={() => handleDownloadHTML(session)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition-colors text-sm font-medium"
                      >
                        <FileCode size={14} />
                        <span>HTML</span>
                      </button>
                      <button
                        onClick={() => handleDownloadJSON(session)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition-colors text-sm font-medium"
                      >
                        <Download size={14} />
                        <span>JSON</span>
                      </button>
                      <button
                        onClick={() => setDeleteId(session.id)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors text-sm font-medium ml-auto"
                      >
                        <Trash2 size={14} />
                        <span>{language === "de" ? "Löschen" : "Delete"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Single Session Modal */}
      <ConfirmationModal
        isOpen={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title={language === "de" ? "Session löschen?" : "Delete Session?"}
        description={language === "de" 
          ? "Diese Session wird unwiderruflich aus deinem Verlauf entfernt."
          : "This session will be permanently removed from your history."}
        confirmText={language === "de" ? "Löschen" : "Delete"}
        cancelText={language === "de" ? "Abbrechen" : "Cancel"}
      />

      {/* Clear All Modal */}
      <ConfirmationModal
        isOpen={showClearAll}
        onCancel={() => setShowClearAll(false)}
        onConfirm={handleClearAll}
        title={language === "de" ? "Alle Sessions löschen?" : "Clear All Sessions?"}
        description={language === "de"
          ? "Alle gespeicherten Sessions werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
          : "All saved sessions will be permanently deleted. This action cannot be undone."}
        confirmText={language === "de" ? "Alle löschen" : "Clear All"}
        cancelText={language === "de" ? "Abbrechen" : "Cancel"}
      />

      {/* Share Modal */}
      <ShareLinkModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={language === "de" ? "Session teilen" : "Share Session"}
        link={shareUrl}
        buttonText={language === "de" ? "Kopieren" : "Copy"}
      />
    </div>
  );
}
