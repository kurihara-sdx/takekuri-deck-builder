const MAX_DECK = 60;
const CARD_PAGE_SIZE = 40;

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
const EN_SET_MAP = {
  SVE:'sve',SVI:'sv1',PAL:'sv2',TEF:'sv5',TWM:'sv6',SFA:'sv6pt5',
  SCR:'sv7',SSP:'sv8',PRE:'sv8pt5',JTG:'sv9',DRI:'sv10',
  BLK:'zsv10pt5',WHT:'rsv10pt5',SVP:'svp',PROMO:'svp',
  MEG:'me1',PFL:'me2',ASC:null,POR:null,
};
const TYPE_MAP_JA = {草:'grass',炎:'fire',水:'water',雷:'lightning',超:'psychic',闘:'fighting',悪:'dark',鋼:'metal',竜:'dragon',無:'colorless'};
const TYPE_MAP_EN = {'{G}':'grass',Grass:'grass','{R}':'fire',Fire:'fire','{W}':'water',Water:'water','{L}':'lightning',Lightning:'lightning','{P}':'psychic',Psychic:'psychic','{F}':'fighting',Fighting:'fighting','{D}':'dark',Dark:'dark','{M}':'metal',Metal:'metal','{N}':'dragon',Dragon:'dragon','{C}':'colorless',Colorless:'colorless'};

const LANG = {
  ja:{csvPath:'data/JP_Card_Data.csv',
    cols:{id:'カード ID',name:'カード名',exp:'エキスパンションマーク',num:'コレクション番号',
      kind:'ポケモンの進化の段階/エネルギー・トレーナーズの種類',rule:'ルール',category:'カテゴリ',
      from:'進化前',hp:'HP',type:'タイプ',weak:'弱点',resist:'抵抗力',retreat:'にげる',
      atkName:'ワザ名',cost:'コスト',dmg:'ダメージ',effect:'効果の説明'},
    basicEnergy:'基本エネルギー',abilityPfx:'[特性]',
    typeMap:TYPE_MAP_JA,
    catLabels:{pokemon:'ポケモン',ex:'ex',supporter:'サポート',goods:'グッズ',tool:'どうぐ',stadium:'スタジアム',energy:'エネルギー'},
    showing:(s,t)=>`${t}件中 ${s}件`,ready:'60枚 OK ✓',needMore:n=>`あと${n}枚`,tooMany:n=>`${n}枚超過`,
    overFour:n=>`${n}: 4枚超過`,aceOver:n=>`ACE SPEC重複: ${n}`,empty:'カードをクリックして追加',
    attack:'ワザ',ability:'特性',newDeck:'新しいデッキ',save:'保存',saved:'保存済',del:'削除',
    confirmDel:'このデッキを削除しますか？',addToDeck:'デッキに追加',removeOne:'1枚減らす',
  },
  en:{csvPath:'data/EN_Card_Data.csv',
    cols:{id:'Card ID',name:'Card Name',exp:'Expansion',num:'Collection No.',
      kind:'Stage (Pokémon)/Type (Energy and Trainer)',rule:'Rule',category:'Category',
      from:'Previous stage',hp:'HP',type:'Type',weak:'Weakness',resist:'Resistance (Type)',
      retreat:'Retreat',atkName:'Move Name',cost:'Cost',dmg:'Damage',effect:'Effect Explanation'},
    basicEnergy:'Basic Energy',abilityPfx:'[Ability]',
    typeMap:TYPE_MAP_EN,
    catLabels:{pokemon:'Pokémon',ex:'ex',supporter:'Supporter',goods:'Item',tool:'Tool',stadium:'Stadium',energy:'Energy'},
    showing:(s,t)=>`${s} of ${t}`,ready:'60 cards OK ✓',needMore:n=>`${n} more`,tooMany:n=>`${n} over`,
    overFour:n=>`${n}: over 4`,aceOver:n=>`ACE SPEC dup: ${n}`,empty:'Click cards to add',
    attack:'Attack',ability:'Ability',newDeck:'New Deck',save:'Save',saved:'Saved',del:'Delete',
    confirmDel:'Delete this deck?',addToDeck:'Add to deck',removeOne:'Remove one',
  },
};

const TYPE_COLORS = {
  grass:'#388e3c',fire:'#d32f2f',water:'#1976d2',lightning:'#f9a825',
  psychic:'#7b1fa2',fighting:'#bf360c',dark:'#37474f',metal:'#607d8b',
  dragon:'#e65100',colorless:'#9e9e9e'
};

const state = {
  screen:'list', lang:localStorage.getItem('deckLang')||'ja',
  viewMode:localStorage.getItem('deckViewMode')||'card',
  cards:[], byId:new Map(),
  decks:[], currentDeckIdx:-1,
  deck:new Map(),
  query:'', activeCats:new Set(), activeTypes:new Set(),
  currentVisible:[], renderedCount:0,
};

const $=id=>document.getElementById(id);
const L=()=>LANG[state.lang];
const imgUrlById=new Map();
const brokenImgs=new Set();

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

/* ===== CSV Parsing ===== */
function parseCsv(text){
  const rows=[];let row=[],field='',inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c==='"'){if(inQ&&n==='"'){field+='"';i++}else inQ=!inQ;continue}
    if(c===','&&!inQ){row.push(field);field='';continue}
    if((c==='\n'||c==='\r')&&!inQ){if(c==='\r'&&n==='\n')i++;row.push(field);if(row.some(v=>v!==''))rows.push(row);row=[];field='';continue}
    field+=c;
  }
  row.push(field);if(row.some(v=>v!==''))rows.push(row);return rows;
}
function clean(v){const s=(v||'').trim();return s==='n/a'?'':s}

/* ===== Image Map ===== */
async function buildImageMap(){
  for(let id=1;id<=1267;id++)imgUrlById.set(id,`cards/${id}.jpg?v=2`);
}

/* ===== Card Categories ===== */
function assignCategory(card){
  const k=card.kind;
  const cats=[];
  if(/ポケモン(?!のどうぐ)|Pokémon(?! Tool)|Stage|Basic(?!.*Energy)/i.test(k)){
    cats.push('pokemon');
    if(card.rule&&/ex/i.test(card.rule))cats.push('ex');
  }
  if(/サポート|Supporter/i.test(k))cats.push('supporter');
  if(/グッズ|Item/i.test(k))cats.push('goods');
  if(/ポケモンのどうぐ|Pokémon Tool/i.test(k))cats.push('tool');
  if(/スタジアム|Stadium/i.test(k))cats.push('stadium');
  if(/エネルギー|Energy/i.test(k))cats.push('energy');
  card.cats=cats;

  const tMap=L().typeMap;
  card.typeKey=tMap[card.type]||null;
}

/* ===== Build Cards ===== */
function buildCards(csvText){
  const rows=parseCsv(csvText.replace(/^﻿/,''));const hdr=rows.shift();const c=L().cols;
  const grouped=new Map();
  for(const row of rows){
    const rec={};hdr.forEach((h,i)=>rec[h]=(row[i]||'').trim());
    const id=Number(rec[c.id]);if(!Number.isFinite(id))continue;
    if(!grouped.has(id)){
      grouped.set(id,{id,name:clean(rec[c.name]),expansion:clean(rec[c.exp]),
        number:clean(rec[c.num]),kind:clean(rec[c.kind]),rule:clean(rec[c.rule]),
        category:clean(rec[c.category]),evolvesFrom:clean(rec[c.from]),
        hp:clean(rec[c.hp]),type:clean(rec[c.type]),
        weakness:clean(rec[c.weak]),resistance:clean(rec[c.resist]),retreat:clean(rec[c.retreat]),
        attacks:[],effects:new Set()});
    }
    const card=grouped.get(id);
    const atkName=clean(rec[c.atkName]),eff=clean(rec[c.effect]);
    if(atkName){
      const isAbility=atkName.startsWith(L().abilityPfx);
      card.attacks.push({name:isAbility?atkName.slice(L().abilityPfx.length).trim():atkName,
        isAbility,cost:clean(rec[c.cost]),damage:clean(rec[c.dmg]),effect:eff});
    }
    if(eff)card.effects.add(eff);
  }
  return[...grouped.values()].map(card=>{
    card.effects=[...card.effects];
    card.searchText=[card.id,card.name,card.expansion,card.number,card.kind,card.rule,card.type,card.hp,
      ...card.effects,...card.attacks.flatMap(a=>[a.name,a.cost,a.damage,a.effect])
    ].filter(Boolean).join(' ').toLowerCase();
    card.imgUrl=imgUrlById.get(card.id)||null;
    assignCategory(card);
    return card;
  });
}

/* ===== Deck Logic ===== */
function isBasicEnergy(c){return/基本エネルギー|Basic Energy/.test(c?.kind)}
function isAceSpec(c){return c?.rule==='ACE SPEC'}
function deckTotal(){let s=0;for(const v of state.deck.values())s+=v;return s}
function countByName(n){let t=0;for(const[id,c]of state.deck){const card=state.byId.get(id);if(card?.name===n)t+=c}return t}
function aceSpecCount(){let t=0;for(const[id,c]of state.deck)if(isAceSpec(state.byId.get(id)))t+=c;return t}
function canAdd(card){
  if(!card)return false;
  if(isAceSpec(card)&&aceSpecCount()>=1)return false;
  return isBasicEnergy(card)||countByName(card.name)<4;
}
function addCard(id){const card=state.byId.get(id);if(!canAdd(card))return;state.deck.set(id,(state.deck.get(id)||0)+1);renderDeckZone();updateLibCardBadge(id);saveCurrent()}
function removeCard(id){const cur=state.deck.get(id)||0;if(cur<=1)state.deck.delete(id);else state.deck.set(id,cur-1);renderDeckZone();updateLibCardBadge(id);saveCurrent()}

/* ===== Deck Storage ===== */
function loadDecks(){try{state.decks=JSON.parse(localStorage.getItem('ptcg-decks'))||[]}catch{state.decks=[]}}
function saveDecks(){localStorage.setItem('ptcg-decks',JSON.stringify(state.decks))}
function saveCurrent(){
  if(state.currentDeckIdx<0)return;
  const d=state.decks[state.currentDeckIdx];
  d.name=$('deckNameInput').value||L().newDeck;
  d.cards=[...state.deck.entries()];
  saveDecks();
}

/* ===== Filtering ===== */
function visibleCards(){
  const q=state.query.toLowerCase();
  const hasCat=state.activeCats.size>0;
  const hasType=state.activeTypes.size>0;
  return state.cards.filter(c=>{
    if(hasCat&&!c.cats.some(cat=>state.activeCats.has(cat)))return false;
    if(hasType&&!state.activeTypes.has(c.typeKey))return false;
    if(q&&!c.searchText.includes(q))return false;
    return true;
  });
}

/* ===== Rendering: Card Image ===== */
function imgHtml(card,cls=''){
  const url=card.imgUrl;
  if(!url||brokenImgs.has(url))return fallbackHtml(card);
  return`<img class="${cls} loading" data-src="${esc(url)}" alt="${esc(card.name)}"
    onload="this.classList.remove('loading');this.classList.add('loaded')"
    onerror="this.classList.add('error');brokenImgs.add(this.dataset.src);this.nextElementSibling.style.display='flex'">
    <div class="lcard-fb" style="display:none"><div class="fb-hp">${esc(card.hp)}</div><div class="fb-name">${esc(card.name)}</div></div>`;
}
function fallbackHtml(card){
  return`<div class="lcard-fb" style="position:relative"><div class="fb-hp">${esc(card.hp)}</div><div class="fb-name">${esc(card.name)}</div><div class="fb-type">${esc(card.type||card.kind)}</div></div>`;
}

/* ===== Rendering: Deck List Screen ===== */
function renderList(){
  $('listScreen').hidden=false;$('buildScreen').hidden=true;
  state.screen='list';
  const grid=$('deckGrid');
  grid.innerHTML=state.decks.map((d,i)=>{
    const cards=new Map(d.cards);
    const total=[...cards.values()].reduce((s,v)=>s+v,0);
    const previewIds=[...cards.keys()].filter(id=>{const c=state.byId.get(id);return c&&c.cats.includes('pokemon')}).slice(0,5);
    const previewImgs=previewIds.map(id=>{const c=state.byId.get(id);const url=c?.imgUrl;return url&&!brokenImgs.has(url)?`<img src="${esc(url)}" alt="">`:''}).join('');
    return`<div class="deck-card" data-deck="${i}">
      <div class="deck-card-preview">${previewImgs||'<span style="color:var(--text3);font-size:12px">Empty</span>'}</div>
      <div class="deck-card-footer">
        <div><div class="deck-card-name">${esc(d.name)}</div><div class="deck-card-count">${total}/60</div></div>
        <div class="deck-card-actions">
          <button class="deck-card-share" data-share="${i}" title="共有">↗</button>
          <button class="deck-card-dup" data-dup="${i}" title="複製">⧉</button>
          <button class="deck-card-del" data-del="${i}" title="${L().del}">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ===== Rendering: Builder Screen ===== */
function renderBuilder(){
  renderDeckZone();
  renderLibrary();
}

function renderDeckZone(){
  const total=deckTotal();
  const l=L();

  $('deckZoneCount').textContent=total;
  $('deckBadge').textContent=`${total}/${MAX_DECK}`;
  $('deckBadge').className='deck-badge'+(total===MAX_DECK?' full':total>MAX_DECK?' over':'');

  const msgs=validate();
  $('deckValidation').innerHTML=msgs.map(m=>`<span class="v-${m.lv}">${esc(m.text)}</span>`).join(' · ');

  const rows=[...state.deck.entries()].map(([id,count])=>({card:state.byId.get(id),count})).filter(e=>e.card);
  rows.sort((a,b)=>{
    const ca=a.card.cats.includes('pokemon')?0:a.card.cats.includes('energy')?2:1;
    const cb=b.card.cats.includes('pokemon')?0:b.card.cats.includes('energy')?2:1;
    return ca-cb||a.card.id-b.card.id;
  });
  $('deckCards').innerHTML=rows.length?rows.map(({card,count})=>{
    const url=card.imgUrl&&!brokenImgs.has(card.imgUrl)?card.imgUrl:'';
    const inner=url?`<img src="${esc(url)}" alt="${esc(card.name)}" onerror="this.style.display='none'">`
      :`<div class="dslot-fb"><div class="fb-hp">${esc(card.hp)}</div><div class="fb-name">${esc(card.name)}</div></div>`;
    return`<div class="dslot" data-id="${card.id}" title="${esc(card.name)} x${count}">
      ${inner}
      <div class="dslot-controls">
        <button class="dslot-minus" data-deck-remove="${card.id}">−</button>
        <span class="dslot-count">${count}</span>
        <button class="dslot-plus" data-add="${card.id}">＋</button>
      </div>
    </div>`;
  }).join(''):`<div style="display:flex;align-items:center;justify-content:center;width:100%;color:var(--text3);font-size:12px">${L().empty}</div>`;
}

/* ===== Rendering: Library (incremental) ===== */
let scrollSentinel=null;
let sentinelObserver=null;
let imgObserver=null;

function renderLibrary(){
  const cards=visibleCards();
  state.currentVisible=cards;
  state.renderedCount=0;
  $('libStatus').textContent=L().showing(cards.length,state.cards.length);
  $('libCards').innerHTML='';
  if(scrollSentinel){scrollSentinel.remove();scrollSentinel=null}
  appendCardBatch();
}

function cardHtml(card){
  if(state.viewMode==='text')return textCardHtml(card);
  const count=state.deck.get(card.id)||0;
  return`<div class="lcard ${count?'in-deck':''}" data-id="${card.id}" draggable="true">
    <div class="lcard-img-wrap">${imgHtml(card,'lcard-img')}
      <div class="lcard-controls">
        <button class="lcard-minus" data-remove="${card.id}">−</button>
        <span class="lcard-ctrl-count">${count}</span>
        <button class="lcard-plus" data-add="${card.id}">＋</button>
      </div>
    </div>
    <div class="lcard-bottom">
      <div class="lcard-name">${esc(card.name)}</div>
      <div class="lcard-sub">${card.hp?'HP'+card.hp+' ':''}${esc(card.kind)}</div>
    </div>
  </div>`;
}

function textCardHtml(card){
  const count=state.deck.get(card.id)||0;
  const tc=TYPE_COLORS[card.typeKey]||'var(--border)';
  const isPoke=card.cats.includes('pokemon');
  let body='';
  if(isPoke){
    const atks=card.attacks.map(a=>{
      if(a.isAbility)return`<div class="lt-atk lt-ability"><div class="lt-atk-row"><span class="lt-label">特性</span><span class="lt-atk-name">${esc(a.name)}</span></div>${a.effect?`<div class="lt-atk-eff">${esc(a.effect)}</div>`:''}</div>`;
      return`<div class="lt-atk"><div class="lt-atk-row"><span class="lt-atk-name">${esc(a.name)}</span>${a.damage?`<span class="lt-atk-dmg">${esc(a.damage)}</span>`:''}</div>${a.cost?`<div class="lt-atk-cost">${esc(a.cost)}</div>`:''}${a.effect?`<div class="lt-atk-eff">${esc(a.effect)}</div>`:''}</div>`;
    }).join('');
    body=`<div class="lt-header" style="border-left:3px solid ${tc}"><span class="lt-hp">${card.hp?'HP'+card.hp:''}</span>${card.rule&&/ex/i.test(card.rule)?'<span class="lt-ex">ex</span>':''}</div>
<div class="lt-kind">${esc(card.kind)}${card.evolvesFrom?' ← '+esc(card.evolvesFrom):''}</div>
<div class="lt-attacks">${atks}</div>
<div class="lt-stats">${card.weakness?'弱:'+esc(card.weakness):''}${card.resistance?' 抵:'+esc(card.resistance):''}${card.retreat?' 逃:'+esc(card.retreat):''}</div>`;
  }else{
    const eff=card.effects.length?card.effects[0]:'';
    body=`<div class="lt-header"><span class="lt-kind-label">${esc(card.kind)}</span></div>
<div class="lt-effect">${esc(eff)}</div>`;
  }
  return`<div class="lcard ${count?'in-deck':''}" data-id="${card.id}" draggable="true">
    <div class="lcard-img-wrap"><div class="lcard-text-body">${body}</div>
      <div class="lcard-controls">
        <button class="lcard-minus" data-remove="${card.id}">−</button>
        <span class="lcard-ctrl-count">${count}</span>
        <button class="lcard-plus" data-add="${card.id}">＋</button>
      </div>
    </div>
    <div class="lcard-bottom">
      <div class="lcard-name">${esc(card.name)}</div>
      <div class="lcard-sub">${card.hp?'HP'+card.hp+' ':''}${esc(card.kind)}</div>
    </div>
  </div>`;
}

function appendCardBatch(){
  const batch=state.currentVisible.slice(state.renderedCount,state.renderedCount+CARD_PAGE_SIZE);
  if(!batch.length)return;
  const html=batch.map(cardHtml).join('');
  $('libCards').insertAdjacentHTML('beforeend',html);
  state.renderedCount+=batch.length;
  observeNewImages();
  setupScrollSentinel();
}

function setupScrollSentinel(){
  if(scrollSentinel){scrollSentinel.remove();scrollSentinel=null}
  if(state.renderedCount>=state.currentVisible.length)return;
  scrollSentinel=document.createElement('div');
  scrollSentinel.style.height='1px';
  $('libCards').appendChild(scrollSentinel);
  if(!sentinelObserver){
    sentinelObserver=new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting)appendCardBatch();
    },{root:document.querySelector('.library-zone'),rootMargin:'200px'});
  }
  sentinelObserver.observe(scrollSentinel);
}

function observeNewImages(){
  if(!imgObserver){
    imgObserver=new IntersectionObserver(entries=>{
      for(const e of entries){
        if(e.isIntersecting){
          const img=e.target;
          if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src}
          imgObserver.unobserve(img);
        }
      }
    },{root:document.querySelector('.library-zone'),rootMargin:'100px'});
  }
  for(const img of $('libCards').querySelectorAll('img[data-src]'))imgObserver.observe(img);
}

function updateLibCardBadge(id){
  const el=$('libCards').querySelector(`.lcard[data-id="${id}"]`);
  if(!el)return;
  const count=state.deck.get(id)||0;
  el.classList.toggle('in-deck',count>0);
  const controls=el.querySelector('.lcard-controls');
  if(controls){
    const ctrlCount=controls.querySelector('.lcard-ctrl-count');
    if(ctrlCount)ctrlCount.textContent=count;
  }
}

function validate(){
  const msgs=[],total=deckTotal(),l=L();
  if(total<MAX_DECK)msgs.push({lv:'warn',text:l.needMore(MAX_DECK-total)});
  else if(total>MAX_DECK)msgs.push({lv:'err',text:l.tooMany(total-MAX_DECK)});
  else msgs.push({lv:'ok',text:l.ready});
  const names=new Map();let aces=[];
  for(const[id,count]of state.deck){
    const card=state.byId.get(id);if(!card)continue;
    if(!isBasicEnergy(card))names.set(card.name,(names.get(card.name)||0)+count);
    if(isAceSpec(card))aces.push({card,count});
  }
  for(const[name,count]of names)if(count>4)msgs.push({lv:'err',text:l.overFour(name)});
  if(aces.reduce((s,e)=>s+e.count,0)>1)msgs.push({lv:'err',text:l.aceOver(aces.map(e=>e.card.name).join(', '))});
  return msgs;
}

/* ===== Modal ===== */
function showModal(card){
  const url=card.imgUrl&&!brokenImgs.has(card.imgUrl)?card.imgUrl:'';
  $('modalImg').src=url||'';$('modalImg').style.display=url?'':'none';
  const chips=[card.kind,card.type,card.hp?'HP '+card.hp:'',isAceSpec(card)?'ACE SPEC':''].filter(Boolean);
  const l=L();
  $('modalInfo').innerHTML=`
    <h3>${esc(card.name)}</h3>
    <div class="mi-id">ID ${card.id} / ${esc(card.expansion)} ${esc(card.number)}</div>
    <div class="mi-chips">${chips.map(c=>`<span class="mi-chip ${c==='ACE SPEC'?'ace':''}">${esc(c)}</span>`).join('')}</div>
    ${card.evolvesFrom?`<div style="font-size:11px;color:var(--text2);margin-bottom:6px">← ${esc(card.evolvesFrom)}</div>`:''}
    ${card.attacks.map(a=>`<div class="mi-atk">
      <div class="mi-atk-head"><span style="color:var(--text2)">${a.isAbility?l.ability:l.attack}</span>
        <strong>${esc(a.name)}</strong>${a.cost?`<small>${esc(a.cost)}</small>`:''}
        ${a.damage?`<span class="dmg">${esc(a.damage)}</span>`:''}</div>
      ${a.effect?`<p>${esc(a.effect)}</p>`:''}</div>`).join('')}
    ${!card.attacks.length&&card.effects.length?`<p style="font-size:11px;color:var(--text2);line-height:1.5">${esc(card.effects[0])}</p>`:''}
    <div style="font-size:10px;color:var(--text3);margin-top:6px">${card.weakness?'弱点:'+esc(card.weakness)+' ':''}${card.resistance?'抵抗:'+esc(card.resistance)+' ':''}${card.retreat?'逃げ:'+esc(card.retreat):''}</div>
    <div class="mi-actions">
      <button class="btn btn-ghost mi-minus" data-modal-remove="${card.id}">−</button>
      <span class="mi-count">${state.deck.get(card.id)||0}</span>
      <button class="btn btn-primary mi-plus" data-modal-add="${card.id}" ${canAdd(card)?'':'disabled'}>＋</button>
    </div>`;
  $('modal').hidden=false;
  $('buildScreen').classList.add('modal-open');
}

/* ===== Screen Navigation ===== */
function openList(){saveCurrent();renderList()}
function openBuilder(idx){
  state.currentDeckIdx=idx;
  const d=state.decks[idx];
  state.deck=new Map(d.cards);
  $('deckNameInput').value=d.name;
  $('listScreen').hidden=true;$('buildScreen').hidden=false;
  state.screen='builder';
  renderBuilder();
}
function createDeck(){
  state.decks.push({name:L().newDeck,cards:[]});
  saveDecks();
  openBuilder(state.decks.length-1);
}
function deleteDeck(idx){
  if(!confirm(L().confirmDel))return;
  state.decks.splice(idx,1);saveDecks();renderList();
}
function duplicateDeck(idx){
  const d=state.decks[idx];
  state.decks.push({name:d.name+' (copy)',cards:[...d.cards.map(([id,c])=>[id,c])]});
  saveDecks();renderList();
}

function deckCsv(){
  const ids=[];
  for(const[id,count]of[...state.deck.entries()].sort((a,b)=>a[0]-b[0]))
    for(let i=0;i<count;i++)ids.push(String(id));
  return ids.join('\n')+'\n';
}

/* ===== CSV Export ===== */
function deckCsvComma(){
  const ids=[];
  for(const[id,count]of[...state.deck.entries()].sort((a,b)=>a[0]-b[0]))
    for(let i=0;i<count;i++)ids.push(String(id));
  return ids.join(',');
}
function showCsvExport(){
  $('csvText').value=deckCsvComma();
  $('csvOverlay').hidden=false;
}

/* ===== Share ===== */
function encodeDeck(){
  const name=$('deckNameInput').value||L().newDeck;
  const cards=[...state.deck.entries()].map(([id,c])=>id+':'+c).join(',');
  const raw=name+'|'+cards;
  return btoa(unescape(encodeURIComponent(raw)));
}
function decodeDeckHash(hash){
  try{
    const raw=decodeURIComponent(escape(atob(hash)));
    const pipe=raw.indexOf('|');
    const name=pipe>=0?raw.slice(0,pipe):'Shared Deck';
    const cardsStr=pipe>=0?raw.slice(pipe+1):'';
    const cards=cardsStr.split(',').map(s=>{
      const[id,count]=s.split(':').map(Number);
      return Number.isFinite(id)&&Number.isFinite(count)&&id>0?[id,count]:null;
    }).filter(Boolean);
    return{name,cards};
  }catch{return null}
}
function encodeDeckData(name,cards){
  const raw=name+'|'+cards.map(([id,c])=>id+':'+c).join(',');
  return btoa(unescape(encodeURIComponent(raw)));
}
function showShare(){
  const encoded=encodeDeck();
  showShareUrl(encoded);
}
function showShareForDeck(idx){
  const d=state.decks[idx];
  const encoded=encodeDeckData(d.name,d.cards);
  showShareUrl(encoded);
}
function showShareUrl(encoded){
  const url=location.origin+location.pathname+'#d='+encoded;
  $('shareUrl').value=url;
  $('shareQr').src='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(url);
  $('shareOverlay').hidden=false;
}
function importFromHash(){
  const h=location.hash;
  if(!h.startsWith('#d='))return false;
  const data=decodeDeckHash(h.slice(3));
  if(!data||!data.cards.length)return false;
  state.decks.push({name:data.name,cards:data.cards});
  saveDecks();
  history.replaceState(null,'',location.pathname);
  return true;
}

/* ===== Events ===== */
function bindEvents(){
  // List screen
  $('deckGrid').addEventListener('click',e=>{
    const shr=e.target.closest('[data-share]');if(shr){e.stopPropagation();showShareForDeck(Number(shr.dataset.share));return}
    const del=e.target.closest('[data-del]');if(del){e.stopPropagation();deleteDeck(Number(del.dataset.del));return}
    const dup=e.target.closest('[data-dup]');if(dup){e.stopPropagation();duplicateDeck(Number(dup.dataset.dup));return}
    const card=e.target.closest('[data-deck]');if(card)openBuilder(Number(card.dataset.deck));
  });
  $('newDeckBtn').addEventListener('click',createDeck);

  // List import
  $('importDeckBtn').addEventListener('click',()=>{$('listImportArea').value='';$('csvFileName').textContent='';$('csvFileInput').value='';$('listImportOverlay').hidden=false});
  $('listImportCancel').addEventListener('click',()=>$('listImportOverlay').hidden=true);
  $('listImportOverlay').addEventListener('click',e=>{if(e.target===$('listImportOverlay'))$('listImportOverlay').hidden=true});
  $('csvFileInput').addEventListener('change',e=>{
    const file=e.target.files[0];if(!file)return;
    $('csvFileName').textContent=file.name;
    const reader=new FileReader();
    reader.onload=()=>{$('listImportArea').value=reader.result.trim()};
    reader.readAsText(file);
  });
  $('listImportApply').addEventListener('click',()=>{
    const text=$('listImportArea').value.trim();if(!text)return;
    const ids=text.split(/[\s,]+/).map(s=>Number(s.trim())).filter(v=>Number.isFinite(v)&&v>0);
    if(!ids.length)return;
    const deck=new Map();
    ids.forEach(id=>{deck.set(id,(deck.get(id)||0)+1)});
    state.decks.push({name:L().newDeck,cards:[...deck.entries()]});
    saveDecks();
    $('listImportOverlay').hidden=true;
    openBuilder(state.decks.length-1);
  });

  // Builder header
  $('backBtn').addEventListener('click',openList);
  $('shareBtn').addEventListener('click',showShare);
  $('shareX').addEventListener('click',()=>$('shareOverlay').hidden=true);
  $('shareOverlay').addEventListener('click',e=>{if(e.target===$('shareOverlay'))$('shareOverlay').hidden=true});
  $('copyUrlBtn').addEventListener('click',()=>{
    navigator.clipboard.writeText($('shareUrl').value).then(()=>{
      $('copyUrlBtn').textContent='コピー済';setTimeout(()=>$('copyUrlBtn').textContent='コピー',1200);
    });
  });
  const debouncedSaveName=debounce(()=>saveCurrent(),500);
  $('deckNameInput').addEventListener('input',debouncedSaveName);
  $('csvBtn').addEventListener('click',showCsvExport);
  $('csvX').addEventListener('click',()=>$('csvOverlay').hidden=true);
  $('csvOverlay').addEventListener('click',e=>{if(e.target===$('csvOverlay'))$('csvOverlay').hidden=true});
  $('copyCsvBtn').addEventListener('click',()=>{
    navigator.clipboard.writeText($('csvText').value).then(()=>{
      $('copyCsvBtn').textContent='コピー済';setTimeout(()=>$('copyCsvBtn').textContent='コピー',1200);
    });
  });
  $('downloadCsvBtn').addEventListener('click',()=>{
    const blob=new Blob([deckCsv()],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='deck.csv';
    document.body.append(a);a.click();a.remove();
  });

  // View toggle
  $('viewToggle').addEventListener('click',e=>{
    const btn=e.target.closest('.vt-btn');
    if(!btn||btn.dataset.view===state.viewMode)return;
    state.viewMode=btn.dataset.view;
    localStorage.setItem('deckViewMode',state.viewMode);
    $('viewToggle').querySelectorAll('.vt-btn').forEach(b=>b.classList.toggle('active',b===btn));
    renderLibrary();
  });

  // Filter bar
  const debouncedSearch=debounce(()=>{state.query=$('searchInput').value.trim();renderLibrary()},150);
  $('searchInput').addEventListener('input',debouncedSearch);

  // Filter toggle (mobile)
  $('filterToggle').addEventListener('click',()=>{
    const el=$('filterCollapsible');
    el.classList.toggle('open');
    $('filterToggle').classList.toggle('open');
  });

  document.querySelectorAll('.ftag').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.cat;
      if(state.activeCats.has(cat)){state.activeCats.delete(cat);btn.classList.remove('active')}
      else{state.activeCats.add(cat);btn.classList.add('active')}
      renderLibrary();
    });
  });
  document.querySelectorAll('.ttag').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const t=btn.dataset.type;
      if(state.activeTypes.has(t)){state.activeTypes.delete(t);btn.classList.remove('active')}
      else{state.activeTypes.add(t);btn.classList.add('active')}
      renderLibrary();
    });
  });

  // Library & deck clicks
  document.body.addEventListener('click',e=>{
    const addBtn=e.target.closest('[data-add]');
    if(addBtn){e.stopPropagation();addCard(Number(addBtn.dataset.add));return}
    const remBtn=e.target.closest('[data-remove]');
    if(remBtn){e.stopPropagation();removeCard(Number(remBtn.dataset.remove));return}
    const deckRem=e.target.closest('[data-deck-remove]');
    if(deckRem){e.stopPropagation();removeCard(Number(deckRem.dataset.deckRemove));return}
    const modalAdd=e.target.closest('[data-modal-add]');
    if(modalAdd){addCard(Number(modalAdd.dataset.modalAdd));showModal(state.byId.get(Number(modalAdd.dataset.modalAdd)));return}
    const modalRem=e.target.closest('[data-modal-remove]');
    if(modalRem){removeCard(Number(modalRem.dataset.modalRemove));showModal(state.byId.get(Number(modalRem.dataset.modalRemove)));return}
    const lcard=e.target.closest('.lcard[data-id]');
    if(lcard&&state.screen==='builder'){showModal(state.byId.get(Number(lcard.dataset.id)));return}
    const dslot=e.target.closest('.dslot[data-id]');
    if(dslot){showModal(state.byId.get(Number(dslot.dataset.id)));return}
  });

  // Modal
  function closeModal(){$('modal').hidden=true;$('buildScreen').classList.remove('modal-open')}
  $('modal').addEventListener('click',e=>{
    if(e.target.closest('[data-modal-add]')||e.target.closest('[data-modal-remove]'))return;
    closeModal();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('importOverlay').hidden=true;$('shareOverlay').hidden=true;$('csvOverlay').hidden=true}});

  // Drag & Drop
  const deckZone=document.querySelector('.deck-zone');
  document.body.addEventListener('dragstart',e=>{
    const lcard=e.target.closest('.lcard[data-id]');
    if(!lcard)return;
    e.dataTransfer.setData('text/plain',lcard.dataset.id);
    e.dataTransfer.effectAllowed='copy';
    requestAnimationFrame(()=>deckZone.classList.add('drag-over'));
  });
  document.body.addEventListener('dragend',()=>deckZone.classList.remove('drag-over'));
  deckZone.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'});
  deckZone.addEventListener('dragleave',e=>{if(!deckZone.contains(e.relatedTarget))deckZone.classList.remove('drag-over')});
  deckZone.addEventListener('drop',e=>{
    e.preventDefault();deckZone.classList.remove('drag-over');
    const id=Number(e.dataTransfer.getData('text/plain'));
    if(Number.isFinite(id))addCard(id);
  });

  // Language
  $('langSelect').addEventListener('change',async e=>{
    state.lang=e.target.value;localStorage.setItem('deckLang',state.lang);
    await loadCards();
    if(state.screen==='list')renderList();else renderBuilder();
  });
}

/* ===== Init ===== */
async function loadCards(){
  if(imgUrlById.size===0)await buildImageMap();
  const res=await fetch(L().csvPath);if(!res.ok)throw new Error('CSV load failed');
  state.cards=buildCards(await res.text());
  state.byId=new Map(state.cards.map(c=>[c.id,c]));
}

async function init(){
  bindEvents();
  $('langSelect').value=state.lang;
  $('viewToggle').querySelectorAll('.vt-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===state.viewMode));
  loadDecks();
  await loadCards();
  if(importFromHash()){
    loadDecks();
    openBuilder(state.decks.length-1);
  }else{
    renderList();
  }
}
init().catch(err=>console.error(err));
