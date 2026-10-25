import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";

export const maxDuration = 300; // Allow up to 5 minutes for long meeting processing

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
      description: "High-level 3-5 sentence executive summary of the meeting's purpose, key topics, and outcomes.",
    },
    discussionTopics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: "Topic heading" },
          summary: { type: Type.STRING, description: "Detailed narrative summary of the discussion" },
          keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Bullet points detailing specific arguments, data, context, or decisions.",
          },
        },
        required: ["topic", "summary", "keyPoints"],
      },
      description: "Key discussion topics covered during the meeting.",
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
          task: { type: Type.STRING, description: "Actionable description of the work" },
          owner: { type: Type.STRING, description: "Person responsible, or 'Unassigned'" },
          deadline: { type: Type.STRING, description: "Mentioned due date or 'TBD'" },
          priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
        },
        required: ["task", "owner", "deadline", "priority"],
      },
      description: "Action items extracted from the conversation.",
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
          speaker: { type: Type.STRING, description: "Speaker name or attribution" },
          text: { type: Type.STRING, description: "What was said" },
        },
        required: ["timestamp", "speaker", "text"],
      },
      description: "Clean chronological timestamped transcript.",
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
  let aiClient: GoogleGenAI | null = null;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const meetingContext = (formData.get("context") as string) || "";
    const liveCaptions = (formData.get("captions") as string) || "";
    const clientApiKey =
      (formData.get("apiKey") as string) ||
      req.headers.get("x-gemini-api-key") ||
      "";

    const apiKey = clientApiKey.trim() || process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API Key is missing. Please configure GEMINI_API_KEY in your environment variables (e.g. Netlify / .env.local).",
        },
        { status: 400 }
      );
    }

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided in request." },
        { status: 400 }
      );
    }

    aiClient = new GoogleGenAI({ apiKey });

    // 1. Write audio blob to system temp directory
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const sanitizedExt = audioFile.name.endsWith(".webm")
      ? ".webm"
      : audioFile.name.endsWith(".mp4")
      ? ".mp4"
      : audioFile.name.endsWith(".wav")
      ? ".wav"
      : audioFile.name.endsWith(".m4a")
      ? ".m4a"
      : audioFile.name.endsWith(".mp3")
      ? ".mp3"
      : ".webm";

    tempFilePath = path.join(os.tmpdir(), `meet-${Date.now()}${sanitizedExt}`);
    await writeFile(tempFilePath, buffer);

    // 2. Upload audio to Gemini File API
    const uploadResult = await aiClient.files.upload({
      file: tempFilePath,
      config: {
        mimeType: audioFile.type || "audio/webm",
      },
    });

    uploadedFileName = uploadResult.name || null;

    // 3. Poll until the audio file is ACTIVE
    if (uploadedFileName) {
      let fileState = await aiClient.files.get({ name: uploadedFileName });
      let waitSeconds = 0;
      while (fileState.state === "PROCESSING" && waitSeconds < 120) {
        await new Promise((r) => setTimeout(r, 2000));
        waitSeconds += 2;
        fileState = await aiClient.files.get({ name: uploadedFileName });
      }

      if (fileState.state !== "ACTIVE") {
        throw new Error(
          `Audio processing on Gemini File API failed or timed out with state: ${fileState.state}`
        );
      }
    }

    // 4. Prompt Gemini 2.5 Flash to generate the MoM + Transcript
    const systemPrompt = `You are an expert Executive Meeting Assistant.
Listen carefully to the attached Google Meet recording (which may include English, Hindi, Hinglish, regional accents, or mixed conversational styles—translate and normalize everything into clear, professional English unless specific quotes or technical terms require original phrasing).

${meetingContext ? `Additional Meeting Context / Attendees provided by user:\n${meetingContext}\n` : ""}
${liveCaptions ? `Live Google Meet Captions log (use these to accurately match speaker names to audio):\n${liveCaptions}\n` : ""}

Produce an exhaustive, highly structured Minutes of Meeting (MoM) following the exact JSON schema provided:
1. Identify all speakers by name whenever they introduce themselves, are addressed by others, or can be distinguished.
2. Summarize every major discussion topic with concrete numbers, timelines, architecture decisions, and context.
3. Extract all explicit decisions made and assign every action item to its rightful owner with priority and realistic deadline.
4. Provide a clean, chronological, timestamped transcript (MM:SS) reflecting the conversation accurately without filler words.`;

    // Multi-model resilience cascade: prioritize latest multimodal flash models with fallbacks
    const candidateModels = [
      "gemini-3.5-flash",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
      "gemini-2.5-flash",
    ];

    let response = null;
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        response = await aiClient.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: uploadResult.uri!,
                    mimeType: uploadResult.mimeType || "audio/webm",
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
        if (response?.text) {
          break;
        }
      } catch (err: unknown) {
        lastError = err;
        console.warn(`Model ${model} failed, falling back to next model...`, err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Failed to generate content with available Gemini models.");
    }

    const rawText = response.text || "{}";
    let momData;
    try {
      momData = JSON.parse(rawText);
    } catch {
      // If wrapped in markdown code blocks
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      momData = JSON.parse(cleaned);
    }

    return NextResponse.json(momData);
  } catch (error: unknown) {
    console.error("Error generating MoM:", error);
    const message = error instanceof Error ? error.message : "Failed to generate Minutes of Meeting.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  } finally {
    // 5. Clean up local temp file & remote Gemini File API storage
    if (tempFilePath) {
      await unlink(tempFilePath).catch(() => {});
    }
    if (uploadedFileName && aiClient) {
      await aiClient.files.delete({ name: uploadedFileName }).catch(() => {});
    }
  }
}
