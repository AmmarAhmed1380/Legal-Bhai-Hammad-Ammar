import { useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const WEB_APP_URL = "https://64.235.61.6.sslip.io/";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasError, setHasError] = useState(false);

  const injectedJavaScript = useMemo(
    () => `
      (function () {
        var existing = document.querySelector('meta[name="viewport"]');
        if (!existing) {
          existing = document.createElement('meta');
          existing.name = 'viewport';
          document.head.appendChild(existing);
        }
        existing.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
      })();
      true;
    `,
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" translucent />
      {hasError ? (
        <View style={styles.fallback}>
          <Text style={styles.title}>Legal Bhai</Text>
          <Text style={styles.message}>Unable to load the live app right now.</Text>
        </View>
      ) : null}
      <WebView
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        startInLoadingState
        originWhitelist={["https://*"]}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
        onLoadStart={() => {
          setHasError(false);
          setIsLoading(true);
        }}
        onLoadEnd={() => {
          setIsLoading(false);
          setIsInitialLoad(false);
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
          setIsInitialLoad(false);
        }}
      />
      {isInitialLoad && isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#0f6e56" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f7f3",
  },
  webview: {
    flex: 1,
    backgroundColor: "#f8f7f3",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248, 247, 243, 0.72)",
  },
  fallback: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 24,
    zIndex: 2,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,110,86,0.12)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a19",
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: "#4a4a48",
  },
});
