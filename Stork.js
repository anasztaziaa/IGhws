// Stork.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class Stork {
  constructor(scene, position, pathPoints = null, speed = 1) {
    this.scene = scene;
    this.position = position.clone();
    this.speed = speed;
    this.pathPoints = pathPoints;
    this.pathIdx = 0;
    this.clock = new THREE.Clock();
    this.mixer = null;
    this.model = null;

    const loader = new GLTFLoader().setPath("./assets/");
    loader.load("stork.glb", gltf => {
      this.model = gltf.scene;
      this.model.position.copy(this.position);
      this.model.scale.set(0.10, 0.10, 0.10);

      // Enable shadows for all meshes in the model
      this.model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(this.model);

      if (gltf.animations && gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(this.model);
        gltf.animations.forEach(clip => {
          this.mixer.clipAction(clip).play();
        });
      }
    });
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);

    if (this.pathPoints && this.model) {
      const nextPt = this.pathPoints[this.pathIdx];
      const currPos = this.model.position;
      const direction = new THREE.Vector3().subVectors(nextPt, currPos);
      const dist = direction.length();
      if (dist > 0.1) {
        direction.normalize();
        currPos.add(direction.multiplyScalar(this.speed * dt));
        this.model.lookAt(nextPt);
      } else {
        this.pathIdx = (this.pathIdx + 1) % this.pathPoints.length;
      }
    }
  }
}
