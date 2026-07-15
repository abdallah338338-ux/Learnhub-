// ===================== إدارة الحالة: localStorage + Firestore (Hybrid) =====================

const STORAGE_KEY = 'learnhub_data';
let currentUser = null;

function loadState(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved){
    try{
      const parsed = JSON.parse(saved);
      return {
        topics: parsed.topics || [],
        path: [],
        view: parsed.view || 'grid',
        contextTarget: null,
        draggedId: null,
      };
    }catch(e){
      console.error('فشل تحميل البيانات المحفوظة', e);
    }
  }
  return {
    topics: [
      { id: 't1', type:'topic', name: 'Programming', icon: '💻', color:'#3b82f6', items: [] },
      { id: 't2', type:'topic', name: 'Architecture', icon: '🏗', color:'#f59e0b', items: [] },
      { id: 't3', type:'topic', name: 'English',      icon: '📚', color:'#10b981', items: [] },
    ],
    path: [],
    view: 'grid',
    contextTarget: null,
    draggedId: null,
  };
}

let state = loadState();

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    topics: state.topics,
    view: state.view,
  }));

  if(currentUser){
    window.saveUserTopics(currentUser.uid, state.topics)
      .catch(err => console.error('فشل الحفظ على Firestore:', err));
  }
}

const ICONS = { folder:'📂', file:'📄', video:'🎥', link:'🔗', note:'📝' };

function uid(){ return 'id_' + Math.random().toString(36).slice(2,9); }

// ===================== أدوات التنقل داخل الشجرة =====================
function getContainerByPath(path){
  if(path.length === 0) return null;
  let node = state.topics.find(t => t.id === path[0]);
  for(let i = 1; i < path.length && node; i++){
    node = node.items.find(it => it.id === path[i]);
  }
  return node || null;
}

function getCurrentItems(){
  if(state.path.length === 0) return state.topics;
  const container = getContainerByPath(state.path);
  return container ? container.items : [];
}

// ===================== الرندر الرئيسي =====================
function render(){
  renderBreadcrumb();
  renderMain();
  saveState();
}

function renderBreadcrumb(){
  const hero = document.getElementById('heroSection');
  if(hero) hero.classList.toggle('hidden', state.path.length !== 0);

  const bc = document.getElementById('breadcrumb');
  let html = `<span data-index="-1">🏠 الرئيسية</span>`;
  let node = null;
  state.path.forEach((id, idx) => {
    node = idx === 0 ? state.topics.find(t=>t.id===id) : node.items.find(it=>it.id===id);
    html += ` / <span data-index="${idx}">${node ? node.name : ''}</span>`;
  });
  bc.innerHTML = html;
  bc.querySelectorAll('span').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = parseInt(el.dataset.index);
      state.path = idx === -1 ? [] : state.path.slice(0, idx+1);
      render();
    });
  });
}

function renderMain(){
  const main = document.getElementById('mainArea');
  main.className = state.view === 'grid' ? 'grid-view' : 'list-view';
  main.innerHTML = '';

  const items = getCurrentItems();
  const isHome = state.path.length === 0;

  if(items.length === 0){
    main.innerHTML = `<p style="color:var(--muted);grid-column:1/-1;">لا يوجد عناصر بعد. اضغط + لإضافة.</p>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card' + (isHome ? ' topic-card' : '');
    if(isHome) card.style.borderTopColor = item.color;
    card.draggable = !isHome;
    card.dataset.id = item.id;

    const count = item.type === 'topic' || item.type === 'folder'
      ? `<div class="meta">${item.items.length} عنصر</div>`
      : (item.fileSize ? `<div class="meta">${item.fileSize}</div>` : '');

    const downloadBtn = item.fileURL
      ? `<button class="download-icon-btn" data-download-id="${item.id}" title="تحميل">⬇</button>`
      : '';

    // معاينة حقيقية للصور والفيديوهات بدل الأيقونة الثابتة
    let mediaPreview = `<span class="icon">${isHome ? item.icon : ICONS[item.type]}</span>`;
    if(item.fileURL){
      const ext = (item.fileName || item.name).split('.').pop().toLowerCase();
      if(['png','jpg','jpeg','gif','webp'].includes(ext)){
        mediaPreview = `<div class="card-media"><img src="${item.fileURL}" loading="lazy"></div>`;
      } else if(['mp4','webm','mov'].includes(ext) || item.type === 'video'){
        mediaPreview = `<div class="card-media"><video src="${item.fileURL}" muted onmouseenter="this.play()" onmouseleave="this.pause()"></video></div>`;
      }
    }

    card.innerHTML = `
      ${downloadBtn}
      ${mediaPreview}
      <div class="name">${item.name}</div>
      ${count}
    `;

    card.addEventListener('click', (e)=>{
      if(e.target.closest('.download-icon-btn')) return;
      openItem(item);
    });

    card.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      openContextMenu(e.pageX, e.pageY, item);
    });

    card.addEventListener('dragstart', ()=>{ state.draggedId = item.id; });
    if(item.type === 'folder' || item.type === 'topic'){
      card.addEventListener('dragover', (e)=>{ e.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', ()=> card.classList.remove('drag-over'));
      card.addEventListener('drop', ()=>{
        card.classList.remove('drag-over');
        moveItem(state.draggedId, item);
      });
    }

    main.appendChild(card);
  });

  main.querySelectorAll('.download-icon-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const itemId = btn.dataset.downloadId;
      const targetItem = getCurrentItems().find(i => i.id === itemId);
      if(targetItem && targetItem.fileURL){
        downloadFile(targetItem.fileURL, targetItem.fileName || targetItem.name);
      }
    });
  });
}

// ===================== فتح عنصر (معاينة داخل الموقع) =====================
function openItem(item){
  if(item.type === 'topic' || item.type === 'folder'){
    state.path.push(item.id);
    render();
  } else if(item.type === 'link'){
    if(item.link) window.open(item.link, '_blank');
  } else if(item.fileURL){
    openPreview(item);
  } else {
    alert(`"${item.name}" لسه مالوش ملف مرفوع فعليًا. جرب تضيفه تاني وتختار ملف من جهازك.`);
  }
}

function openPreview(item){
  const modal = document.getElementById('previewModal');
  const title = document.getElementById('previewTitle');
  const body = document.getElementById('previewBody');
  const downloadBtn = document.getElementById('previewDownloadBtn');

  title.textContent = item.name;
  body.innerHTML = '';

  const ext = (item.fileName || item.name).split('.').pop().toLowerCase();

  if(['png','jpg','jpeg','gif','webp','svg'].includes(ext)){
    body.innerHTML = `<img src="${item.fileURL}" alt="${item.name}">`;
  } else if(['mp4','webm','mov'].includes(ext) || item.type === 'video'){
    body.innerHTML = `<video src="${item.fileURL}" controls autoplay></video>`;
  } else if(ext === 'pdf'){
    body.innerHTML = `<iframe src="${item.fileURL}"></iframe>`;
  } else {
    body.innerHTML = `<p style="color:#fff;">مش متاح معاينة لهذا النوع، اضغط تحميل لفتحه.</p>`;
  }

  downloadBtn.onclick = () => downloadFile(item.fileURL, item.fileName || item.name);

  // زرار فتح الملف كامل في تبويب جديد - مفيد خصوصًا لملفات PDF
  const openBtn = document.getElementById('previewOpenBtn');
  if(openBtn){
    openBtn.onclick = () => window.open(item.fileURL, '_blank');
  }

  modal.classList.remove('hidden');
}

const previewCloseBtn = document.getElementById('previewCloseBtn');
if(previewCloseBtn){
  previewCloseBtn.addEventListener('click', ()=>{
    const modal = document.getElementById('previewModal');
    modal.classList.add('hidden');
    document.getElementById('previewBody').innerHTML = '';
  });
}

// ===================== تحميل حقيقي على جهاز المستخدم =====================
function downloadFile(url, filename){
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    })
    .catch(err => {
      console.error('فشل التحميل المباشر:', err);
      window.open(url, '_blank');
    });
}

// ===================== نقل عنصر (سحب وإفلات) =====================
function moveItem(draggedId, targetContainer){
  if(!draggedId || draggedId === targetContainer.id) return;
  const currentItems = getCurrentItems();
  const idx = currentItems.findIndex(i => i.id === draggedId);
  if(idx === -1) return;
  const [moved] = currentItems.splice(idx, 1);
  targetContainer.items.push(moved);
  render();
}

// ===================== زر + وقائمة الإضافة =====================
const addBtn = document.getElementById('addBtn');
const addMenu = document.getElementById('addMenu');

addBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  if(state.path.length === 0){
    openTopicModal();
  } else {
    showPopup(addMenu, e.pageX - 180, e.pageY - 250);
  }
});

addMenu.querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    hidePopup(addMenu);
    openItemModal(btn.dataset.type);
  });
});

function showPopup(el, x, y){
  el.style.left = Math.max(10, x) + 'px';
  el.style.top = y + 'px';
  el.classList.remove('hidden');
}
function hidePopup(el){ el.classList.add('hidden'); }

document.addEventListener('click', ()=>{
  hidePopup(addMenu);
  hidePopup(document.getElementById('contextMenu'));
});

// ===================== مودال الموضوع =====================
const topicModal = document.getElementById('topicModal');
let selectedColor = '#FF8A3D';
let selectedIcon = '💻';

function openTopicModal(){
  document.getElementById('topicNameInput').value = '';
  topicModal.classList.remove('hidden');
}
document.getElementById('topicCancel').addEventListener('click', ()=> topicModal.classList.add('hidden'));

document.querySelectorAll('.icon-picker span').forEach(span=>{
  span.addEventListener('click', ()=>{
    document.querySelectorAll('.icon-picker span').forEach(s=>s.classList.remove('selected'));
    span.classList.add('selected');
    selectedIcon = span.dataset.icon;
  });
});

document.querySelectorAll('.color-picker span').forEach(span=>{
  span.addEventListener('click', ()=>{
    document.querySelectorAll('.color-picker span').forEach(s=>s.classList.remove('selected'));
    span.classList.add('selected');
    selectedColor = span.dataset.color;
  });
});

document.getElementById('topicSave').addEventListener('click', ()=>{
  const name = document.getElementById('topicNameInput').value.trim();
  if(!name) return;
  state.topics.push({ id:uid(), type:'topic', name, icon:selectedIcon, color:selectedColor, items:[] });
  topicModal.classList.add('hidden');
  render();
});

// ===================== مودال إضافة عنصر (ملف/مجلد/فيديو/رابط/ملاحظة) =====================
const itemModal = document.getElementById('itemModal');
const itemLinkInput = document.getElementById('itemLinkInput');
const fileInputWrapper = document.getElementById('fileInputWrapper');
const itemFileInput = document.getElementById('itemFileInput');
const fileNamePreview = document.getElementById('fileNamePreview');
let pendingType = null;

function openItemModal(type){
  pendingType = type;
  document.getElementById('itemModalTitle').textContent =
    type === 'folder' ? 'مجلد جديد' :
    type === 'file' ? 'ملف / PDF جديد' :
    type === 'video' ? 'فيديو جديد' :
    type === 'link' ? 'رابط جديد' : 'ملاحظة جديدة';

  document.getElementById('itemNameInput').value = '';
  itemLinkInput.value = '';
  itemLinkInput.classList.toggle('hidden', type !== 'link');

  if(itemFileInput){
    itemFileInput.value = '';
    fileNamePreview.textContent = '';
    fileInputWrapper.classList.toggle('hidden', type !== 'file' && type !== 'video');
  }

  const progressWrapper = document.getElementById('uploadProgressWrapper');
  if(progressWrapper) progressWrapper.classList.add('hidden');

  itemModal.classList.remove('hidden');
}

if(itemFileInput){
  itemFileInput.addEventListener('change', ()=>{
    const file = itemFileInput.files[0];
    if(file){
      fileNamePreview.textContent = `📎 ${file.name}`;
      if(!document.getElementById('itemNameInput').value.trim()){
        document.getElementById('itemNameInput').value = file.name;
      }
    }
  });
}

document.getElementById('itemCancel').addEventListener('click', ()=> itemModal.classList.add('hidden'));

document.getElementById('itemSave').addEventListener('click', async ()=>{
  const name = document.getElementById('itemNameInput').value.trim();
  if(!name) return;

  const newItem = { id:uid(), type:pendingType, name };
  if(pendingType === 'folder') newItem.items = [];
  if(pendingType === 'link') newItem.link = itemLinkInput.value.trim();

  const saveBtn = document.getElementById('itemSave');

  if((pendingType === 'file' || pendingType === 'video') && itemFileInput && itemFileInput.files[0]){
    const file = itemFileInput.files[0];
    newItem.fileName = file.name;
    newItem.fileSize = (file.size / 1024).toFixed(1) + ' KB';

    if(typeof window.uploadFile === 'function'){
      const progressWrapper = document.getElementById('uploadProgressWrapper');
      const progressBar = document.getElementById('uploadProgressBar');
      const progressText = document.getElementById('uploadProgressText');

      if(progressWrapper) progressWrapper.classList.remove('hidden');
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الرفع...';

      try{
        const uidForFolder = currentUser ? currentUser.uid : 'guest';
        const url = await window.uploadFile(file, uidForFolder, (percent)=>{
          if(progressBar) progressBar.style.width = percent + '%';
          if(progressText) progressText.textContent = `${percent}%`;
        });
        newItem.fileURL = url;
      }catch(err){
        console.error('فشل رفع الملف:', err);
        alert('حصل خطأ أثناء رفع الملف: ' + err.message);
      }

      saveBtn.disabled = false;
      saveBtn.textContent = 'إضافة';
      if(progressWrapper) progressWrapper.classList.add('hidden');
    } else {
      console.warn('دالة window.uploadFile غير موجودة - تأكد إن cloudinary-init.js متحمّل قبل script.js');
    }
  }

  getCurrentItems().push(newItem);
  itemModal.classList.add('hidden');
  render();
});

// ===================== قائمة يمين الماوس =====================
const contextMenu = document.getElementById('contextMenu');

function openContextMenu(x, y, item){
  state.contextTarget = item;
  showPopup(contextMenu, x, y);
}

document.getElementById('ctxRename').addEventListener('click', ()=>{
  const item = state.contextTarget;
  const newName = prompt('الاسم الجديد:', item.name);
  if(newName && newName.trim()) item.name = newName.trim();
  render();
});
document.getElementById('ctxDuplicate').addEventListener('click', ()=>{
  const item = state.contextTarget;
  const clone = JSON.parse(JSON.stringify(item));
  clone.id = uid();
  clone.name += ' (نسخة)';
  getCurrentItems().push(clone);
  render();
});
document.getElementById('ctxFavorite').addEventListener('click', ()=>{
  const item = state.contextTarget;
  item.favorite = !item.favorite;
  render();
});
document.getElementById('ctxDelete').addEventListener('click', ()=>{
  const item = state.contextTarget;
  if(!confirm(`حذف "${item.name}"؟`)) return;
  const items = getCurrentItems();
  const idx = items.findIndex(i=>i.id===item.id);
  if(idx > -1) items.splice(idx,1);
  render();
});

// ===================== البحث =====================
document.getElementById('searchInput').addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase();
  if(!q){ render(); return; }

  const results = [];
  function search(items, path, breadcrumb){
    items.forEach(item=>{
      if(item.name.toLowerCase().includes(q)){
        results.push({ item, breadcrumb });
      }
      if(item.items) search(item.items, [...path, item.id], breadcrumb + ' / ' + item.name);
    });
  }
  search(state.topics, [], '🏠');

  const main = document.getElementById('mainArea');
  main.className = 'list-view';
  main.innerHTML = results.length
    ? results.map(r => `
        <div class="item-card" style="text-align:right">
          <b>${ICONS[r.item.type] || r.item.icon || '📁'} ${r.item.name}</b>
          <div class="meta">${r.breadcrumb}</div>
        </div>`).join('')
    : `<p style="color:var(--muted)">لا توجد نتائج لـ "${q}"</p>`;
});

// ===================== تبديل العرض Grid / List =====================
document.getElementById('gridBtn').addEventListener('click', ()=>{
  state.view = 'grid';
  document.getElementById('gridBtn').classList.add('active');
  document.getElementById('listBtn').classList.remove('active');
  render();
});
document.getElementById('listBtn').addEventListener('click', ()=>{
  state.view = 'list';
  document.getElementById('listBtn').classList.add('active');
  document.getElementById('gridBtn').classList.remove('active');
  render();
});

// ===================== تسجيل الدخول / الخروج بجوجل =====================
document.getElementById('loginBtn').addEventListener('click', ()=>{
  window.loginWithGoogle();
});

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  window.logout();
});

window.onUserStateChanged = async function(user){
  const loginBtn = document.getElementById('loginBtn');
  const userInfo = document.getElementById('userInfo');
  const userPhoto = document.getElementById('userPhoto');
  const userName = document.getElementById('userName');

  if(user){
    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    userPhoto.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email;

    currentUser = user;

    const cloudTopics = await window.loadUserTopics(user.uid);

    if(cloudTopics && cloudTopics.length > 0){
      state.topics = cloudTopics;
    } else {
      await window.saveUserTopics(user.uid, state.topics);
    }

    state.path = [];
    render();

  } else {
    loginBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');

    currentUser = null;

    const local = loadState();
    state.topics = local.topics;
    state.view = local.view;
    state.path = [];
    render();
  }
};

// ===================== البداية =====================
render();