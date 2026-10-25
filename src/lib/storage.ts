import { get, set, del, keys } from "idb-keyval";
import { MeetingMoM, SavedMeeting } from "./types";

const MEETING_PREFIX = "gmeet_mom_";

export async function saveMeetingToStorage(
  mom: MeetingMoM,
  audioBlob?: Blob,
  context?: string
): Promise<SavedMeeting> {
  const saved: SavedMeeting = {
    id: mom.id,
    title: mom.title,
    date: mom.date,
    durationSeconds: mom.durationSeconds,
    mom,
    audioBlob,
    context,
    createdAt: Date.now(),
  };

  if (typeof window !== "undefined") {
    await set(`${MEETING_PREFIX}${mom.id}`, saved);
  }
  return saved;
}

export async function getAllSavedMeetings(): Promise<SavedMeeting[]> {
  if (typeof window === "undefined") return [];
  try {
    const allKeys = await keys();
    const meetingKeys = allKeys.filter(
      (k) => typeof k === "string" && k.startsWith(MEETING_PREFIX)
    );
    const meetings: SavedMeeting[] = [];
    for (const key of meetingKeys) {
      const item = (await get(key)) as SavedMeeting;
      if (item && item.id) {
        meetings.push(item);
      }
    }
    // Sort descending by creation date
    return meetings.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error("Failed to load saved meetings:", err);
    return [];
  }
}

export async function deleteSavedMeeting(id: string): Promise<void> {
  if (typeof window !== "undefined") {
    await del(`${MEETING_PREFIX}${id}`);
  }
}

export async function getSavedMeeting(id: string): Promise<SavedMeeting | undefined> {
  if (typeof window === "undefined") return undefined;
  return (await get(`${MEETING_PREFIX}${id}`)) as SavedMeeting | undefined;
}
