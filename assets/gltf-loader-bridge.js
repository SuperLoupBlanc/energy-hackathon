import * as ThreeModule from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

window.ASTRA_GLTF = {
  THREE: ThreeModule,
  GLTFLoader
};

window.dispatchEvent(new Event("astra:gltf-ready"));
