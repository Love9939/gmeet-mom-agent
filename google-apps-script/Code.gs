/**
 * Google Apps Script Automation for Google Calendar & Gmail Sync
 * Automatically detects Google Meet invites from Google Calendar & Gmail,
 * syncs them to MeetMoM, and can auto-email finished MoMs to attendees.
 *
 * Setup:
 * 1. Open https://script.google.com while signed in to your Google account
 * 2. Click "New Project" and paste this code into Code.gs
 * 3. Replace MEETMOM_WEBHOOK_URL with your Netlify or ngrok URL (e.g., https://your-app.netlify.app/api/calendar/webhook)
 * 4. Replace USER_EMAIL with your Gmail address
 * 5. Run `setupCalendarTrigger()` once to authorize and start the 10-minute automated sync!
 */

const MEETMOM_WEBHOOK_URL = "https://your-domain.netlify.app/api/calendar/webhook"; // Change to your deployed app URL
const USER_EMAIL = "your-email@gmail.com"; // Set to your Gmail address

/**
 * Sync upcoming Google Meet events from your Google Calendar for today & tomorrow
 */
function syncUpcomingMeetings() {
  const now = new Date();
  const twoDaysLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const calendar = CalendarApp.getDefaultCalendar();
  const events = calendar.getEvents(now, twoDaysLater);

  Logger.log(`Found ${events.length} events in calendar.`);

  events.forEach((event) => {
    const description = event.getDescription() || "";
    const location = event.getLocation() || "";

    // Extract Google Meet link (looks for meet.google.com/xxx-yyyy-zzz)
    const meetMatch = (location + " " + description).match(
      /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i
    );

    if (meetMatch) {
      const meetUrl = meetMatch[0];
      const attendees = event
        .getGuestList()
        .map((guest) => guest.getEmail())
        .concat([USER_EMAIL]);

      const payload = {
        id: event.getId(),
        title: event.getTitle() || "Google Meet Sync",
        meetUrl: meetUrl,
        startTime: event.getStartTime().toISOString(),
        endTime: event.getEndTime().toISOString(),
        attendees: attendees,
        description: description.replace(/<[^>]*>/g, "").slice(0, 300),
        accountEmail: USER_EMAIL,
      };

      try {
        const options = {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        };

        const response = UrlFetchApp.fetch(MEETMOM_WEBHOOK_URL, options);
        Logger.log(`Synced meeting: ${payload.title} -> Status: ${response.getResponseCode()}`);
      } catch (err) {
        Logger.log(`Failed to push to webhook: ${err.message}`);
      }
    }
  });
}

/**
 * Run this function once in script.google.com to install the automated 10-minute cron trigger
 */
function setupCalendarTrigger() {
  // Delete existing triggers to prevent duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  // Run sync every 10 minutes automatically in the background
  ScriptApp.newTrigger("syncUpcomingMeetings")
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log("Automated 10-minute calendar sync trigger created successfully!");
  syncUpcomingMeetings();
}

/**
 * Webhook receiver to send MoM emails directly via Google Apps Script
 * Deployed as a Web App in Google Apps Script
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const recipients = data.recipients.join(", ");
    const subject = `[MoM] Minutes of Meeting: ${data.title}`;
    const body = data.bodyText;
    const htmlBody = data.htmlBody;

    GmailApp.sendEmail(recipients, subject, body, {
      htmlBody: htmlBody,
      name: "MeetMoM Agent",
    });

    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", sentTo: recipients })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
