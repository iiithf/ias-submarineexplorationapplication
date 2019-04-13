const $p = document.querySelector('p');
const $distancealarm = document.querySelector('#distancealarm');
const $navalmine = document.querySelector('#navalmine');
const $counter = document.querySelector('#counter');
const REQUESTRATE = 500;

async function onInterval() {
  var data = await m.request({method: 'GET', url: '/status'});
  var {time, distancealarm, navalmine, counter} = data;
  if(time==null) { $p.textContent = 'Waiting for images to be ready'; return; }
  $distancealarm.textContent = distancealarm;
  $navalmine.textContent = navalmine;
  $counter.textContent = counter;
}
onInterval();
setInterval(onInterval, REQUESTRATE);
