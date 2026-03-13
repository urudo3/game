// Neon Runner - Smooth & Stable Engine (rAF + Linear Difficulty)
(function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const lifeContainer = document.getElementById('life-container');
    const overlay = document.getElementById('overlay');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreElement = document.getElementById('final-score');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');

    // モバイル判定
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // --- ゲーム設定 (秒単位/時間ベースに統一) ---
    const CONFIG = {
        GRAVITY: 3200,    // 秒間加速度
        LIFT: -6000,      // 秒間上昇力
        BASE_RESISTANCE: 0.1, // 秒間の残存速度係数 (近似値)
        INITIAL_SPEED: isMobile ? 350 : 350, // 1秒間の移動ピクセル数
        ACCELERATION: 10,   // 1秒ごとに増加する速度(px/sec)
        SPAWN_INTERVAL: 1.5, // 障害物出現間隔(秒)
        PLAYER_X: 100,
        PLAYER_SIZE: 30
    };

    // --- 内部状態 ---
    let state = {
        active: false,
        lastTime: 0,
        startTime: 0,
        score: 0,
        lives: 3,
        speed: CONFIG.INITIAL_SPEED,
        playerY: 0,
        playerV: 0,
        isLifting: false,
        obstacles: [],
        spawnTimer: 0,
        animId: null
    };

    function init() {
        window.addEventListener('resize', resize);
        resize();
        setupEvents();
    }

    function resize() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }

    function setupEvents() {
        const liftStart = (e) => {
            if (e.cancelable) e.preventDefault();
            state.isLifting = true;
        };
        const liftEnd = () => { state.isLifting = false; };

        canvas.addEventListener('mousedown', liftStart);
        window.addEventListener('mouseup', liftEnd);
        canvas.addEventListener('touchstart', liftStart, { passive: false });
        window.addEventListener('touchend', liftEnd, { passive: false });
        window.addEventListener('keydown', (e) => { 
            if (e.code === 'Space') { e.preventDefault(); state.isLifting = true; } 
        });
        window.addEventListener('keyup', (e) => { 
            if (e.code === 'Space') state.isLifting = false; 
        });

        startButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', startGame);
    }

    function startGame() {
        if (state.animId) cancelAnimationFrame(state.animId);
        
        const now = performance.now();
        state = {
            ...state,
            active: true,
            lastTime: now,
            startTime: now,
            score: 0,
            lives: 3,
            speed: CONFIG.INITIAL_SPEED,
            playerY: canvas.height / 2,
            playerV: 0,
            isLifting: false,
            obstacles: [],
            spawnTimer: 0
        };

        updateHUD();
        overlay.classList.add('hidden');
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        
        state.animId = requestAnimationFrame(loop);
    }

    function stopGame() {
        state.active = false;
        if (state.animId) cancelAnimationFrame(state.animId);
        finalScoreElement.innerText = Math.floor(state.score);
        overlay.classList.remove('hidden');
        gameOverScreen.classList.remove('hidden');
    }

    function update(dt) {
        if (!state.active) return;

        // 時間経過の計算
        const elapsed = (performance.now() - state.startTime) / 1000;
        
        // 速度上昇: 時間にのみ比例させる (指数関数的な暴走を防ぐ)
        state.speed = CONFIG.INITIAL_SPEED + (elapsed * CONFIG.ACCELERATION);
        
        // スコア更新 (進んだピクセル数ベース)
        state.score += state.speed * dt / 10;

        // プレイヤー物理
        if (state.isLifting) {
            state.playerV += CONFIG.LIFT * dt;
        } else {
            state.playerV += CONFIG.GRAVITY * dt;
        }
        
        // 抵抗 (dtに合わせて滑らかに減衰)
        state.playerV *= Math.pow(0.05, dt); 
        state.playerY += state.playerV * dt;

        // 境界チェック
        if (state.playerY < 0) { state.playerY = 0; state.playerV = 0; }
        if (state.playerY > canvas.height - CONFIG.PLAYER_SIZE) {
            state.playerY = canvas.height - CONFIG.PLAYER_SIZE;
            state.playerV = 0;
        }

        // 障害物生成
        state.spawnTimer += dt;
        if (state.spawnTimer >= CONFIG.SPAWN_INTERVAL) {
            const gapH = Math.max(120, 250 - (elapsed * 2));
            const y = Math.random() * (canvas.height - gapH - 100) + 50;
            state.obstacles.push({ x: canvas.width, y: y, h: gapH, w: 50, passed: false });
            state.spawnTimer = 0;
        }

        // 障害物更新
        for (let i = state.obstacles.length - 1; i >= 0; i--) {
            const o = state.obstacles[i];
            o.x -= state.speed * dt;

            // 衝突判定 (プレイヤーX=100)
            const px = CONFIG.PLAYER_X;
            const size = CONFIG.PLAYER_SIZE;
            if (px + size > o.x && px < o.x + o.w) {
                if (state.playerY < o.y || state.playerY + size > o.y + o.h) {
                    state.lives--;
                    state.obstacles.splice(i, 1);
                    updateHUD();
                    if (state.lives <= 0) stopGame();
                    continue;
                }
            }
            if (o.x + o.w < 0) state.obstacles.splice(i, 1);
        }

        updateHUD();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 背景ライン (グリッド)
        ctx.strokeStyle = 'rgba(112, 0, 255, 0.1)';
        const gridOffset = (state.score * 10) % 50;
        for (let x = -gridOffset; x < canvas.width; x += 50) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // 障害物
        ctx.fillStyle = '#7000ff';
        state.obstacles.forEach(o => {
            ctx.fillRect(o.x, 0, o.w, o.y);
            ctx.fillRect(o.x, o.y + o.h, o.w, canvas.height - (o.y + o.h));
        });

        // プレイヤー (ネオン三角形)
        ctx.fillStyle = '#00f2ff';
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f2ff';
        ctx.beginPath();
        const px = CONFIG.PLAYER_X;
        const py = state.playerY;
        const size = CONFIG.PLAYER_SIZE;
        ctx.moveTo(px + size, py + size / 2);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py + size);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function loop(time) {
        if (!state.active) return;

        let dt = (time - state.lastTime) / 1000;
        state.lastTime = time;

        // 異常なdt（タブ切り替え時など）へのガード
        if (dt > 0.1) dt = 0.1;

        update(dt);
        draw();
        state.animId = requestAnimationFrame(loop);
    }

    function updateHUD() {
        scoreElement.innerText = Math.floor(state.score);
        const hearts = lifeContainer.querySelectorAll('.heart');
        hearts.forEach((h, i) => h.classList.toggle('lost', i >= state.lives));
    }

    init();
    console.log("Neon Runner Smooth v11 Loaded");
})();
