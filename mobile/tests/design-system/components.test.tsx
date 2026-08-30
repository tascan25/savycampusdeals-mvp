import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "@/design-system/components";

// This RNTL version's render() is async (backed by the new `test-renderer`
// package's async `act`) — it must be awaited, and the `screen` singleton
// export doesn't propagate through this project's Jest/Babel interop, so
// tests use the render() return value directly. See mobile/docs/testing.md.
describe("Button", () => {
  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Claim offer" onPress={onPress} />);

    fireEvent.press(getByRole("button", { name: "Claim offer" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress while disabled", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Claim offer" onPress={onPress} disabled />);

    fireEvent.press(getByRole("button", { name: "Claim offer" }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows a busy state while loading and blocks the press", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button label="Claim offer" onPress={onPress} loading />);

    const button = getByRole("button", { name: "Claim offer" });
    expect(button.props.accessibilityState.busy).toBe(true);
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
