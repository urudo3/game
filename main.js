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

// ゲーム定数
const GRAVITY = 0.3;
const LIFT = -0.6;
const PLAYER_X = 100;
const INITIAL_SPEED = 3;
const SPAWN_INTERVAL = 120; // フレーム単位
const MIN_GAP = 120;
const MAX_GAP = 250;

// ゲーム状態
let score = 0;
let distance = 0;
let lives = 3;
let speed = INITIAL_SPEED;
let isPlaying = false;
let animationId;
let frames = 0;

// プレイヤーオブジェクト
const player = {
    y: 300,
    velocity: 0,
    width: 30,
    height: 30,
    color: '#00f2ff',
    isLifting: false,

    update() {
        if (this.isLifting) {
            this.velocity += LIFT;
        } else {
            this.velocity += GRAVITY;
        }
        
        // 抵抗
        this.velocity *= 0.95;
        this.y += this.velocity;

        // 境界チェック
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.velocity = 0;
        }
    },

    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // キャラクターを少しスタイリッシュに（三角形/矢印風）
        ctx.moveTo(this.x + this.width, this.y + this.height / 2);
        ctx.lineTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    },
    x: PLAYER_X
};

// 障害物
let obstacles = [];

class Obstacle {
    constructor(x, gapY, gapHeight) {
        this.x = x;
        this.gapY = gapY;
        this.gapHeight = gapHeight;
        this.width = 50;
        this.passed = false;
        this.color = '#7000ff';
    }

    update() {
        this.x -= speed;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;

        // 上の壁
        ctx.fillRect(this.x, 0, this.width, this.gapY);
        // 下の壁
        ctx.fillRect(this.x, this.gapY + this.gapHeight, this.width, canvas.height - (this.gapY + this.gapHeight));

        // 隙間に少し光を当てる
        const gradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        gradient.addColorStop(0, 'rgba(112, 0, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(112, 0, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(112, 0, 255, 0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, 0, this.width, this.gapY);
        ctx.fillRect(this.x, this.gapY + this.gapHeight, this.width, canvas.height - (this.gapY + this.gapHeight));

        ctx.restore();
    }
}

// 初期化
function init() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    
    window.addEventListener('resize', () => {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    });

    handleInput();
}

// 入力判定
function handleInput() {
    const startLifting = () => { player.isLifting = true; };
    const stopLifting = () => { player.isLifting = false; };

    window.addEventListener('mousedown', startLifting);
    window.addEventListener('mouseup', stopLifting);
    window.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startLifting();
    }, { passive: false });
    window.addEventListener('touchend', stopLifting);

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            startLifting();
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            stopLifting();
        }
    });

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
}

function startGame() {
    isPlaying = true;
    score = 0;
    distance = 0;
    lives = 3;
    speed = INITIAL_SPEED;
    obstacles = [];
    player.y = canvas.height / 2;
    player.velocity = 0;
    frames = 0;
    
    updateHUD();
    overlay.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    gameLoop();
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    finalScoreElement.innerText = Math.floor(score);
    overlay.classList.remove('hidden');
    gameOverScreen.classList.remove('hidden');
}

function updateHUD() {
    scoreElement.innerText = Math.floor(score);
    const hearts = lifeContainer.querySelectorAll('.heart');
    hearts.forEach((heart, index) => {
        if (index < lives) {
            heart.classList.remove('lost');
        } else {
            heart.classList.add('lost');
        }
    });
}

function spawnObstacle() {
    // 難易度に応じて隙間を小さくする
    const currentGapHeight = Math.max(MIN_GAP, MAX_GAP - (distance / 500));
    const gapY = Math.random() * (canvas.height - currentGapHeight - 100) + 50;
    obstacles.push(new Obstacle(canvas.width, gapY, currentGapHeight));
}

function checkCollision(p, o) {
    // 上の壁との判定
    if (p.x + p.width > o.x && p.x < o.x + o.width) {
        if (p.y < o.gapY || p.y + p.height > o.gapY + o.gapHeight) {
            return true;
        }
    }
    return false;
}

function update() {
    frames++;
    distance += speed / 10;
    score = distance;
    
    // スピードを徐々に上げる
    speed = INITIAL_SPEED + (distance / 1000);

    player.update();

    if (frames % SPAWN_INTERVAL === 0) {
        spawnObstacle();
    }

    obstacles.forEach((obstacle, index) => {
        obstacle.update();

        // 衝突判定
        if (checkCollision(player, obstacle)) {
            lives--;
            obstacles.splice(index, 1);
            updateHUD();
            if (lives <= 0) {
                gameOver();
            }
        }

        // スコア加算判定（通り過ぎたか）
        if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
            obstacle.passed = true;
            updateHUD();
        }

        // 画面外に出た障害物を削除
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(index, 1);
        }
    });

    updateHUD();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景の装飾（流れるグリッド線など）
    drawBackground();

    player.draw();
    obstacles.forEach(obstacle => obstacle.draw());
}

function drawBackground() {
    ctx.strokeStyle = 'rgba(112, 0, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    const offsetX = (frames * speed) % gridSize;
    
    // 縦線
    for (let x = -offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // 横線
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function gameLoop() {
    if (!isPlaying) return;
    update();
    draw();
    animationId = requestAnimationFrame(gameLoop);
}

init();
