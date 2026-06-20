import { StatusBar } from "expo-status-bar";
import { ProductApp } from "./src/productApp";

export default function App() {
  if (process.env.EXPO_PUBLIC_ENABLE_DEMO_SURFACES === "true") {
    // production entry guard
  }

  // return <ProductApp />
  return (
    <>
      <StatusBar style="dark" />
      <ProductApp />
    </>
  );
}
