export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
}

export interface App {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  platform?: string;
  bundleId?: string;
  emailFrom?: string;
  emailName?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  googleClientId?: string;
  firebaseProjectId?: string;
  firebaseClientEmail?: string;
  firebasePrivateKey?: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { tickets: number; feedbacks: number };
}

export interface Ticket {
  id: string;
  appId: string;
  userId: string;
  title: string;
  description: string;
  category?: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  slaDeadline?: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
  assignee?: { id: string; name: string; email?: string };
  app: { id: string; name: string };
  _count: { comments: number; attachments: number };
  comments?: Comment[];
  attachments?: Attachment[];
  history?: HistoryEntry[];
}

export interface Comment {
  id: string;
  ticketId: string;
  userId: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string };
}

export interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface UserDetail {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  googleId?: string;
  isBanned: boolean;
  lastActiveAt?: string;
  createdAt: string;
  _count: { tickets: number; feedbacks: number; comments?: number };
  recentTickets?: { id: string; title: string; status: string; priority: string; createdAt: string }[];
  recentFeedbacks?: { id: string; rating: number; category: string; comment?: string; createdAt: string }[];
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Analytics {
  overview: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    criticalOpen: number;
    slaBreached: number;
  };
  byApp: { appId: string; appName: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  recentTickets: Ticket[];
}
