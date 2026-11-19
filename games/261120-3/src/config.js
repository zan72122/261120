// Shared constants & layout. Units: centimetres. +y up. Table top is y = 0.
// The player sits on the +z side and looks toward -z. Screen right = +x, screen up = -z (far).
import * as THREE from 'three';

export const RIM_Y = 7.0; // height of the hot plate's cooking surface (rim of the holes)
export const HOLE_R = 2.1; // hemispherical hole radius
export const BALL_R = 2.1; // takoyaki radius (sphere centre sits at rim level while in a hole)
export const COLS = 3;
export const ROWS = 4;
export const PITCH = 5.4;
export const BALL_COUNT = COLS * ROWS;

// Hot plate: housing footprint 25 (x) x 34 (z) incl. handles at the far/near ends; metal plate 18 x 24.
export const HOTPLATE = { w: 25, d: 31, handle: 1.5, plateW: 18.6, plateD: 24, bodyH: 6.4 };

// hole i = row * COLS + col ; row 0 is the far row (-z), col 0 is the left column (-x)
export function holeCenter(i, out = new THREE.Vector3()) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return out.set((col - (COLS - 1) / 2) * PITCH, RIM_Y, (row - (ROWS - 1) / 2) * PITCH);
}

// Serving platter (ceramic, rectangular with rounded corners). Local frame: origin = centre of its base on the table.
export const PLATTER = { w: 17.5, d: 22.5, surfaceY: 1.2, slotPitch: 4.7 };
// slot i: local position of the CENTRE of a ball resting in slot i (same indexing as holes)
export function platterSlot(i, out = new THREE.Vector3()) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return out.set(
    (col - (COLS - 1) / 2) * PLATTER.slotPitch,
    PLATTER.surfaceY + BALL_R * 0.97,
    (row - (ROWS - 1) / 2) * PLATTER.slotPitch
  );
}

export const PHASES = ['pour', 'fill', 'sprinkle', 'flip', 'plate', 'sauce', 'mayo', 'flakes', 'eat', 'end'];

const B = (x0, x1, z0, z1, y1 = 9) => new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, y1, z1));

// Everything that depends on the screen shape. aspect = width / height.
export function layout(aspect) {
  const portrait = aspect < 1;
  if (portrait) {
    const platter = new THREE.Vector3(0, 0, 31.5);
    return {
      portrait,
      camPitch: 58, // degrees below horizontal
      camFov: 38, // vertical fov
      toolRest: new THREE.Vector3(3.5, 0, 25), // phases pour..flip: in front of the hot plate
      toolSlideFrom: new THREE.Vector3(34, 0, 26), // tools are "handed in" from off-screen right
      platter,
      platterSlideFrom: new THREE.Vector3(-40, 0, 31.5),
      pickRestPlate: new THREE.Vector3(0, 0, 18.4), // phase plate: pick lies in the gap, along x
      pickRestPlateYaw: Math.PI / 2,
      dressRest: new THREE.Vector3(2.5, 0, 49.5), // phases sauce..flakes: in front of the platter
      runawayStop: new THREE.Vector3(8.2, 0, 17.6), // the runaway ball bumps the hot plate housing here
      frames: {
        cook: B(-13.5, 13.5, -17.5, 30.5),
        plate: B(-13.5, 13.5, -17.5, 43.5),
        dress: B(-10.5, 10.5, 19.5, 55),
        eat: B(-10, 10, 19, 44.5),
        end: B(-21, 21, -30, 46),
      },
    };
  }
  const platter = new THREE.Vector3(30, 0, 0.5);
  return {
    portrait,
    camPitch: 50,
    camFov: 30,
    toolRest: new THREE.Vector3(21.5, 0, 5),
    toolSlideFrom: new THREE.Vector3(60, 0, 8),
    platter,
    platterSlideFrom: new THREE.Vector3(70, 0, 0.5),
    pickRestPlate: new THREE.Vector3(16.6, 0, 1),
    pickRestPlateYaw: 0,
    dressRest: new THREE.Vector3(46, 0, 3),
    runawayStop: new THREE.Vector3(16.8, 0, 9.5),
    frames: {
      cook: B(-14, 29, -17.5, 17.5),
      plate: B(-14, 40, -17.5, 17.5),
      dress: B(20, 52, -12.5, 12.5),
      eat: B(20, 40, -12.5, 12.5),
      end: B(-28, 48, -32, 24),
    },
  };
}
