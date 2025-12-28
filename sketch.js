// ===================== CONFIG =====================
const MAX_BOIDS = 800;
const MIN_BOIDS = 300;
const WEATHER_UPDATE_INTERVAL = 30;
const SOUND_UPDATE_INTERVAL = 20;

// ===================== GLOBALS =====================
let flock;
let weatherData;
let apiURL =
  "https://api.openweathermap.org/data/2.5/weather?q=Bengaluru&APPID=aacedc9a30cfcbe4d7e237cd5ad4830b";

let currentTemp = 273;
let targetTemp = 273;
let currentHumidity = 50;
let targetHumidity = 50;
let daylightValue = 0;

let daylightSlider, humiditySlider, skyConditionSlider;
let murmurationSound, repelSound;
let repelPoints = [];

let weatherCounter = 0;
let soundCounter = 0;

// ===================== PRELOAD =====================
function preload() {
  murmurationSound = loadSound("STARLINGS.mp3");
  repelSound = loadSound("FLIGHT.mp3");
}

// ===================== SETUP =====================
function setup() {
  createCanvas(1200, 600);
  frameRate(30);

  flock = new Flock();

  for (let i = 0; i < MAX_BOIDS; i++) {
    flock.addBoid(new Boid(random(width), random(height)));
  }

  setupUI();
  loadWeatherData();
  setInterval(loadWeatherData, 15000);

  murmurationSound.loop();
}

// ===================== UI =====================
function setupUI() {
  let left = createDiv("").position(10, height + 10);

  createP("DAYLIGHT").parent(left);
  daylightSlider = createSlider(0, 1, 0.5, 0.01).parent(left);

  createP("SKY CONDITION").parent(left);
  skyConditionSlider = createSlider(0, 1, 0.5, 0.01).parent(left);

  createP("HUMIDITY").parent(left);
  humiditySlider = createSlider(0, 100, 50, 1).parent(left);
}

// ===================== DRAW =====================
function draw() {
  background(255);

  daylightValue = daylightSlider.value();
  currentHumidity = humiditySlider.value();

  weatherCounter++;
  soundCounter++;

  if (weatherCounter % WEATHER_UPDATE_INTERVAL === 0 && weatherData) {
    currentTemp = lerp(currentTemp, targetTemp, 0.1);
    targetHumidity = weatherData.main.humidity;

    for (let boid of flock.boids) {
      boid.updateWeatherEffects(
        currentTemp,
        currentHumidity,
        daylightValue,
        skyConditionSlider.value()
      );
    }
  }

  flock.run();
  adjustBoidCount();

  if (soundCounter % SOUND_UPDATE_INTERVAL === 0) {
    adjustSound();
  }

  if (repelPoints.length > 0) {
    flock.repel(repelPoints);
  }
}

// ===================== INTERACTION =====================
function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    repelPoints = [createVector(mouseX, mouseY)];
    repelSound.setVolume(0.15);
    repelSound.play();
  }
}

function mouseReleased() {
  repelPoints = [];
  repelSound.fade(0, 1);
}

// ===================== WEATHER =====================
function loadWeatherData() {
  loadJSON(apiURL, (data) => {
    weatherData = data;
    targetTemp = data.main.temp;
  });
}

// ===================== BOID COUNT =====================
function adjustBoidCount() {
  let target = int(map(daylightValue, 0, 1, MIN_BOIDS, MAX_BOIDS));

  while (flock.boids.length > target) flock.boids.pop();
  while (flock.boids.length < target)
    flock.addBoid(new Boid(random(width), random(height)));
}

// ===================== SOUND =====================
function adjustSound() {
  let avgSpeed = flock.avgSpeed();
  murmurationSound.rate(map(avgSpeed, 1, 5, 0.9, 1.3));
  murmurationSound.setVolume(flock.boids.length / MAX_BOIDS);
}

// ===================== FLOCK =====================
class Flock {
  constructor() {
    this.boids = [];
  }

  addBoid(b) {
    this.boids.push(b);
  }

  run() {
    for (let b of this.boids) {
      b.run(this.boids);
    }
  }

  repel(points) {
    for (let p of points) {
      for (let b of this.boids) {
        let d = p5.Vector.dist(b.position, p);
        if (d < 120) {
          let force = p5.Vector.sub(b.position, p);
          force.setMag(map(d, 0, 120, 1, 0));
          b.applyForce(force);
        }
      }
    }
  }

  avgSpeed() {
    let sum = 0;
    for (let b of this.boids) sum += b.velocity.mag();
    return sum / this.boids.length;
  }
}

// ===================== BOID =====================
class Boid {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D();
    this.acceleration = createVector();
    this.maxSpeed = 3;
    this.maxForce = 0.15;
  }

  run(boids) {
    this.flock(boids);
    this.update();
    this.wrap();
    this.render();
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  flock(boids) {
    let sep = this.separate(boids).mult(1.5);
    let ali = this.align(boids);
    let coh = this.cohesion(boids);

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
  }

  updateWeatherEffects(temp, humidity, daylight, sky) {
    this.maxSpeed = map(daylight, 0, 1, 2, 4);
    this.maxForce = map(humidity, 0, 100, 0.1, 0.25);
    if (sky < 0.5) this.maxSpeed += 1;
  }

  render() {
    stroke(60);
    point(this.position.x, this.position.y);
  }

  wrap() {
    if (this.position.x < 0) this.position.x = width;
    if (this.position.y < 0) this.position.y = height;
    if (this.position.x > width) this.position.x = 0;
    if (this.position.y > height) this.position.y = 0;
  }

  separate(boids) {
    let steer = createVector();
    let count = 0;

    for (let o of boids) {
      let d = p5.Vector.dist(this.position, o.position);
      if (d > 0 && d < 15) {
        let diff = p5.Vector.sub(this.position, o.position);
        diff.normalize().div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) steer.div(count);
    steer.limit(this.maxForce);
    return steer;
  }

  align(boids) {
    let sum = createVector();
    let count = 0;

    for (let o of boids) {
      let d = p5.Vector.dist(this.position, o.position);
      if (d > 0 && d < 25) {
        sum.add(o.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count).setMag(this.maxSpeed);
      return p5.Vector.sub(sum, this.velocity).limit(this.maxForce);
    }
    return createVector();
  }

  cohesion(boids) {
    let sum = createVector();
    let count = 0;

    for (let o of boids) {
      let d = p5.Vector.dist(this.position, o.position);
      if (d > 0 && d < 25) {
        sum.add(o.position);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      return p5.Vector.sub(sum, this.position).limit(this.maxForce);
    }
    return createVector();
  }
}
