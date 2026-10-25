Google Meet MoM (Minutes of Meeting) AI Agent — Complete Technical Blueprint & Implementation Guide
An end-to-end architectural specification and implementation guide for building a zero-infrastructure-cost meeting capture and processing system using Next.js and the Google Gemini API (@google/genai).
1. Project Overview & Core Objective
Build a full-stack Google Meet Minutes of Meeting (MoM) Web Application that captures live Google Meet audio (both remote participants and local microphone) at $0 extra infrastructure cost, processes the recording natively using the Google Gemini API (@google/genai), and generates a structured, actionable Minutes of Meeting report with full transcript, key decisions, and assigned action items.
Key Constraints & Design Principles
Zero Paid Third-Party Bot APIs: Do not use paid meeting bot APIs (like Recall.ai) or paid external transcription APIs (like OpenAI Whisper or Deepgram).
Single AI Provider: Use only the user's Gemini API Key (gemini-2.5-flash) via the official @google/genai SDK. Gemini natively supports multimodal audio understanding up to several hours per file and structured JSON schema outputs.
100% Reliable Google Meet Capture: Capture audio directly from the Google Meet browser tab + the user's microphone using the browser's native navigator.mediaDevices.getDisplayMedia + getUserMedia + Web Audio API (AudioContext mixer). This avoids Google Meet's headless browser anti-bot CAPTCHAs and waiting-room blocks while recording both sides of the conversation cleanly.
Optional Live Speaker Attribution Extension: Include a lightweight companion Chrome Extension (Manifest V3) that scrapes Google Meet's live closed captions (CC) in real time and sends speaker-tagged caption logs to the web app to enrich Gemini's audio understanding with exact participant names.
2. Tech Stack Specification
Layer
Technology
Version / Package
Purpose
Framework
Next.js (App Router)
next@^15.0.0 (TypeScript)
Full-stack React framework & API routes
Styling & UI
Tailwind CSS + Lucide Icons
tailwindcss, lucide-react
Responsive dashboard, recording controls, MoM viewer
Audio Capture
Browser Web Audio API
Native AudioContext, MediaRecorder
Multiplexing Google Meet tab audio + local mic into .webm
AI SDK
Google Gen AI SDK
@google/genai
Uploading audio via File API & generating structured JSON MoM
Local Storage / DB
IndexedDB / Prisma + SQLite
idb-keyval or prisma
Persisting past meetings, audio blobs, and generated MoMs locally
Export Utilities
Markdown / PDF Export
Native Blob download / window.print()
One-click export of MoM to .md, Google Docs, or PDF

3. System Architecture & End-to-End Data Flow
Audio Capture & Mixing (Client-Side):
User opens the MoM Web App alongside their Google Meet tab and clicks "Start Meeting Recording".
The app calls navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) (user selects the Google Meet tab with "Share tab audio" checked).
Simultaneously, the app calls navigator.mediaDevices.getUserMedia({ audio: true }) to capture the user's own microphone.
A Web Audio AudioContext merges both audio tracks into a single MediaStreamAudioDestinationNode so both the user and remote meeting participants are recorded on one unified audio track.
MediaRecorder encodes the mixed audio stream using audio/webm;codecs=opus at 32–64 kbps (keeping a 1-hour meeting under ~20 MB).
Upload & Multimodal Processing (Server-Side API Route):
When the meeting ends, the user clicks "Stop & Generate MoM".
The client sends the recorded .webm audio file (and optional live caption log) via FormData to POST /api/generate-mom.
The server saves the temporary file to /tmp, uploads it to Gemini's File API via ai.files.upload(), waits until the file state is ACTIVE, and invokes ai.models.generateContent() using gemini-2.5-flash with responseMimeType: "application/json" and a strict responseSchema.
Once complete, the server deletes the temporary file from /tmp and from the Gemini File API (ai.files.delete()), returning the structured MoM JSON to the frontend.
Review, Edit & Export (Dashboard):
The frontend renders the Executive Summary, Participants, Key Discussion Points, Decisions Made, Action Items table (Task, Owner, Priority, Due Date), and Timestamped Transcript.
Users can copy as Markdown, download as a .md file, or save to local history.
4. Target Directory Structure
google-meet-mom-agent/

├── .env.local                        # Contains GEMINI_API_KEY=your_key_here

├── package.json

├── tsconfig.json

├── src/

│   ├── app/

│   │   ├── layout.tsx                # Root layout & font configuration

│   │   ├── page.tsx                  # Main Meeting Recorder & MoM Dashboard UI

│   │   └── api/

│   │       └── generate-mom/

│   │           └── route.ts          # Next.js API route calling @google/genai

│   ├── hooks/

│   │   └── useMeetRecorder.ts        # Custom hook mixing Google Meet tab + Mic audio

│   ├── lib/

│   │   ├── types.ts                  # TypeScript interfaces for MoM & Transcript

│   │   └── markdownExporter.ts       # Formats MoM JSON into clean Markdown

└── chrome-extension/                 # Optional companion extension for Meet CC speaker names

    ├── manifest.json

    └── content.js
5. Step-by-Step Implementation Guide
Step 1: Initialize Project & Install Dependencies
npx create-next-app@latest google-meet-mom-agent --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd google-meet-mom-agent

npm install @google/genai lucide-react

Create .env.local in the project root:v
GEMINI_API_KEY=your_actual_gemini_api_key_here

### Step 2: Define Data Models (`src/lib/types.ts`)

```typescript

export interface ActionItem {

  task: string;

  owner: string;

  deadline: string;

  priority: "High" | "Medium" | "Low";

}

export interface DiscussionTopic {

  topic: string;

  summary: string;

  keyPoints: string[];

}

export interface TranscriptSegment {

  timestamp: string;

  speaker: string;

  text: string;

}

export interface MeetingMoM {

  id: string;

  title: string;

  date: string;

  durationSeconds: number;

  participants: string[];

  executiveSummary: string;

  discussionTopics: DiscussionTopic[];

  decisionsMade: string[];

  actionItems: ActionItem[];

  openQuestions: string[];

  transcript: TranscriptSegment[];

}
Step 3: Build the Google Meet + Mic Audio Mixer Hook (src/hooks/useMeetRecorder.ts)
This hook uses AudioContext to combine the Google Meet tab audio stream and the user's microphone stream into a single audio track, preventing any silent gaps when the local user speaks."use client";

import { useState, useRef, useCallback } from "react";

export function useMeetRecorder() {

  const [isRecording, setIsRecording] = useState(false);

  const [isPaused, setIsPaused] = useState(false);

  const [duration, setDuration] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  const streamsRef = useRef<MediaStream[]>([]);

  const chunksRef = useRef<Blob[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupStreams = useCallback(() => {

    if (timerRef.current) clearInterval(timerRef.current);

    streamsRef.current.forEach((stream) =>

      stream.getTracks().forEach((track) => track.stop())

    );

    streamsRef.current = [];

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {

      audioContextRef.current.close();

    }

  }, []);

  const startRecording = useCallback(async () => {

    setError(null);

    chunksRef.current = [];

    try {

      // 1. Capture Google Meet Tab Audio (User selects the Meet tab and checks "Share tab audio")

      const displayStream = await navigator.mediaDevices.getDisplayMedia({

        video: true,

        audio: {

          echoCancellation: false,

          noiseSuppression: false,

          autoGainControl: false,

        },

      });

      const tabAudioTracks = displayStream.getAudioTracks();

      if (tabAudioTracks.length === 0) {

        displayStream.getTracks().forEach((t) => t.stop());

        throw new Error(

          'No tab audio detected! Please make sure "Also share tab audio" is checked when selecting your Google Meet tab.'

        );

      }

      // 2. Capture User's Local Microphone Audio

      let micStream: MediaStream | null = null;

      try {

        micStream = await navigator.mediaDevices.getUserMedia({

          audio: {

            echoCancellation: true,

            noiseSuppression: true,

            autoGainControl: true,

          },

          video: false,

        });

      } catch (micErr) {

        console.warn("Microphone access denied; recording tab audio only.", micErr);

      }

      streamsRef.current = micStream ? [displayStream, micStream] : [displayStream];

      // 3. Mix Tab Audio + Mic Audio via Web Audio API

      const audioContext = new AudioContext();

      audioContextRef.current = audioContext;

      const destination = audioContext.createMediaStreamDestination();

      const tabSource = audioContext.createMediaStreamSource(

        new MediaStream([tabAudioTracks[0]])

      );

      tabSource.connect(destination);

      if (micStream && micStream.getAudioTracks().length > 0) {

        const micSource = audioContext.createMediaStreamSource(micStream);

        micSource.connect(destination);

      }

      // 4. Record the mixed audio stream at an efficient bitrate

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")

        ? "audio/webm;codecs=opus"

        : "audio/webm";

      const recorder = new MediaRecorder(destination.stream, {

        mimeType,

        audioBitsPerSecond: 48000, // ~21 MB per hour of meeting audio

      });

      recorder.ondataavailable = (event) => {

        if (event.data && event.data.size > 0) {

          chunksRef.current.push(event.data);

        }

      };

      // Automatically stop recording if the user closes the shared Google Meet tab

      displayStream.getVideoTracks()[0].onended = () => {

        if (mediaRecorderRef.current?.state !== "inactive") {

          mediaRecorderRef.current?.stop();

        }

      };

      recorder.start(1000); // Collect 1-second chunks

      mediaRecorderRef.current = recorder;

      setIsRecording(true);

      setIsPaused(false);

      setDuration(0);

      timerRef.current = setInterval(() => {

        setDuration((prev) => prev + 1);

      }, 1000);

    } catch (err: any) {

      cleanupStreams();

      setError(err.message || "Failed to start recording.");

    }

  }, [cleanupStreams]);

  const stopRecording = useCallback((): Promise<Blob | null> => {

    return new Promise((resolve) => {

      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === "inactive") {

        cleanupStreams();

        setIsRecording(false);

        resolve(null);

        return;

      }

      recorder.onstop = () => {

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        cleanupStreams();

        setIsRecording(false);

        setIsPaused(false);

        resolve(audioBlob);

      };

      recorder.stop();

    });

  }, [cleanupStreams]);

  return {

    isRecording,

    isPaused,

    duration,

    error,

    startRecording,

    stopRecording,

  };

}
Step 4: Build the Gemini Multimodal MoM Backend Route (src/app/api/generate-mom/route.ts)
This API route receives the recorded .webm audio file, uploads it via the Gemini File API (which handles long meetings up to 2 GB cleanly), enforces a strict JSON schema for the MoM output, and cleans up the remote file afterward.import { NextRequest, NextResponse } from "next/server";

import { GoogleGenAI, Type, Schema } from "@google/genai";

import { writeFile, unlink } from "fs/promises";

import path from "path";

import os from "os";

export const maxDuration = 300; // Allow up to 5 minutes for long meeting processing

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const momResponseSchema: Schema = {

  type: Type.OBJECT,

  properties: {

    title: {

      type: Type.STRING,

      description: "Concise, descriptive title of the meeting inferred from the conversation.",

    },

    participants: {

      type: Type.ARRAY,

      items: { type: Type.STRING },

      description: "Names or roles of speakers identified in the meeting (e.g., 'Rahul (Host)', 'Priya', 'Speaker 1').",

    },

    executiveSummary: {

      type: Type.STRING,

      description: "High-level 3-5 sentence executive summary of the meeting's purpose and outcomes.",

    },

    discussionTopics: {

      type: Type.ARRAY,

      items: {

        type: Type.OBJECT,

        properties: {

          topic: { type: Type.STRING },

          summary: { type: Type.STRING },

          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },

        },

        required: ["topic", "summary", "keyPoints"],

      },

    },

    decisionsMade: {

      type: Type.ARRAY,

      items: { type: Type.STRING },

      description: "Concrete decisions or agreements reached during the meeting.",

    },

    actionItems: {

      type: Type.ARRAY,

      items: {

        type: Type.OBJECT,

        properties: {

          task: { type: Type.STRING },

          owner: { type: Type.STRING, description: "Person responsible, or 'Unassigned'" },

          deadline: { type: Type.STRING, description: "Mentioned due date or 'TBD'" },

          priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },

        },

        required: ["task", "owner", "deadline", "priority"],

      },

    },

    openQuestions: {

      type: Type.ARRAY,

      items: { type: Type.STRING },

      description: "Unresolved questions, blockers, or follow-up items needing future discussion.",

    },

    transcript: {

      type: Type.ARRAY,

      items: {

        type: Type.OBJECT,

        properties: {

          timestamp: { type: Type.STRING, description: "MM:SS format" },

          speaker: { type: Type.STRING },

          text: { type: Type.STRING },

        },

        required: ["timestamp", "speaker", "text"],

      },

    },

  },

  required: [

    "title",

    "participants",

    "executiveSummary",

    "discussionTopics",

    "decisionsMade",

    "actionItems",

    "openQuestions",

    "transcript",

  ],

};

export async function POST(req: NextRequest) {

  let tempFilePath: string | null = null;

  let uploadedFileName: string | null = null;

  try {

    const formData = await req.formData();

    const audioFile = formData.get("audio") as File | null;

    const meetingContext = (formData.get("context") as string) || "";

    const liveCaptions = (formData.get("captions") as string) || "";

    if (!audioFile) {

      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });

    }

    // 1. Write audio blob to system temp directory

    const bytes = await audioFile.arrayBuffer();

    const buffer = Buffer.from(bytes);

    tempFilePath = path.join(os.tmpdir(), `meet-${Date.now()}.webm`);

    await writeFile(tempFilePath, buffer);

    // 2. Upload audio to Gemini File API

    const uploadResult = await ai.files.upload({

      file: tempFilePath,

      mimeType: audioFile.type || "audio/webm",

    });

    uploadedFileName = uploadResult.name!;

    // 3. Poll until the audio file is ACTIVE

    let fileState = await ai.files.get({ name: uploadedFileName });

    while (fileState.state === "PROCESSING") {

      await new Promise((r) => setTimeout(r, 2000));

      fileState = await ai.files.get({ name: uploadedFileName });

    }

    if (fileState.state !== "ACTIVE") {

      throw new Error(`Audio processing failed on Gemini File API: ${fileState.state}`);

    }

    // 4. Prompt Gemini 2.5 Flash to generate the MoM + Transcript

    const systemPrompt = `You are an expert Executive Meeting Assistant.

Listen carefully to the attached Google Meet recording (which may include English, Hindi, Hinglish, or regional accents—translate and normalize everything into clear, professional English unless specific quotes require original terms).

${meetingContext ? `Additional Meeting Context / Attendees provided by user: ${meetingContext}` : ""}

${liveCaptions ? `Live Google Meet Captions (use these to accurately match speaker names): \n${liveCaptions}` : ""}

Produce a thorough, accurate Minutes of Meeting (MoM) following the exact JSON schema provided:

1. Identify all speakers by name whenever they introduce themselves or are addressed by others.

2. Summarize every major discussion topic with concrete figures, timelines, and context.

3. Extract all explicit decisions and assign every action item to its rightful owner with priority and deadline.

4. Provide a clean, chronological, timestamped transcript (MM:SS).`;

    const response = await ai.models.generateContent({

      model: "gemini-2.5-flash",

      contents: [

        {

          role: "user",

          parts: [

            {

              fileData: {

                fileUri: uploadResult.uri!,

                mimeType: uploadResult.mimeType!,

              },

            },

            { text: systemPrompt },

          ],

        },

      ],

      config: {

        responseMimeType: "application/json",

        responseSchema: momResponseSchema,

        temperature: 0.2,

      },

    });

    const momData = JSON.parse(response.text || "{}");

    return NextResponse.json(momData);

  } catch (error: any) {

    console.error("Error generating MoM:", error);

    return NextResponse.json(

      { error: error.message || "Failed to generate Minutes of Meeting." },

      { status: 500 }

    );

  } finally {

    // 5. Clean up local temp file & remote Gemini File API storage

    if (tempFilePath) {

      await unlink(tempFilePath).catch(() => {});

    }

    if (uploadedFileName) {

      await ai.files.delete({ name: uploadedFileName }).catch(() => {});

    }

  }

}
Step 5: Markdown Exporter Utility (src/lib/markdownExporter.ts)
import { MeetingMoM } from "./types";

export function formatMoMAsMarkdown(mom: MeetingMoM): string {

  const lines: string[] = [];

  lines.push(`# ${mom.title}`);

  lines.push(`**Date:** ${mom.date} | **Duration:** ${Math.ceil(mom.durationSeconds / 60)} mins`);

  lines.push(`**Participants:** ${mom.participants.join(", ") || "Not specified"}\n`);

  lines.push(`## Executive Summary`);

  lines.push(`${mom.executiveSummary}\n`);

  lines.push(`## Key Discussion Topics`);

  mom.discussionTopics.forEach((topic) => {

    lines.push(`### ${topic.topic}`);

    lines.push(`${topic.summary}`);

    topic.keyPoints.forEach((pt) => lines.push(`- ${pt}`));

    lines.push("");

  });

  lines.push(`## Decisions Made`);

  if (mom.decisionsMade.length === 0) {

    lines.push(`- No formal decisions recorded.`);

  } else {

    mom.decisionsMade.forEach((d) => lines.push(`- ${d}`));

  }

  lines.push("");

  lines.push(`## Action Items`);

  lines.push(`| Task | Owner | Deadline | Priority |`);

  lines.push(`| :--- | :--- | :--- | :--- |`);

  mom.actionItems.forEach((item) => {

    lines.push(`| ${item.task} | **${item.owner}** | ${item.deadline} | ${item.priority} |`);

  });

  lines.push("");

  if (mom.openQuestions.length > 0) {

    lines.push(`## Open Questions & Follow-ups`);

    mom.openQuestions.forEach((q) => lines.push(`- ${q}`));

    lines.push("");

  }

  lines.push(`## Full Transcript`);

  mom.transcript.forEach((seg) => {

    lines.push(`**[${seg.timestamp}] ${seg.speaker}:** ${seg.text}  `);

  });

  return lines.join("\n");

}
Step 6: Build the Frontend Recorder & MoM Dashboard (src/app/page.tsx)
"use client";

import React, { useState } from "react";

import { useMeetRecorder } from "@/hooks/useMeetRecorder";

import { MeetingMoM } from "@/lib/types";

import { formatMoMAsMarkdown } from "@/lib/markdownExporter";

import {

  Mic,

  Square,

  Loader2,

  Download,

  Copy,

  CheckCircle2,

  FileAudio,

  Users,

  CheckSquare,

  MessageSquare,

} from "lucide-react";

export default function MeetMoMDashboard() {

  const { isRecording, duration, error, startRecording, stopRecording } =

    useMeetRecorder();

  const [meetingContext, setMeetingContext] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  const [momResult, setMomResult] = useState<MeetingMoM | null>(null);

  const [copied, setCopied] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  const formatTime = (secs: number) => {

    const mins = Math.floor(secs / 60).toString().padStart(2, "0");

    const remSecs = (secs % 60).toString().padStart(2, "0");

    return `${mins}:${remSecs}`;

  };

  const handleStopAndGenerate = async () => {

    const audioBlob = await stopRecording();

    if (!audioBlob) return;

    await processAudioBlob(audioBlob, duration);

  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    await processAudioBlob(file, 0);

  };

  const processAudioBlob = async (blob: Blob, recordedDuration: number) => {

    setIsProcessing(true);

    setApiError(null);

    try {

      const formData = new FormData();

      formData.append("audio", blob, "meeting.webm");

      formData.append("context", meetingContext);

      const res = await fetch("/api/generate-mom", {

        method: "POST",

        body: formData,

      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to generate MoM");

      setMomResult({

        ...data,

        id: crypto.randomUUID(),

        date: new Date().toLocaleString(),

        durationSeconds: recordedDuration,

      });

    } catch (err: any) {

      setApiError(err.message);

    } finally {

      setIsProcessing(false);

    }

  };

  const handleCopyMarkdown = () => {

    if (!momResult) return;

    navigator.clipboard.writeText(formatMoMAsMarkdown(momResult));

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);

  };

  const handleDownloadMarkdown = () => {

    if (!momResult) return;

    const md = formatMoMAsMarkdown(momResult);

    const blob = new Blob([md], { type: "text/markdown" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `${momResult.title.toLowerCase().replace(/\s+/g, "-")}-mom.md`;

    a.click();

    URL.revokeObjectURL(url);

  };

  return (

    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">

      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">

          <div>

            <h1 className="text-3xl font-bold tracking-tight text-white">

              Google Meet MoM Agent

            </h1>

            <p className="text-slate-400 mt-1">

              Record your live Google Meet tab + mic and generate structured Minutes of Meeting with Gemini 2.5 Flash.

            </p>

          </div>

        </div>

        {/* Recorder Control Card */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">

          <div className="space-y-2">

            <label className="text-sm font-medium text-slate-300">

              Optional Context (Participant names, project name, or agenda)

            </label>

            <input

              type="text"

              value={meetingContext}

              onChange={(e) => setMeetingContext(e.target.value)}

              placeholder="e.g., Sprint Planning with Rahul, Priya, and Ankit for Q4 Mobile Launch"

              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"

              disabled={isRecording || isProcessing}

            />

          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">

            {!isRecording ? (

              <button

                onClick={startRecording}

                disabled={isProcessing}

                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl transition cursor-pointer"

              >

                <Mic className="w-5 h-5" />

                Join & Record Google Meet Tab

              </button>

            ) : (

              <button

                onClick={handleStopAndGenerate}

                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-medium px-6 py-3 rounded-xl transition animate-pulse cursor-pointer"

              >

                <Square className="w-5 h-5" />

                Stop & Generate MoM ({formatTime(duration)})

              </button>

            )}

            <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-5 py-3 rounded-xl transition cursor-pointer">

              <FileAudio className="w-5 h-5" />

              <span>Or Upload Recording</span>

              <input

                type="file"

                accept="audio/*,video/*"

                onChange={handleFileUpload}

                disabled={isRecording || isProcessing}

                className="hidden"

              />

            </label>

          </div>

          <p className="text-xs text-slate-400">

            Tip: When prompted by Chrome, select your active <strong>Google Meet tab</strong> and make sure <strong>&quot;Also share tab audio&quot;</strong> is switched on.

          </p>

          {(error || apiError) && (

            <div className="bg-rose-950/60 border border-rose-800 text-rose-200 px-4 py-3 rounded-xl text-sm">

              {error || apiError}

            </div>

          )}

          {isProcessing && (

            <div className="flex items-center gap-3 text-indigo-400 pt-2">

              <Loader2 className="w-5 h-5 animate-spin" />

              <span className="text-sm font-medium">

                Gemini is listening to the meeting audio and drafting your MoM...

              </span>

            </div>

          )}

        </div>

        {/* Generated MoM Output */}

        {momResult && (

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-8 shadow-xl">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">

              <div>

                <h2 className="text-2xl font-bold text-white">{momResult.title}</h2>

                <p className="text-sm text-slate-400 mt-1">{momResult.date}</p>

              </div>

              <div className="flex items-center gap-3">

                <button

                  onClick={handleCopyMarkdown}

                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"

                >

                  {copied ? (

                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />

                  ) : (

                    <Copy className="w-4 h-4" />

                  )}

                  {copied ? "Copied Markdown" : "Copy Markdown"}

                </button>

                <button

                  onClick={handleDownloadMarkdown}

                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"

                >

                  <Download className="w-4 h-4" />

                  Download .md

                </button>

              </div>

            </div>

            {/* Executive Summary & Participants */}

            <div className="grid md:grid-cols-3 gap-6">

              <div className="md:col-span-2 space-y-2">

                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">

                  Executive Summary

                </h3>

                <p className="text-slate-200 leading-relaxed">

                  {momResult.executiveSummary}

                </p>

              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">

                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-400">

                  <Users className="w-4 h-4" />

                  <span>Participants</span>

                </div>

                <ul className="text-sm text-slate-300 space-y-1">

                  {momResult.participants.map((p, idx) => (

                    <li key={idx}>• {p}</li>

                  ))}

                </ul>

              </div>

            </div>

            {/* Action Items Table */}

            <div className="space-y-3">

              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-400">

                <CheckSquare className="w-4 h-4" />

                <span>Action Items</span>

              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">

                <table className="w-full text-left text-sm">

                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">

                    <tr>

                      <th className="py-3 px-4">Task</th>

                      <th className="py-3 px-4">Owner</th>

                      <th className="py-3 px-4">Deadline</th>

                      <th className="py-3 px-4">Priority</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-800">

                    {momResult.actionItems.map((item, idx) => (

                      <tr key={idx} className="hover:bg-slate-800/40">

                        <td className="py-3 px-4 text-slate-200">{item.task}</td>

                        <td className="py-3 px-4 font-medium text-white">

                          {item.owner}

                        </td>

                        <td className="py-3 px-4 text-slate-400">{item.deadline}</td>

                        <td className="py-3 px-4">

                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">

                            {item.priority}

                          </span>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

            {/* Discussion Topics & Decisions */}

            <div className="grid md:grid-cols-2 gap-6">

              <div className="space-y-4">

                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">

                  Key Discussion Points

                </h3>

                {momResult.discussionTopics.map((topic, idx) => (

                  <div

                    key={idx}

                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2"

                  >

                    <h4 className="font-semibold text-white">{topic.topic}</h4>

                    <p className="text-xs text-slate-400">{topic.summary}</p>

                    <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">

                      {topic.keyPoints.map((pt, i) => (

                        <li key={i}>{pt}</li>

                      ))}

                    </ul>

                  </div>

                ))}

              </div>

              <div className="space-y-4">

                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">

                  Decisions Made

                </h3>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">

                  <ul className="space-y-2 text-sm text-slate-200">

                    {momResult.decisionsMade.map((decision, idx) => (

                      <li key={idx} className="flex items-start gap-2">

                        <span className="text-emerald-400">✓</span>

                        <span>{decision}</span>

                      </li>

                    ))}

                  </ul>

                </div>

              </div>

            </div>

            {/* Full Transcript */}

            <div className="space-y-3">

              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-400">

                <MessageSquare className="w-4 h-4" />

                <span>Full Timestamped Transcript</span>

              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-96 overflow-y-auto space-y-3 text-sm">

                {momResult.transcript.map((seg, idx) => (

                  <div key={idx} className="leading-relaxed">

                    <span className="text-xs font-mono text-slate-500 mr-2">

                      [{seg.timestamp}]

                    </span>

                    <span className="font-semibold text-indigo-300 mr-2">

                      {seg.speaker}:

                    </span>

                    <span className="text-slate-300">{seg.text}</span>

                  </div>

                ))}

              </div>

            </div>

          </div>

        )}

      </div>

    </main>

  );

}
6. Optional Upgrade: Companion Chrome Extension for Exact Speaker Names
If you want 100% exact speaker attribution without participants introducing themselves out loud, add a lightweight Chrome Extension (chrome-extension/) that observes Google Meet's live closed captions DOM and logs { speaker, text, timestamp } to localStorage or posts it to your local app.
chrome-extension/manifest.json
{

  "manifest_version": 3,

  "name": "Google Meet MoM Speaker Tracker",

  "version": "1.0",

  "description": "Captures live speaker names from Google Meet captions to enrich Gemini MoM generation.",

  "permissions": ["storage"],

  "content_scripts": [

    {

      "matches": ["https://meet.google.com/*"],

      "js": ["content.js"]

    }

  ]

}
7. Agent Verification Checklist
When the coding agent finishes implementing this specification, verify the following:

Run npm run build to ensure zero TypeScript or Next.js build errors.
Verify .env.local has a valid GEMINI_API_KEY.
Start the dev server (npm run dev), open http://localhost:3000, and test recording a Google Meet tab with "Also share tab audio" enabled.
Confirm that both local microphone speech and remote tab audio are captured in the resulting .webm blob and that /api/generate-mom returns valid JSON matching MeetingMoM.

