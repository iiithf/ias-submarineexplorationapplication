const express = require('express');
const needle = require('needle');
const boolean = require('boolean');
const http = require('http');
const path = require('path');



const E = process.env;
const PORT = parseInt(E['PORT']||'8001', 10);
const ADDRESS = E['ADDRESS']||'192.168.1.7:'+PORT;
const ASSETS = path.join(__dirname, 'assets');
const DEVICE = E['DEVICE']||'http://192.168.1.7:8000';
const DATARATE = parseInt(E['DATARATE']||'10000', 10);
const IMAGES = [
  'ias-distancesensor', 'ias-sonarsensor', 'ias-floweranalysissensor',
  'ias-navalminemodel', 'ias-irismodel', 'ias-distancealarmservice',
  'ias-emergencynotificationservice', 'ias-counterservice', 'ias-irishelperservice',
];
const TRANSPORTHOST = E['TRANSPORTHOST']||'smtp.gmail.com';
const TRANSPORTPORT = parseInt(E['TRANSPORTPORT']||'587', 10);
const TRANSPORTSECURE = boolean(E['TRANSPORTSECURE']||'false');
const TRANSPORTUSER = E['TRANSPORTUSER']||'';
const TRANSPORTPASS = E['TRANSPORTPASS']||'';
const MAILFROM = E['MAILFROM']||'';
const MAILTO = E['MAILTO']||'';
const MAILSUBJECT = E['MAILSUBJECT']||'';
const MAILTEXT = E['MAILTEXT']||'';
const MAILHTML = E['MAILHTML']||'';
const app = express();
const server = http.createServer(app);
var distancesensor, sonarsensor, floweranalysissensor;
var navalminemodel, irismodel;
var distancealarmservice, emergencynotificationservice;
var counterservice, irishelperservice;
var distancealarm, navalmine, counter, dtime = null;
var intervalBusy = false;


async function imageContainer(img) {
  var res = await needle('get', `${DEVICE}/container`);
  return res.body.find(c => c.image===img);
}

function imageRun(img, cfg) {
  return needle('post', `${DEVICE}/image/${img}/run`, cfg, {json: true});
}

async function containerConfig(con) {
  var res = await needle('get', `${DEVICE}/container/${con}/config`);
  return res.body;
}

async function containerMaintain(img, cfg) {
  var c = await imageContainer(img);
  if(c==null) await imageRun(img, cfg);
  if(c==null) c = await imageContainer(img);
  return await containerConfig(c.id);
}

async function containerStart(con) {
  var c = await containerConfig(con);
  if((c.state||s.status)!=='exited') return;
  await needle('post', `${DEVICE}/container/${con}/start`);
}

async function appReady() {
  console.log('appReady()');
  return (await Promise.all(IMAGES.map(
    i => needle('get', `${DEVICE}/image/${i}/config`)
  ))).every(res => res.statusCode===200);
}

async function appMaintain() {
  console.log('appMaintain()');
  distancesensor = await containerMaintain('ias-distancesensor');
  sonarsensor = await containerMaintain('ias-sonarsensor');
  floweranalysissensor = await containerMaintain('ias-floweranalysissensor');
  navalminemodel = await containerMaintain('ias-navalminemodel');
  irismodel = await containerMaintain('ias-irismodel');
  distancealarmservice = await containerMaintain('ias-distancealarmservice', {env: {
    SOURCE: `http://${distancesensor.env.ADDRESS}/status`,
    TARGET: `http://${ADDRESS}/distancealarm`,
  }});
  emergencynotificationservice = await containerMaintain('ias-emergencynotificationservice', {env: {
    SOURCE: `http://${distancesensor.env.ADDRESS}/status`,
    TRANSPORTHOST, TRANSPORTPORT, TRANSPORTSECURE, TRANSPORTUSER, TRANSPORTPASS,
    MAILFROM, MAILTO, MAILSUBJECT, MAILTEXT, MAILHTML,
  }});
  counterservice = await containerMaintain('ias-counterservice', {env: {
    TARGET: `http://${ADDRESS}/counter`,
  }});
  irishelperservice = await containerMaintain('ias-irishelperservice', {env: {
    SOURCE: `http://${floweranalysissensor.env.ADDRESS}/status`,
    MODEL: `http://${irismodel.env.ADDRESS.split(',')[1]}/v1/models/model`,
  }});
}

async function onInterval() {
  if(!(await appReady())) return;
  await appMaintain();
  if(!sonarsensor) return;
  var res = await needle('get', `${sonarsensor.env.ADDRESS}/status`);
  console.log('sonarsensor', sonarsensor.env.ADDRESS, res.body);
  var {time, inputs} = res.body;
  if(!navalminemodel) return;
  var data = {examples: [{inputs}]};
  console.log(navalminemodel.env.ADDRESS);
  console.log(JSON.stringify(data));
  res = await needle('post', `${navalminemodel.env.ADDRESS.split(',')[1]}/v1/models/model:classify`, data, {json: true});
  console.log('navalminemodel', navalminemodel.env.ADDRESS, res.body);
  var {results} = res.body;
  results[1].sort((a, b) => b[1]-a[1]);
  navalmine = results[1][1][1];
  console.log('navalminestatus', navalmine);
}
setInterval(async () => {
  if(intervalBusy) return;
  intervalBusy = true;
  await onInterval();
  intervalBusy = false;
}, DATARATE);
setTimeout(async () => {
  var c = await imageContainer('ias-containerservice');
  await containerStart(c.id);
}, 30000);



app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use((req, res, next) => {
  Object.assign(req.body, req.query);
  var {ip, method, url, body} = req;
  if(method!=='GET') console.log(ip, method, url, body);
  next();
});

app.get('/status', (req, res) => {
  res.json({time: dtime, distancealarm, navalmine, counter});
});
app.post('/distancealarm', (req, res) => {
  var {time, status} = req.body;
  dtime = time||new Date();
  distancealarm = status;
});
app.post('/counter', (req, res) => {
  var {time, count} = req.body;
  dtime = time||new Date();
  counter = count;
});

app.use(express.static(ASSETS, {extensions: ['html']}));
app.use((err, req, res, next) => {
  console.error(err, err.stack);
  res.status(err.statusCode||500).send(err.json||err);
});
server.listen(PORT, () => {
  console.log('SUBMARINEEXPLORATIONAPPLICATION running on '+PORT);
});
