'use strict';

const objectList = document.querySelector('#object-list');
const searchInput = document.querySelector('#object-search');
const countBadge = document.querySelector('#count-badge');
const catalogueCount = document.querySelector('#catalogue-count');
const catalogueMessage = document.querySelector('#catalogue-message');
const selectionContent = document.querySelector('#selection-content');
const shelfGrid = document.querySelector('#shelf-grid');
const planTitle = document.querySelector('#plan-title');
const selectionSummary = document.querySelector('#selection-summary');
const cabinetButtons = document.querySelectorAll('[data-cabinet]');
const shelfButtons = document.querySelectorAll('[data-shelf]');

let catalogue = [];
let selectedId = null;
let cabinet = 'V1';
let shelf = 'E4';
let selectedZones = [];
let dragStart = null;

const rows = ['A', 'B', 'C', 'D', 'E'];
const columns = [1, 2, 3, 4, 5];

function objectNumber(id) {
  return Number(id.replace('OBJ-', ''));
}

function filenameFromUrl(url) {
  return String(url).split('/').pop();
}

function photoPath(item) {
  return `photos/${item.id}.jpg`;
}

function pdfPath(item) {
  return `pdf/${filenameFromUrl(item.pdf)}`;
}

function visibleObjects() {
  const query = searchInput.value.trim();
  if (!query) return catalogue;
  if (!/^\d+$/.test(query)) return [];
  return catalogue.filter((item) => objectNumber(item.id) === Number(query));
}

function renderList() {
  const visible = visibleObjects();
  objectList.replaceChildren();

  if (visible.length === 0) {
    catalogueMessage.hidden = false;
    catalogueMessage.textContent = 'Aucun objet correspondant.';
    return;
  }

  catalogueMessage.hidden = true;
  for (const item of visible) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `object-row${item.id === selectedId ? ' is-selected' : ''}`;
    button.setAttribute('aria-pressed', String(item.id === selectedId));
    button.title = `${objectNumber(item.id)} — ${item.designation}`;

    const dot = document.createElement('span');
    dot.className = 'piece-dot';
    dot.textContent = objectNumber(item.id);

    const image = document.createElement('img');
    image.className = 'list-photo';
    image.src = photoPath(item);
    image.alt = '';

    const designation = document.createElement('span');
    designation.className = 'object-name';
    designation.textContent = item.designation;

    button.append(dot, image, designation);
    button.addEventListener('click', () => selectObject(item.id));
    objectList.append(button);
  }
}

function selectObject(id) {
  selectedId = id;
  const item = catalogue.find((candidate) => candidate.id === id);
  if (!item) return;

  selectionContent.className = '';
  selectionContent.replaceChildren();

  const title = document.createElement('h2');
  title.id = 'selection-title';
  title.className = 'selected-title';
  title.textContent = `${objectNumber(item.id)} — ${item.designation}`;

  const image = document.createElement('img');
  image.className = 'selected-photo';
  image.src = photoPath(item);
  image.alt = item.designation;

  const designation = document.createElement('p');
  designation.className = 'selected-designation';
  designation.textContent = item.designation;

  const pdfLink = document.createElement('a');
  pdfLink.className = 'pdf-link';
  pdfLink.href = pdfPath(item);
  pdfLink.target = '_blank';
  pdfLink.rel = 'noopener';
  pdfLink.textContent = 'Ouvrir la fiche PDF';

  selectionContent.append(title, image, designation, pdfLink);
  renderList();
}

function selectRectangle(start, end) {
  const selected = [];
  const startRow = rows.indexOf(start[0]);
  const endRow = rows.indexOf(end[0]);
  const startColumn = Number(start.slice(1));
  const endColumn = Number(end.slice(1));

  for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row += 1) {
    for (let column = Math.min(startColumn, endColumn); column <= Math.max(startColumn, endColumn); column += 1) {
      selected.push(`${rows[row]}${column}`);
    }
  }

  selectedZones = selected;
  renderPlan();
}

function renderPlan() {
  planTitle.textContent = `${cabinet}.${shelf}`;
  const count = selectedZones.length;
  selectionSummary.textContent = `${count} zone${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}`;

  cabinetButtons.forEach((button) => button.classList.toggle('active', button.dataset.cabinet === cabinet));
  shelfButtons.forEach((button) => button.classList.toggle('active', button.dataset.shelf === shelf));
  shelfGrid.replaceChildren();

  for (const row of rows) {
    const gridRow = document.createElement('div');
    gridRow.className = 'grid-row';

    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = row;
    gridRow.append(label);

    for (const column of columns) {
      const zone = `${row}${column}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `zone${selectedZones.includes(zone) ? ' selected' : ''}`;
      button.dataset.zone = zone;
      button.setAttribute('aria-pressed', String(selectedZones.includes(zone)));
      button.setAttribute('aria-label', `Zone ${zone}`);

      const zoneLabel = document.createElement('span');
      zoneLabel.className = 'zone-label';
      zoneLabel.textContent = zone;
      button.append(zoneLabel);
      gridRow.append(button);
    }

    shelfGrid.append(gridRow);
  }
}

function zoneAtPointer(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  return target?.closest('.zone')?.dataset.zone || null;
}

cabinetButtons.forEach((button) => button.addEventListener('click', () => {
  cabinet = button.dataset.cabinet;
  selectedZones = [];
  renderPlan();
}));

shelfButtons.forEach((button) => button.addEventListener('click', () => {
  shelf = button.dataset.shelf;
  selectedZones = [];
  renderPlan();
}));

shelfGrid.addEventListener('pointerdown', (event) => {
  const zone = zoneAtPointer(event);
  if (!zone) return;
  event.preventDefault();
  dragStart = zone;
  shelfGrid.setPointerCapture?.(event.pointerId);
  selectRectangle(zone, zone);
});

shelfGrid.addEventListener('pointermove', (event) => {
  if (!dragStart) return;
  const zone = zoneAtPointer(event);
  if (zone) selectRectangle(dragStart, zone);
});

function finishSelection(event) {
  if (event?.pointerId !== undefined && shelfGrid.hasPointerCapture?.(event.pointerId)) shelfGrid.releasePointerCapture(event.pointerId);
  dragStart = null;
}

shelfGrid.addEventListener('pointerup', finishSelection);
shelfGrid.addEventListener('pointercancel', finishSelection);

async function loadCatalogue() {
  try {
    const response = await fetch('catalogue.json');
    if (!response.ok) throw new Error('Catalogue indisponible');
    const data = await response.json();
    if (!Array.isArray(data.objets) || data.objets.length !== 26) throw new Error('Catalogue incomplet');

    catalogue = [...data.objets].sort((left, right) => objectNumber(left.id) - objectNumber(right.id));
    countBadge.textContent = catalogue.length;
    catalogueCount.textContent = `${catalogue.length} objets du catalogue`;
    renderList();
  } catch (error) {
    countBadge.textContent = '—';
    catalogueCount.textContent = 'Catalogue indisponible';
    catalogueMessage.hidden = false;
    catalogueMessage.textContent = 'Impossible de charger catalogue.json.';
  }
}

searchInput.addEventListener('input', renderList);
renderPlan();
loadCatalogue();
