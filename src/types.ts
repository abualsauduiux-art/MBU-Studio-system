export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserPermissions {
  dashboard: boolean;
  clients: boolean;
  projects: boolean;
  tasks: boolean;
  messages: boolean;
  financials: boolean;
  team: boolean;
  settings: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  jobTitle?: string; // e.g., Graphic Designer, Content Creator
  password?: string; // Visible to admin only
  teamId?: string;
  photoURL?: string;
  createdAt: string;
  permissions?: UserPermissions;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  leaderId: string; // User UID
  members: string[]; // Array of User UIDs
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source?: string; // e.g., Facebook, Referral, Website
  service?: string; // Main service interested in
  status: 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'active' | 'inactive' | 'closed';
  address?: string;
  estimatedValue?: number;
  totalPrice?: number;
  paidAmount?: number;
  remainingAmount?: number;
  lastWhatsAppContact?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  teamMembers?: string[]; // Array of User UIDs
  name: string;
  serviceType: 'social_media' | 'ads' | 'seo' | 'design';
  budget: number;
  status: 'in_progress' | 'completed' | 'on_hold';
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  clientId?: string;
  assignedTo?: string[]; // Array of User UIDs
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  deadline?: string;
  reminderAt?: string;
  reminderNotified?: boolean;
  files?: string[]; // Array of file URLs
  commentsCount?: number;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  customNumber?: string;
  clientId: string;
  projectId?: string;
  amount: number;
  currency?: string;
  dueDate: string;
  status: 'paid' | 'unpaid' | 'partial';
  items: InvoiceItem[];
  notes?: string;
  createdAt: string;
}

export interface AgencySettings {
  id: string;
  name: string;
  logo?: string; // Base64 or URL
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxNumber?: string;
  currency?: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  category: 'ads' | 'salaries' | 'tools' | 'other';
  amount: number;
  description?: string;
  date: string;
  createdAt: string;
}
