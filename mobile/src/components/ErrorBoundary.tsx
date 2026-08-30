import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, Button, Screen } from "@/design-system/components";
import { space } from "@/design-system/tokens";
import { reportError } from "@/services/crashReporting";

type State = { error: Error | null };

/**
 * Catches render-time errors so a single broken screen doesn't take down the
 * whole app. Deliberately does not swallow the error silently — it reports
 * through the provider-independent crash-reporting abstraction (currently a
 * no-op logger; see docs/analytics.md once a provider is approved).
 */
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack ?? undefined });
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <Screen style={styles.container}>
          <View style={styles.content}>
            <AppText variant="h2">Something went wrong</AppText>
            <AppText variant="body" color="#A1A1AA" style={styles.message}>
              This screen hit an unexpected error. Your data is safe — try again.
            </AppText>
            <Button label="Try again" onPress={this.reset} />
          </View>
        </Screen>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { justifyContent: "center" },
  content: { paddingHorizontal: space.lg, gap: space.md },
  message: { marginBottom: space.sm },
});
