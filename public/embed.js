(function () {
  // Determine the URL of the widget based on where this script is loaded from
  const currentScript = document.currentScript;
  let widgetUrl = "https://chatbot-widjet-sona-star.vercel.app"; // Default to production URL

  if (currentScript && currentScript.src) {
    try {
      const scriptUrl = new URL(currentScript.src);
      // Only override if it's a valid http/https origin, this helps avoid issues with local files
      if (scriptUrl.origin.startsWith("http")) {
         widgetUrl = scriptUrl.origin;
      }
    } catch (e) {
      console.warn("Could not parse script origin", e);
    }
  }

  // Create the iframe
  const iframe = document.createElement("iframe");
  iframe.src = widgetUrl + "/widget";
  iframe.style.position = "fixed";
  iframe.style.bottom = "10px";
  iframe.style.right = "10px";
  iframe.style.width = "180px";
  iframe.style.height = "140px";
  iframe.style.border = "none";
  iframe.style.zIndex = "2147483647"; // Max z-index to stay on top
  iframe.style.background = "transparent";
  iframe.style.colorScheme = "normal"; // Prevent dark mode overrides
  iframe.allow = "microphone"; // For voice features if any

  document.body.appendChild(iframe);

  // Listen for messages from the iframe
  window.addEventListener("message", (event) => {
    // Make sure the message is coming from our widget
    if (event.origin !== widgetUrl) return;

    const data = event.data;

    if (data && data.type === "CHATBOT_STATE_CHANGE") {
      if (data.isOpen) {
        // When open, expand the iframe
        if (window.innerWidth <= 450) {
           // Mobile size
           iframe.style.width = "100vw";
           iframe.style.height = "100vh";
           iframe.style.bottom = "0";
           iframe.style.right = "0";
        } else {
           // Desktop size
           iframe.style.width = "430px";
           iframe.style.height = "670px";
           iframe.style.bottom = "10px";
           iframe.style.right = "10px";
        }
      } else {
        // When closed, shrink back to button size (with extra padding for tooltip)
        iframe.style.width = "180px";
        iframe.style.height = "140px";
        iframe.style.bottom = "10px";
        iframe.style.right = "10px";
      }
    }
  });

  // Handle window resizing to adjust mobile view if open
  window.addEventListener("resize", () => {
    // If it's larger than 180px, it means it's open
    if (iframe.style.width !== "180px") {
      if (window.innerWidth <= 450) {
        iframe.style.width = "100vw";
        iframe.style.height = "100vh";
        iframe.style.bottom = "0";
        iframe.style.right = "0";
      } else {
        iframe.style.width = "430px";
        iframe.style.height = "670px";
        iframe.style.bottom = "10px";
        iframe.style.right = "10px";
      }
    }
  });
})();
