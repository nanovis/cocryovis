import ReactDOM from "react-dom/client";
import Main from "@/components/Main";

window.addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Backspace" || event.key === "Tab") {
      event.stopImmediatePropagation();
    }
  },
  true
);
window.addEventListener(
  "keyup",
  function (event) {
    if (event.key === "Backspace" || event.key === "Tab") {
      event.stopImmediatePropagation();
    }
  },
  true
);

const root = ReactDOM.createRoot(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  document.getElementById("root")!
);

root.render(<Main />);
