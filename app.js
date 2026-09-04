'use strict';

const objectList = document.querySelector('#object-list');
const searchInput = document.querySelector('#object-search');
const countBadge = document.querySelector('#count-badge');
const catalogueCount = document.querySelector('#catalogue-count');
const storageStatus = document.querySelector('#storage-status');
const backupButton = document.querySelector('#backup-button');
const restoreButton = document.querySelector('#restore-button');
const restoreInput = document.querySelector('#restore-input');
const catalogueMessage = document.querySelector('#catalogue-message');
const selectionContent = document.querySelector('#selection-content');
const shelfGrid = document.querySelector('#shelf-grid');
const planTitle = document.querySelector('#plan-title');
const selectionSummary = document.querySelector('#selection-summary');
const presentStrip = document.querySelector('#present-strip');
const placeButton = document.querySelector('#place-button');
const moveButton = document.querySelector('#move-button');
const removeButton = document.querySelector('#remove-button');
const cabinetButtons = document.querySelectorAll('[data-cabinet]');
const shelfButtons = document.querySelectorAll('[data-shelf]');

let catalogue = [];
let selectedId = null;
let cabinet = 'V1';
let shelf = 'E4';
let selectedZones = [];
let dragStart = null;
let placements = [];
let reservedIds = new Set();

const rows = ['A', 'B', 'C', 'D', 'E'];
const columns = [1, 2, 3, 4, 5];
const storageKey = '0_VITRINES:placements:v2';

function objectNumber(id) {
  return Number(id.replace('OBJ-', ''));
}

function filenameFromUrl(url) {
  return String(url).split('/').pop();
}

function photoPath(item) {
  return `photos/${item.id}.jpg?v=2`;
}

function pdfPath(item) {
  return `pdf/${filenameFromUrl(item.pdf)}`;
}

function placementFor(id) {
  return placements.find((placement) => placement.objectId === id) || null;
}

function hasActivePlacement(id) {
  return placements.some((placement) => placement.objectId === id);
}

function setStorageStatus(message) {
  storageStatus.textContent = message;
}

function stateForExport() {
  return {
    formatVersion: 1,
    placements: [
      ...placements.map((placement) => ({
        id: placement.objectId, state: 'place', cabinet: placement.cabinet, shelf: placement.shelf,
        zones: [...placement.zones], displayZone: placement.displayZone,
      })),
      ...[...reservedIds].map((id) => ({ id, state: 'reserve' })),
    ],
  };
}

function chooseDisplayZone(cabinetName, shelfName, zones, ignoredId = null) {
  const counts = new Map(zones.map((zone) => [zone, 0]));
  for (const placement of placements) {
    if (placement.objectId !== ignoredId && placement.cabinet === cabinetName && placement.shelf === shelfName && counts.has(placement.displayZone)) {
      counts.set(placement.displayZone, counts.get(placement.displayZone) + 1);
    }
  }
  return zones.reduce((leastBusy, zone) => counts.get(zone) < counts.get(leastBusy) ? zone : leastBusy);
}

function parseState(state) {
  const catalogueIds = new Set(catalogue.map((item) => item.id));
  const validZones = new Set(rows.flatMap((row) => columns.map((column) => `${row}${column}`)));
  if (state?.formatVersion !== 1 || !Array.isArray(state.placements)) throw new Error('Format invalide');
  const ids = new Set();
  const restoredPlacements = [];
  const restoredReserve = new Set();
  for (const entry of state.placements) {
    if (!catalogueIds.has(entry?.id) || ids.has(entry.id)) throw new Error('Identifiant invalide');
    ids.add(entry.id);
    if (entry.state === 'reserve') { restoredReserve.add(entry.id); continue; }
    if (entry.state !== 'place' || !['V1', 'V2'].includes(entry.cabinet) || !['F', 'E1', 'E2', 'E3', 'E4'].includes(entry.shelf)
      || !Array.isArray(entry.zones) || entry.zones.length === 0 || entry.zones.some((zone) => !validZones.has(zone)) || new Set(entry.zones).size !== entry.zones.length
      || !entry.zones.includes(entry.displayZone)) throw new Error('Placement invalide');
    restoredPlacements.push({ objectId: entry.id, cabinet: entry.cabinet, shelf: entry.shelf, zones: [...entry.zones], displayZone: entry.displayZone });
  }
  return { placements: restoredPlacements, reserve: restoredReserve };
}

function savePlacementState() {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(stateForExport()));
    setStorageStatus('✓ Enregistré');
    return true;
  } catch {
    setStorageStatus('Non enregistré');
    return false;
  }
}

function restorePlacementState() {
  placements = [];
  reservedIds = new Set();

  try {
    const rawState = window.localStorage.getItem(storageKey);
    if (!rawState) return;

    const restored = parseState(JSON.parse(rawState));
    placements = restored.placements;
    reservedIds = restored.reserve;
    setStorageStatus('✓ Enregistré');
  } catch {
    placements = [];
    reservedIds = new Set();
    setStorageStatus('Données locales ignorées');
  }
}

function placementLabel(placement) {
  if (!placement) return 'Réserve';
  const firstZone = placement.zones[0];
  const lastZone = placement.zones[placement.zones.length - 1];
  const zoneLabel = firstZone === lastZone ? firstZone : `${firstZone}-${lastZone}`;
  return `${placement.cabinet}.${placement.shelf} · ${zoneLabel}`;
}

function updatePlaceButton() {
  const placement = placementFor(selectedId);
  placeButton.disabled = !selectedId || selectedZones.length === 0 || hasActivePlacement(selectedId);
  moveButton.disabled = !selectedId || selectedZones.length === 0 || !placement;
  removeButton.disabled = !placement;
}

function renderPresentStrip() {
  presentStrip.replaceChildren();
  if (selectedZones.length === 0) return;

  const relevantPlacements = placements.filter((placement) => (
    placement.cabinet === cabinet
    && placement.shelf === shelf
    && placement.zones.some((zone) => selectedZones.includes(zone))
  ));
  const objectIds = [...new Set(relevantPlacements.map((placement) => placement.objectId))];

  objectIds.forEach((id, index) => {
    const item = catalogue.find((candidate) => candidate.id === id);
    if (!item) return;

    if (index % 3 === 0) {
      const group = document.createElement('div');
      group.className = 'present-group';
      presentStrip.append(group);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'present-object';
    button.title = `${objectNumber(item.id)} — ${item.designation}`;

    const image = document.createElement('img');
    image.src = photoPath(item);
    image.alt = '';

    const number = document.createElement('span');
    number.className = 'present-number';
    number.textContent = objectNumber(item.id);

    const designation = document.createElement('span');
    designation.className = 'present-name';
    designation.textContent = item.designation;

    button.append(image, number, designation);
    button.addEventListener('click', () => selectObject(item.id));
    presentStrip.lastElementChild.append(button);
  });
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

    const details = document.createElement('span');
    details.className = 'object-details';

    const designation = document.createElement('span');
    designation.className = 'object-name';
    designation.textContent = item.designation;

    const location = document.createElement('span');
    location.className = 'object-location';
    location.textContent = placementLabel(placementFor(item.id));

    details.append(designation, location);

    button.append(dot, image, details);
    button.addEventListener('click', () => selectObject(item.id));
    objectList.append(button);
  }
}

function selectObject(id) {
  selectedId = id;
  const item = catalogue.find((candidate) => candidate.id === id);
  if (!item) return;

  const placement = placementFor(id);
  if (placement) {
    cabinet = placement.cabinet;
    shelf = placement.shelf;
    selectedZones = [...placement.zones];
  }

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

  const location = document.createElement('p');
  location.className = 'selection-note';
  location.textContent = `Emplacement : ${placementLabel(placementFor(item.id))}`;

  const pdfLink = document.createElement('a');
  pdfLink.className = 'pdf-link';
  pdfLink.href = pdfPath(item);
  pdfLink.target = '_blank';
  pdfLink.rel = 'noopener';
  pdfLink.textContent = 'Ouvrir la fiche PDF';

  selectionContent.append(title, image, designation, location, pdfLink);
  renderList();
  renderPlan();
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
  updatePlaceButton();

  cabinetButtons.forEach((button) => button.classList.toggle('active', button.dataset.cabinet === cabinet));
  shelfButtons.forEach((button) => button.classList.toggle('active', button.dataset.shelf === shelf));
  renderPresentStrip();
  shelfGrid.replaceChildren();

  const visiblePlacementsByZone = new Map();
  for (const row of rows) {
    for (const column of columns) visiblePlacementsByZone.set(`${row}${column}`, []);
  }
  const surfacePlacements = placements.filter((placement) => (
    placement.cabinet === cabinet && placement.shelf === shelf
  ));

  for (const placement of surfacePlacements) {
    const targetZone = placement.zones.includes(placement.displayZone) ? placement.displayZone : placement.zones[0];
    if (visiblePlacementsByZone.has(targetZone)) visiblePlacementsByZone.get(targetZone).push(placement);
  }

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

      const zonePlacements = visiblePlacementsByZone.get(zone);
      if (zonePlacements.length > 0) {
        const objects = document.createElement('div');
        objects.className = 'zone-objects';
        for (const placement of zonePlacements) {
          const item = catalogue.find((candidate) => candidate.id === placement.objectId);
          if (!item) continue;
          const object = document.createElement('span');
          object.className = 'zone-object';
          object.dataset.objectId = item.id;
          object.title = `${objectNumber(item.id)} — ${item.designation}`;

          const objectImage = document.createElement('img');
          objectImage.src = photoPath(item);
          objectImage.alt = '';

          const objectNumberLabel = document.createElement('span');
          objectNumberLabel.textContent = objectNumber(item.id);
          object.append(objectImage, objectNumberLabel);
          objects.append(object);
        }
        button.append(objects);
      }
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
  const placedObject = event.target.closest('.zone-object');
  if (placedObject) {
    event.preventDefault();
    event.stopPropagation();
    selectObject(placedObject.dataset.objectId);
    return;
  }

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

placeButton.addEventListener('click', () => {
  if (!selectedId || selectedZones.length === 0 || hasActivePlacement(selectedId)) return;
  reservedIds.delete(selectedId);
  placements.push({
    objectId: selectedId,
    cabinet,
    shelf,
    zones: [...selectedZones],
    displayZone: chooseDisplayZone(cabinet, shelf, selectedZones),
  });
  savePlacementState();
  selectObject(selectedId);
});

moveButton.addEventListener('click', () => {
  const placement = placementFor(selectedId);
  if (!placement || selectedZones.length === 0) return;

  placement.cabinet = cabinet;
  placement.shelf = shelf;
  placement.zones = [...selectedZones];
  placement.displayZone = chooseDisplayZone(cabinet, shelf, selectedZones, selectedId);
  savePlacementState();
  selectObject(selectedId);
});

removeButton.addEventListener('click', () => {
  if (!placementFor(selectedId)) return;
  placements = placements.filter((placement) => placement.objectId !== selectedId);
  reservedIds.add(selectedId);
  selectedZones = [];
  savePlacementState();
  selectObject(selectedId);
});

function downloadState(state, prefix = 'VITRINE') {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

backupButton.addEventListener('click', () => downloadState(stateForExport()));
restoreButton.addEventListener('click', () => restoreInput.click());
restoreInput.addEventListener('change', async () => {
  const file = restoreInput.files?.[0];
  restoreInput.value = '';
  if (!file) return;
  try {
    const restored = parseState(JSON.parse(await file.text()));
    if (!window.confirm('Remplacer les placements actuels ? Une sauvegarde de sécurité sera téléchargée avant la restauration.')) return;
    downloadState(stateForExport(), 'VITRINE-AVANT-RESTAURATION');
    placements = restored.placements;
    reservedIds = restored.reserve;
    savePlacementState();
    selectedId = null;
    selectedZones = [];
    renderList();
    renderPlan();
  } catch {
    window.alert('Fichier de restauration invalide : les placements actuels sont conservés.');
  }
});

function loadCatalogue() {
  try {
    if (!Array.isArray(window.CATALOGUE) || window.CATALOGUE.length !== 26) throw new Error('Catalogue incomplet');

    catalogue = [...window.CATALOGUE].sort((left, right) => objectNumber(left.id) - objectNumber(right.id));
    countBadge.textContent = catalogue.length;
    catalogueCount.textContent = `${catalogue.length} objets du catalogue`;
    restorePlacementState();
    renderList();
    renderPlan();
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
