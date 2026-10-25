import { NextRequest, NextResponse } from "next/server";
import { UpcomingMeeting } from "@/lib/types";

// In-memory synced meetings store
let syncedMeetings: UpcomingMeeting[] = [];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (email) {
    const filtered = syncedMeetings.filter(
      (m) => m.accountEmail && m.accountEmail.toLowerCase() === email.toLowerCase()
    );
    return NextResponse.json({ meetings: filtered, total: filtered.length });
  }

  return NextResponse.json({ meetings: syncedMeetings, total: syncedMeetings.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.title || !body.meetUrl) {
      return NextResponse.json(
        { error: "Meeting title and meetUrl are required." },
        { status: 400 }
      );
    }

    const newMeeting: UpcomingMeeting = {
      id: body.id || `evt_${Date.now()}`,
      title: body.title,
      meetUrl: body.meetUrl,
      startTime: body.startTime || new Date().toISOString(),
      endTime: body.endTime || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      attendees: Array.isArray(body.attendees) ? body.attendees : (body.accountEmail ? [body.accountEmail] : []),
      description: body.description || "",
      accountEmail: body.accountEmail || "",
    };

    // Upsert meeting
    syncedMeetings = [
      newMeeting,
      ...syncedMeetings.filter((m) => m.id !== newMeeting.id),
    ];

    return NextResponse.json({
      success: true,
      message: "Meeting synced successfully",
      meeting: newMeeting,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid webhook payload", details: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    syncedMeetings = syncedMeetings.filter((m) => m.id !== id);
    return NextResponse.json({ success: true, remaining: syncedMeetings.length });
  }

  return NextResponse.json({ error: "id parameter required" }, { status: 400 });
}
