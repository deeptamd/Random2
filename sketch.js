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

const MAX_BOIDS = 1200; // capped for performance
const NEIGHBOR_DIST = 40;
const DESIRED_SEP = 25;

function preload() {
  murmurationSound = loadSound("STARLINGS.mp3");
  repelSound = loadSound("FLIGHT.mp3");
}

function setup() {
  createCanvas(1200, 600);
  pixelDensity(1);

  loadWeatherData();
  setInterval(loadWeatherData, 15000);

  flock = new Flock();

  for (let i = 0; i < MAX_BOIDS; i++) {
    flock.addBoid(
      new Boid(
        width / 2 + random(-50, 50),
        height / 2 + random(-50, 50)
      )
    );
  }

  setupUI();
  murmurationSound.loop();
}

function setupUI() {
  daylightSlider = createSlider(0, 1, 0.5, 0.01);
  humiditySlider = createSlider(0, 100, 50, 1);
  skyConditionSlider = createSlider(0, 1, 0.5, 0.01);

  daylightSlider.position(20, height + 20);
  humiditySlider.position(20, height + 60);
  skyConditionSlider.position(20, height + 100);
}

function draw() {
  background(255);

  daylightValue = daylightSlider.value();
  let skyVal = skyConditionSlider.value();
  currentHumidity = humiditySlider.value();

  if (weatherData) {
    currentTemp = lerp(currentTemp, targetTemp, 0.03);
    currentHumidity = lerp(currentHumidity, targetHumidity, 0.03);
  }

  flock.run(currentTemp, currentHumidity, daylightValue, skyVal);

  if (repelPoints.length > 0) {
    flock.repel(repelPoints);
  }

  adjustSound();
}

function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    repelPoints.push(createVector(mouseX, mouseY));
    repelSound.play(0, 1, 0.3, 0, 1);
  }
}

function mouseReleased() {
  repelPoints = [];
}

function adjustSound() {
  let speed = flock.getAverageSpeed();
  murmurationSound.rate(map(speed, 1.5, 4, 0.8, 1.3));
  murmurationSound.setVolume(constrain(flock.boids.length / MAX_BOIDS, 0.3, 1));
}

function loadWeatherData() {
  loadJSON(apiURL, processWeatherData);
}

function processWeatherData(data) {
  weatherData = data;
  targetTemp = data.main.temp;
  targetHumidity = data.main.humidity;
}

// =======================
// FLOCK
// =======================

class Flock {
  constructor() {
    this.boids = [];
  }

  addBoid(b) {
    this.boids.push(b);
  }

  run(temp, humidity, daylight, sky) {
    for (let b of this.boids) {
      b.applyEnvironment(temp, humidity, daylight, sky);
      b.run(this.boids);
    }
  }

  repel(points) {
    for (let p of points) {
      for (let b of this.boids) {
        let d = p5.Vector.dist(b.position, p);
        if (d < 150) {
          let force = p5.Vector.sub(b.position, p);
          force.setMag(map(d, 0, 150, 0.6, 0));
          b.applyForce(force);
        }
      }
    }
  }

  getAverageSpeed() {
    let sum = 0;
    for (let b of this.boids) sum += b.velocity.mag();
    return sum / this.boids.length;
  }
}

// =======================
// BOID
// =======================

class Boid {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = p5.Vector.random2D();
    this.acceleration = createVector(0, 0);

    this.maxSpeed = 3;
    this.maxForce = 0.15;

    this.r = 4; // 🔥 BIGGER BOIDS
  }

  run(boids) {
    this.flock(boids);
    this.update();
    this.edges();
    this.render();
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  applyEnvironment(temp, humidity, daylight, sky) {
    this.maxSpeed = map(daylight, 0, 1, 2, 4);

    if (sky < 0.4) this.maxSpeed += 1;
    if (humidity > 70) this.maxSpeed -= 0.5;
  }

  flock(boids) {
    let sep = this.separate(boids).mult(1.6);
    let ali = this.align(boids).mult(1.0);
    let coh = this.cohesion(boids).mult(1.0);

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  render() {
    let theta = this.velocity.heading() + PI / 2;
    fill(40);
    noStroke();

    push();
    translate(this.position.x, this.position.y);
    rotate(theta);
    beginShape();
    vertex(0, -this.r * 2.5);
    vertex(-this.r, this.r * 2);
    vertex(this.r, this.r * 2);
    endShape(CLOSE);
    pop();
  }

  edges() {
    if (this.position.x < 0) this.position.x = width;
    if (this.position.y < 0) this.position.y = height;
    if (this.position.x > width) this.position.x = 0;
    if (this.position.y > height) this.position.y = 0;
  }

  separate(boids) {
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < DESIRED_SEP) {
        let diff = p5.Vector.sub(this.position, other.position);
        diff.normalize().div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) steer.div(count);
    if (steer.mag() > 0) {
      steer.setMag(this.maxSpeed);
      steer.sub(this.velocity);
      steer.limit(this.maxForce);
    }
    return steer;
  }

  align(boids) {
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < NEIGHBOR_DIST) {
        sum.add(other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxForce);
      return steer;
    }
    return createVector(0, 0);
  }

  cohesion(boids) {
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < NEIGHBOR_DIST) {
        sum.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      let desired = p5.Vector.sub(sum, this.position);
      desired.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(desired, this.velocity);
      steer.limit(this.maxForce);
      return steer;
    }
    return createVector(0, 0);
  }
}
