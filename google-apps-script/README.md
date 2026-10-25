# Google Meet Calendar & Gmail Automation

This folder contains the automated bridge between your Google Account and your **MeetMoM** agent.

---

### What it does:
1. **Auto-Detects Meetings:** Whenever an invite or calendar event with a Google Meet link (`meet.google.com/...`) appears in your Google Calendar, it automatically syncs to your MeetMoM dashboard.
2. **1-Click Preload & Launch:** In the dashboard, click **"Join & Preload MoM"** to open the Google Meet tab and automatically populate the context and agenda.
3. **Auto-Email Minutes of Meeting:** Click **"Email MoM"** on any generated meeting report to draft and send the minutes and action items to all attendees directly from your email account.

---

### Quick Setup (Takes 2 Minutes)

1. Open [script.google.com](https://script.google.com) in your browser.
2. Click **"+ New Project"**.
3. Copy the entire contents of `Code.gs` and paste it into the editor.
4. Update `MEETMOM_WEBHOOK_URL` with your local tunnel or deployed URL:
   - For local development with ngrok: `https://<your-ngrok-id>.ngrok-free.app/api/calendar/webhook`
   - For production (Netlify / Vercel): `https://<your-app>.netlify.app/api/calendar/webhook`
5. Set `USER_EMAIL` to your Gmail address.
6. In the top dropdown, select **`setupCalendarTrigger`** and click **Run**.
7. Grant the Google Calendar & Gmail permissions when prompted.

**Done!** Google Apps Script will now automatically check your Google Calendar every 10 minutes and sync any new meetings directly to your MeetMoM application.
