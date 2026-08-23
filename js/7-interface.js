"use strict";
// ---------- panneau : boutique, cultures, aide (et pause) ----------
const ovl = document.getElementById('ovl'), elTitle = document.getElementById('sheetTitle'),
      elTabs = document.getElementById('tabs'), elBody = document.getElementById('body');
const TABS = [['shop','🛒 Boutique'], ['parc','🚜 Parc'], ['crop','🌱 Cultures'],
              ['ctrl','🎮 Pilotage'], ['help','❔ Aide']];
let panelTab = 'shop', paused = false;
const panelOpen = () => ovl.classList.contains('on');
function openPanel(tab){
  panelTab = tab || panelTab; paused = true;
  ovl.classList.add('on'); drawPanel();
}
function closePanel(){
  if (panelTab === 'level' && prize > 0){       // refermer vaut encaisser : le bonus n'est jamais perdu
    coins += prize; prize = 0; popChip(chipCoins); sfx('coin');
  }
  if (panelTab === 'level') panelTab = 'shop';
  paused = false; ovl.classList.remove('on'); save();
}
document.getElementById('sheetX').onclick = closePanel;
ovl.addEventListener('pointerdown', e => { if (e.target === ovl) closePanel(); });

function canChangeCrop(){
  if (stage === 0) return true;
  if (stage !== 1) return false;
  for(let k=0;k<plants.length;k++) if (plants[k].g > 0) return false;
  return true;
}
function statsHTML(){
  return '<div class="stats">' +
    '<div><b>' + fmt(coins) + ' 🪙</b><span>trésorerie</span></div>' +
    '<div><b>Niveau ' + level() + '</b><span>' + fmt(totalT) + ' t livrées</span></div>' +
    '<div><b>Jour ' + day + '</b><span>' + WEATHER[wKey].emo + ' ' + WEATHER[wKey].n + '</span></div>' +
    '<div><b>' + harvests + '</b><span>récoltes bouclées</span></div></div>';
}
function drawPanel(){
  if (panelTab === 'level') return drawLevel(lvlShown);
  elTabs.innerHTML = '';
  elTabs.style.display = '';
  document.getElementById('sheet').classList.remove('party');
  document.getElementById('sheetHead').classList.remove('party-head');
  TABS.forEach(([id,n]) => {
    const b = document.createElement('button');
    b.className = 'tab' + (id === panelTab ? ' on' : ''); b.textContent = n;
    b.onclick = () => { panelTab = id; drawPanel(); };
    elTabs.appendChild(b);
  });
  elTitle.textContent = panelTab === 'shop' ? 'Boutique' : panelTab === 'parc' ? 'Parc matériel'
                      : panelTab === 'crop' ? 'Cultures'
                      : panelTab === 'ctrl' ? 'Pilotage' : 'Aide';
  elBody.innerHTML = '';
  elBody.scrollTop = 0;
  if (panelTab === 'shop') drawShop();
  else if (panelTab === 'parc') drawParc();
  else if (panelTab === 'crop') drawCrops();
  else if (panelTab === 'ctrl') drawCtrl();
  else drawHelp();
}
function card(icon, title, sub, extraHTML){
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = '<div class="ic">' + icon + '</div><div class="tx"><b>' + title +
                '</b><span>' + sub + '</span>' + (extraHTML || '') + '</div>';
  return d;
}
function drawShop(){
  elBody.insertAdjacentHTML('beforeend', statsHTML());
  elBody.insertAdjacentHTML('beforeend',
    '<div class="note">Chaque niveau se paie avec la recette du silo et vaut pour tous les engins.</div>');
  UPGRADES.forEach(u => {
    const l = lv[u.id], maxed = l >= u.max, cost = upCost(u,l);
    const bars = '<div class="lv">' + Array.from({length:u.max},
      (_,i) => '<i class="' + (i < l ? 'f' : '') + '"></i>').join('') + '</div>';
    const c = card(u.emo, u.n, u.d, bars);
    const b = document.createElement('button');
    b.className = 'buy' + (maxed ? ' max' : '');
    b.textContent = maxed ? 'max' : fmt(cost) + ' 🪙';
    b.disabled = maxed || coins < cost;
    b.onclick = () => {
      if (coins < cost || maxed){ sfx('deny'); return; }
      coins -= cost; lv[u.id]++; applyUpgrades(); sfx('buy');
      toast(u.n + ' niveau ' + lv[u.id], 'good'); save(); drawPanel();
    };
    c.appendChild(b); elBody.appendChild(c);
  });
  const r = document.createElement('div');
  r.innerHTML = '<button class="buy max full-btn" id="wipe">↺ Nouvelle partie</button>';
  elBody.appendChild(r);
  document.getElementById('wipe').onclick = () => {
    if (confirm('Effacer la sauvegarde et repartir de zéro ?')) wipe();
  };
}
// ---------- le parc : on achète des pièces, et chacune monte en gamme de son côté ----------
// Deux moitiés : ce qu'on peut acheter neuf, en autant d'exemplaires qu'on veut, et ce
// qu'on possède déjà, chaque pièce avec son bouton d'amélioration.
function ligne(icone, titre, sous, boutonTexte, actif, action){
  const c = card(icone, titre, sous);
  const b = document.createElement('button');
  if (!action){ b.className = 'buy max'; b.disabled = true; b.textContent = boutonTexte; }
  else {
    b.className = 'buy'; b.textContent = boutonTexte; b.disabled = !actif;
    b.onclick = () => { if (!actif){ sfx('deny'); return; } action(); };
  }
  c.appendChild(b); elBody.appendChild(c);
  return c;
}
const titreParc = t => elBody.insertAdjacentHTML('beforeend', '<div class="note"><b>' + t + '</b></div>');
// La boutique est une liste, pas un catalogue : un article par machine, toujours le plus
// petit modèle. On en achète autant qu'on veut. Monter en gamme se fait plus bas, en
// cliquant sur la pièce qu'on possède déjà — jamais en la rachetant.
function drawParc(){
  elBody.insertAdjacentHTML('beforeend', statsHTML());
  titreParc('🛒 À acheter');
  elBody.insertAdjacentHTML('beforeend',
    '<div class="note">Un tracteur ne fait rien seul : c\u2019est ce qu\u2019on accroche ' +
    'derrière qui décide de son métier, et le bouton \u2693 du pupitre le décroche sur place ' +
    'pour aller en prendre un autre.</div>');
  const achat = (emo, nom, det, prix, faire) =>
    ligne(emo, nom, det, fmt(prix) + ' 🪙', coins >= prix, () => {
      if (!faire()){ sfx('deny'); return; }
      sfx('buy'); toast(nom + ' livré au parc', 'good'); drawVeh(); drawHitch(); drawPanel();
    });
  achat(PORTEURS.tracteur.emo, 'Tracteur compact', PORTEURS.tracteur.det(0),
        PORTEURS.tracteur.prix[0], () => acheterPorteur('tracteur', 0));
  TYPES_OUTIL.forEach(type => {
    const D = OUTILS[type];
    achat(D.emo, D.n + ' — ' + TAILLES[0], 'remorque à atteler · ' + D.det(0),
          D.prix[0], () => acheterOutil(type, 0));
  });
  achat(PORTEURS.moiss.emo, 'Moissonneuse compacte',
        PORTEURS.moiss.det(0) + ' · ' + PORTEURS.moiss.outil.det(0),
        PORTEURS.moiss.prix[0], () => acheterPorteur('moiss', 0));
  achat(PORTEURS.pulve.emo, 'Pulvérisateur automoteur',
        PORTEURS.pulve.det(0) + ' · ' + PORTEURS.pulve.outil.det(0),
        PORTEURS.pulve.prix[0], () => acheterPorteur('pulve', 0));
  if (siloNiv < 0)
    achat(SILOS[0].emo, 'Silo', SILOS[0].d, SILOS[0].prix, () => acheterSilo());

  // ---- ce qu'on possède : une ligne par pièce, et son passage à la taille au-dessus ----
  if (!engins.length && !outils.length && siloNiv < 0) return;
  titreParc('🏠 Au parc — cliquer pour faire évoluer');
  engins.forEach(v => {
    const P = PORTEURS[v.kind], max = P.prix.length - 1;
    const o = outilDe(v);
    const sous = P.nom[v.niv] + ' · ' + (o ? OUTILS[o.type].n.toLowerCase() + ', ' + TAILLES[o.niv]
                                           : v.kind === 'tracteur' ? 'rien d\u2019attelé'
                                           : P.outil.det(v.bec));
    if (v.niv >= max) ligne(icoVeh(v), nomVeh(v), sous, 'au maximum', false, null);
    else {
      const net = coutAmelioration(P.prix, v.niv, v.niv+1);
      ligne(icoVeh(v), nomVeh(v), sous + ' — passer en ' + P.nom[v.niv+1].toLowerCase(),
            fmt(net) + ' 🪙', coins >= net, () => {
              if (ameliorerEngin(v.pid) === null){ sfx('deny'); return; }
              sfx('buy'); toast('Machine remotorisée', 'good'); drawVeh(); drawPanel();
            });
    }
    if (P.outil && v.bec < 2){
      const net = coutAmelioration(P.outil.prix, v.bec, v.bec+1);
      ligne('📏', P.outil.n, P.outil.det(v.bec) + ' — passer à ' + P.outil.det(v.bec+1),
            fmt(net) + ' 🪙', coins >= net, () => {
              if (ameliorerBec(v.pid) === null){ sfx('deny'); return; }
              sfx('buy'); toast(P.outil.n + ' élargie', 'good'); drawVeh(); drawPanel();
            });
    }
  });
  outils.forEach(o => {
    const D = OUTILS[o.type];
    const porteur = o.porteur ? enginPar(o.porteur) : null;
    const ou = porteur ? 'attelé' : 'posé dans la cour';
    if (o.niv >= 2) return ligne(D.emo, D.n + ' — ' + TAILLES[o.niv], D.det(o.niv) + ' · ' + ou,
                                 'au maximum', false, null);
    const net = coutAmelioration(D.prix, o.niv, o.niv+1);
    const trop = porteur && D.force[o.niv+1] > porteur.niv;
    ligne(D.emo, D.n + ' — ' + TAILLES[o.niv],
          D.det(o.niv) + ' · ' + ou + (trop ? ' — le tracteur qui le tire est trop léger'
                                            : ' — passer au ' + TAILLES[o.niv+1] + ', ' + D.det(o.niv+1)),
          trop ? 'tracteur trop léger' : fmt(net) + ' 🪙', !trop && coins >= net,
          trop ? null : () => {
            const r = ameliorerOutil(o.oid);
            if (r === null || r === 'lourd'){ sfx('deny'); return; }
            sfx('buy'); toast(D.n + ' élargi', 'good'); drawVeh(); drawPanel();
          });
  });
  if (siloNiv === 0){
    const net = coutAmelioration([SILOS[0].prix, SILOS[1].prix], 0, 1);
    ligne(SILOS[0].emo, SILOS[0].n, SILOS[0].d + ' — passer au grand silo',
          fmt(net) + ' 🪙', coins >= net, () => {
            if (ameliorerSilo() === null){ sfx('deny'); return; }
            sfx('buy'); toast('Grand silo bâti dans la cour', 'good'); drawPanel();
          });
  } else if (siloNiv === 1)
    ligne(SILOS[1].emo, SILOS[1].n, SILOS[1].d, 'au maximum', false, null);
}
const fr = n => n.toFixed(1).replace('.', ',');
function drawCrops(){
  const free = canChangeCrop();
  elBody.insertAdjacentHTML('beforeend', '<div class="note">' + (free
    ? 'Choisis ce que tu sèmes. La semence est payée au lancement du semis.'
    : 'La parcelle est déjà en culture — tu pourras changer au prochain déchaumage.') + '</div>');
  CROPS.forEach((c,i) => {
    const have = owned[c.id];
    const sub = c.d + ' · ' + c.price + ' 🪙/t' +
                (c.seed ? ' · semence ' + fmt(c.seed) + ' 🪙' : ' · semence offerte');
    const el = card(c.emo, c.n, sub);
    if (i === cropI) el.classList.add('sel');
    const b = document.createElement('button');
    b.className = 'buy';
    if (!have){
      b.textContent = fmt(c.unlock) + ' 🪙';
      b.disabled = coins < c.unlock;
      b.onclick = () => {
        if (coins < c.unlock){ sfx('deny'); return; }
        coins -= c.unlock; owned[c.id] = true; sfx('buy');
        toast(c.n + ' débloqué', 'good'); save(); drawPanel();
      };
    } else if (i === cropI){
      b.className = 'buy max'; b.textContent = 'en place';
    } else {
      b.textContent = 'semer';
      b.disabled = !free;
      b.onclick = () => {
        if (!free){ sfx('deny'); return; }
        cropI = i; applyCrop(); sfx('buy');
        toast(c.emo + ' ' + c.n + ' sélectionné', 'good'); save(); drawPanel(); refreshNow();
      };
    }
    el.appendChild(b); elBody.appendChild(el);
  });
}
let lvlShown = 1, prize = 0;
function levelUp(n){
  prize = n*750;
  panelTab = 'level'; paused = true;
  ovl.classList.add('on'); drawLevel(n);
  confetti(40); sfx('cash');
}
function drawLevel(n){
  document.getElementById('sheet').classList.add('party');
  document.getElementById('sheetHead').classList.add('party-head');
  elTitle.textContent = 'Niveau ' + n + ' !';
  elTabs.innerHTML = ''; elTabs.style.display = 'none';
  elBody.innerHTML =
    '<div class="prize"><div class="big"><span class="c"></span>' + fmt(prize) + '</div>' +
    '<p>' + fmt(totalT) + ' tonnes livrées depuis le début. Le domaine grandit.</p></div>';
  const b = document.createElement('button');
  b.className = 'buy gold full-btn'; b.textContent = 'Encaisser';
  b.onclick = () => {
    coins += prize; prize = 0; popChip(chipCoins); sfx('coin');
    panelTab = 'shop'; closePanel(); save();
  };
  elBody.appendChild(b);
}
function drawCtrl(){
  elBody.insertAdjacentHTML('beforeend',
    '<div class="note">Trois façons de conduire. Le pilote automatique reste disponible dans tous les cas, ' +
    'et le clavier reprend la main dès qu\'on l\'utilise.</div>');
  elBody.insertAdjacentHTML('beforeend',
    '<div class="note"><b>Un doigt</b> — une <b>tape</b> sur un engin le sélectionne, un ' +
    'triangle se plante au-dessus. <b>Deux tapes</b> sur le champ y envoient l\'engin ' +
    'sélectionné. Un <b>balayage</b> lui dessine un parcours, qu\'il suit et qui s\'efface ' +
    'derrière lui. Le bouton ◼ l\'arrête.<br><b>Deux doigts</b> — <b>écarter</b> pour zoomer, ' +
    '<b>glisser</b> pour déplacer la carte, <b>tourner</b> pour la faire pivoter. La caméra ne ' +
    'suit jamais les engins : elle reste où on la laisse, et la pastille 🎯 la ramène sur ' +
    'l\'engin sélectionné.<br>Tous les engins restent sur la carte : celui qu\'on quitte ' +
    'continue son travail.</div>');
  // l'inclinaison a quitté le balayage à deux doigts, qui déplace maintenant la carte
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = '<div class="ico">📐</div><div class="txt"><b>Inclinaison de la caméra</b>' +
                 '<i id="pitchVal">' + Math.round(PITCH*180/Math.PI) + '°</i></div>';
  const sl = document.createElement('input');
  sl.type = 'range'; sl.min = '28'; sl.max = '85'; sl.step = '1';
  sl.value = String(Math.round(PITCH*180/Math.PI));
  sl.style.cssText = 'width:100%;margin-top:6px';
  sl.oninput = () => { setPitch(+sl.value*Math.PI/180);
                       const t = document.getElementById('pitchVal');
                       if (t) t.textContent = sl.value + '°'; };
  sl.onchange = () => save();
  const wrap = document.createElement('div'); wrap.style.cssText = 'flex:1 1 100%';
  wrap.appendChild(sl); el.appendChild(wrap); elBody.appendChild(el);
}
function drawHelp(){
  elBody.insertAdjacentHTML('beforeend',
    '<div class="note"><b>La cour est vide au départ.</b> Tout se trouve à l\u2019onglet ' +
    '<b>🚜 Parc</b> : des tracteurs, et des outils qu\u2019on accroche derrière. Un tracteur, ' +
    'une déchaumeuse, un semoir, une benne et une moissonneuse suffisent à boucler une ' +
    'première récolte — le même tracteur fait tout, il change d\u2019outil au bouton \u2693. ' +
    'Le pulvérisateur peut attendre : sans lui la culture pousse, bien plus lentement.</div>');
  elBody.insertAdjacentHTML('beforeend',
    '<div class="note">Un cycle complet : <b>déchaumer</b> le sol, <b>semer</b>, <b>fertiliser</b>, ' +
    'laisser <b>pousser</b>, puis <b>moissonner</b>. La benne vide la moissonneuse et porte le grain au silo, ' +
    'qui le paie. La météo et la nuit passent toutes seules ; la pluie arrose mais ralentit les engins.</div>');
  elBody.insertAdjacentHTML('beforeend',
    '<div class="keys">' +
    '<kbd>Z Q S D</kbd><span>piloter (ou W A S D / flèches)</span>' +
    '<kbd>Espace</kbd><span>freiner</span>' +
    '<kbd>V</kbd><span>pilote automatique</span>' +
    '<kbd>E</kbd><span>changer d\'engin</span>' +
    '<kbd>R</kbd><span>décrocher / atteler l\'outil</span>' +
    '<kbd>1 2 3 4</kbd><span>sol · semis · engrais · moisson</span>' +
    '<kbd>X</kbd><span>accélérer le temps ×1 ×3 ×6</span>' +
    '<kbd>B</kbd><span>boutique</span>' +
    '<kbd>C</kbd><span>cultures</span>' +
    '<kbd>H</kbd><span>cette aide</span>' +
    '<kbd>N</kbd><span>couper le son</span>' +
    '<kbd>Échap</kbd><span>pause / reprendre</span>' +
    '</div>');
  elBody.insertAdjacentHTML('beforeend',
    '<div class="note" style="margin-top:12px">Au doigt, trois gestes : une <b>tape</b> sur un engin le ' +
    'sélectionne, <b>deux tapes</b> sur le champ l\'y envoient, un <b>balayage</b> lui dessine un parcours ' +
    'qui s\'efface à mesure qu\'il le suit. À <b>deux doigts</b>, le champ appartient à la caméra : écarter ' +
    'pour zoomer, glisser pour la déplacer, tourner pour la faire pivoter — elle ne suit jamais les engins. ' +
    'Le <b>manche</b> reste en bas pour conduire à la main.<br>Tous les engins vivent sur la carte : celui ' +
    'qu\'on quitte garde son tracé et continue de travailler.</div>');
}

// ---------- manette ----------
let jx = 0, jy = 0, jmag = 0, manual = false, btnAuto = null;   // une seule manette : angle = cap, amplitude = vitesse
// trois façons de conduire : au manche, au cap et à l'allure, ou sur un parcours dessiné
const CTRL = [
  { id:'manche', n:'Manche', emo:'🕹️', d:'La direction donne le cap, l\'amplitude la vitesse.' }
];
let ctrlMode = 'manche';
// Deux temps seulement : au repos le doigt appartient à la carte, armé il dessine le
// parcours de l'engin conduit. Tant qu'on est armé on peut tracer autant de traits qu'on
// veut : ils s'ajoutent au bout du parcours, l'engin les avale au fur et à mesure.
let pathState = 'pret';                 // conservé pour la sonde : 'pret' | 'route'
function applyCtrl(){ /* un seul poste de commande : le manche, toujours en place */ }
function drawPathBtn(){
  const b = document.getElementById('pathBtn');
  if (!b) return;
  const v = pilote(), n = traceLeft(v);
  const roule = n >= 2 || !!(v && v.goto);
  pathState = roule ? 'route' : 'pret';
  b.classList.toggle('rolling', roule);
  b.classList.remove('armed');
  b.setAttribute('aria-label', roule ? 'Arrêter l\'engin · ' + n + ' points' : 'Arrêter l\'engin');
}
function setPathState(st){ drawPathBtn(); }
(function(){
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let id = null;
  function set(e){
    const r = stick.getBoundingClientRect();
    const R = r.width*.36;                       // la course suit la taille réelle du manche
    let dx = e.clientX - (r.left+r.width/2), dy = e.clientY - (r.top+r.height/2);
    const m = Math.hypot(dx,dy) || 1, k = Math.min(1, m/R);
    jx = dx/m*k; jy = dy/m*k; jmag = k;
    knob.style.transform = `translate(${jx*R}px,${jy*R}px)`;
    if (jmag > .2) setManual();
  }
  stick.addEventListener('pointerdown', e => { SND.boot(); id = e.pointerId; stick.setPointerCapture(id); set(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId===id) set(e); });
  const clear = e => { if (e.pointerId!==id) return; id=null; jx=jy=jmag=0; knob.style.transform=''; };
  stick.addEventListener('pointerup', clear);
  stick.addEventListener('pointercancel', clear);
})();

// --- Le doigt, un seul gestionnaire pour tout :
//   une tape sur un engin le sélectionne ;
//   deux tapes sur le champ y envoient l'engin sélectionné ;
//   un balayage lui dessine un parcours, qu'il suit et qui s'efface derrière lui ;
//   deux doigts appartiennent à la caméra — écarter zoome, glisser déplace, tourner pivote.
// Un seul jeu d'écouteurs, aucune capture de pointeur, aucun pointerleave : ce sont eux qui
// faisaient rater le pincement une fois sur deux.
(function(){
  const el = document.getElementById('stage');
  const btn = document.getElementById('pathBtn');
  // Un tracé se mérite. Le doigt qui se pose et ripe de deux millimètres ne doit rien
  // lancer du tout : il faut du temps ET de la longueur, et tant que les deux ne sont pas
  // réunis on ne fait qu'enregistrer le geste, sans rien envoyer à l'engin.
  const SEUIL = 14;                                  // px : en dessous, c'était une tape
  const TENUE = 260;                                 // ms de doigt posé avant qu'un tracé prenne
  const LONGE = 58;                                  // px de trait réellement dessiné
  let mode = 'rien';                                 // 'rien' | 'esquisse' | 'trace' | 'camera'
  let id1 = null, x0 = 0, y0 = 0, t0 = 0, lg = 0, lx = 0, ly = 0, buf = [];
  let bD = 0, bZ = 1, bX = 0, bY = 0, bA = 0, cum = 0;
  let tapT = 0, tapX = 0, tapY = 0;
  const deux = () => { const it = TOUCH.values(); return [it.next().value, it.next().value]; };
  function baseCam(){
    const [a,b] = deux(); if (!a || !b) return;
    bD = Math.hypot(a.x-b.x, a.y-b.y) || 1; bZ = zoom;
    bX = (a.x+b.x)/2; bY = (a.y+b.y)/2;
    bA = Math.atan2(b.y-a.y, b.x-a.x); cum = 0;
  }
  btn.onclick = () => {                              // le bouton ne fait qu'arrêter
    const v = pilote(); if (!v) return;
    traceClear(v); v.goto = null; v.speed = 0; setManual(); drawPathBtn();
  };
  el.addEventListener('pointerdown', e => {
    if (paused) return;
    TOUCH.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (TOUCH.size === 1){
      id1 = e.pointerId; x0 = lx = e.clientX; y0 = ly = e.clientY;
      t0 = performance.now(); lg = 0; buf = []; mode = 'rien';
    }
    else if (TOUCH.size === 2){
      // un deuxième doigt : c'était un pincement, pas un tracé. On efface ce qu'on venait
      // de poser, sinon l'engin part sur un bout de trajet qu'on n'a jamais voulu.
      if (mode === 'trace'){ const v = pilote(); if (v) traceClear(v); }
      mode = 'camera'; baseCam();
    }
  });
  el.addEventListener('pointermove', e => {
    if (!TOUCH.has(e.pointerId)) return;
    TOUCH.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (TOUCH.size >= 2){
      if (mode !== 'camera'){ mode = 'camera'; baseCam(); return; }
      const [a,b] = deux(); if (!a || !b) return;
      const d = Math.hypot(a.x-b.x, a.y-b.y) || 1;
      const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
      const ang = Math.atan2(b.y-a.y, b.x-a.x);
      setZoom(bZ * d/bD);
      // la torsion ne prend qu'au-delà d'un seuil : sinon un simple glissement pivoterait
      let da = ang - bA;
      while (da >  Math.PI) da -= 6.28318;
      while (da < -Math.PI) da += 6.28318;
      bA = ang; cum += da;
      if (Math.abs(cum) > .10) setYaw(YAW + da);
      // le milieu des deux doigts entraîne la carte, dans le repère de la caméra
      const k = VIEW/SH;
      const sx = -(mx-bX)*k, sy = (my-bY)*k/Math.max(.35, Math.sin(PITCH));
      const cy = Math.cos(YAW), sn = Math.sin(YAW);
      camPan(sx*cy - sy*sn, -sx*sn - sy*cy);
      bX = mx; bY = my;
      return;
    }
    if (e.pointerId !== id1 || mode === 'camera') return;
    lg += Math.hypot(e.clientX-lx, e.clientY-ly);     // longueur réellement parcourue
    lx = e.clientX; ly = e.clientY;
    if (mode !== 'trace'){
      if (mode === 'rien'){
        if (Math.hypot(e.clientX-x0, e.clientY-y0) < SEUIL) return; // simple tremblement
        mode = 'esquisse';                           // le geste est parti, rien n'est décidé
      }
      buf.push({ x:e.clientX, y:e.clientY });
      if (lg < LONGE || performance.now()-t0 < TENUE) return;
      // temps et longueur y sont : le tracé prend, et il reprend le geste depuis le début
      const v = pilote(); if (!v) return;
      mode = 'trace'; traceClear(v); v.goto = null; setManual();
      const q = screenToWorld(x0, y0); if (q) traceAdd(v, q);
      for(const b of buf){ const w = screenToWorld(b.x, b.y); if (w) traceAdd(v, w); }
      buf = [];
      return;
    }
    const v = pilote(); if (!v) return;
    const p = screenToWorld(e.clientX, e.clientY); if (p) traceAdd(v, p);
  });
  function fin(e){
    if (!TOUCH.has(e.pointerId)) return;
    TOUCH.delete(e.pointerId);
    if (TOUCH.size >= 2){ baseCam(); return; }
    if (TOUCH.size === 1){                           // il reste un doigt du pincement
      const r = TOUCH.entries().next().value;
      id1 = r[0]; x0 = r[1].x; y0 = r[1].y; mode = 'camera';
      return;                                        // il ne tracera rien : le geste est fini
    }
    const etait = mode; mode = 'rien'; id1 = null; buf = [];
    // une esquisse trop courte ou trop brève ne vaut ni tape ni tracé : elle ne fait rien
    if (etait === 'esquisse'){ tapT = 0; return; }
    if (etait !== 'rien'){ drawPathBtn(); return; }
    // c'était une tape : sur un engin elle sélectionne, sur le champ elle vise
    const cible = vehicleAt(e.clientX, e.clientY);
    if (cible){ tapT = 0; if (cible !== pilote()) selectVeh(cible.pid); return; }
    const now = performance.now();
    if (now - tapT < 340 && Math.hypot(e.clientX-tapX, e.clientY-tapY) < 30){
      tapT = 0;
      const p = screenToWorld(e.clientX, e.clientY); if (!p) return;
      const v = pilote(); if (!v) return;
      traceClear(v); v.goto = p; setManual(); pingSol(p.x, p.z); drawPathBtn();
    } else { tapT = now; tapX = e.clientX; tapY = e.clientY; }
  }
  ['pointerup','pointercancel'].forEach(ev => el.addEventListener(ev, fin));
})();
// Repère de sélection : un petit triangle planté au-dessus de l'engin conduit. Il tourne
// avec la caméra pour rester de face, et bat doucement pour se distinguer du décor.
const MARK = (function(){
  // un triangle plat, pointe en bas, toujours face à la caméra : un volume se lirait
  // comme un losange dès qu'on tourne la vue
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    [0,0,0, -.82,1.2,0, .82,1.2,0], 3));
  g.computeVertexNormals();
  const grp = new THREE.Group();
  const fond = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color:'#5c4a20', side:THREE.DoubleSide, depthTest:false, depthWrite:false }));
  fond.scale.setScalar(1.22); fond.position.set(0,-.13,-.01);
  const face = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color:'#ffc93c', side:THREE.DoubleSide, depthTest:false, depthWrite:false }));
  grp.add(fond, face);
  grp.renderOrder = 7; grp.visible = false; scene.add(grp);
  return grp;
})();
// quel engin se trouve sous le doigt ? on vise les maillages, pas le sol derrière eux
function vehicleAt(cx, cy){
  const r = stageEl.getBoundingClientRect();
  _ndc.set(((cx-r.left)/r.width)*2-1, -((cy-r.top)/r.height)*2+1);
  _ray.setFromCamera(_ndc, camera);
  const objs = [];
  for(const v of engins) objs.push(v.h);
  const hits = _ray.intersectObjects(objs, true);
  if (!hits.length) return null;
  for(const v of engins){
    let o = hits[0].object;
    while (o){ if (o === v.h) return v; o = o.parent; }
  }
  return null;
}
// repère posé au sol à l'endroit désigné : sans lui on ne sait pas si l'appui a été pris
const PING = (function(){
  const g = new THREE.RingGeometry(.7, 1.5, 22); g.rotateX(-Math.PI/2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color:'#ffe07a', transparent:true, opacity:0, depthWrite:false }));
  m.frustumCulled = false; m.visible = false; scene.add(m);
  return { m, t:0 };
})();
function pingSol(x,z){
  PING.m.position.set(x, parcelY(x,z)+.06, z);
  PING.m.visible = true; PING.t = 0;
}
function setManual(){
  if (manual) return;
  manual = true; if (btnAuto) btnAuto.classList.remove('on');
}
function setAuto(){
  manual = false;
  if (btnAuto) btnAuto.classList.add('on');
  const v = worker || pilote();
  if (v && v.lanes){
    traceClear(v); v.goto = null;
    let best = 0, bd = 1e9;
    v.lanes.forEach((l,i) => { const d = l.distanceTo(v.pos); if (d<bd){ bd=d; best=i; } });
    v.laneI = best; v.wpT = 0; v.done = false;
  }
}

// ---------- HUD ----------
const stepsEl = document.getElementById('steps');
STAGES.forEach((s,i) => {
  const e = document.createElement('button');
  e.className = 'step'; e.type = 'button';
  e.innerHTML = '<i>' + s.ic + '</i><span>' + s.n + '</span>';
  e.title = s.n + ' — ' + s.d;
  // le chemin des étapes sert aussi à choisir l'engin : on prend celui du chantier visé
  // Une étape dont on n'a pas la machine ne doit pas être un cul-de-sac : on peut toujours
  // y amener la parcelle, et passer à la suivante. Sans pulvérisateur, la culture pousse,
  // simplement bien plus lentement.
  e.onclick = () => { const k = STAGES[i].k;
                      const w = engins.find(v => v.metier === k);
                      if (w) selectVeh(w.pid); else switchTo(i); };
  stepsEl.appendChild(e);
});

const elVehBtn = document.getElementById('vehBtn'), elCropBtn = document.getElementById('cropBtn');
(function(){ const b = document.getElementById('btnCam');
  if (b) b.onclick = () => camFollow(); })();
elCropBtn.onclick = () => openPanel('crop');
document.getElementById('btnShop').onclick = () => openPanel('shop');
document.getElementById('btnSet').onclick  = () => openPanel('ctrl');

btnAuto = document.getElementById('btnAuto');
btnAuto.classList.add('on');
btnAuto.onclick = () => manual ? setAuto() : setManual();

let SPEED = 1;
const btnSpeed = document.getElementById('btnSpeed');
btnSpeed.onclick = () => cycleSpeed();
function setSpeed(v){
  SPEED = v;
  btnSpeed.textContent = '×' + v;
  btnSpeed.classList.toggle('on', v > 1);
}
function cycleSpeed(){ setSpeed(SPEED === 1 ? 3 : SPEED === 3 ? 6 : 1); }
setSpeed(1);

// ---------- passer d'un engin à l'autre ----------
// Le bouton fait le tour de tout ce qui roule à la ferme, dans l'ordre où on l'a acheté.
// Le nom affiché est celui du métier du moment : un tracteur devient « déchaumeuse » ou
// « benne » selon ce qu'il traîne, et redevient « tracteur seul » quand il est décroché.
const METICO = { prep:'🚜', sow:'🌱', fert:'💧', harvest:'🌾' };
const METNOM = { prep:'Déchaumeuse', sow:'Semoir', fert:'Pulvérisateur', harvest:'Moissonneuse' };
function icoVeh(v){
  if (!v) return '🚜';
  if (v.g.userData.benne) return '🛻';
  return METICO[v.metier] || (v.kind === 'moiss' ? '🌾' : '🚜');
}
function nomVeh(v){
  if (!v) return 'Au repos';
  const o = outilDe(v);
  if (o && o.type === 'benne') return BENNES[o.niv].n;
  if (v.metier) return METNOM[v.metier] + (o ? ' ' + (o.niv+1) : '');
  return v.kind === 'tracteur' ? 'Tracteur seul' : PORTEURS[v.kind].n;
}
function drawVeh(){
  const v = pilote();
  elVehBtn.disabled = false;
  // Parc vide : le bouton ne propose plus de changer d'engin, il mène à la boutique.
  if (!engins.length){
    elVehBtn.classList.remove('alt');
    elVehBtn.innerHTML = '<i>🛒</i><span>Acheter un engin</span>';
    elVehBtn.title = 'Le parc est vide';
    return;
  }
  const n = nomVeh(v);
  elVehBtn.classList.toggle('alt', !!(v && v.g.userData.benne));
  elVehBtn.innerHTML = '<i>' + icoVeh(v) + '</i><span>' + n + '</span>'
                     + (engins.length > 1 ? '<b class="sw">⇄</b>' : '');
  elVehBtn.title = engins.length > 1 ? 'Changer d\u2019engin' : n;
}
function drawCropBtn(){
  elCropBtn.innerHTML = '<i>' + crop().emo + '</i><span>' + crop().n + '</span>';
}
function switchVehicle(){
  if (!engins.length){ sfx('deny'); openPanel('parc'); return; }
  const i = engins.findIndex(v => v.pid === driven);
  selectVeh(engins[(i+1) % engins.length].pid);
}
// Prendre les commandes d'un engin ne déplace rien : celui qu'on quitte reste où il est,
// garde son tracé et continue son chantier.
function selectVeh(pid){
  const v = enginPar(pid);
  if (!v){ sfx('deny'); openPanel('parc'); return; }
  driven = pid;
  // suivre l'engin veut dire suivre son chantier : l'étape se cale sur son métier
  const st = STAGES.findIndex(s => s.k === v.metier);
  if (st >= 0 && stage !== st) switchTo(st);
  syncFleet();
  setManual(); sfx('stage'); drawVeh(); drawPathBtn(); drawHitch();
}
elVehBtn.onclick = switchVehicle;

// ---------- décrocher / raccrocher : le tracteur laisse sa benne et va en prendre une autre ----------
// Le bouton ne sert qu'au transport, et il ne s'allume que s'il y a vraiment quelque chose
// à faire : une benne attelée à poser, ou une benne posée à portée de la boule.
const elHitch = document.getElementById('btnHitch');
// Le bouton ne sert qu'aux tracteurs, et il ne s'allume que s'il y a vraiment quelque
// chose à faire : un outil attelé à poser, ou un outil au sol à portée de la boule.
function drawHitch(){
  if (!elHitch) return;
  const v = pilote(), tract = !!v && v.kind === 'tracteur';
  elHitch.style.display = tract ? '' : 'none';
  if (!tract) return;
  const att = !!v.outil, pret = att || !!outilAPortee(v);
  elHitch.disabled = !pret;
  elHitch.textContent = att ? '⚓' : '🪝';
  elHitch.classList.toggle('on', pret && !att);
  const lib = att ? 'Décrocher l\u2019outil' : 'Atteler l\u2019outil à portée';
  elHitch.setAttribute('aria-label', lib);
  elHitch.title = lib;
}
function toggleHitch(){
  const v = pilote();
  if (!v || v.kind !== 'tracteur'){ sfx('deny'); return; }
  if (v.outil){
    const o = decrocher(v);
    if (o){ sfx('stage'); toast(OUTILS[o.type].n + ' décroché sur place', 'good'); }
  } else {
    const o = raccrocher(v);
    if (!o){ sfx('deny'); toast('Rien à portée de l\u2019attelage', 'bad'); }
    else { sfx('stage'); toast(OUTILS[o.type].n + ' attelé', 'good'); }
  }
  drawHitch(); drawVeh();
}
if (elHitch) elHitch.onclick = toggleHitch;

// ---------- clavier : le jeu se joue aussi sans écran tactile ----------
const keys = Object.create(null);
let kbActive = false;
const MOVE = ['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','z','q',' '];
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  SND.boot();
  if (k === 'escape'){ panelOpen() ? closePanel() : openPanel(panelTab); e.preventDefault(); return; }
  if (panelOpen()) return;
  if (MOVE.indexOf(k) >= 0){ e.preventDefault(); document.body.classList.add('kb'); }
  if (!keys[k]){                                  // actions : au front montant seulement
    if (k === 'v') manual ? setAuto() : setManual();
    else if (k === 'b' || k === 'p') openPanel('shop');
    else if (k === 'c') openPanel('crop');
    else if (k === 'h') openPanel('help');
    else if (k === 'x') cycleSpeed();
    else if (k === 'e') switchVehicle();
    else if (k === 'r') toggleHitch();
    else if (k === 'n') toast(SND.toggle() ? '🔊 Son activé' : '🔇 Son coupé');
    else if (k >= '1' && k <= '4'){ const c = ['prep','sow','fert','harvest'][+k-1];
                                    const w = engins.find(v => v.metier === c);
                                    if (w) selectVeh(w.pid); }
  }
  keys[k] = true;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for(const k in keys) keys[k] = false; });
// le manche et le clavier alimentent les mêmes jx/jy/jmag
function readKeys(){
  let x = 0, y = 0;
  if (keys.arrowup    || keys.w || keys.z) y -= 1;
  if (keys.arrowdown  || keys.s)           y += 1;
  if (keys.arrowleft  || keys.a || keys.q) x -= 1;
  if (keys.arrowright || keys.d)           x += 1;
  const brake = !!keys[' '], m = Math.hypot(x,y);
  if (!m && !brake){
    if (kbActive){ kbActive = false; jx = jy = jmag = 0; }
    return;
  }
  kbActive = true; setManual();
  if (m){ jx = x/m; jy = y/m; }
  jmag = brake ? 0 : 1;
}
