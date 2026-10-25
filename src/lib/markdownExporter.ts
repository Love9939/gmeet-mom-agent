import { MeetingMoM } from "./types";

export function formatMoMAsMarkdown(mom: MeetingMoM): string {
  const lines: string[] = [];

  lines.push(`# ${mom.title}`);
  lines.push("");
  lines.push(
    `**Date:** ${mom.date} | **Duration:** ${Math.ceil(mom.durationSeconds / 60)} mins | **Generated with:** Gemini AI`
  );
  lines.push(
    `**Participants:** ${mom.participants && mom.participants.length > 0 ? mom.participants.join(", ") : "Not specified"}`
  );
  lines.push("");

  lines.push(`## 📌 Executive Summary`);
  lines.push("");
  lines.push(`${mom.executiveSummary}`);
  lines.push("");

  lines.push(`## 💬 Key Discussion Topics`);
  lines.push("");
  if (mom.discussionTopics && mom.discussionTopics.length > 0) {
    mom.discussionTopics.forEach((topic, idx) => {
      lines.push(`### ${idx + 1}. ${topic.topic}`);
      lines.push("");
      lines.push(`${topic.summary}`);
      lines.push("");
      if (topic.keyPoints && topic.keyPoints.length > 0) {
        topic.keyPoints.forEach((pt) => lines.push(`- ${pt}`));
        lines.push("");
      }
    });
  } else {
    lines.push(`- No structured discussion topics recorded.`);
    lines.push("");
  }

  lines.push(`## ✅ Decisions Made`);
  lines.push("");
  if (mom.decisionsMade && mom.decisionsMade.length > 0) {
    mom.decisionsMade.forEach((d) => lines.push(`- ${d}`));
  } else {
    lines.push(`- No formal decisions recorded.`);
  }
  lines.push("");

  lines.push(`## 🎯 Action Items`);
  lines.push("");
  if (mom.actionItems && mom.actionItems.length > 0) {
    lines.push(`| Status | Task | Owner | Deadline | Priority |`);
    lines.push(`| :---: | :--- | :--- | :--- | :--- |`);
    mom.actionItems.forEach((item) => {
      const status = item.completed ? "[x]" : "[ ]";
      lines.push(
        `| ${status} | ${item.task} | **${item.owner}** | ${item.deadline} | ${item.priority} |`
      );
    });
  } else {
    lines.push(`- No pending action items identified.`);
  }
  lines.push("");

  if (mom.openQuestions && mom.openQuestions.length > 0) {
    lines.push(`## ❓ Open Questions & Follow-ups`);
    lines.push("");
    mom.openQuestions.forEach((q) => lines.push(`- ${q}`));
    lines.push("");
  }

  lines.push(`## 📝 Full Timestamped Transcript`);
  lines.push("");
  if (mom.transcript && mom.transcript.length > 0) {
    mom.transcript.forEach((seg) => {
      lines.push(`**[${seg.timestamp}] ${seg.speaker}:** ${seg.text}  `);
    });
  } else {
    lines.push(`_Transcript not available._`);
  }
  lines.push("");

  return lines.join("\n");
}
