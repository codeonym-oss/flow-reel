import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./studio.css";
import { render } from "preact";
import { App } from "./app.tsx";
import { applyStoredTheme } from "./theme.ts";

applyStoredTheme();

render(<App />, document.getElementById("app")!);
