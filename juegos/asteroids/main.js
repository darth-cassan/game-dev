const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0b0f1a, 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera();
scene.add(camera);

const hudScore = document.getElementById("score");
const hudLives = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const overlayButton = document.getElementById("overlay-button");

const state = {
  running: false,
  paused: false,
  score: 0,
  lives: 3,
  level: 1,
  lastShot: 0,
  invulnerableUntil: 0,
  burstCount: 0,
  burstCooldownUntil: 0,
  respawnAt: 0,
};

const world = {
  halfWidth: 90,
  halfHeight: 70,
};

const input = {
  left: false,
  right: false,
  thrust: false,
  shoot: false,
};

const ship = {
  mesh: null,
  flame: null,
  velocity: new THREE.Vector2(),
  rotation: 0,
  position: new THREE.Vector2(),
  radius: 1.7,
};

const asteroids = [];
const bullets = [];
const explosions = [];

const MAX_SPEED = 40.5;
const THRUST = 65;
const ROTATE_SPEED = 3.2;
const FRICTION = 0.5;
const SHOT_COOLDOWN = 0.18;
const BURST_LIMIT = 3;
const BURST_COOLDOWN = 0.6;
const RESPAWN_DELAY = 1.2;
const EXPLOSION_LIFE = 0.6;

const glowTexture = createRadialTexture();

function createRadialTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function resize() {
  const { innerWidth, innerHeight } = window;
  renderer.setSize(innerWidth, innerHeight);
  const aspect = innerWidth / innerHeight;
  world.halfHeight = 70;
  world.halfWidth = world.halfHeight * aspect;
  camera.left = -world.halfWidth;
  camera.right = world.halfWidth;
  camera.top = world.halfHeight;
  camera.bottom = -world.halfHeight;
  camera.near = -100;
  camera.far = 100;
  camera.updateProjectionMatrix();
}

function wrapPosition(vec) {
  if (vec.x > world.halfWidth) vec.x = -world.halfWidth;
  if (vec.x < -world.halfWidth) vec.x = world.halfWidth;
  if (vec.y > world.halfHeight) vec.y = -world.halfHeight;
  if (vec.y < -world.halfHeight) vec.y = world.halfHeight;
}

function createShip() {
  const shape = new THREE.BufferGeometry();
  const points = new Float32Array([
    0, 2.4, 0,
    -1.7, -1.7, 0,
    0, -1.0, 0,
    1.7, -1.7, 0,
  ]);
  shape.setAttribute("position", new THREE.BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color: 0x6ae3ff });
  const line = new THREE.LineLoop(shape, material);

  const flameShape = new THREE.BufferGeometry();
  const flamePoints = new Float32Array([
    0, -2.2, 0,
    -0.7, -3.6, 0,
    0.7, -3.6, 0,
  ]);
  flameShape.setAttribute("position", new THREE.BufferAttribute(flamePoints, 3));
  const flameMaterial = new THREE.LineBasicMaterial({ color: 0xffb86b, transparent: true, opacity: 0.9 });
  const flame = new THREE.LineLoop(flameShape, flameMaterial);
  flame.visible = false;

  const group = new THREE.Group();
  group.add(line);
  group.add(flame);
  scene.add(group);
  ship.mesh = group;
  ship.flame = flame;
  ship.position.set(0, 0);
  ship.velocity.set(0, 0);
  ship.rotation = Math.PI / 2;
}

function createStarfield() {
  const layers = [
    { count: 140, size: 0.7, color: 0xe6f1ff, z: -2 },
    { count: 90, size: 1.2, color: 0x9bc4ff, z: -3 },
    { count: 60, size: 1.8, color: 0x6ae3ff, z: -4 },
  ];

  layers.forEach((layer) => {
    const positions = new Float32Array(layer.count * 3);
    for (let i = 0; i < layer.count; i += 1) {
      positions[i * 3] = (Math.random() * 2 - 1) * world.halfWidth;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * world.halfHeight;
      positions[i * 3 + 2] = layer.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: layer.color,
      size: layer.size,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
  });
}

function createAsteroid(size = 3, position = null) {
  const radius = size === 3 ? 6 : size === 2 ? 4 : 2.4;
  const verts = 14 + Math.floor(Math.random() * 6);
  const points = [];
  for (let i = 0; i < verts; i += 1) {
    const angle = (i / verts) * Math.PI * 2;
    const variance = radius * (0.65 + Math.random() * 0.5);
    points.push(Math.cos(angle) * variance, Math.sin(angle) * variance, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(points), 3));
  const stroke = new THREE.LineBasicMaterial({ color: 0xe6f1ff });
  const mesh = new THREE.LineLoop(geometry, stroke);
  scene.add(mesh);

  const shape = new THREE.Shape();
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i];
    const y = points[i + 1];
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const fillGeometry = new THREE.ShapeGeometry(shape);
  const fill = new THREE.Mesh(
    fillGeometry,
    new THREE.MeshBasicMaterial({ color: 0x0d1726, transparent: true, opacity: 0.5 })
  );
  scene.add(fill);

  const asteroid = {
    mesh,
    fill,
    size,
    radius,
    position: new THREE.Vector2(),
    velocity: new THREE.Vector2(),
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() * 2 - 1) * 0.8,
  };

  if (position) {
    asteroid.position.copy(position);
  } else {
    asteroid.position.set(
      (Math.random() * 2 - 1) * world.halfWidth,
      (Math.random() * 2 - 1) * world.halfHeight
    );
  }

  const speed = 5 + Math.random() * 9;
  const angle = Math.random() * Math.PI * 2;
  asteroid.velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed);

  asteroid.mesh.position.set(asteroid.position.x, asteroid.position.y, 0);
  asteroid.fill.position.set(asteroid.position.x, asteroid.position.y, -0.1);

  asteroids.push(asteroid);
}

function spawnWave() {
  const count = 3 + state.level;
  for (let i = 0; i < count; i += 1) {
    const offset = new THREE.Vector2(
      (Math.random() * 2 - 1) * world.halfWidth,
      (Math.random() * 2 - 1) * world.halfHeight
    );
    if (offset.length() < 12) {
      offset.set(world.halfWidth * 0.7, world.halfHeight * 0.7);
    }
    createAsteroid(3, offset);
  }
}

function shootBullet(time) {
  if (time - state.lastShot < SHOT_COOLDOWN) return;
  if (time < state.burstCooldownUntil) return;
  state.lastShot = time;
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x6ae3ff })
  );
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x6ae3ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.scale.set(2.6, 2.6, 1);
  const mesh = new THREE.Group();
  mesh.add(glow);
  mesh.add(core);
  scene.add(mesh);

  const direction = new THREE.Vector2(Math.cos(ship.rotation), Math.sin(ship.rotation));
  const position = ship.position.clone().add(direction.clone().multiplyScalar(2.4));

  bullets.push({
    mesh,
    position,
    velocity: direction.multiplyScalar(85).add(ship.velocity.clone()),
    life: 1.35,
  });
  mesh.position.set(position.x, position.y, 0);
  mesh.rotation.z = ship.rotation - Math.PI / 2;

  state.burstCount += 1;
  if (state.burstCount >= BURST_LIMIT) {
    state.burstCooldownUntil = time + BURST_COOLDOWN;
    state.burstCount = 0;
  }
}

function canShoot(time) {
  if (time < state.burstCooldownUntil) return false;
  return true;
}

function resetShip() {
  ship.position.set(0, 0);
  ship.velocity.set(0, 0);
  ship.rotation = Math.PI / 2;
  state.invulnerableUntil = performance.now() + 1500;
  ship.mesh.visible = true;
  ship.flame.visible = false;
}

function updateShip(delta) {
  if (state.respawnAt && performance.now() < state.respawnAt) {
    return;
  }
  if (input.left) ship.rotation += ROTATE_SPEED * delta;
  if (input.right) ship.rotation -= ROTATE_SPEED * delta;

  if (input.thrust) {
    const accel = new THREE.Vector2(Math.cos(ship.rotation), Math.sin(ship.rotation));
    ship.velocity.add(accel.multiplyScalar(THRUST * delta));
    ship.flame.visible = true;
  } else {
    ship.velocity.multiplyScalar(1 - Math.min(FRICTION * delta, 1));
    ship.flame.visible = false;
  }

  if (ship.velocity.length() > MAX_SPEED) {
    ship.velocity.setLength(MAX_SPEED);
  }

  ship.position.add(ship.velocity.clone().multiplyScalar(delta));
  wrapPosition(ship.position);

  ship.mesh.position.set(ship.position.x, ship.position.y, 0);
  ship.mesh.rotation.z = ship.rotation - Math.PI / 2;

  if (performance.now() < state.invulnerableUntil) {
    ship.mesh.visible = Math.floor(performance.now() / 100) % 2 === 0;
  } else {
    ship.mesh.visible = true;
  }
  ship.flame.visible = ship.mesh.visible && input.thrust;
}

function updateAsteroids(delta) {
  asteroids.forEach((asteroid) => {
    asteroid.position.add(asteroid.velocity.clone().multiplyScalar(delta));
    wrapPosition(asteroid.position);
    asteroid.rotation += asteroid.spin * delta;
    asteroid.mesh.position.set(asteroid.position.x, asteroid.position.y, 0);
    asteroid.mesh.rotation.z = asteroid.rotation;
    asteroid.fill.position.set(asteroid.position.x, asteroid.position.y, -0.1);
    asteroid.fill.rotation.z = asteroid.rotation;
  });
}

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.life -= delta;
    bullet.position.add(bullet.velocity.clone().multiplyScalar(delta));
    wrapPosition(bullet.position);
    bullet.mesh.position.set(bullet.position.x, bullet.position.y, 0);
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
    }
  }
}

function createExplosion(position) {
  const count = 18;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = 0;
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 25;
    velocities.push(new THREE.Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffb86b,
    size: 1.6,
    sizeAttenuation: false,
    map: glowTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  explosions.push({
    mesh: points,
    velocities,
    life: EXPLOSION_LIFE,
  });
}

function updateExplosions(delta) {
  for (let i = explosions.length - 1; i >= 0; i -= 1) {
    const explosion = explosions[i];
    explosion.life -= delta;
    const positions = explosion.mesh.geometry.attributes.position.array;
    for (let j = 0; j < explosion.velocities.length; j += 1) {
      const velocity = explosion.velocities[j];
      positions[j * 3] += velocity.x * delta;
      positions[j * 3 + 1] += velocity.y * delta;
    }
    explosion.mesh.geometry.attributes.position.needsUpdate = true;
    if (explosion.life <= 0) {
      scene.remove(explosion.mesh);
      explosions.splice(i, 1);
    }
  }
}

function destroyAsteroidAt(index) {
  const asteroid = asteroids[index];
  scene.remove(asteroid.mesh);
  scene.remove(asteroid.fill);
  asteroids.splice(index, 1);
  if (asteroid.size > 1) {
    createAsteroid(asteroid.size - 1, asteroid.position.clone());
    createAsteroid(asteroid.size - 1, asteroid.position.clone());
  }
}

function handleCollisions() {
  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    for (let j = bullets.length - 1; j >= 0; j -= 1) {
      const bullet = bullets[j];
      if (asteroid.position.distanceTo(bullet.position) < asteroid.radius) {
        destroyAsteroidAt(i);
        scene.remove(bullet.mesh);
        bullets.splice(j, 1);
        state.score += asteroid.size * 100;
        updateHud();
        break;
      }
    }
  }

  if (performance.now() < state.invulnerableUntil) return;

  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    if (asteroid.position.distanceTo(ship.position) < asteroid.radius + ship.radius) {
      destroyAsteroidAt(i);
      createExplosion(ship.position.clone());
      state.lives -= 1;
      updateHud();
      ship.mesh.visible = false;
      ship.flame.visible = false;
      if (state.lives <= 0) {
        endGame();
      } else {
        const respawnAt = performance.now() + RESPAWN_DELAY * 1000;
        state.respawnAt = respawnAt;
        state.invulnerableUntil = respawnAt + 1500;
        ship.position.set(0, 0);
        ship.velocity.set(0, 0);
        ship.rotation = Math.PI / 2;
        ship.mesh.position.set(0, 0, 0);
        ship.mesh.rotation.z = ship.rotation - Math.PI / 2;
      }
      break;
    }
  }
}

function updateHud() {
  hudScore.textContent = `Score: ${state.score}`;
  hudLives.textContent = `Lives: ${state.lives}`;
}

function updateGame(delta, time) {
  if (!state.running || state.paused) return;

  if (state.respawnAt && performance.now() >= state.respawnAt) {
    state.respawnAt = 0;
    resetShip();
  }

  updateShip(delta);
  updateAsteroids(delta);
  updateBullets(delta);
  updateExplosions(delta);
  handleCollisions();

  if (asteroids.length === 0) {
    state.level += 1;
    spawnWave();
  }

  if (input.shoot && canShoot(time)) {
    shootBullet(time);
  }
}

function animate(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  updateGame(delta, time / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.lastShot = 0;
  state.burstCount = 0;
  state.burstCooldownUntil = 0;
  state.respawnAt = 0;
  asteroids.splice(0, asteroids.length).forEach((asteroid) => {
    scene.remove(asteroid.mesh);
    scene.remove(asteroid.fill);
  });
  bullets.splice(0, bullets.length).forEach((bullet) => scene.remove(bullet.mesh));
  explosions.splice(0, explosions.length).forEach((explosion) => scene.remove(explosion.mesh));
  resetShip();
  spawnWave();
  updateHud();
  hideOverlay();
}

function endGame() {
  state.running = false;
  showOverlay(`Game Over\nScore: ${state.score}`, "gameover");
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  if (state.paused) {
    showOverlay("Paused", "pause");
  } else {
    hideOverlay();
  }
}

function showOverlay(message, mode = "home") {
  overlayText.textContent = message;
  overlay.dataset.state = mode;
  overlay.classList.remove("hidden");
  overlayButton.textContent = mode === "pause" ? "Resume" : "Start";
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function handleKey(event, pressed) {
  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      input.left = pressed;
      break;
    case "ArrowRight":
    case "KeyD":
      input.right = pressed;
      break;
    case "ArrowUp":
    case "KeyW":
      input.thrust = pressed;
      break;
    case "Space":
      input.shoot = pressed;
      break;
    case "KeyP":
      if (pressed) togglePause();
      break;
    default:
      break;
  }
}

window.addEventListener("keydown", (event) => handleKey(event, true));
window.addEventListener("keyup", (event) => handleKey(event, false));
window.addEventListener("resize", resize);

overlayButton.addEventListener("click", () => {
  if (!state.running) {
    startGame();
  } else if (state.paused) {
    togglePause();
  }
});

resize();
createStarfield();
createShip();
showOverlay("Press Start", "home");
updateHud();

let lastTime = performance.now();
requestAnimationFrame(animate);
