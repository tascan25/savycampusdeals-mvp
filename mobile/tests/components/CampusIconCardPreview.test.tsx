import { render } from "@testing-library/react-native";

import { CampusIconCardPreview } from "@/components/CampusIconCardPreview";

describe("CampusIconCardPreview", () => {
  it("shows the current Campus Icon threshold in the website-style preview", async () => {
    const view = await render(<CampusIconCardPreview unlocked={false} threshold={12000} />);

    expect(view.getByText("12K")).toBeTruthy();
    expect(view.getByText("12,000 POINTS")).toBeTruthy();
    expect(view.getByText(/Reach 12,000 lifetime Savvy Points/)).toBeTruthy();
  });

  it("switches to the unlocked identity state", async () => {
    const view = await render(<CampusIconCardPreview unlocked threshold={12000} />);

    expect(view.getByText("UNLOCKED")).toBeTruthy();
    expect(view.getByText("ICON STATUS")).toBeTruthy();
  });
});
