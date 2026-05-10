import { useStore } from "./src/store";

// This is a scratch script to reset the active view
const resetView = () => {
  const { setActiveView } = useStore.getState();
  setActiveView("home");
  console.log("View reset to home.");
};

resetView();
