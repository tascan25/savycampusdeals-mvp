import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import {
  apiListAnnouncements,
  apiMarkAnnouncementClicked,
  apiMarkAnnouncementSeen,
} from "@/api/announcements";
import { queryKeys } from "@/api/queryKeys";
import { AnnouncementCentreModal } from "@/components/AnnouncementCentreModal";
import { AnnouncementSpotlightModal } from "@/components/AnnouncementSpotlightModal";
import { useAppLock } from "@/providers/AppLockProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { Announcement, AnnouncementsResponse } from "@/types/announcement";
import { resolveCtaRoute } from "@/utils/announcementRoute";

type AnnouncementContextValue = {
  items: Announcement[];
  unreadCount: number;
  openCentre: () => void;
};

const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

export function AnnouncementProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { locked } = useAppLock();
  const router = useRouter();
  const queryClient = useQueryClient();
  const enabled = Boolean(user) && ["student", "outlet_partner"].includes(user?.role ?? "");

  const query = useQuery({
    queryKey: queryKeys.announcements.list(),
    queryFn: apiListAnnouncements,
    enabled,
    staleTime: 30_000,
  });

  const handledIds = useRef<Set<string>>(new Set());
  const [spotlight, setSpotlight] = useState<Announcement | null>(null);
  const [centreOpen, setCentreOpen] = useState(false);

  useEffect(() => {
    const modalAnnouncement = query.data?.modal;
    if (!modalAnnouncement || handledIds.current.has(modalAnnouncement.id)) return;
    handledIds.current.add(modalAnnouncement.id);

    setSpotlight(modalAnnouncement);
    apiMarkAnnouncementSeen(modalAnnouncement.id)
      .then(() => {
        queryClient.setQueryData<AnnouncementsResponse>(
          queryKeys.announcements.list(),
          (current) => {
            if (!current) return current;
            const items = current.items.map((item) =>
              item.id === modalAnnouncement.id ? { ...item, seen: true } : item,
            );
            return {
              ...current,
              items,
              modal: null,
              unread_count: items.filter((i) => !i.seen).length,
            };
          },
        );
      })
      .catch(() => undefined);
  }, [query.data?.modal, queryClient]);

  const followCta = useCallback(
    async (announcement: Announcement) => {
      await apiMarkAnnouncementClicked(announcement.id).catch(() => undefined);
      setSpotlight(null);
      setCentreOpen(false);
      const route = resolveCtaRoute(announcement.cta_url, user?.role);
      if ("external" in route) {
        await Linking.openURL(route.external).catch(() => undefined);
      } else {
        router.push(
          route.params
            ? ({ pathname: route.push, params: route.params } as never)
            : (route.push as never),
        );
      }
    },
    [router, user?.role],
  );

  const value = useMemo<AnnouncementContextValue>(
    () => ({
      items: query.data?.items ?? [],
      unreadCount: query.data?.unread_count ?? 0,
      openCentre: () => setCentreOpen(true),
    }),
    [query.data],
  );

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
      <AnnouncementSpotlightModal
        announcement={locked ? null : spotlight}
        onCta={() => spotlight && followCta(spotlight)}
        onViewAll={() => {
          setSpotlight(null);
          setCentreOpen(true);
        }}
        onClose={() => setSpotlight(null)}
      />
      <AnnouncementCentreModal
        visible={centreOpen && !locked}
        items={value.items}
        onCta={followCta}
        onClose={() => setCentreOpen(false)}
      />
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncements(): AnnouncementContextValue {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) throw new Error("useAnnouncements must be used within AnnouncementProvider");
  return ctx;
}
