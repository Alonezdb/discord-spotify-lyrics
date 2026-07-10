# Discord Spotify Lyrics Sync

[![Discord Spotify Lyrics Sync Demo](https://img.youtube.com/vi/_gRKmXKPrsU/maxresdefault.jpg)](https://youtu.be/_gRKmXKPrsU)

A Spicetify extension that syncs Spotify's active song lyrics to your Discord custom status in real-time.

Unlike standalone desktop scripts, this extension runs directly inside the Spotify client using Spicetify. This means it doesn't poll external Web APIs, doesn't require developer API keys, and has direct access to Spotify's internal player state and synced lyrics.

---

## Features

* **Real-time Lyrics Syncing:** Seamlessly displays the current lyrics line in your Discord status as the song plays.
* **Intelligent Rate Limit Backoff:** Respects Discord API rate limits and automatically backs off/throttles when required to keep your account safe.
* **Custom Idle Animation:** Configurable list of custom statuses (e.g. rotating emojis like `🕺 Chilling...`) when Spotify is paused or idle.
* **Fully Customizable:** Easily change the status prefix (default: `🎶 `), intervals, and status text via a built-in UI modal.
* **First-Load Prompt:** Automatically prompts you to enter your Discord token on the first run.

<img width="1086" height="769" alt="image" src="https://github.com/user-attachments/assets/97b52e92-de30-436a-a44f-b49be28458f4" />

---

## Prerequisites

1. **Spotify Desktop Client** (Official Windows/macOS/Linux client, not the Windows Store version).
2. **Spicetify CLI** installed and set up. If you don't have Spicetify yet, follow the [Spicetify Installation Guide](https://spicetify.app/docs/getting-started).

---

## Installation

### 1. Copy the Extension File

Copy `discord-spotify-lyrics.js` to your Spicetify `Extensions` folder:

* **Windows (PowerShell):**
  ```powershell
  Copy-Item -Path "discord-spotify-lyrics.js" -Destination "$env:APPDATA\spicetify\Extensions\"
  ```
  *(Alternatively, open Explorer and navigate to `%appdata%\spicetify\Extensions\`)*

* **macOS / Linux (Terminal):**
  ```bash
  cp discord-spotify-lyrics.js ~/.config/spicetify/Extensions/
  ```

### 2. Enable & Apply

Activate the extension in your Spicetify configuration and restart the Spotify client:

```bash
spicetify config extensions discord-spotify-lyrics.js
spicetify apply
```

---

## Configuration

1. When you launch Spotify for the first time after installing, a settings popup will appear requesting your **Discord Token**.
2. To modify settings later, click on your **Profile Menu** in Spotify and choose **Discord Status Sync**.
3. You can configure:
   * **Discord Token:** Your personal Discord authorization token.
   * **Status Prefix:** A custom string added before the lyrics (e.g., `🎶 ` or `🎧 `).
   * **Idle Emojis (comma-separated):** A sequence of statuses to cycle through when paused/idle.
   * **Idle Interval (seconds):** How long each idle status is displayed.

---

## How to Get Your Discord Token

> [!WARNING]
> Your Discord token is essentially your account password. Never share it, paste it into untrusted websites, or send it to anyone.

1. Open Discord in your web browser (Chrome, Firefox, or Edge) and log in.
2. Press `F12` (or `Ctrl+Shift+I` on Windows / `Cmd+Opt+I` on Mac) to open the browser's developer tools.
3. Select the **Console** tab.
4. Paste the following script and press `Enter` to display your token:
   ```javascript
   (webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let[_,x]of Object.entries(e.c))m.push(x.exports)}]),m).find(m=>m?.default?.getToken!==void-0).default.getToken()
   ```
5. Copy the outputted token and paste it into the Spicetify extension settings.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
