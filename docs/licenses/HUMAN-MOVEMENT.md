# Human mesh and motion provenance

The embedded rigged human and the walking/push-up clips are derived from
OpenGym3D's publicly redistributable CC0 assets (not its Mixamo assets).

- Source: https://assiamahs.github.io/opengym3d/assets/walk.glb
- Push-up motion: https://assiamahs.github.io/opengym3d/assets/push_up.glb
- Asset library: https://github.com/AssiamahS/opengym3d/blob/main/assets/ASSET_LIBRARY.json
- Published manifest: https://assiamahs.github.io/opengym3d/exercises.json
- Inspected source revision: ea3a60130fdcfb3c4771e44d09f84ebab4ee9bae
- Human: MakeHuman / MPFB2 anatomical human, CC0-1.0.
- Motion: Mesh2Motion / Quaternius animation library, CC0-1.0.
- License: https://creativecommons.org/publicdomain/zero/1.0/

The published manifest marks `walk` and `push_up` as CC0 with `pack: true`.
We strip camera, UV, baked muscle colours and animations from the base GLB,
retain the skin weights and rig, and compress the embedded binary with gzip.
Runtime vertex colours apply a full fitness outfit. The two preserved clips
are stored separately in clips.json. Other demos use our illustrative bone
poses; they are not captured or professionally validated exercise technique.

No Mixamo clips or models sourced from non-redistributable renders are included.
