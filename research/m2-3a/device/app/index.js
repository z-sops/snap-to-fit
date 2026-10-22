import { registerRootComponent } from "expo";
import App from "./App";

// The device benchmark is a standalone Expo Go project. It has its own entry
// point, and it never touches the shipping application.
registerRootComponent(App);
