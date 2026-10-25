"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useMeetRecorder } from "@/hooks/useMeetRecorder";
import { MeetingMoM, SavedMeeting, UpcomingMeeting } from "@/lib/types";
import { formatMoMAsMarkdown } from "@/lib/markdownExporter";
import {
  saveMeetingToStorage,
  getAllSavedMeetings,
  deleteSavedMeeting,
} from "@/lib/storage";
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Loader2,
  Download,
  Copy,
  CheckCircle2,
  Users,
  CheckSquare,
  MessageSquare,
  HelpCircle,
  Clock,
  AudioLines,
  Video,
  History,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  AlertCircle,
  Volume2,
  Radio,
  FileText,
  ListOrdered,
  X,
  Mail,
  Calendar,
  CalendarCheck,
  ArrowUpRight,
  Plus,
} from "lucide-react";

export default function MeetMoMDashboard() {
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error: recorderError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordedBlob,
    recordedAudioUrl,
    resetRecording,
  } = useMeetRecorder();

  // State
  const [meetingContext, setMeetingContext] = useState("");
  const [liveCaptions, setLiveCaptions] = useState("");
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(1);
  const [momResult, setMomResult] = useState<MeetingMoM | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Settings & History state
  const [apiKey, setApiKey] = useState("");
  const [savedMeetings, setSavedMeetings] = useState<SavedMeeting[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "actions" | "topics" | "transcript">("overview");

  // Search & Filter state
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [actionSearch, setActionSearch] = useState("");
  const [actionPriorityFilter, setActionPriorityFilter] = useState<string>("ALL");

  // Upcoming Meetings Automation
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [preloadedNotice, setPreloadedNotice] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingUrl, setNewMeetingUrl] = useState("");
  const [newMeetingAttendees, setNewMeetingAttendees] = useState("");
  const [newMeetingDesc, setNewMeetingDesc] = useState("");
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);

  // Load saved settings & meetings on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedKey = localStorage.getItem("gmeet_gemini_api_key") || "";
      setApiKey(storedKey);
      const storedEmail = localStorage.getItem("gmeet_user_email") || "";
      setUserEmail(storedEmail);
      setTempEmail(storedEmail);
      loadSavedMeetingsList();
      fetchUpcomingMeetings(storedEmail);
    }
  }, []);

  const fetchUpcomingMeetings = async (emailOverride?: string) => {
    try {
      const emailToQuery = emailOverride !== undefined ? emailOverride : userEmail;
      const url = emailToQuery
        ? `/api/calendar/webhook?email=${encodeURIComponent(emailToQuery)}`
        : "/api/calendar/webhook";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUpcomingMeetings(data.meetings || []);
      }
    } catch (e) {
      console.error("Failed to load upcoming meetings:", e);
    }
  };

  const handleSaveUserEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tempEmail.trim();
    setUserEmail(clean);
    if (typeof window !== "undefined") {
      if (clean) {
        localStorage.setItem("gmeet_user_email", clean);
      } else {
        localStorage.removeItem("gmeet_user_email");
      }
    }
    setIsEditingEmail(false);
    fetchUpcomingMeetings(clean);
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      await fetch(`/api/calendar/webhook?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await fetchUpcomingMeetings();
    } catch (e) {
      console.error("Failed to delete meeting:", e);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingTitle.trim() || !newMeetingUrl.trim()) return;
    setIsSubmittingMeeting(true);
    try {
      const attendeesList = newMeetingAttendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      await fetch("/api/calendar/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newMeetingTitle.trim(),
          meetUrl: newMeetingUrl.trim().startsWith("http") ? newMeetingUrl.trim() : `https://${newMeetingUrl.trim()}`,
          startTime: new Date().toISOString(),
          attendees: attendeesList,
          description: newMeetingDesc.trim(),
          accountEmail: userEmail || "",
        }),
      });
      setShowAddMeetingModal(false);
      setNewMeetingTitle("");
      setNewMeetingUrl("");
      setNewMeetingDesc("");
      setNewMeetingAttendees("");
      await fetchUpcomingMeetings();
    } catch (err) {
      console.error("Failed to add meeting:", err);
    } finally {
      setIsSubmittingMeeting(false);
    }
  };

  const handleJoinAndRecord = (meeting: UpcomingMeeting) => {
    const attendeeStr = meeting.attendees.join(", ");
    const ctx = `Meeting: ${meeting.title}${attendeeStr ? `\nParticipants: ${attendeeStr}` : ""}${meeting.description ? `\nAgenda: ${meeting.description}` : ""}`;
    setMeetingContext(ctx);
    setPreloadedNotice(`Preloaded context & attendees for "${meeting.title}"!`);
    window.open(meeting.meetUrl, "_blank");
    setTimeout(() => {
      document.getElementById("start-recording-btn")?.scrollIntoView({ behavior: "smooth" });
    }, 400);
  };

  const handleEmailMoM = () => {
    if (!momResult) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const attendeeEmails = (momResult.participants || []).filter((p) =>
      emailRegex.test(p.trim())
    );
    const recipients = attendeeEmails.length > 0 ? attendeeEmails.join(", ") : (userEmail || "");
    const subject = encodeURIComponent(`[MoM] Minutes of Meeting: ${momResult.title}`);

    let body = `Hi Team,\n\nHere are the Minutes of Meeting for: ${momResult.title} (${momResult.date})\n\n`;
    body += `EXECUTIVE SUMMARY:\n${momResult.executiveSummary}\n\n`;

    if (momResult.decisionsMade?.length) {
      body += `KEY DECISIONS:\n` + momResult.decisionsMade.map((d, i) => `${i + 1}. ${d}`).join("\n") + "\n\n";
    }

    if (momResult.actionItems?.length) {
      body += `ACTION ITEMS:\n` + momResult.actionItems.map(a => `• [${a.priority}] ${a.task} — Owner: ${a.owner} (Due: ${a.deadline})`).join("\n") + "\n\n";
    }

    body += `\nGenerated via Google Meet MoM Agent.`;

    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipients)}&su=${subject}&body=${encodeURIComponent(body)}`;
    window.open(gmailComposeUrl, "_blank");
  };

  const loadSavedMeetingsList = async () => {
    try {
      const list = await getAllSavedMeetings();
      setSavedMeetings(list);
    } catch (e) {
      console.error("Failed to load meetings list:", e);
    }
  };

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
    const remSecs = (secs % 60).toString().padStart(2, "0");
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins}:${remSecs}`;
    }
    return `${mins}:${remSecs}`;
  };

  const handleStopAndGenerate = async () => {
    const audioBlob = await stopRecording();
    if (!audioBlob) return;
    await processAudio(audioBlob, duration);
  };

  const processAudio = async (blob: Blob, recordedDuration: number) => {
    setIsProcessing(true);
    setProcessingStep(1);
    setApiError(null);

    const stepTimer1 = setTimeout(() => setProcessingStep(2), 1500);
    const stepTimer2 = setTimeout(() => setProcessingStep(3), 4000);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "meeting.webm");
      formData.append("context", meetingContext);
      formData.append("captions", liveCaptions);
      if (apiKey) {
        formData.append("apiKey", apiKey);
      }

      const res = await fetch("/api/generate-mom", {
        method: "POST",
        body: formData,
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setProcessingStep(4);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate MoM.");
      }

      const finalMoM: MeetingMoM = {
        ...data,
        id: crypto.randomUUID(),
        date: new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        durationSeconds: recordedDuration || data.durationSeconds || 120,
      };

      setMomResult(finalMoM);

      // Save to IndexedDB
      await saveMeetingToStorage(finalMoM, blob, meetingContext);
      await loadSavedMeetingsList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate Minutes of Meeting.";
      setApiError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!momResult) return;
    navigator.clipboard.writeText(formatMoMAsMarkdown(momResult));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownloadMarkdown = () => {
    if (!momResult) return;
    const md = formatMoMAsMarkdown(momResult);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${momResult.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-mom.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleToggleActionItem = (index: number) => {
    if (!momResult) return;
    const updated = [...momResult.actionItems];
    updated[index] = {
      ...updated[index],
      completed: !updated[index].completed,
    };
    setMomResult({
      ...momResult,
      actionItems: updated,
    });
  };



  const handleSelectSavedMeeting = (saved: SavedMeeting) => {
    setMomResult(saved.mom);
    setShowHistoryDrawer(false);
    setActiveTab("overview");
    setTimeout(() => {
      const el = document.getElementById("mom-results-dashboard");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const handleDeleteSavedMeeting = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSavedMeeting(id);
    await loadSavedMeetingsList();
  };

  // Filtered action items
  const filteredActionItems = useMemo(() => {
    if (!momResult?.actionItems) return [];
    return momResult.actionItems.filter((item) => {
      const matchesSearch =
        item.task.toLowerCase().includes(actionSearch.toLowerCase()) ||
        item.owner.toLowerCase().includes(actionSearch.toLowerCase());
      const matchesPriority =
        actionPriorityFilter === "ALL" || item.priority === actionPriorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [momResult?.actionItems, actionSearch, actionPriorityFilter]);

  // Filtered transcript segments
  const filteredTranscript = useMemo(() => {
    if (!momResult?.transcript) return [];
    if (!transcriptSearch.trim()) return momResult.transcript;
    const q = transcriptSearch.toLowerCase();
    return momResult.transcript.filter(
      (seg) =>
        seg.text.toLowerCase().includes(q) ||
        seg.speaker.toLowerCase().includes(q)
    );
  }, [momResult?.transcript, transcriptSearch]);

  return (
    <main className="min-h-screen bg-[#fbfbf9] text-[#33332e] flex flex-col font-sans">
      {/* Top Navigation Bar (Pinterest Style: 64px, White, 1px Hairline) */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#dadad3] h-16 flex items-center px-4 sm:px-8 no-print">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* App Brand Logo Mark */}
            <div className="w-10 h-10 rounded-2xl bg-[#e60023] flex items-center justify-center text-white shadow-sm">
              <AudioLines className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-[#000000]">
                  MeetMoM
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f6f6f3] text-[#33332e] border border-[#dadad3]">
                  <Video className="w-3 h-3 text-[#e60023]" />
                  Google Meet
                </span>
              </div>
              <p className="text-xs text-[#62625b] hidden sm:block">
                Google Meet Tab + Mic Minutes of Meeting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">


            {/* Saved Meetings Button */}
            <button
              id="toggle-history-btn"
              onClick={() => setShowHistoryDrawer(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-2xl bg-[#e5e5e0] hover:bg-[#dadad3] text-[#000000] transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#62625b]" />
              <span className="hidden sm:inline">Saved</span>
              {savedMeetings.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#e60023] text-white font-bold">
                  {savedMeetings.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Info Banner (Pinterest Soft Card) */}
        <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 sm:p-5 no-print">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-white border border-[#dadad3] text-[#e60023] mt-0.5 shadow-sm">
              <Radio className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-[#000000]">
                Zero-Cost Google Meet Tab & Mic Capture
              </h3>
              <p className="text-xs text-[#62625b] leading-relaxed">
                Click <strong>&quot;Record Google Meet Tab + Mic&quot;</strong>, select your Google Meet tab, and check <strong>&quot;Also share tab audio&quot;</strong>. Both remote participants and your local mic are cleanly mixed without third-party bots.
              </p>
            </div>
          </div>
        </div>

        {/* Automated Meeting Sync Card */}
        <div className="bg-white border border-[#dadad3] rounded-[32px] p-6 sm:p-8 space-y-4 shadow-sm no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dadad3] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#fee2e2] text-[#e60023]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-2">
                  <h3 className="text-lg font-bold text-[#000000]">
                    Google Meet Calendar Sync
                  </h3>
                  {userEmail ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e8f5e9] text-[#1b5e20] border border-[#c8e6c9]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32] animate-pulse"></span>
                      {userEmail}
                      <button
                        onClick={() => {
                          setTempEmail(userEmail);
                          setIsEditingEmail(true);
                        }}
                        className="text-[10px] underline ml-1 hover:text-black cursor-pointer"
                        title="Edit calendar email"
                      >
                        edit
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="text-[11px] font-semibold text-[#62625b] hover:text-[#000000] bg-[#f6f6f3] border border-[#dadad3] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>+ Link Calendar Email</span>
                    </button>
                  )}
                </div>
                {isEditingEmail && (
                  <form onSubmit={handleSaveUserEmail} className="flex items-center gap-2 mt-2">
                    <input
                      type="email"
                      placeholder="your.email@gmail.com"
                      value={tempEmail}
                      onChange={(e) => setTempEmail(e.target.value)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-[#dadad3] bg-[#fbfbf9] focus:outline-none focus:border-black"
                    />
                    <button
                      type="submit"
                      className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#103c25] text-white cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(false)}
                      className="text-xs px-2 text-[#62625b] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                )}
                <p className="text-xs text-[#62625b] mt-0.5">
                  Auto-detects invites with 1-click context preload & recorder launch.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                id="add-custom-meeting-btn"
                onClick={() => setShowAddMeetingModal(true)}
                className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-[#103c25] hover:bg-[#0b2919] text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Meeting</span>
              </button>
              <button
                id="refresh-calendar-events-btn"
                onClick={() => fetchUpcomingMeetings()}
                className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-[#f6f6f3] hover:bg-[#e5e5e0] text-[#33332e] border border-[#dadad3] transition flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-[#103c25]" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {preloadedNotice && (
            <div className="bg-[#c7f0da] border border-[#a3e6c2] text-[#103c25] px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between">
              <span>{preloadedNotice}</span>
              <button onClick={() => setPreloadedNotice(null)} className="cursor-pointer font-bold ml-2">×</button>
            </div>
          )}

          {upcomingMeetings.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#62625b]">
              No upcoming Google Meet invites detected. Click &ldquo;+ Add Meeting&rdquo; or sync via Google Calendar webhook.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {upcomingMeetings.map((meet) => (
                <div
                  key={meet.id}
                  className="bg-[#fbfbf9] border border-[#dadad3] hover:border-[#000000] transition rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#e60023] uppercase tracking-wider">
                        Google Meet
                      </span>
                      <span className="text-[11px] font-medium text-[#62625b]">
                        {new Date(meet.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-[#000000] line-clamp-1">
                      {meet.title}
                    </h4>
                    {meet.description && (
                      <p className="text-xs text-[#62625b] line-clamp-2">
                        {meet.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-1 border-t border-[#dadad3]/60">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#62625b]">
                      <Users className="w-3 h-3 text-[#62625b] shrink-0" />
                      <span className="truncate">{meet.attendees.join(", ")}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleJoinAndRecord(meet)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#e60023] hover:bg-[#cc001f] text-white text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer shadow-sm"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join & Preload MoM</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meet.id)}
                        title="Dismiss / Delete meeting"
                        className="p-2 text-[#62625b] hover:text-[#e60023] hover:bg-[#fee2e2] rounded-xl border border-[#dadad3] transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Meeting Modal */}
          {showAddMeetingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-3xl border border-[#dadad3] p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#dadad3] pb-3">
                  <h3 className="font-bold text-base text-[#000000] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#e60023]" />
                    Add / Sync Google Meet
                  </h3>
                  <button
                    onClick={() => setShowAddMeetingModal(false)}
                    className="text-[#62625b] hover:text-[#000000] p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateMeeting} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#33332e] mb-1">
                      Meeting Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Meet at 10:30"
                      value={newMeetingTitle}
                      onChange={(e) => setNewMeetingTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#dadad3] bg-[#fbfbf9] focus:outline-none focus:border-[#000000]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#33332e] mb-1">
                      Google Meet URL *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="https://meet.google.com/xxx-yyyy-zzz"
                      value={newMeetingUrl}
                      onChange={(e) => setNewMeetingUrl(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#dadad3] bg-[#fbfbf9] focus:outline-none focus:border-[#000000]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#33332e] mb-1">
                      Attendees (Comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="name@example.com, colleague@example.com"
                      value={newMeetingAttendees}
                      onChange={(e) => setNewMeetingAttendees(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#dadad3] bg-[#fbfbf9] focus:outline-none focus:border-[#000000]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#33332e] mb-1">
                      Description / Agenda
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Brief context or topics to preload"
                      value={newMeetingDesc}
                      onChange={(e) => setNewMeetingDesc(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#dadad3] bg-[#fbfbf9] focus:outline-none focus:border-[#000000]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#dadad3]">
                    <button
                      type="button"
                      onClick={() => setShowAddMeetingModal(false)}
                      className="text-xs font-semibold px-4 py-2 rounded-xl text-[#62625b] hover:bg-[#f6f6f3]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingMeeting}
                      className="text-xs font-bold px-4 py-2 rounded-xl bg-[#e60023] hover:bg-[#cc001f] text-white shadow-sm disabled:opacity-50"
                    >
                      {isSubmittingMeeting ? "Adding..." : "Add to Sync"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Hero Recording Studio Card (Pinterest Style: 32px Radius, White Canvas, Hairline) */}
        <div className="bg-white border border-[#dadad3] rounded-[32px] p-6 sm:p-10 space-y-6 shadow-sm no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#000000]">
                  Meeting Audio Recorder
                </h2>
                {isRecording && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fee2e2] text-[#cc001f] border border-[#fecaca] animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-[#e60023]"></span>
                    {isPaused ? "PAUSED" : "RECORDING"}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#62625b] mt-1">
                Records Google Meet tab audio and your microphone simultaneously into a lightweight Opus stream.
              </p>
            </div>

            {/* Timer Display */}
            <div className="flex items-center gap-3">
              <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl px-6 py-2.5 flex items-center gap-3">
                <Clock className="w-4 h-4 text-[#e60023]" />
                <span className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-[#000000]">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>

          {/* Live Audio Input Level Bar */}
          {isRecording && (
            <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#62625b] font-medium">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#e60023]" />
                  Audio Level Meter
                </span>
                <span className="font-mono font-bold text-[#000000]">{audioLevel}%</span>
              </div>
              <div className="w-full bg-[#dadad3] rounded-full h-2.5 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-75 bg-[#e60023]"
                  style={{ width: `${Math.max(5, audioLevel)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Recording Controls (Pinterest Red CTA) */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!isRecording ? (
              <button
                id="start-recording-btn"
                onClick={startRecording}
                disabled={isProcessing}
                className="flex items-center gap-2.5 bg-[#e60023] hover:bg-[#cc001f] disabled:opacity-50 text-white font-bold px-7 py-3.5 rounded-2xl shadow-sm transition cursor-pointer text-sm"
              >
                <Mic className="w-5 h-5" />
                <span>Record Google Meet Tab + Mic</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="stop-recording-btn"
                  onClick={handleStopAndGenerate}
                  className="flex items-center gap-2 bg-[#000000] hover:bg-[#262622] text-white font-bold px-7 py-3.5 rounded-2xl shadow-sm transition cursor-pointer text-sm animate-pulse"
                >
                  <Square className="w-4 h-4 fill-current text-[#e60023]" />
                  <span>Stop & Generate MoM</span>
                </button>

                {isPaused ? (
                  <button
                    id="resume-recording-btn"
                    onClick={resumeRecording}
                    className="flex items-center gap-2 bg-[#e5e5e0] hover:bg-[#dadad3] text-[#000000] font-bold px-5 py-3.5 rounded-2xl transition cursor-pointer text-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    id="pause-recording-btn"
                    onClick={pauseRecording}
                    className="flex items-center gap-2 bg-[#e5e5e0] hover:bg-[#dadad3] text-[#000000] font-bold px-5 py-3.5 rounded-2xl transition cursor-pointer text-sm"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </button>
                )}
              </div>
            )}

            {recordedAudioUrl && !isRecording && (
              <button
                id="reset-recording-btn"
                onClick={resetRecording}
                className="flex items-center gap-1.5 text-xs text-[#62625b] hover:text-[#000000] px-3.5 py-2 rounded-2xl bg-[#f6f6f3] border border-[#dadad3] transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Audio Player for recorded audio preview */}
          {recordedAudioUrl && !isRecording && (
            <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-white border border-[#dadad3] text-[#e60023]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#000000]">
                    Meeting Audio Recorded
                  </p>
                  <p className="text-[11px] text-[#62625b]">
                    {recordedBlob
                      ? `${(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB • ${formatTime(duration)}`
                      : "Audio stream ready"}
                  </p>
                </div>
              </div>
              <audio
                id="recorded-audio-player"
                src={recordedAudioUrl}
                controls
                className="w-full sm:w-64 h-9 rounded-lg"
              />
            </div>
          )}

          {/* Collapsible Meeting Context & Live Captions */}
          <div className="border-t border-[#dadad3] pt-4">
            <button
              id="toggle-advanced-inputs-btn"
              onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
              className="flex items-center gap-2 text-xs font-bold text-[#000000] hover:text-[#e60023] transition cursor-pointer"
            >
              <span>Meeting Context & Live Google Meet Captions (Optional)</span>
              {showAdvancedInputs ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAdvancedInputs && (
              <div className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#000000]">
                    Meeting Context / Attendees (Optional)
                  </label>
                  <input
                    id="meeting-context-input"
                    type="text"
                    value={meetingContext}
                    onChange={(e) => setMeetingContext(e.target.value)}
                    placeholder="e.g., Sprint Planning with Rahul, Priya, and Sneha for Q4 Roadmap"
                    className="w-full bg-[#f6f6f3] border border-[#dadad3] rounded-2xl px-4 py-2.5 text-xs text-[#000000] placeholder:text-[#91918c] focus:outline-none focus:border-[#000000]"
                    disabled={isRecording || isProcessing}
                  />
                  <p className="text-[11px] text-[#62625b]">
                    Helps Gemini disambiguate speaker names and agenda details.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#000000]">
                      Live Meet Captions Log (From Companion Chrome Extension)
                    </label>
                    <button
                      id="paste-captions-btn"
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setLiveCaptions(text);
                        } catch (e) {
                          console.warn("Could not read clipboard:", e);
                        }
                      }}
                      className="text-[11px] text-[#e60023] font-bold hover:underline"
                    >
                      Paste Captions
                    </button>
                  </div>
                  <textarea
                    id="live-captions-input"
                    rows={3}
                    value={liveCaptions}
                    onChange={(e) => setLiveCaptions(e.target.value)}
                    placeholder="Optional: Paste logs from the Google Meet MoM Chrome Extension to guarantee 100% exact speaker attribution..."
                    className="w-full bg-[#f6f6f3] border border-[#dadad3] rounded-2xl px-4 py-2.5 text-xs text-[#000000] placeholder:text-[#91918c] focus:outline-none focus:border-[#000000] font-mono"
                    disabled={isRecording || isProcessing}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Errors */}
          {(recorderError || apiError) && (
            <div
              id="error-banner"
              className="bg-[#fee2e2] border border-[#fecaca] text-[#9e0a0a] px-4 py-3.5 rounded-2xl text-xs sm:text-sm flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-[#e60023] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Notice</p>
                <p>{recorderError || apiError}</p>
              </div>
            </div>
          )}

          {/* AI Generating Animation Card */}
          {isProcessing && (
            <div
              id="processing-card"
              className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#e60023] animate-spin" />
                <div>
                  <h4 className="text-sm font-bold text-[#000000]">
                    Generating Minutes of Meeting
                  </h4>
                  <p className="text-xs text-[#62625b]">
                    Analyzing audio tracks, identifying speakers, and extracting action items...
                  </p>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                {[
                  { step: 1, label: "Saving Audio Stream" },
                  { step: 2, label: "Gemini File API Upload" },
                  { step: 3, label: "Speech & Speaker Analysis" },
                  { step: 4, label: "Synthesizing MoM JSON" },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-3 rounded-2xl border text-xs font-bold transition ${
                      processingStep >= s.step
                        ? "bg-white border-[#000000] text-[#000000]"
                        : "bg-[#f6f6f3] border-[#dadad3] text-[#91918c]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {processingStep > s.step ? (
                        <Check className="w-3.5 h-3.5 text-[#103c25]" />
                      ) : processingStep === s.step ? (
                        <Loader2 className="w-3.5 h-3.5 text-[#e60023] animate-spin" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-[#dadad3] flex items-center justify-center text-[10px]">
                          {s.step}
                        </span>
                      )}
                      <span>{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Minutes of Meeting (MoM) Output Dashboard (Pinterest Magazine Style) */}
        {momResult && (
          <div id="mom-results-dashboard" className="space-y-6">
            <div className="bg-white border border-[#dadad3] rounded-[32px] p-6 sm:p-10 space-y-6 shadow-sm">
              {/* Header & Export Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#dadad3] pb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-[#c7f0da] text-[#103c25]">
                      Minutes of Meeting Ready
                    </span>
                    <span className="text-xs text-[#62625b]">
                      {momResult.date}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#000000]">
                    {momResult.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 no-print">
                  <button
                    id="email-mom-btn"
                    onClick={handleEmailMoM}
                    className="flex items-center gap-2 bg-[#103c25] hover:bg-[#0b2818] text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email MoM</span>
                  </button>

                  <button
                    id="copy-markdown-btn"
                    onClick={handleCopyMarkdown}
                    className="flex items-center gap-2 bg-[#e5e5e0] hover:bg-[#dadad3] text-[#000000] px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-[#103c25]" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#62625b]" />
                    )}
                    <span>{copied ? "Copied!" : "Copy Markdown"}</span>
                  </button>

                  <button
                    id="download-markdown-btn"
                    onClick={handleDownloadMarkdown}
                    className="flex items-center gap-2 bg-[#e60023] hover:bg-[#cc001f] text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .md</span>
                  </button>

                  <button
                    id="print-pdf-btn"
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-[#e5e5e0] hover:bg-[#dadad3] text-[#000000] px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#62625b]" />
                    <span>Print / PDF</span>
                  </button>
                </div>
              </div>

              {/* Stat Metric Tiles (Pinterest Cream Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 space-y-1">
                  <p className="text-[11px] font-bold text-[#62625b] uppercase tracking-wider">
                    Duration
                  </p>
                  <p className="text-2xl font-bold text-[#000000]">
                    {Math.ceil(momResult.durationSeconds / 60)} mins
                  </p>
                </div>
                <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 space-y-1">
                  <p className="text-[11px] font-bold text-[#62625b] uppercase tracking-wider">
                    Participants
                  </p>
                  <p className="text-2xl font-bold text-[#e60023]">
                    {momResult.participants?.length || 0}
                  </p>
                </div>
                <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 space-y-1">
                  <p className="text-[11px] font-bold text-[#62625b] uppercase tracking-wider">
                    Action Items
                  </p>
                  <p className="text-2xl font-bold text-[#000000]">
                    {momResult.actionItems?.length || 0}
                  </p>
                </div>
                <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 space-y-1">
                  <p className="text-[11px] font-bold text-[#62625b] uppercase tracking-wider">
                    Decisions Logged
                  </p>
                  <p className="text-2xl font-bold text-[#103c25]">
                    {momResult.decisionsMade?.length || 0}
                  </p>
                </div>
              </div>

              {/* Filter Chips / Navigation Tabs (Pinterest Pill Filter Chips) */}
              <div className="flex border-b border-[#dadad3] pb-4 gap-2 overflow-x-auto no-print">
                {[
                  { id: "overview", label: "Executive Summary" },
                  { id: "actions", label: `Action Items (${momResult.actionItems?.length || 0})` },
                  { id: "topics", label: `Key Discussion Topics (${momResult.discussionTopics?.length || 0})` },
                  { id: "transcript", label: `Full Transcript (${momResult.transcript?.length || 0})` },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`tab-${tab.id}`}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`btn-pill-filter px-4 py-2 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "bg-[#000000] text-white"
                          : "bg-[#f6f6f3] text-[#000000] hover:bg-[#e5e5e0]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Executive Summary & Overview */}
              {activeTab === "overview" && (
                <div className="space-y-8 pt-2">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#62625b]">
                        Executive Summary
                      </h3>
                      <p className="text-[#33332e] text-sm sm:text-base leading-relaxed bg-[#f6f6f3] p-6 rounded-2xl border border-[#dadad3]">
                        {momResult.executiveSummary}
                      </p>
                    </div>

                    <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-6 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#62625b]">
                        <Users className="w-4 h-4 text-[#e60023]" />
                        <span>Identified Attendees</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {momResult.participants?.map((p, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full text-xs bg-white border border-[#dadad3] text-[#000000] font-bold shadow-xs"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Concrete Decisions Made */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#103c25]">
                      Concrete Decisions Made
                    </h3>
                    {momResult.decisionsMade && momResult.decisionsMade.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {momResult.decisionsMade.map((decision, idx) => (
                          <div
                            key={idx}
                            className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 flex items-start gap-3"
                          >
                            <span className="w-5 h-5 rounded-full bg-[#c7f0da] text-[#103c25] flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold">
                              ✓
                            </span>
                            <span className="text-xs sm:text-sm text-[#000000] leading-normal font-medium">
                              {decision}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#62625b] italic">
                        No explicit decisions recorded in this session.
                      </p>
                    )}
                  </div>

                  {/* Open Questions & Follow-ups */}
                  {momResult.openQuestions && momResult.openQuestions.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#b45309] flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Open Questions & Follow-ups</span>
                      </h3>
                      <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-5 space-y-2">
                        {momResult.openQuestions.map((q, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#33332e]">
                            <span className="text-[#e60023] font-bold">•</span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Action Items Table */}
              {activeTab === "actions" && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#91918c] absolute left-3.5 top-3.5" />
                      <input
                        id="action-search-input"
                        type="text"
                        value={actionSearch}
                        onChange={(e) => setActionSearch(e.target.value)}
                        placeholder="Search tasks or owners..."
                        className="w-full bg-[#f6f6f3] border border-[#dadad3] rounded-full pl-9 pr-4 py-2.5 text-xs text-[#000000] placeholder:text-[#91918c] focus:outline-none focus:border-[#000000]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {["ALL", "High", "Medium", "Low"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setActionPriorityFilter(p)}
                          className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition cursor-pointer border ${
                            actionPriorityFilter === p
                              ? "bg-[#000000] border-[#000000] text-white"
                              : "bg-[#f6f6f3] border-[#dadad3] text-[#62625b] hover:text-[#000000]"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border border-[#dadad3] rounded-2xl overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-[#f6f6f3] text-[#62625b] border-b border-[#dadad3] font-bold">
                          <tr>
                            <th className="py-3.5 px-4 w-12 text-center">Done</th>
                            <th className="py-3.5 px-4">Task Description</th>
                            <th className="py-3.5 px-4">Owner</th>
                            <th className="py-3.5 px-4">Deadline</th>
                            <th className="py-3.5 px-4">Priority</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dadad3]">
                          {filteredActionItems.map((item, idx) => {
                            const isHigh = item.priority === "High";
                            const isMed = item.priority === "Medium";
                            return (
                              <tr
                                key={idx}
                                className={`hover:bg-[#f6f6f3]/60 transition ${
                                  item.completed ? "opacity-50 bg-[#f6f6f3]/30" : ""
                                }`}
                              >
                                <td className="py-3.5 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!item.completed}
                                    onChange={() => handleToggleActionItem(idx)}
                                    className="w-4 h-4 rounded text-[#e60023] focus:ring-[#e60023] border-[#dadad3] cursor-pointer"
                                  />
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`text-[#000000] font-medium ${
                                      item.completed ? "line-through text-[#91918c]" : ""
                                    }`}
                                  >
                                    {item.task}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-[#f6f6f3] border border-[#dadad3] font-bold text-[#000000]">
                                    <Users className="w-3 h-3 text-[#62625b]" />
                                    {item.owner}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-[#62625b] text-xs font-medium">
                                  {item.deadline}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`px-3 py-0.5 rounded-full text-xs font-bold border ${
                                      isHigh
                                        ? "bg-[#fee2e2] text-[#cc001f] border-[#fecaca]"
                                        : isMed
                                        ? "bg-[#fef3c7] text-[#b45309] border-[#fde68a]"
                                        : "bg-[#c7f0da] text-[#103c25] border-[#a7f3d0]"
                                    }`}
                                  >
                                    {item.priority}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Key Discussion Topics */}
              {activeTab === "topics" && (
                <div className="space-y-4 pt-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    {momResult.discussionTopics?.map((topic, idx) => (
                      <div
                        key={idx}
                        className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-6 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#000000] text-white font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-[#000000] text-base">
                            {topic.topic}
                          </h4>
                        </div>
                        <p className="text-xs sm:text-sm text-[#33332e] leading-relaxed">
                          {topic.summary}
                        </p>
                        <div className="border-t border-[#dadad3] pt-3 space-y-1.5">
                          <p className="text-[11px] font-bold text-[#62625b] uppercase tracking-wider">
                            Key Details
                          </p>
                          <ul className="space-y-1 text-xs text-[#33332e]">
                            {topic.keyPoints?.map((pt, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-[#e60023] font-bold">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 4: Full Transcript */}
              {activeTab === "transcript" && (
                <div className="space-y-4 pt-2">
                  <div className="relative no-print">
                    <Search className="w-4 h-4 text-[#91918c] absolute left-3.5 top-3.5" />
                    <input
                      id="transcript-search-input"
                      type="text"
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      placeholder="Search spoken dialogue or speaker name..."
                      className="w-full bg-[#f6f6f3] border border-[#dadad3] rounded-full pl-9 pr-4 py-2.5 text-xs text-[#000000] placeholder:text-[#91918c] focus:outline-none focus:border-[#000000]"
                    />
                  </div>

                  <div className="bg-[#f6f6f3] border border-[#dadad3] rounded-2xl p-4 sm:p-6 max-h-[500px] overflow-y-auto space-y-3">
                    {filteredTranscript.length > 0 ? (
                      filteredTranscript.map((seg, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-[#dadad3] rounded-2xl p-3.5 text-xs sm:text-sm space-y-1 shadow-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#000000] px-2.5 py-0.5 rounded-full bg-[#f6f6f3] border border-[#dadad3] text-xs">
                              {seg.speaker}
                            </span>
                            <span className="font-mono text-[11px] text-[#62625b]">
                              [{seg.timestamp}]
                            </span>
                          </div>
                          <p className="text-[#33332e] leading-relaxed pl-1">
                            {seg.text}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#62625b] text-center py-8">
                        No transcript segments match your search query.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Saved Meetings Slide-over Drawer (Pinterest Clean Canvas) */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="bg-white border-l border-[#dadad3] w-full max-w-md h-full flex flex-col p-6 space-y-5 shadow-xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-[#dadad3] pb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#e60023]" />
                <h3 className="font-bold text-lg text-[#000000]">Saved Meetings</h3>
              </div>
              <button
                id="close-history-drawer-btn"
                onClick={() => setShowHistoryDrawer(false)}
                className="text-[#62625b] hover:text-[#000000] p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#62625b]">
              Meetings saved locally in your browser&apos;s IndexedDB.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {savedMeetings.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <Clock className="w-8 h-8 text-[#91918c] mx-auto" />
                  <p className="text-xs text-[#62625b]">
                    No saved meetings yet. Record a call or load the demo to begin!
                  </p>
                </div>
              ) : (
                savedMeetings.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSavedMeeting(item)}
                    className="p-4 rounded-2xl bg-[#f6f6f3] border border-[#dadad3] hover:border-[#000000] transition cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-[#000000] group-hover:text-[#e60023] transition line-clamp-1">
                        {item.title}
                      </h4>
                      <button
                        onClick={(e) => handleDeleteSavedMeeting(item.id, e)}
                        className="text-[#91918c] hover:text-[#cc001f] p-1 transition"
                        title="Delete meeting"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#62625b] font-mono">
                      <span>{item.date}</span>
                      <span>•</span>
                      <span>{Math.ceil(item.durationSeconds / 60)} mins</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#dadad3] bg-white py-6 text-center text-xs text-[#62625b] no-print mt-auto">
        <p>
          Google Meet MoM • Dual-Stream Audio Capture • Inspired by Pinterest Design System
        </p>
      </footer>
    </main>
  );
}
