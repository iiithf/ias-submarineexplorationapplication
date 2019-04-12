const express = require('express');
const needle = require('needle');
const http = require('http');
const path = require('path');



const E = process.env;
const PORT = parseInt(E['PORT']||'8000', 10);
const ASSETS = path.join(__dirname, 'assets');
const DEVICE = E['DEVICE']||'http://127.0.0.1:8000';
const IMAGES = [
  'ias-distancesensor', 'ias-sonarsensor', 'ias-floweranalysissensor',
  'ias-navalminemodel', 'ias-irismodel', 'ias-distancealarmservice',
  'ias-emergencynotificationservice', 'ias-counterservice', 'ias-irishelperservice',
];
const app = express();
const server = http.createServer(app);



async function imageContainer(img) {
  var res = await needle('get', `${DEVICE}/container`);
  return res.body.find(c => c.image===img);
}

function imageRun(img, cfg) {
  await needle('post', `${DEVICE}/${img}/run`, cfg, {json: true});
}

async function containerMaintain(img, cfg) {
  var c = await imageContainer(img);
  if(c==null) await imageRun(img, cfg);
  return await imageContainer(img);
}

async function appReady() {
  return (await Promise.all(IMAGES.map(
    i => needle('get', `${DEVICE}/image/${i}/config`)
  ))).every(res => res.statusCode===200);
}

async function appMaintain() {
  var distancesensor = await containerMaintain('ias-distancesensor');
  var sonarsensor = await containerMaintain('ias-sonarsensor');
  var floweranalysissensor = await containerMaintain('ias-floweranalysissensor');
  var navalminemodel = await containerMaintain('ias-navalminemodel');
  var irismodel = await containerMaintain('ias-irismodel');
  var distancealarmservice = await containerMaintain('ias-distancealarmservice', {env: {
    SOURCE: `http://${distancesensor.env.ADDRESS}/status`,
    TARGET: `http://${ADDRESS}/distancealarm`,
  }});
  var emergencynotificationservice = await containerMaintain('ias-emergencynotificationservice', {env: {
    SOURCE: `http://${distancesensor.env.ADDRESS}/status`,
    // MAIL
  }});
  var counterservice = await containerMaintain('ias-counterservice', {env: {
    TARGET: `http://${ADDRESS}/counter`,
  }});
  var irishelperservice = await containerMaintain('ias-irishelperservice', {env: {
    SOURCE: `http://${floweranalysissensor.env.ADDRESS}/status`,
    MODEL: `http://${irismodel.env.ADDRESS}/v1/models/model`,
  }});
}


app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use((req, res, next) => {
  Object.assign(req.body, req.query);
  var {ip, method, url, body} = req;
  if(method!=='GET') console.log(ip, method, url, body);
  next();
});

app.use(express.static(ASSETS, {extensions: ['html']}));
app.use((err, req, res, next) => {
  console.error(err, err.stack);
  res.status(err.statusCode||500).send(err.json||err);
});
server.listen(PORT, () => {
  console.log('SUBMARINEEXPLORATIONAPPLICATION running on '+PORT);
});
