// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

const root = document.getElementById("app");
if (!root) {
  // Fail loudly: a missing mount point would otherwise be a blank page with no error.
  throw new Error("#app is missing from the document shell: the client cannot mount");
}
mount(() => <StartClient />, root);
