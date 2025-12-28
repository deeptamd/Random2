let flock;
let weatherData; // To store the weather data

let apiURL =
  "https://api.openweathermap.org/data/2.5/weather?q=Bengaluru&APPID=aacedc9a30cfcbe4d7e237cd5ad4830b";

let currentTemp = 273; // Initial temperature in Kelvin
let targetTemp = 273; // Target temperature
let currentHumidity = 50; // Initial humidity
let targetHumidity = 50;

let daylightValue = 0; // Amount of sunlight
let weatherCondition = ""; // Current weather condition

let daylightSlider; // Slider for controlling daylight
let humiditySlider; // Slider for controlling humidity
let skyConditionSlider; // Slider for controlling sky condition

let murmurationSound; // Sound object for murmuration
let repelSound; // Sound object for repelling effect

let repelPoints = []; // Array to store multiple repelling points

function preload() {
  murmurationSound = loadSound("STARLINGS.mp3");
  repelSound = loadSound("FLIGHT.mp3");
}

function setup() {
  createCanvas(1200, 600);
  loadWeatherData();
  setInterval(loadWeatherData, 10000);

  flock = new Flock();

  for (let i = 0; i < 2000; i++) {
    let b = new Boid(
      width / 2 + random(-50, 50),
      height / 2 + random(-50, 50)
    );
    flock.addBoid(b);
  }

  daylightSlider = createSlider(0, 1, 0.5, 0.01);
  humiditySlider = createSlider(0, 100, 50, 1);
  skyConditionSlider = createSlider(0, 1, 0.5, 0.01);

  daylightSlider.position(20, height + 20);
  humiditySlider.position(20, height + 60);
  skyConditionSlider.position(20, height + 100);

  murmurationSound.loop();
}

function draw() {
  background(255);

  daylightValue = daylightSlider.value();
  let skyConditionValue = skyConditionSlider.value();
  currentHumidity = humiditySlider.value();

  if (weatherData) {
    currentTemp = lerp(currentTemp, targetTemp, 0.05);
    currentHumidity = lerp(currentHumidity, targetHumidity, 0.05);

    for (let boid of flock.boids) {
      boid.updateWeatherEffects(
        currentTemp,
        currentHumidity,
        weatherCondition,
        daylightValue,
        skyConditionValue
      );
    }
  }

  flock.run();
  adjustBoidCount(daylightValue, skyConditionValue);

  if (repelPoints.length > 0) {
    flock.repelMultiple(repelPoints);
  }
}

function mousePressed() {
  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    repelPoints.push(createVector(mouseX, mouseY));
    repelSound.play();
  }
}

function mouseReleased() {
  repelPoints = [];
}

function adjustBoidCount(daylightValue, skyConditionValue) {
  let targetBoidCount = map(daylightValue, 0, 1, 500, 1700);

  while (flock.boids.length > targetBoidCount) flock.boids.pop();

  while (flock.boids.length < targetBoidCount) {
    let b = new Boid(
      width / 2 + random(-100, 100),
      height / 2 + random(-100, 100)
    );
    flock.addBoid(b);
  }
}

function loadWeatherData() {
  loadJSON(apiURL, processWeatherData, handleError);
}

function processWeatherData(data) {
  weatherData = data;
  targetTemp = weatherData.main.temp;
  targetHumidity = weatherData.main.humidity;
  weatherCondition = weatherData.weather[0].description;
}

function handleError(err) {
  console.error("Error loading weather data:", err);
}

// =======================
// FLOCK CLASS
// =======================

class Flock {
  constructor() {
    this.boids = [];
  }

  run() {
    for (let boid of this.boids) {
      boid.run(this.boids);
    }
  }

  repelMultiple(points) {
    for (let point of points) {
      for (let boid of this.boids) {
        let distance = p5.Vector.dist(boid.position, point);

        if (distance < 200) {
          let repelForce = p5.Vector.sub(boid.position, point);
          repelForce.setMag(
            map(distance, 0, 200, boid.maxforce * 20, 0)
          );
          boid.applyForce(repelForce);
        }
      }
    }
  }

  addBoid(b) {
    this.boids.push(b);
  }
}

// =======================
// BOID CLASS
// =======================

class Boid {
  constructor(x, y) {
    this.acceleration = createVector(0, 0);
    this.velocity = createVector(random(-1, 1), random(-1, 1));
    this.position = createVector(x, y);

    this.r = 1.5;
    this.maxspeed = 3;
    this.maxforce = 0.3;

    this.separationFactor = 20.0;
    this.cohesionFactor = 20.0;
  }

  run(boids) {
    this.flock(boids);
    this.update();
    this.borders();
    this.render();
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  updateWeatherEffects(
    temp,
    humidity,
    skyCondition,
    daylightValue,
    skyConditionValue
  ) {
    this.cohesionFactor = map(temp, 270, 310, 1.0, 2.0);
    this.separationFactor = map(humidity, 0, 100, 1.0, 3.0);

    if (skyConditionValue < 0.5) {
      this.maxspeed = 7;
      this.maxforce = 0.5;
    } else {
      this.maxspeed = 3;
      this.maxforce = 0.3;
    }

    if (daylightValue < 0.2) {
      this.maxspeed = 2;
      this.maxforce = 0.2;
    }
  }

  flock(boids) {
    let sep = this.separate(boids).mult(this.separationFactor);
    let ali = this.align(boids).mult(2);
    let coh = this.cohesion(boids).mult(this.cohesionFactor);

    this.applyForce(sep);
    this.applyForce(ali);
    this.applyForce(coh);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxspeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  render() {
    let theta = this.velocity.heading() + radians(90);

    fill(50);
    stroke(50);

    push();
    translate(this.position.x, this.position.y);
    rotate(theta);
    beginShape();
    vertex(0, -this.r * 2);
    vertex(-this.r, this.r * 2);
    vertex(this.r, this.r * 2);
    endShape(CLOSE);
    pop();
  }

  borders() {
    let margin = 220;
    if (this.position.x < margin)
      this.applyForce(createVector(this.maxforce, 0));
    if (this.position.y < margin)
      this.applyForce(createVector(0, this.maxforce));
    if (this.position.x > width - margin)
      this.applyForce(createVector(-this.maxforce, 0));
    if (this.position.y > height - margin)
      this.applyForce(createVector(0, -this.maxforce));
  }

  separate(boids) {
    let desiredSeparation = 20.0;
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < desiredSeparation) {
        let diff = p5.Vector.sub(this.position, other.position);
        diff.normalize();
        diff.div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) steer.div(count);

    if (steer.mag() > 0) {
      steer.normalize();
      steer.mult(this.maxspeed);
      steer.sub(this.velocity);
      steer.limit(this.maxforce);
    }
    return steer;
  }

  align(boids) {
    let neighborDist = 30;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < neighborDist) {
        sum.add(other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.normalize();
      sum.mult(this.maxspeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxforce);
      return steer;
    }
    return createVector(0, 0);
  }

  cohesion(boids) {
    let neighborDist = 30;
    let sum = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.position, other.position);
      if (d > 0 && d < neighborDist) {
        sum.add(other.position);
        count++;
      }
    }

    if (count > 0) {
      sum.div(count);
      sum.sub(this.position);
      sum.normalize();
      sum.mult(this.maxspeed);
      let steer = p5.Vector.sub(sum, this.velocity);
      steer.limit(this.maxforce);
      return steer;
    }
    return createVector(0, 0);
  }
}
