import * as Assets from '../assets';
import { ScoreService, Games } from '../services/ScoreService';
import { Keyboard } from 'phaser-ce';

const RADIAN = 6.283185;
const ONE_DEGREE_RADIANS = 0.01745329;

const TILE_SIZE = 256;
const TILE_SPACING = 80;
const GAME_COUNT = 4;
const TILE_STEP = TILE_SIZE + TILE_SPACING;
const TILE_START_X = (1920 - (GAME_COUNT * TILE_SIZE + (GAME_COUNT - 1) * TILE_SPACING)) / 2;

// External game URLs — update ports if your dev servers differ
const SNAKE_URL = 'http://localhost:5173';
const PAKOROIDS_URL = 'http://localhost:3001';

const GAME_KEYS = ['simInvadersTitle', 'flappyTitle', 'snake', 'pakoroids'];

export default class Title extends Phaser.State {
    private googleFontText: Phaser.Text = null;
    private pixelateShader: Phaser.Filter = null;
    private sinTracker = 0;
    private selectedIndex: number = 0;

    private squares: Phaser.Sprite[] = [];
    private labels: Phaser.Text[] = [];
    private selectionText: Phaser.Text = null;

    private leftWasDown: boolean = false;
    private rightWasDown: boolean = false;
    private spaceWasDown: boolean = false;

    private iframeEl: HTMLIFrameElement = null;
    private iframeMessageHandler: ((e: MessageEvent) => void) = null;

    public create(): void {
        this.game.input.enabled = true;
        this.squares = [];
        this.labels = [];
        this.selectedIndex = 0;
        this.game.sound.stopAll();
        this.googleFontText = this.game.add.text(this.game.world.centerX - 30, this.game.world.centerY - 460, 'Stream Arcade', {
            font: '50px ' + Assets.GoogleWebFonts.VT323,
            fill: '#FFFFFF'
        });
        this.googleFontText.anchor.setTo(0.5);

        this.pixelateShader = new Phaser.Filter(this.game, null, this.game.cache.getShader(Assets.Shaders.ShadersPixelate.getName()));

        const tileY = this.game.world.centerY - 256;
        const tileColor = this.RGBtoHEX(94, 104, 119);
        const gameTitles = ['Sim Invaders', 'Flappy Scrangle', 'Snake', 'Pakoroids'];

        for (let i = 0; i < GAME_COUNT; i++) {
            const tileX = TILE_START_X + i * TILE_STEP;

            const square = new Phaser.Sprite(this.game, tileX, tileY, Assets.Images.ImagesSquare.getName());
            square.tint = tileColor;
            square.width = TILE_SIZE;
            square.height = TILE_SIZE;
            square.alpha = i === 0 ? 1 : 0.5;
            this.game.add.existing(square);
            this.squares.push(square);

            const label = this.game.add.text(
                tileX + TILE_SIZE / 2,
                tileY + TILE_SIZE / 2,
                gameTitles[i],
                {
                    font: '28px ' + Assets.GoogleWebFonts.VT323,
                    fill: '#FFFFFF',
                    align: 'center',
                    wordWrap: true,
                    wordWrapWidth: TILE_SIZE - 20,
                }
            );
            label.anchor.setTo(0.5);
            label.alpha = i === 0 ? 1 : 0.5;
            this.labels.push(label);
        }

        this.selectionText = this.game.add.text(
            this.game.world.centerX - 150,
            this.game.world.centerY + 300,
            'Use the arrow keys to choose.. ',
            {
                font: '25px ' + Assets.GoogleWebFonts.VT323,
                boundsAlignV: 'middle',
                boundsAlignH: 'middle',
                fill: '#FFFFFF'
            }
        );

        this.stage.backgroundColor = '#000000';
        this.game.sound.play(Assets.Audio.AudioStreamArcadeFull.getName(), 1, true);
        this.game.input.gamepad.start();
        this.leftWasDown = false;
        this.rightWasDown = false;
        this.spaceWasDown = false;
    }

    public pauseUpdate() {
        this.game.paused = false;
    }

    public shutdown() {
        this.closeIframe();
        this.game.sound.stopAll();
    }

    RGBtoHEX(r, g, b) {
        return r << 16 | g << 8 | b;
    }

    private setSelectedIndex(index: number): void {
        this.selectedIndex = index;
        for (let i = 0; i < GAME_COUNT; i++) {
            const active = i === index;
            this.squares[i].alpha = active ? 1 : 0.5;
            this.labels[i].alpha = active ? 1 : 0.5;
        }
    }

    private launchInIframe(url: string): void {
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9999;';
        document.body.appendChild(iframe);
        this.iframeEl = iframe;
        this.game.sound.pauseAll();

        this.iframeMessageHandler = (e: MessageEvent) => {
            if (e.data === 'backToArcade') {
                this.closeIframe();
            }
        };
        window.addEventListener('message', this.iframeMessageHandler);
    }

    private closeIframe(): void {
        if (this.iframeEl) {
            this.iframeEl.remove();
            this.iframeEl = null;
        }
        if (this.iframeMessageHandler) {
            window.removeEventListener('message', this.iframeMessageHandler);
            this.iframeMessageHandler = null;
        }
        this.game.sound.resumeAll();
    }

    private launchSelected(): void {
        const key = GAME_KEYS[this.selectedIndex];
        if (key === 'snake') {
            this.launchInIframe(SNAKE_URL);
        } else if (key === 'pakoroids') {
            this.launchInIframe(PAKOROIDS_URL);
        } else {
            this.game.state.start(key);
        }
    }

    public update(): void {
        this.sinTracker = (this.sinTracker + (10 * ONE_DEGREE_RADIANS)) % RADIAN;
        this.googleFontText.rotation = 0.2 * Math.sin(this.sinTracker);

        const pad = this.game.input.gamepad.pad1;
        const leftDown = (
            this.game.input.keyboard.isDown(Phaser.Keyboard.LEFT) ||
            (pad && pad.isDown(Phaser.Gamepad.XBOX360_DPAD_LEFT)) ||
            (pad && pad.axis(Phaser.Gamepad.XBOX360_STICK_LEFT_X) < -0.1)
        );
        const rightDown = (
            this.game.input.keyboard.isDown(Phaser.Keyboard.RIGHT) ||
            (pad && pad.isDown(Phaser.Gamepad.XBOX360_DPAD_RIGHT)) ||
            (pad && pad.axis(Phaser.Gamepad.XBOX360_STICK_LEFT_X) > 0.1)
        );
        const spaceDown = (
            this.game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR) ||
            (pad && pad.isDown(Phaser.Gamepad.XBOX360_A))
        );

        if (leftDown && !this.leftWasDown) {
            this.setSelectedIndex((this.selectedIndex - 1 + GAME_COUNT) % GAME_COUNT);
        }
        if (rightDown && !this.rightWasDown) {
            this.setSelectedIndex((this.selectedIndex + 1) % GAME_COUNT);
        }
        if (spaceDown && !this.spaceWasDown) {
            this.launchSelected();
        }

        this.leftWasDown = leftDown;
        this.rightWasDown = rightDown;
        this.spaceWasDown = spaceDown;
    }
}
