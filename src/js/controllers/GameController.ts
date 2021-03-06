import { AudioController } from './AudioController';
import { UIController } from './UIController';
import { DrawController } from './DrawController';
import { enemiesController } from '../models/Enemy';
import { extrapolate } from '../utils/math';
import { Player, loadPlayerModel } from '../models/Player';
import { enemies, loadMeteoriteModel } from '../models/Enemy';
import * as THREE from "three";


export class GameController {
  isStart = false;
  audioController: AudioController;
  uiController: UIController;
  drawController: DrawController;
  player: Player;
  minPitch = 200;
  maxPitch = 550;
  score = 0;
  healthPoints = 4;
  rafId: number = null;

  constructor() {
    this.uiController = new UIController(this.start, this.stop);
    this.uiController.updateHealth(this.healthPoints);
    window.game = this;
  }
  
  initAssets = (playerModel: THREE.Group, enemyModel: THREE.Mesh) => {
    this.player = new Player(playerModel);
    this.drawController = new DrawController(this.player);
    this.drawController.meteorite = enemyModel;
  }

  loadAssets = async () => {
    const playerModel = await loadPlayerModel((xhr) => {
      this.uiController.updateProgressBar('player', xhr.loaded)
    });

    const enemyModel = await loadMeteoriteModel((xhr) => {
      this.uiController.updateProgressBar('meteorite', xhr.loaded)
    });
    this.uiController.startButton.innerText = 'Play';
    this.uiController.startButton.disabled = false;
    this.initAssets(playerModel, enemyModel);
  }

  onPitchChanged = (pitch: number, clarity: number) => {
    if(pitch > 50 && pitch < 1500 && clarity > 0.95) {
      const pitchValue = Math.abs(extrapolate(100, 350, pitch));
      
      this.player.vy = (0.5 - pitchValue) * 3;
        console.table({
          pitch,
          pitchValue,
          vy: (0.5 - pitchValue) * 3
        });
      this.uiController.pitchChart.addPitch({
        x: 200,
        y: 100 - pitchValue * 100,
        z: clarity,
        color: pitchValue * 255
      });
    }
  }

  start = async () => {
    if (this.isStart) return;
    this.audioController = new AudioController();
    try {
      await this.audioController.startListen(this.onPitchChanged);
      await this.drawController.init();
      this.isStart = true;
      this.loop();
    } catch (error) {
      console.log('start error', error)
    }
  }

  stop = () => {
    if (!this.isStart) return;
    this.audioController.stopListen();
    this.audioController = null;
    this.isStart = false;
    window.cancelAnimationFrame(this.rafId);
  }

  detectCollisions = () => {
    const playerCollider = new THREE.Box3().setFromObject(this.player.model.children[2]);
    enemies
      .filter(enemy => !enemy.isDead)
      .forEach(enemy => {
        const enemyCollider = new THREE.Box3().setFromObject(enemy.mesh);
        const collision = playerCollider.intersectsBox(enemyCollider);
        if(collision) {
          this.player.hitAnimation()
          enemy.kill();
          this.updateHealth(this.healthPoints - 1);
        }
      });
  }

  incScore = (value = 1) => {
    this.score += value;
    this.updateScore(this.score);
  }

  updateScore = (value: number) => {
    this.score = value;
    this.uiController.updateScore(value);
  }

  updateHealth = (value: number) => {
    this.healthPoints = value;
    this.uiController.updateHealth(value);
  }

  draw = () => {
    const { 
      scene,
      player: { model },
      meteorite 
    } = this.drawController;
    this.uiController.drawPitchState(this.player.vy, this.minPitch, this.maxPitch);

    enemiesController(scene, model.position.y, meteorite, this.incScore);
    this.player.draw();
    this.drawController.draw();
    this.detectCollisions()
  }

  loop = () => {
    this.draw();
    this.rafId = window.requestAnimationFrame(this.loop);
  }
}