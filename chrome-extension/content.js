// Google Meet MoM Caption & Speaker Tracker
(() => {
  console.log("[MoM Tracker] Extension loaded on Google Meet.");

  const captionsLog = [];
  let lastSpeaker = "Unknown Speaker";
  let lastText = "";

  // Helper to format timestamp MM:SS
  const getTimestamp = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  };

  // Add a small non-intrusive floating tracker badge to the Google Meet UI
  function injectTrackerWidget() {
    if (document.getElementById("gmeet-mom-tracker-badge")) return;

    const badge = document.createElement("div");
    badge.id = "gmeet-mom-tracker-badge";
    badge.style.position = "fixed";
    badge.style.bottom = "80px";
    badge.style.left = "20px";
    badge.style.zIndex = "9999";
    badge.style.background = "rgba(15, 23, 42, 0.9)";
    badge.style.border = "1px solid #3b82f6";
    badge.style.borderRadius = "8px";
    badge.style.padding = "8px 12px";
    badge.style.color = "#ffffff";
    badge.style.fontSize = "12px";
    badge.style.fontFamily = "sans-serif";
    badge.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    badge.style.display = "flex";
    badge.style.alignItems = "center";
    badge.style.gap = "8px";

    badge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>
      <span id="mom-tracker-status" style="font-weight:600;">MoM Agent: Active</span>
      <button id="mom-open-app-btn" style="background:#e60023;color:white;border:none;padding:4px 9px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold;">Launch MeetMoM</button>
      <button id="mom-copy-captions-btn" style="background:#334155;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Copy CC</button>
    `;

    document.body.appendChild(badge);

    const openAppBtn = document.getElementById("mom-open-app-btn");
    openAppBtn?.addEventListener("click", () => {
      const meetCode = window.location.pathname.replace("/", "");
      const meetUrl = window.location.href;
      window.open(`http://localhost:3001/?meetUrl=${encodeURIComponent(meetUrl)}&title=${encodeURIComponent("Google Meet: " + meetCode)}`, "_blank");
    });

    const copyBtn = document.getElementById("mom-copy-captions-btn");
    copyBtn?.addEventListener("click", () => {
      const formatted = captionsLog
        .map((entry) => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
        .join("\n");
      navigator.clipboard.writeText(formatted).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy CC";
        }, 2000);
      });
    });
  }

  // Observe Google Meet DOM for caption changes
  const observer = new MutationObserver((mutations) => {
    // In Google Meet, captions appear in containers with jscontroller / jsaction or aria-live
    const captionContainers = document.querySelectorAll(
      'div[jscontroller="M4K4Zd"], div[jscontroller="eIu7Db"], div[aria-live="polite"], div[jsname="YSxPC"]'
    );

    captionContainers.forEach((container) => {
      // Look for speaker name
      const speakerEl = container.querySelector(
        '.zs7s8d, [data-sender-name], div[jsname="r4nke"], .b8N75'
      );
      if (speakerEl && speakerEl.textContent) {
        lastSpeaker = speakerEl.textContent.trim();
      }

      // Look for caption text
      const textEl = container.querySelector(
        '.iTTPOb, div[jsname="tgaKEf"], span[jsname="V67aGc"]'
      );
      if (textEl && textEl.textContent) {
        const text = textEl.textContent.trim();
        if (text && text !== lastText) {
          lastText = text;
          const entry = {
            timestamp: getTimestamp(),
            speaker: lastSpeaker,
            text,
          };
          captionsLog.push(entry);

          // Keep in storage
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ gmeet_captions_log: captionsLog });
          }

          // Update widget count
          const statusEl = document.getElementById("mom-tracker-status");
          if (statusEl) {
            statusEl.textContent = `MoM Tracker: ${captionsLog.length} lines`;
          }
        }
      }
    });
  });

  // Start observing when ready
  const interval = setInterval(() => {
    if (document.body) {
      clearInterval(interval);
      injectTrackerWidget();
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }, 1000);
})();
