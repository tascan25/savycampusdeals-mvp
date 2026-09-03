import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { apiToggleSaveOffer } from "@/api/offers";
import { useSaveOfferToggle } from "@/hooks/useSaveOfferToggle";
import { cancelSavedOfferReminder } from "@/services/localNotifications";
import type { Offer } from "@/types/offer";

jest.mock("@/api/offers", () => ({ apiToggleSaveOffer: jest.fn() }));
jest.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "student-1" } }),
}));
jest.mock("@/services/localNotifications", () => ({
  cancelSavedOfferReminder: jest.fn(() => Promise.resolve()),
}));

const offer = { id: "offer-1" } as Offer;
const mockedToggle = jest.mocked(apiToggleSaveOffer);
const mockedCancelReminder = jest.mocked(cancelSavedOfferReminder);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSaveOfferToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("confirms when an offer is saved", async () => {
    mockedToggle.mockResolvedValueOnce({ saved: true });
    const queryClient = new QueryClient();
    const { result, unmount } = await renderHook(() => useSaveOfferToggle(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.toggleSave(offer);
    });

    expect(result.current.feedback).toMatchObject({
      kind: "success",
      saved: true,
      title: "Offer saved",
    });
    expect(mockedCancelReminder).not.toHaveBeenCalled();
    unmount();
  });

  it("confirms removal and clears its reminder", async () => {
    mockedToggle.mockResolvedValueOnce({ saved: false });
    const queryClient = new QueryClient();
    const { result, unmount } = await renderHook(() => useSaveOfferToggle(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.toggleSave(offer);
    });

    expect(result.current.feedback).toMatchObject({
      kind: "success",
      saved: false,
      title: "Removed from saved offers",
    });
    expect(mockedCancelReminder).toHaveBeenCalledWith("student-1", "offer-1");
    unmount();
  });

  it("shows a failure message and leaves reminder state alone", async () => {
    mockedToggle.mockRejectedValueOnce(new Error("offline"));
    const queryClient = new QueryClient();
    const { result, unmount } = await renderHook(() => useSaveOfferToggle(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.toggleSave(offer);
    });

    expect(result.current.feedback).toMatchObject({
      kind: "error",
      title: "Couldn’t update saved offers",
    });
    expect(mockedCancelReminder).not.toHaveBeenCalled();
    unmount();
  });
});
