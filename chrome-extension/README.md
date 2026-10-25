# Google Meet MoM Speaker Tracker (Chrome Extension)

This optional lightweight companion extension captures Google Meet live closed captions and speaker names in real-time, providing exact speaker attribution to enrich Gemini's Minutes of Meeting generation.

## How to Install in Google Chrome:

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** ON (top right switch).
3. Click **Load unpacked** (top left).
4. Select the `chrome-extension/` directory inside this project folder (`gmeet-mom-agent/chrome-extension`).
5. Open any Google Meet call (`https://meet.google.com/...`) and ensure **Turn on captions (c)** is turned ON in Google Meet.
6. A subtle floating badge will appear in the bottom-left showing live captured caption count with a 1-click **Copy** button.
7. Paste any captured captions into the "Live Captions / Speaker Attribution Log" box in the MoM Web App to give Gemini exact participant names!
