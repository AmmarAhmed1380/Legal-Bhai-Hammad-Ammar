import { StatusBar } from "expo-status-bar";
import { ProductApp } from "./src/productApp";

const demoSurfacesEnabled = process.env.EXPO_PUBLIC_ENABLE_DEMO_SURFACES === "true";

export default function App() {
  if (demoSurfacesEnabled) {
    return <ProductApp />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <ProductApp />
    </>
  );
}
