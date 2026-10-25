export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  completed?: boolean;
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

export interface SavedMeeting {
  id: string;
  title: string;
  date: string;
  durationSeconds: number;
  mom: MeetingMoM;
  audioBlob?: Blob;
  context?: string;
  createdAt: number;
}

export interface UpcomingMeeting {
  id: string;
  title: string;
  meetUrl: string;
  startTime: string;
  endTime?: string;
  attendees: string[];
  description?: string;
  accountEmail: string;
}

