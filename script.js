// =========================
// BENKYOU NOW CHALLENGE
// =========================

let playerNickname = "";
let avatarGlowRGBA = "rgba(0, 150, 255, 0.6)"; // fallback

const ICON_MUSIC_ON = `
<svg viewBox="0 0 24 24">
  <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
</svg>
`;

const ICON_MUSIC_OFF = `
<svg viewBox="0 0 24 24">
  <path d="M16.5 12a3.5 3.5 0 1 1-7 0c0-.84.29-1.6.77-2.22L16.5 12z"/>
  <path d="M3 3l18 18" stroke="currentColor" stroke-width="2"/>
</svg>
`;


const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Pools por Gyo
const gyoMap = {
    vogais: ["あ", "い", "う", "え", "お"],
    ka: ["か", "き", "く", "け", "こ"],
    sa: ["さ", "し", "す", "せ", "そ"],
    ta: ["た", "ち", "つ", "て", "と"],
    na: ["な", "に", "ぬ", "ね", "の"],
    ha: ["は", "ひ", "ふ", "へ", "ほ"],
    ma: ["ま", "み", "む", "め", "も"],
    ya_wa: ["や", "ゆ", "よ", "わ", "を"],
    ra: ["ら", "り", "る", "れ", "ろ"],
};

const romajiMap = {
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo", "わ": "wa", "を": "wo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    // "ん": "n",
};

// Estado
let currentKanaPool = [];
let currentGyoKey = "";

let activeKanas = [];
let lives = 100;
let score = 0;

let fallSpeed = 3;
let spawnInterval = 3000;

let gameInterval = null;
let kanaSpawnerTimeout = null;



// =========================
// SFX (por elemento + erro único + loop do especial)
// =========================
let currentElement = ""; // "fogo" | "agua" | "terra" | "ar" | "flora"

// HIT por elemento
const sfxHitByElement = {
    fogo: new Audio("./assets/01_fogo.mp3"),
    agua: new Audio("./assets/02_agua.mp3"),
    terra: new Audio("./assets/03_terra.mp3"),
    ar: new Audio("./assets/04_vento.mp3"),
    flora: new Audio("./assets/05_flora.mp3"),
};

const sfxHajime = new Audio("./assets/hajime.mp3");
sfxHajime.volume = 0.9;

const bgm = new Audio("./assets/bgm_menu.mp3");
bgm.loop = true;
bgm.volume = 0.35;

let musicEnabled = false;


// ERRO único
const sfxError = new Audio("./assets/00_error.mp3");

// LOOP do especial por elemento
const sfxSpecialLoopByElement = {
    fogo: new Audio("./assets/01_especial_fogo.mp3"),
    agua: new Audio("./assets/02_especial_agua.mp3"),
    terra: new Audio("./assets/03_especial_terra.mp3"),
    ar: new Audio("./assets/04_especial_vento.mp3"),
    flora: new Audio("./assets/05_especial_flora.mp3"),
};

Object.values(sfxHitByElement).forEach(a => a.volume = 0.6);
sfxError.volume = 0.7;

Object.values(sfxSpecialLoopByElement).forEach(a => {
    a.volume = 0.35;  // loop costuma ser mais baixo mesmo
    a.loop = true;
});

// Detecta se o dispositivo permite auto-focus (desktop)
function shouldAutoFocus() {
    // pointer: coarse = toque (mobile/tablet)
    // pointer: fine   = mouse (desktop)
    return !window.matchMedia("(pointer: coarse)").matches;
}


function updateMusicButton() {
    const btn = document.getElementById("musicBtn");
    if (!btn) return;

    btn.innerHTML = musicEnabled ? ICON_MUSIC_ON : ICON_MUSIC_OFF;
    btn.title = musicEnabled ? "Música ligada" : "Música desligada";
}

function playMusic() {
    try {
        bgm.play();
        musicEnabled = true;
        updateMusicButton();
    } catch (_) { }
}

function pauseMusic() {
    bgm.pause();
    musicEnabled = false;
    updateMusicButton();
}

document.getElementById("musicBtn").addEventListener("click", () => {
    if (musicEnabled) {
        pauseMusic();
    } else {
        playMusic();
    }
});


// toca som (com “restart” pra permitir spam)
function playSfx(audio) {
    if (!audio) return;
    if (isPaused) return; // opcional: sem som durante pause

    try {
        audio.currentTime = 0;
        audio.play();
    } catch (_) { }
}

// desbloqueio de áudio (Chrome/Safari)
let audioUnlocked = false;
function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    const all = [
        ...Object.values(sfxHitByElement),
        sfxError,
        ...Object.values(sfxSpecialLoopByElement),
        sfxHajime,
    ];


    all.forEach((a) => {
        try {
            a.play();
            a.pause();
            a.currentTime = 0;
        } catch (_) { }
    });
}

function restartPressStartAnimation() {
    const el = document.getElementById("pressStart");
    if (!el) return;

    el.style.animation = "none";
    el.offsetHeight; // força reflow (reset real)
    el.style.animation = "";
}



// helpers do loop do especial
function getSpecialLoopAudio() {
    return sfxSpecialLoopByElement[currentElement] || null;
}

function startSpecialLoop() {
    const a = getSpecialLoopAudio();
    if (!a) return;

    try {
        a.currentTime = 0;
        if (!isPaused) a.play();
    } catch (_) { }
}

function stopSpecialLoop() {
    const a = getSpecialLoopAudio();
    if (!a) return;

    try {
        a.pause();
        a.currentTime = 0;
    } catch (_) { }
}

function pauseSpecialLoop() {
    const a = getSpecialLoopAudio();
    if (!a) return;

    try {
        a.pause();
    } catch (_) { }
}

function resumeSpecialLoop() {
    const a = getSpecialLoopAudio();
    if (!a) return;

    try {
        if (specialActive && !isPaused) a.play();
    } catch (_) { }
}


// =========================
// PAUSE / PLAY
// =========================
let isPaused = false;
let wasRunning = false; // só pra saber se o jogo estava rodando quando pausou

const ICON_PAUSE = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"></path>
  </svg>
`;

const ICON_PLAY = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5v14l11-7L8 5z"></path>
  </svg>
`;

function setPauseUI(paused) {
    const btn = document.getElementById("pauseBtn");
    if (!btn) return;

    btn.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
    btn.title = paused ? "Continuar" : "Pausar";
}


let damageText = "";
let damageAlpha = 0;
let damageY = 0;
let damageColor = "white";

let specialPoints = 0;
let specialActive = false;
let specialTimer = null;

let specialEndsAt = 0;           // timestamp de quando termina
let specialRemainingMs = 0;      // quanto falta quando pausa


let selectedAvatar = "";

// Alfabeto (futuro Katakana)
let selectedAlphabet = "hiragana";

// =========================
// UI Helpers
// =========================


function updateStartButtonState() {
    const nickEl = document.getElementById("nicknameInput");
    const btn = document.getElementById("startGameBtn");
    if (!nickEl || !btn) return;

    const nick = nickEl.value.trim();
    const ok = Boolean(selectedAvatar) && nick.length > 0;

    btn.disabled = !ok;
}

function hideAllScreens() {
    const ids = [
        "titleScreen",
        "alphabetScreen",
        "gyoScreen",
        "avatarSelectionScreen",
        "gameOverScreen",
        "gameCanvas",
        "hud",
        "inputArea",
        "romajiButtons",
    ];

    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

function resetGameState() {
    activeKanas = [];
    lives = 100;
    score = 0;

    fallSpeed = 3;
    spawnInterval = 3000;

    damageText = "";
    damageAlpha = 0;
    damageY = 0;

    specialPoints = 0;
    specialActive = false;

    // reset pause
    wasRunning = false;
    isPaused = false;
    setPauseUI(false);
    stopSpecialLoop();



    canvas.style.boxShadow = "none";


    if (specialTimer) {
        clearInterval(specialTimer);
        specialTimer = null;
    }

    canvas.classList.remove("special-active");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sbFill = document.getElementById("specialBarFill");
    if (sbFill) sbFill.style.width = "0%";

    const sbBg = document.getElementById("specialBarBackground");
    if (sbBg) sbBg.classList.remove("special-ready");

    const specialBtn = document.getElementById("specialBtn");
    if (specialBtn) {
        specialBtn.disabled = true;
        specialBtn.textContent = "ESPECIAL";
    }

}

function stopLoops() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (kanaSpawnerTimeout) {
        clearTimeout(kanaSpawnerTimeout);
        kanaSpawnerTimeout = null;
    }

    // pause state
    wasRunning = false;
    isPaused = false;
    setPauseUI(false);
}


// =========================
// Fluxo de telas
// =========================

// ===== AUDIO DO PRESS START =====
const sfxPressStart = new Audio("./assets/challenge.mp3");
sfxPressStart.volume = 0.9;

const pressStart = document.getElementById("pressStart");

pressStart.addEventListener("click", async () => {
    // desbloqueia áudio (se ainda não desbloqueou)
    unlockAudioOnce();
    pressStart.classList.add("stop-blink");
    // evita clique duplo
    pressStart.style.pointerEvents = "none";

    try {
        sfxPressStart.currentTime = 0;
        await sfxPressStart.play();

        // só troca a tela quando o áudio terminar
        sfxPressStart.onended = () => {
            document.getElementById("titleScreen").style.display = "none";
            document.getElementById("alphabetScreen").style.display = "block";
            document.getElementById("copyright").style.display = "none";

            // libera clique de novo (caso volte pro title)
            pressStart.style.pointerEvents = "auto";
        };
    } catch (err) {
        // se der bloqueio por browser, não trava o fluxo:
        document.getElementById("titleScreen").style.display = "none";
        document.getElementById("alphabetScreen").style.display = "block";
        document.getElementById("copyright").style.display = "none";

        pressStart.style.pointerEvents = "auto";
    }
});


document.addEventListener("keydown", async (e) => {
    if (document.getElementById("titleScreen").style.display === "block" && e.key === "Enter") {
        unlockAudioOnce();

        pressStart.style.pointerEvents = "none";

        try {
            sfxPressStart.currentTime = 0;
            await sfxPressStart.play();

            sfxPressStart.onended = () => {
                document.getElementById("titleScreen").style.display = "none";
                document.getElementById("alphabetScreen").style.display = "block";
                document.getElementById("copyright").style.display = "none";
                pressStart.style.pointerEvents = "auto";
            };
        } catch (_) {
            document.getElementById("titleScreen").style.display = "none";
            document.getElementById("alphabetScreen").style.display = "block";
            document.getElementById("copyright").style.display = "none";
            pressStart.style.pointerEvents = "auto";
        }
    }
});


function pauseGame(reason = "") {
    const runningNow = Boolean(gameInterval || kanaSpawnerTimeout);

    if (isPaused) return;

    isPaused = true;
    wasRunning = runningNow;

    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (kanaSpawnerTimeout) {
        clearTimeout(kanaSpawnerTimeout);
        kanaSpawnerTimeout = null;
    }

    // ✅ congela o especial (se estiver ativo)
    if (specialActive && specialTimer) {
        specialRemainingMs = Math.max(0, specialEndsAt - Date.now());
    }

    if (specialActive) pauseSpecialLoop();



    setPauseUI(true);
}


function resumeGame() {
    if (!isPaused) return;



    // se o jogo não estava rodando, não volta nada
    if (!wasRunning) {
        isPaused = false;
        setPauseUI(false);
        return;
    }

    // ✅ retoma o especial de onde parou
    if (specialActive && specialRemainingMs > 0) {
        specialEndsAt = Date.now() + specialRemainingMs;
    }

    isPaused = false;

    if (specialActive) resumeSpecialLoop();

    setPauseUI(false);

    // volta loops
    gameInterval = setInterval(gameLoop, 50);
    startKanaSpawner();
}

function selectAlphabet(alpha) {
    selectedAlphabet = alpha;

    // Por enquanto só Hiragana (Katakana invisível)
    document.getElementById("alphabetScreen").style.display = "none";
    document.getElementById("gyoScreen").style.display = "block";
}

function goToTitle() {
    stopLoops();
    stopSpecialLoop();
    resetGameState();
    hideAllScreens();

    document.activeElement.blur();
    document.body.classList.remove("in-game");
    document.getElementById("titleScreen").style.display = "block";
    document.getElementById("copyright").style.display = "block";

    pressStart.classList.remove("stop-blink");
    pressStart.style.pointerEvents = "auto";
    restartPressStartAnimation();

    // limpa seleção atual
    currentKanaPool = [];
    currentGyoKey = "";
    selectedAvatar = "";
    playerNickname = "";
    selectedAlphabet = "hiragana";

    const pn = document.getElementById("playerName");
    if (pn) pn.innerHTML = "";

    const ki = document.getElementById("kanaInput");
    if (ki) ki.value = "";

    const ni = document.getElementById("nicknameInput");
    if (ni) ni.value = "";

    if (musicEnabled) playMusic(); // volta a música se o usuário quiser


    // remove seleção visual
    document.querySelectorAll(".avatar-option").forEach((img) => {
        img.classList.remove("selected-avatar", "fogo", "agua", "terra", "ar", "flora");
    });

    updateStartButtonState();
}

function backToGyo() {
    document.getElementById("avatarSelectionScreen").style.display = "none";
    document.getElementById("gyoScreen").style.display = "block";

    // limpa seleção ao voltar
    selectedAvatar = "";
    playerNickname = "";

    const ni = document.getElementById("nicknameInput");
    if (ni) ni.value = "";

    document.querySelectorAll(".avatar-option").forEach((img) => {
        img.classList.remove("selected-avatar", "fogo", "agua", "terra", "ar", "flora");
    });

    const info = document.getElementById("avatarInfo");
    const phrase = document.getElementById("avatarPhrase");
    if (info) info.textContent = "Avatar selecionado: -";
    if (phrase) phrase.textContent = "";

    updateStartButtonState();
}

// =========================
// GYO
// =========================

function selectGyo(key) {
    currentGyoKey = key;
    currentKanaPool = gyoMap[key] ? [...gyoMap[key]] : [];
    showAvatarSelection(); // garante sempre o layout "2ª imagem"
}

// =========================
// AVATAR (layout final)
// =========================

function showAvatarSelection() {
    document.getElementById("gyoScreen").style.display = "none";
    document.getElementById("avatarSelectionScreen").style.display = "block";

    const info = document.getElementById("avatarInfo");
    const phrase = document.getElementById("avatarPhrase");
    const nick = document.getElementById("nicknameInput");

    if (shouldAutoFocus()) {
        nick.focus();
    }


    if (info) info.textContent = "Avatar selecionado: -";
    if (phrase) phrase.textContent = "";
    if (nick) nick.value = "";

    selectedAvatar = "";
    playerNickname = "";

    // remove seleção visual
    document.querySelectorAll(".avatar-option").forEach((img) => {
        img.classList.remove("selected-avatar", "fogo", "agua", "terra", "ar", "flora");
    });

    updateStartButtonState();
}

function selectAvatar(element, avatarName) {
    selectedAvatar = avatarName;


    const frases = {
        fogo: "Determinação incansável",
        agua: "Sabedoria em movimento",
        terra: "Estabilidade e foco",
        ar: "Liberdade e agilidade",
        flora: "Crescimento e harmonia",
    };

    const cores = {
        fogo: "#ff3b3b",   // vermelho
        agua: "#1fa2ff",   // azul
        terra: "#a56a43",  // marrom
        ar: "#00c9c9",     // ciano
        flora: "#3cbf4a",  // verde
    };

    const tipo = avatarName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    currentElement = tipo;


    avatarGlowRGBA = {
        fogo: "rgba(255, 80, 0, 0.6)",
        agua: "rgba(0, 160, 255, 0.6)",
        terra: "rgba(160, 110, 60, 0.6)",
        ar: "rgba(0, 210, 210, 0.6)",
        flora: "rgba(80, 220, 0, 0.6)",
    }[tipo] || "rgba(0, 150, 255, 0.6)";

    document.getElementById("avatarInfo").textContent =
        `Avatar selecionado: ${avatarName}`;

    const phraseEl = document.getElementById("avatarPhrase");
    phraseEl.textContent = frases[tipo] || "";
    phraseEl.style.color = cores[tipo] || "#fff";

    document.querySelectorAll(".avatar-option").forEach((img) => {
        img.classList.remove("selected-avatar", "fogo", "agua", "terra", "ar", "flora");
    });

    element.classList.add("selected-avatar", tipo);

    updateStartButtonState();
}




// =========================
// ROMAJI BUTTONS
// =========================

function createRomajiButtons() {
    const container = document.getElementById("romajiButtons");
    container.innerHTML = "";

    // Grid padrão (você já usa 5 colunas)
    // container.style.display = "grid";
    // container.style.gridTemplateColumns = "repeat(6, 60px)";
    // container.style.gridAutoRows = "50px";
    //  container.style.gap = "2px";


    // Pega os romajis do pool atual (do gyo escolhido)
    const romajis = currentKanaPool
        .map((k) => romajiMap[k])
        .filter(Boolean);

    // Monta linhas conforme o gyo, para ficar bonito
    let grid = [];

    if (currentGyoKey === "ya_wa") {
        // Ya (3) + Wa (2)
        // Linha 1: YA _ YU _ YO
        // Linha 2: WA _ _ _ WO
        grid = [
            ["ya", "yu", "yo", "wa", "wo"],
        ];
    } else if (currentGyoKey === "ra") {
        // Ra (5) + N (1)
        // Linha 1: RA RI RU RE RO
        // Linha 2: _  _  N  _  _
        grid = [
            ["ra", "ri", "ru", "re", "ro"],
        ];
    } else {
        // Gyo normal: 5 botões numa linha (vogais/ka/sa/ta/na/ha/ma)
        // Ex: ["ka","ki","ku","ke","ko"]
        grid = [romajis];
    }

    // Renderiza grid com botões (e espaços invisíveis)
    grid.forEach((row) => {
        row.forEach((romaji) => {
            const btn = document.createElement("button");
            btn.className = "romaji-btn";
            btn.textContent = romaji ? romaji.toUpperCase() : "";
            btn.disabled = !romaji;

            if (romaji) {
                btn.onclick = () => handleRomajiClick(romaji);
            } else {
                btn.style.visibility = "hidden";
            }

            container.appendChild(btn);
        });
    });
}


// =========================
// GAME START
// =========================

function startGame() {
    const nicknameInput = document.getElementById("nicknameInput");
    playerNickname = (nicknameInput?.value || "").trim();

    if (!playerNickname) {
        alert("Digite um nickname para começar!");
        nicknameInput?.focus();
        return;
    }

    if (!selectedAvatar) return;

    if (!currentKanaPool.length) {
        goToTitle();
        return;
    }

    stopLoops();
    resetGameState();
    pauseMusic(); // música para durante gameplay


    // ✅ agora sim pode liberar pause (jogo vai iniciar)
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) pauseBtn.disabled = false;

    wasRunning = false;
    isPaused = false;
    setPauseUI(false);

    document.body.classList.add("in-game");
    document.getElementById("avatarSelectionScreen").style.display = "none";
    document.getElementById("gameCanvas").style.display = "block";
    document.getElementById("hud").style.display = "flex";
    document.getElementById("inputArea").style.display = "block";

    createRomajiButtons();
    document.getElementById("romajiButtons").style.display = "grid";

    const nameLabel = playerNickname;
    document.getElementById("playerName").innerHTML =
        `<img src="assets/avatar_${selectedAvatar.toLowerCase()}.png" width="30" style="vertical-align: middle; margin-right: 5px;"> ${nameLabel}`;

    document.getElementById("kanaInput").value = "";
    const kanaInput = document.getElementById("kanaInput");
    kanaInput.value = "";

    if (shouldAutoFocus()) {
        kanaInput.focus();
    }


    updateHUD();

    const hajime = document.getElementById("hajimeText");
    hajime.style.opacity = "1";
    playSfx(sfxHajime);

    setTimeout(() => {
        hajime.style.opacity = "0";
        setTimeout(() => {
            spawnKana();

            wasRunning = true;
            isPaused = false;
            setPauseUI(false);

            gameInterval = setInterval(gameLoop, 50);
            startKanaSpawner();

        }, 800);
    }, 900);

}

// =========================
// SPAWN / LOOP
// =========================

function spawnKana() {
    const pool = currentKanaPool.length ? currentKanaPool : Object.values(gyoMap).flat();
    const kana = pool[Math.floor(Math.random() * pool.length)];
    const x = Math.floor(Math.random() * (canvas.width - 100)) + 50;
    activeKanas.push({ kana, x, y: 0 });
}

function startKanaSpawner() {
    if (isPaused) return;

    kanaSpawnerTimeout = setTimeout(() => {
        if (!isPaused) spawnKana();
        startKanaSpawner();
    }, spawnInterval);
}


function gameLoop() {
    if (isPaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "37px Arial";

    activeKanas.forEach((k) => {
        ctx.fillText(k.kana, k.x, k.y);
        k.y += fallSpeed;
    });

    if (damageAlpha > 0) {
        ctx.globalAlpha = damageAlpha;
        ctx.fillStyle = damageColor;
        ctx.font = "32px Arial";
        ctx.fillText(damageText, canvas.width / 2, damageY);
        ctx.globalAlpha = 1.0;
        damageAlpha -= 0.03;
        damageY -= 1;
    }

    activeKanas = activeKanas.filter((k) => {
        if (k.y > canvas.height) {
            if (!specialActive) {
                lives -= 10;
                playSfx(sfxError);

                showDamage("-10", "red");
                updateHUD();
                if (lives <= 0) endGame();
            }
            return false;
        }
        return true;
    });
}

// =========================
// INPUT / CLIQUES
// =========================

function handleRomajiClick(romaji) {
    const input = romaji.toLowerCase();
    const index = activeKanas.findIndex((k) => romajiMap[k.kana] === input);

    if (index !== -1) {
        score += 10;
        playSfx(sfxHitByElement[currentElement]);


        if (!specialActive) {
            specialPoints = Math.min(100, specialPoints + 5);
        }

        showDamage("+10", "lime");
        activeKanas.splice(index, 1);

        fallSpeed = Math.min(fallSpeed + 0.1, 7);
        spawnInterval = Math.max(spawnInterval * 0.95, 1500);
    } else if (!specialActive) {
        lives -= 5;
        playSfx(sfxError);

        showDamage("-5", "red");
        if (lives <= 0) endGame();
    }

    updateHUD();
}

function handleEnterInput(value) {
    const input = value.trim().toLowerCase();
    const index = activeKanas.findIndex((k) => romajiMap[k.kana] === input);

    if (index !== -1) {
        score += 10;

        if (!specialActive) {
            specialPoints = Math.min(100, specialPoints + 5);
        }

        showDamage("+10", "lime");
        activeKanas.splice(index, 1);

        fallSpeed = Math.min(fallSpeed + 0.1, 7);
        spawnInterval = Math.max(spawnInterval * 0.95, 1500);
    } else if (!specialActive) {
        lives -= 5;
        showDamage("-5", "red");
        if (lives <= 0) endGame();
    }

    updateHUD();
}

// =========================
// ESPECIAL
// =========================

function activateSpecial() {
    specialActive = true;
    startSpecialLoop();
    specialPoints = 0;

    const specialBtn = document.getElementById("specialBtn");
    if (specialBtn) {
        specialBtn.disabled = true;
        specialBtn.textContent = "ATIVO";
    }

    const gameCanvas = document.getElementById("gameCanvas");
    gameCanvas.classList.add("special-active");
    gameCanvas.style.boxShadow = `0 0 30px 10px ${avatarGlowRGBA}`;

    document.getElementById("specialBarBackground").classList.remove("special-ready");
    updateHUD();

    const duration = 30 * 1000;
    specialRemainingMs = duration;
    specialEndsAt = Date.now() + specialRemainingMs;

    if (specialTimer) clearInterval(specialTimer);

    specialTimer = setInterval(() => {
        if (isPaused) return; // ✅ se estiver pausado, não consome tempo

        const remaining = Math.max(0, specialEndsAt - Date.now());
        const percent = (remaining / duration) * 100;

        document.getElementById("specialBarFill").style.width = `${percent}%`;

        if (remaining <= 0) {
            clearInterval(specialTimer);
            specialTimer = null;

            specialActive = false;
            specialRemainingMs = 0;
            specialEndsAt = 0;

            gameCanvas.classList.remove("special-active");
            gameCanvas.style.boxShadow = "none";

            stopSpecialLoop();
            updateHUD();
        }
    }, 100);
}

// =========================
// HUD / DAMAGE
// =========================

function showDamage(text, color) {
    damageText = text;
    damageAlpha = 1;
    damageY = canvas.height / 2 + 30;
    damageColor = color;
}

function updateHUD() {
    document.getElementById("score").textContent = "Score: " + String(score).padStart(10, "0");

    const lifeText = document.getElementById("lifeText");
    lifeText.textContent = `${lives}/100`;

    const fill = document.getElementById("lifeBarFill");
    const percent = Math.max(0, lives);
    fill.style.width = `${percent}%`;

    if (percent > 60) {
        fill.style.backgroundColor = "#0f0";
    } else if (percent > 30) {
        fill.style.backgroundColor = "#ffa500";
    } else {
        fill.style.backgroundColor = "#f00";
    }

    const specialFill = document.getElementById("specialBarFill");
    const specialBG = document.getElementById("specialBarBackground");

    if (!specialActive) {
        const sp = Math.min(100, specialPoints);
        specialFill.style.width = `${sp}%`;

        if (sp === 100) {
            specialBG.classList.add("special-ready");
        } else {
            specialBG.classList.remove("special-ready");
        }
    }

    const specialBtn = document.getElementById("specialBtn");
    if (specialBtn) {
        const canUse = (specialPoints >= 100 && !specialActive);
        specialBtn.disabled = !canUse;
        specialBtn.textContent = specialActive ? "ATIVO" : "ESPECIAL";
    }
}

// =========================
// FIM
// =========================

function endGame() {
    stopLoops();
    stopSpecialLoop();

    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) pauseBtn.disabled = true;

    document.body.classList.remove("in-game");
    document.getElementById("gameCanvas").style.display = "none";
    document.getElementById("hud").style.display = "none";
    document.getElementById("inputArea").style.display = "none";
    document.getElementById("romajiButtons").style.display = "none";

    // Panorama completo
    const nick = playerNickname || "Player";

    const alphaLabel = selectedAlphabet === "hiragana" ? "Hiragana" : "Katakana";

    const gyoLabelMap = {
        vogais: "Vogais",
        ka: "Ka",
        sa: "Sa",
        ta: "Ta",
        na: "Na",
        ha: "Ha",
        ma: "Ma",
        ya_wa: "Ya + Wa",
        ra_n: "Ra + N",
    };

    const gyoLabel = gyoLabelMap[currentGyoKey] || "-";

    document.getElementById("summaryNickname").textContent = nick;
    document.getElementById("summaryAlphabet").textContent = alphaLabel;
    document.getElementById("summaryGyo").textContent = gyoLabel;
    document.getElementById("summaryScore").textContent = String(score);

    document.getElementById("gameOverScreen").style.display = "block";
}


// =========================
// INIT
// =========================

window.onload = () => {
    hideAllScreens();

    // ✅ libera a UI sem piscar
    document.addEventListener("pointerdown", unlockAudioOnce, { once: true });
    document.addEventListener("keydown", unlockAudioOnce, { once: true });
    document.body.classList.remove("loading");
    document.getElementById("titleScreen").style.display = "block";
    document.getElementById("copyright").style.display = "block";

    document.addEventListener("keydown", (e) => {
        if (e.code === "Space" && specialPoints >= 100 && !specialActive) {
            activateSpecial();
        }

    });

    const nickInput = document.getElementById("nicknameInput");
    if (nickInput) {
        nickInput.addEventListener("input", updateStartButtonState);
    }

    const kanaInput = document.getElementById("kanaInput");
    kanaInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            handleEnterInput(event.target.value);
            event.target.value = "";
        }
    });

    const specialBtn = document.getElementById("specialBtn");
    if (specialBtn) {
        specialBtn.addEventListener("click", () => {
            if (specialPoints >= 100 && !specialActive) activateSpecial();
        });

    }

    // =========================
    // PAUSE INIT + AUTO-PAUSE
    // =========================
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn) {
        pauseBtn.disabled = true; // só libera quando o jogo começar
        setPauseUI(false);

        pauseBtn.addEventListener("click", () => {
            if (isPaused) resumeGame();
            else pauseGame("manual");
        });
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseGame("visibilitychange");
    });

    window.addEventListener("blur", () => {
        pauseGame("window blur");
    });

    const howToBtn = document.getElementById("howToPlayBtn");
    const howToModal = document.getElementById("howToModal");
    const closeHowTo = document.getElementById("closeHowTo");

    if (howToBtn && howToModal && closeHowTo) {
        howToBtn.addEventListener("click", () => {
            howToModal.style.display = "flex";
        });

        closeHowTo.addEventListener("click", () => {
            howToModal.style.display = "none";
        });

        // fecha clicando fora da imagem
        howToModal.addEventListener("click", (e) => {
            if (e.target === howToModal) {
                howToModal.style.display = "none";
            }
        });
    }


};

function checkOrientation() {
    const warning = document.getElementById("rotate-warning");

    if (window.innerWidth > window.innerHeight) {
        // Landscape
        warning.style.display = "flex";
    } else {
        // Portrait
        warning.style.display = "none";
    }
}

window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", checkOrientation);

// inicial
checkOrientation();

