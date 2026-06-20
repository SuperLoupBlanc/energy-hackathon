# Offline Dependencies

Local runtime copies are stored under `assets/vendor/` so the game can keep running without CDN access.

## Vendored Runtime

| Dependency | Version / source | Local path |
| --- | --- | --- |
| Three.js classic build | `three@0.160.0` | `assets/vendor/three-0.160.0/three.min.js` |
| Three.js ES module build | `three@0.160.0` | `assets/vendor/three-0.160.0/three.module.js` |
| GLTFLoader | `three@0.160.0` examples JSM | `assets/vendor/three-0.160.0/examples/jsm/loaders/GLTFLoader.js` |
| BufferGeometryUtils | `three@0.160.0` examples JSM | `assets/vendor/three-0.160.0/examples/jsm/utils/BufferGeometryUtils.js` |
| Chart.js | `chart.js@4.4.1` | `assets/vendor/chart.js-4.4.1/chart.umd.min.js` |
| TensorFlow.js | `@tensorflow/tfjs@4.17.0` | `assets/vendor/tfjs-4.17.0/tf.min.js` |
| chiptune2.js | `deskjet/chiptune2.js` master snapshot | `assets/vendor/chiptune2/chiptune2.js` |
| libopenmpt asm.js | `deskjet/chiptune2.js` master snapshot | `assets/vendor/chiptune2/libopenmpt.js` |
| libopenmpt memory | `deskjet/chiptune2.js` master snapshot | `assets/vendor/chiptune2/libopenmpt.js.mem` |

## Still Online By Design

YouTube music uses `https://www.youtube.com/iframe_api` and streamed YouTube media. That cannot be made fully offline unless the music is replaced by local audio/module files.

The Amiga module path `assets/Dr_Awesome_Crusader_Now_what.mod` works offline with the vendored chiptune runtime.

## Notes

The project still should be served through a local HTTP server because ES modules, import maps, GLB, and audio assets are not reliable from `file://`.

Example:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```
