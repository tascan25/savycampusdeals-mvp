import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { toApiError } from "@/api/errors";
import { apiToggleSaveOffer } from "@/api/offers";
import { queryKeys } from "@/api/queryKeys";
import { useAuth } from "@/providers/AuthProvider";
import { cancelSavedOfferReminder } from "@/services/localNotifications";
import type { Offer } from "@/types/offer";

type SaveOfferSuccessFeedback = {
  id: number;
  kind: "success";
  saved: boolean;
  title: string;
  message: string;
};

type SaveOfferErrorFeedback = {
  id: number;
  kind: "error";
  title: string;
  message: string;
};

export type SaveOfferFeedbackState = SaveOfferSuccessFeedback | SaveOfferErrorFeedback | null;

type SaveOfferFeedbackInput =
  Omit<SaveOfferSuccessFeedback, "id"> | Omit<SaveOfferErrorFeedback, "id">;

export function useSaveOfferToggle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<SaveOfferFeedbackState>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackId = useRef(0);
  const pendingOfferIds = useRef(new Set<string>());

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const showFeedback = useCallback((next: SaveOfferFeedbackInput) => {
    const id = ++feedbackId.current;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setFeedback({ ...next, id } as NonNullable<SaveOfferFeedbackState>);
    hideTimer.current = setTimeout(() => {
      setFeedback((current) => (current?.id === id ? null : current));
    }, 3_500);
  }, []);

  const toggleSave = useCallback(
    async (offer: Offer): Promise<{ saved: boolean } | null> => {
      if (pendingOfferIds.current.has(offer.id)) return null;
      pendingOfferIds.current.add(offer.id);

      try {
        const result = await apiToggleSaveOffer(offer.id);
        showFeedback(
          result.saved
            ? {
                kind: "success",
                saved: true,
                title: "Offer saved",
                message: "You’ll find it in Saved Offers.",
              }
            : {
                kind: "success",
                saved: false,
                title: "Removed from saved offers",
                message: "This offer is no longer in your shortlist.",
              },
        );

        if (!result.saved && user) {
          void cancelSavedOfferReminder(user.id, offer.id).catch(() => undefined);
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.offers.all() });
        return result;
      } catch (error) {
        const apiError = toApiError(error);
        showFeedback({
          kind: "error",
          title: "Couldn’t update saved offers",
          message: apiError.message || "Please try again.",
        });
        return null;
      } finally {
        pendingOfferIds.current.delete(offer.id);
      }
    },
    [queryClient, showFeedback, user],
  );

  return { feedback, toggleSave };
}
