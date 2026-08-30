export type AnnouncementCategory = "new" | "important" | "limited";

/** Mirrors serialize_announcement() as returned to a student/partner (with a receipt). */
export type Announcement = {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  audience: string;
  priority: number;
  cta_label: string;
  cta_url: string;
  image_url: string;
  published: boolean;
  status: "draft" | "scheduled" | "expired" | "active";
  starts_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  seen: boolean;
  seen_at: string | null;
  clicked: boolean;
};

/** Mirrors GET /api/announcements. */
export type AnnouncementsResponse = {
  items: Announcement[];
  unread_count: number;
  modal: Announcement | null;
};
