(function init() {
    if (typeof Spicetify === 'undefined' || !Spicetify.Player || !Spicetify.React || !Spicetify.ReactDOM) {
        setTimeout(init, 100);
        return;
    }
    main();
})();

function main() {
    if (!localStorage.getItem("discord_status_prefix")) {
        localStorage.setItem("discord_status_prefix", "🎶 ");
    }
    if (!localStorage.getItem("discord_min_interval")) {
        localStorage.setItem("discord_min_interval", "3.0");
    }
    if (!localStorage.getItem("discord_idle_interval")) {
        localStorage.setItem("discord_idle_interval", "15.0");
    }
    if (!localStorage.getItem("discord_idle_frames")) {
        const defaultFrames = ["🕺 Chilling...", "💃 Chilling...", "🕴️ Chilling..."];
        localStorage.setItem("discord_idle_frames", JSON.stringify(defaultFrames));
        localStorage.setItem("discord_idle_frames_raw", defaultFrames.join(", "));
    }

    let currentTrackId = null;
    let lyricsList = [];
    let lastStatusText = undefined;
    let rateLimitUntil = 0;
    let lastDiscordUpdateTime = 0;
    let lastIdleUpdateTime = 0;
    let idleFrameIndex = 0;
    let updateInterval = null;

    function parseLRC(lrcText) {
        if (!lrcText) return [];
        const lines = lrcText.split("\n");
        const lyrics = [];
        const timeReg = /\[(\d+):(\d+)(?:\.(\d+))?\]/;
        
        for (const line of lines) {
            const match = timeReg.exec(line);
            if (match) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                let milliseconds = 0;
                if (match[3]) {
                    const msStr = match[3];
                    if (msStr.length === 1) {
                        milliseconds = parseInt(msStr, 10) * 100;
                    } else if (msStr.length === 2) {
                        milliseconds = parseInt(msStr, 10) * 10;
                    } else {
                        milliseconds = parseInt(msStr.slice(0, 3), 10);
                    }
                }
                const timeMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
                const text = line.replace(timeReg, "").trim();
                
                if (text || line.replace(timeReg, "").length > 0) {
                    lyrics.push({ time: timeMs, text });
                }
            }
        }
        return lyrics.sort((a, b) => a.time - b.time);
    }

    async function setDiscordStatus(text) {
        const token = localStorage.getItem("discord_token");
        if (!token) return;

        const currentTime = Date.now();
        if (currentTime < rateLimitUntil) return;
        if (text === lastStatusText) return;

        const url = "https://discord.com/api/v9/users/@me/settings";
        const headers = {
            "Authorization": token,
            "Content-Type": "application/json"
        };

        const payload = text === null 
            ? { custom_status: null }
            : { custom_status: { text: text, expires_at: null } };

        try {
            const response = await fetch(url, {
                method: "PATCH",
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (response.status === 200) {
                lastStatusText = text;
            } else if (response.status === 429) {
                const data = await response.json();
                const retryAfter = (data.retry_after || 5) * 1000;
                rateLimitUntil = Date.now() + retryAfter;
            } else if (response.status === 401 || response.status === 403) {
                rateLimitUntil = Date.now() + 60000;
            }
        } catch (e) {
            console.error("Discord Status Sync Error:", e);
        }
    }

    function handleIdleState() {
        const idleFramesRaw = localStorage.getItem("discord_idle_frames");
        let idleFrames = [];
        try {
            idleFrames = JSON.parse(idleFramesRaw || "[]");
        } catch (e) {
            idleFrames = [];
        }

        if (idleFrames.length > 0) {
            const desiredStatus = idleFrames[idleFrameIndex];
            const idleInterval = parseFloat(localStorage.getItem("discord_idle_interval") || "15.0") * 1000;
            const timeSinceLastIdle = Date.now() - lastIdleUpdateTime;
            const justBecameIdle = !idleFrames.includes(lastStatusText);

            if (justBecameIdle || (timeSinceLastIdle >= idleInterval)) {
                setDiscordStatus(desiredStatus).then(() => {
                    idleFrameIndex = (idleFrameIndex + 1) % idleFrames.length;
                });
                lastIdleUpdateTime = Date.now();
                lastDiscordUpdateTime = Date.now();
            }
        } else {
            if (lastStatusText !== null) {
                setDiscordStatus(null);
                lastDiscordUpdateTime = Date.now();
            }
        }
    }

    function tick() {
        const isPlaying = Spicetify.Player.isPlaying();
        const progressMs = Spicetify.Player.getProgress();

        if (isPlaying) {
            let currentLyric = "";
            if (lyricsList.length > 0) {
                for (const line of lyricsList) {
                    if (line.time <= progressMs) {
                        currentLyric = line.text;
                    } else {
                        break;
                    }
                }
            }

            const prefix = localStorage.getItem("discord_status_prefix") || "🎶 ";
            let desiredStatus = currentLyric ? `${prefix}${currentLyric}` : null;
            if (desiredStatus && desiredStatus.length > 128) {
                desiredStatus = desiredStatus.slice(0, 125) + "...";
            }

            const minInterval = parseFloat(localStorage.getItem("discord_min_interval") || "3.0") * 1000;
            const timeSinceLastUpdate = Date.now() - lastDiscordUpdateTime;
            const isClearing = (desiredStatus === null);

            if (desiredStatus !== lastStatusText) {
                if (isClearing || (timeSinceLastUpdate >= minInterval)) {
                    setDiscordStatus(desiredStatus);
                    lastDiscordUpdateTime = Date.now();
                }
            }
        } else {
            handleIdleState();
        }
    }

    Spicetify.Player.addEventListener("songchange", async () => {
        const item = Spicetify.Player.data?.item;
        if (!item) {
            currentTrackId = null;
            lyricsList = [];
            return;
        }

        const trackId = item.uri.split(":").pop();
        if (trackId === currentTrackId) return;

        currentTrackId = trackId;
        lyricsList = [];
        idleFrameIndex = 0;

        const trackName = item.name;
        const artistName = item.artists.map(a => a.name).join(", ");
        const albumName = item.album.name;
        const durationSec = Math.round((item.duration.milliseconds || item.duration) / 1000);

        try {
            const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artistName)}&track_name=${encodeURIComponent(trackName)}&album_name=${encodeURIComponent(albumName)}&duration=${durationSec}`;
            const response = await fetch(url);
            
            if (response.status === 200) {
                const data = await response.json();
                if (data.syncedLyrics) {
                    lyricsList = parseLRC(data.syncedLyrics);
                }
            } else if (response.status === 404) {
                const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(trackName + " " + artistName)}`;
                const searchRes = await fetch(searchUrl);
                if (searchRes.status === 200) {
                    const searchData = await searchRes.json();
                    const match = searchData.find(song => song.syncedLyrics && Math.abs(song.duration - durationSec) < 5);
                    if (match) {
                        lyricsList = parseLRC(match.syncedLyrics);
                    } else if (searchData[0] && searchData[0].syncedLyrics) {
                        lyricsList = parseLRC(searchData[0].syncedLyrics);
                    }
                }
            }
        } catch (e) {
            console.error("Lyrics Sync Fetch Error:", e);
        }
    });

    window.addEventListener("beforeunload", () => {
        const token = localStorage.getItem("discord_token");
        if (token && lastStatusText !== null) {
            const url = "https://discord.com/api/v9/users/@me/settings";
            fetch(url, {
                method: "PATCH",
                headers: {
                    "Authorization": token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ custom_status: null }),
                keepalive: true
            });
        }
    });

    function showSettingsModal() {
        if (typeof Spicetify === 'undefined' || !Spicetify.PopupModal) return;

        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "12px";
        container.style.padding = "16px";
        container.style.minWidth = "350px";
        container.style.color = "var(--spice-text, #ffffff)";

        const modalTitle = document.createElement("h2");
        modalTitle.textContent = "Discord Status Settings";
        modalTitle.style.marginBottom = "8px";
        modalTitle.style.fontSize = "18px";
        modalTitle.style.fontWeight = "bold";
        container.appendChild(modalTitle);

        const createField = (labelText, type, storageKey, defaultValue, isPassword = false) => {
            const label = document.createElement("label");
            label.textContent = labelText;
            label.style.fontWeight = "bold";
            label.style.fontSize = "13px";
            label.style.marginBottom = "4px";

            const input = document.createElement("input");
            input.type = isPassword ? "password" : type;
            input.value = localStorage.getItem(storageKey) || defaultValue;
            input.style.padding = "10px";
            input.style.borderRadius = "6px";
            input.style.border = "1px solid var(--spice-button-disabled, #535353)";
            input.style.backgroundColor = "var(--spice-card, #282828)";
            input.style.color = "var(--spice-text, #ffffff)";
            input.style.fontSize = "13px";
            input.style.width = "100%";
            input.style.boxSizing = "border-box";

            container.appendChild(label);
            container.appendChild(input);
            return input;
        };

        const tokenInput = createField("Discord Token", "text", "discord_token", "", true);
        const prefixInput = createField("Status Prefix", "text", "discord_status_prefix", "🎶 ");
        const framesInput = createField("Idle Emojis (comma-separated)", "text", "discord_idle_frames_raw", "🕺 Chilling..., 💃 Chilling..., 🕴️ Chilling...");
        const intervalInput = createField("Idle Interval (seconds)", "number", "discord_idle_interval", "15.0");

        const saveButton = document.createElement("button");
        saveButton.textContent = "Save";
        saveButton.style.padding = "12px";
        saveButton.style.marginTop = "12px";
        saveButton.style.borderRadius = "500px";
        saveButton.style.border = "none";
        saveButton.style.backgroundColor = "var(--spice-button, #1db954)";
        saveButton.style.color = "var(--spice-text, #000000)";
        saveButton.style.fontWeight = "bold";
        saveButton.style.cursor = "pointer";
        saveButton.style.fontSize = "14px";
        saveButton.style.transition = "transform 0.1s ease";

        saveButton.onmouseenter = () => saveButton.style.transform = "scale(1.03)";
        saveButton.onmouseleave = () => saveButton.style.transform = "scale(1)";
        
        saveButton.onclick = () => {
            const token = tokenInput.value.trim();
            const prefix = prefixInput.value;
            const framesRaw = framesInput.value;
            const interval = parseFloat(intervalInput.value);

            if (token) localStorage.setItem("discord_token", token);
            localStorage.setItem("discord_status_prefix", prefix);
            localStorage.setItem("discord_idle_frames_raw", framesRaw);
            
            const parsedFrames = framesRaw.split(",").map(s => s.trim()).filter(Boolean);
            localStorage.setItem("discord_idle_frames", JSON.stringify(parsedFrames));

            if (!isNaN(interval) && interval > 0) {
                localStorage.setItem("discord_idle_interval", interval.toString());
            }

            rateLimitUntil = 0;
            lastStatusText = undefined;
            
            Spicetify.PopupModal.hide();
        };

        container.appendChild(saveButton);

        Spicetify.PopupModal.display({
            title: "Discord Status Sync",
            content: container
        });
    }

    function initMenu() {
        if (Spicetify.Menu && Spicetify.Menu.Item) {
            const myItem = new Spicetify.Menu.Item(
                "Discord Status Sync",
                true,
                showSettingsModal
            );
            myItem.register();
        } else {
            setTimeout(initMenu, 500);
        }
    }

    initMenu();
    updateInterval = setInterval(tick, 500);

    if (!localStorage.getItem("discord_token")) {
        const welcomePromptInterval = setInterval(() => {
            if (Spicetify.PopupModal) {
                showSettingsModal();
                clearInterval(welcomePromptInterval);
            }
        }, 1000);
    }
}
