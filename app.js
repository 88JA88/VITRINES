'use strict';

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js?v=14', { updateViaCache: 'none' }));
}

const objectList = document.querySelector('#object-list');
const catalogueFilterButtons = document.querySelectorAll('[data-catalogue-filter]');
const sortToggle = document.querySelector('#sort-toggle');
const countBadge = document.querySelector('#count-badge');
const catalogueCount = document.querySelector('#catalogue-count');
const storageStatus = document.querySelector('#storage-status');
const backupButton = document.querySelector('#backup-button');
const restoreButton = document.querySelector('#restore-button');
const restoreInput = document.querySelector('#restore-input');
const catalogueMessage = document.querySelector('#catalogue-message');
const selectionContent = document.querySelector('#selection-content');
const selectionPanel = document.querySelector('.selection-panel');
const objectHeading = document.querySelector('#object-heading');
const researchPanel = document.querySelector('#research-panel');
const researchInput = document.querySelector('#research-input');
const researchCount = document.querySelector('#research-count');
const clearResearch = document.querySelector('#clear-research');
const researchCriteria = document.querySelector('#research-criteria');
const researchFamilies = [
  ['nature', 'Nature'], ['epoque', 'Époque'], ['culture', 'Culture'],
  ['matiere', 'Matière'], ['technique', 'Technique'], ['decor', 'Iconographie / type'],
];
const checkedCriteria = new Map(researchFamilies.map(([field]) => [field, new Set()]));
const planPanel = document.querySelector('.plan-panel');
const planHeading = document.querySelector('.plan-heading');
const shelfGrid = document.querySelector('#shelf-grid');
const planTitle = document.querySelector('#plan-title');
const selectionSummary = document.querySelector('#selection-summary');
const presentStrip = document.querySelector('#present-strip');
const objectActions = document.querySelector('.object-actions');
const placeButton = document.querySelector('#place-button');
const moveButton = document.querySelector('#move-button');
const removeButton = document.querySelector('#remove-button');
const cabinetButtons = document.querySelectorAll('[data-cabinet]');
const shelfButtons = document.querySelectorAll('[data-shelf]');

let catalogue = [];
let catalogueFilter = 'all';
let sortDescending = false;
let selectedId = null;
let cabinet = 'V1';
let shelf = 'E4';
let selectedZones = [];
let dragStart = null;
let placements = [];
let reservedIds = new Set();
let headingScroll = null;
const placementClientId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
let placementEvents = null;

const rows = ['A', 'B', 'C', 'D', 'E'];
const columns = [1, 2, 3, 4, 5];

function objectNumber(id) {
  return Number(id.replace('OBJ-', ''));
}

function photoPath(item, suffix = '') {
  return `photos/${item.id}${suffix}.jpg?v=2`;
}

function displayValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' · ');
  return String(value || '').trim();
}

function allegerImagesPourImpression() {
  const images = [...ficheContent.querySelectorAll('.fiche-photos img')];
  const versions = [];
  for (const image of images) {
    if (!image.complete) continue;
    if (!image.naturalWidth || !image.naturalHeight) continue;
    const facteur = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const largeur = Math.max(1, Math.round(image.naturalWidth * facteur));
    const hauteur = Math.max(1, Math.round(image.naturalHeight * facteur));
    const canvas = document.createElement('canvas');
    canvas.width = largeur;
    canvas.height = hauteur;
    canvas.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
    versions.push({ image, src: image.src, allegee: canvas.toDataURL('image/jpeg', 0.8) });
  }
  versions.forEach(({ image, allegee }) => { image.src = allegee; });
  return () => versions.forEach(({ image, src }) => { image.src = src; });
}

function imprimerDansFenetre(dialog, titre) {
  const fenetre = window.open('', '_blank');
  if (!fenetre) return false;
  fenetre.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titre}</title><link rel="stylesheet" href="styles.css?v=5"></head><body><div class="fiche-dialog printing" open>${dialog.querySelector('.fiche-page').outerHTML}</div></body></html>`);
  fenetre.document.close();
  fenetre.addEventListener('load', () => fenetre.print(), { once: true });
  return true;
}

function createFicheDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'fiche-dialog';
  dialog.innerHTML = `
    <article class="fiche-page">
      <header class="fiche-toolbar">
        <button type="button" class="fiche-close" aria-label="Fermer la fiche">Fermer</button>
        <button type="button" class="fiche-print">Imprimer / Exporter en PDF</button>
      </header>
      <div class="fiche-content"></div>
    </article>`;
  document.body.append(dialog);
  dialog.querySelector('.fiche-close').addEventListener('click', () => dialog.close());
  dialog.querySelector('.fiche-print').addEventListener('click', () => {
    const item = catalogue.find((candidate) => candidate.id === selectedId);
    if (!item) return window.print();
    const restaurerImages = allegerImagesPourImpression();
    const titreNormal = document.title;
    document.title = `${item.id} - ${item.designation}`;
    const titreImpression = `${item.id} - ${item.designation}`;
    if (imprimerDansFenetre(dialog, titreImpression)) {
      restaurerImages();
      document.title = titreNormal;
      return;
    }
    dialog.classList.add('printing');
    const restaurerTitre = () => {
      document.title = titreNormal;
      dialog.classList.remove('printing');
      dialog.close();
      restaurerImages();
      window.removeEventListener('afterprint', restaurerTitre);
    };
    window.addEventListener('afterprint', restaurerTitre, { once: true });
    dialog.close();
    window.print();
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  return dialog;
}

const ficheDialog = createFicheDialog();
const ficheContent = ficheDialog.querySelector('.fiche-content');
let ficheRenderVersion = 0;

function appendFicheSection(parent, title, content, className = '') {
  if (!content.childElementCount) return;
  const section = document.createElement('section');
  section.className = `fiche-section ${className}`.trim();
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.append(heading, content);
  parent.append(section);
}

function appendFreeText(container, text) {
  for (const block of String(text || '').trim().split(/\n\s*\n/)) {
    const value = block.trim();
    if (!value) continue;
    const element = document.createElement(value.startsWith('## ') ? 'h4' : 'p');
    element.textContent = value.startsWith('## ') ? value.slice(3).trim() : value;
    container.append(element);
  }
}

async function photosDeFiche(item) {
  try {
    const response = await fetch(`/api/photos/${encodeURIComponent(item.id)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Galerie indisponible');
    const photos = await response.json();
    if (!Array.isArray(photos)) throw new Error('Réponse de galerie invalide');
    return { photos, editable: true };
  } catch {
    return { photos: [{ nom: `${item.id}.jpg`, url: photoPath(item), principale: true }], editable: false };
  }
}

function creerImageGalerie(photo, designation) {
  const figure = document.createElement('figure');
  figure.className = `fiche-photo${photo.principale ? ' fiche-photo-principale' : ''}`;
  const image = document.createElement('img');
  image.src = `${photo.url}${photo.url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  image.alt = photo.principale ? designation : `${designation} — vue complémentaire`;
  image.addEventListener('error', () => figure.remove(), { once: true });
  figure.append(image);
  return figure;
}

async function afficherGalerie(item, photoSection, version) {
  const galerie = document.createElement('div');
  galerie.className = 'fiche-photos';
  const statut = document.createElement('p');
  statut.className = 'fiche-gallery-status';
  statut.setAttribute('aria-live', 'polite');
  photoSection.append(galerie, statut);
  let { photos, editable } = await photosDeFiche(item);
  if (version !== ficheRenderVersion) return;

  const actualiser = async () => {
    ({ photos, editable } = await photosDeFiche(item));
    if (version === ficheRenderVersion) dessiner();
  };

  const dessiner = () => {
    photoSection.querySelectorAll('.fiche-gallery-add').forEach((element) => element.remove());
    galerie.replaceChildren();
    galerie.dataset.count = String(photos.length);
    photoSection.hidden = photos.length === 0;
    for (const [index, photo] of photos.entries()) {
      const figure = creerImageGalerie(photo, item.designation);
      if (editable && !photo.principale) {
        const complements = photos.filter((candidate) => !candidate.principale);
        const positionComplement = complements.findIndex((candidate) => candidate.nom === photo.nom);
        const actions = document.createElement('div');
        actions.className = 'fiche-photo-actions';
        const monter = document.createElement('button');
        monter.type = 'button';
        monter.textContent = '↑';
        monter.title = 'Déplacer cette photo vers la gauche';
        monter.disabled = positionComplement === 0;
        const descendre = document.createElement('button');
        descendre.type = 'button';
        descendre.textContent = '↓';
        descendre.title = 'Déplacer cette photo vers la droite';
        descendre.disabled = positionComplement === complements.length - 1;
        const supprimer = document.createElement('button');
        supprimer.type = 'button';
        supprimer.textContent = 'Supprimer';
        supprimer.className = 'fiche-photo-delete';
        supprimer.addEventListener('click', async () => {
          if (!window.confirm('Supprimer cette photo complémentaire ?')) return;
          const response = await fetch(`/api/photos/${encodeURIComponent(item.id)}/${encodeURIComponent(photo.nom)}`, { method: 'DELETE' });
          if (!response.ok) {
            statut.textContent = 'La photo n’a pas pu être supprimée.';
            return;
          }
          statut.textContent = '';
          await actualiser();
        });
        const deplacer = async (offset) => {
          const position = complements.findIndex((candidate) => candidate.nom === photo.nom);
          [complements[position], complements[position + offset]] = [complements[position + offset], complements[position]];
          const response = await fetch(`/api/photos/${encodeURIComponent(item.id)}/ordre`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(complements.map((candidate) => candidate.nom)),
          });
          if (!response.ok) {
            statut.textContent = 'L’ordre des photos n’a pas pu être enregistré.';
            return;
          }
          statut.textContent = '';
          await actualiser();
        };
        monter.addEventListener('click', () => deplacer(-1));
        descendre.addEventListener('click', () => deplacer(1));
        actions.append(monter, descendre, supprimer);
        figure.append(actions);
      }
      galerie.append(figure);
    }

    if (!editable) return;
    const ajout = document.createElement('div');
    ajout.className = 'fiche-gallery-add';
    const choisir = document.createElement('button');
    choisir.type = 'button';
    choisir.textContent = 'Ajouter des photos';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.multiple = true;
    input.hidden = true;
    choisir.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      if (!input.files?.length) return;
      const donnees = new FormData();
      for (const fichier of input.files) donnees.append('photos', fichier);
      choisir.disabled = true;
      statut.textContent = 'Ajout des photos…';
      try {
        const response = await fetch(`/api/photos/${encodeURIComponent(item.id)}`, { method: 'POST', body: donnees });
        if (!response.ok) throw new Error('Ajout impossible');
        statut.textContent = '';
        await actualiser();
      } catch {
        statut.textContent = 'Les photos n’ont pas pu être ajoutées.';
      } finally {
        choisir.disabled = false;
        input.value = '';
      }
    });
    ajout.append(choisir, input);
    photoSection.append(ajout);
  };

  dessiner();
}

function renderFiche(item) {
  const version = ++ficheRenderVersion;
  ficheContent.replaceChildren();

  const title = document.createElement('header');
  title.className = 'fiche-title';
  const designation = document.createElement('h2');
  designation.textContent = item.id + ' — ' + item.designation;
  title.append(designation);
  const placement = placementFor(item.id);
  const emplacement = document.createElement('p');
  emplacement.textContent = placement ? `Emplacement : ${placement.cabinet}-${placement.shelf}-${placement.zones.join('-')}` : 'Emplacement : Réserve';
  title.append(emplacement);
  ficheContent.append(title);

  const identity = document.createElement('dl');
  identity.className = 'fiche-identification';
  const fields = [
    ['Nature', displayValue(item.nature)],
    ['Dimensions', displayValue(item.dimensions)],
    ['Poids', displayValue(item.poids)],
    ['Date minimale', displayValue(item.dateMin)],
    ['Date maximale', displayValue(item.dateMax)],
    ['Datation', displayValue(item.datation)],
    ['Époque', displayValue(item.epoque)],
    ['Culture / civilisation', displayValue(item.culture)],
    ['Aire géographique / aire d’usage attesté', displayValue(item.aireGeographique)],
    ['Matériaux métalliques', displayValue(item.materiauxMetalliques)],
    ['Matériaux non métalliques', displayValue(item.materiauxNonMetalliques)],
    ['Technique', displayValue(item.technique)],
    ['Décor', displayValue(item.decor)],
    ['Fonction / usage', displayValue(item.fonctionUsage)],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    identity.append(term, detail);
  }
  appendFicheSection(ficheContent, 'Identification', identity);

  const photoSection = document.createElement('section');
  photoSection.className = 'fiche-section fiche-photos-section';
  const photoHeading = document.createElement('h3');
  photoHeading.textContent = 'Photos';
  photoSection.append(photoHeading);
  ficheContent.append(photoSection);

  const particularites = document.createElement('div');
  particularites.className = 'fiche-text';
  appendFreeText(particularites, item.particularites);
  appendFicheSection(ficheContent, 'Particularités', particularites, 'fiche-particularites');

  const usage = document.createElement('div');
  usage.className = 'fiche-text';
  appendFreeText(usage, item.usageTexte);
  appendFicheSection(ficheContent, 'À quoi ça sert ?', usage);

  const analyse = document.createElement('div');
  analyse.className = 'fiche-text';
  appendFreeText(analyse, item.texteAnalyse);
  appendFicheSection(ficheContent, 'Documentation et notes', analyse);

  void afficherGalerie(item, photoSection, version);
}

function openFiche(item) {
  renderFiche(item);
  ficheDialog.showModal();
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

function stateForExport(currentPlacements = placements, currentReservedIds = reservedIds) {
  return {
    formatVersion: 1,
    placements: [
      ...currentPlacements.map((placement) => ({
        id: placement.objectId, state: 'place', cabinet: placement.cabinet, shelf: placement.shelf,
        zones: [...placement.zones], displayZone: placement.displayZone,
      })),
      ...[...currentReservedIds].map((id) => ({ id, state: 'reserve' })),
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

async function savePlacementState(nextPlacements = placements, nextReservedIds = reservedIds) {
  setStorageStatus('Enregistrement du placement…');
  try {
    const response = await fetch(`/api/placements?client=${encodeURIComponent(placementClientId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stateForExport(nextPlacements, nextReservedIds)),
    });
    if (!response.ok) throw new Error('Réponse du serveur invalide');
    setStorageStatus('✓ Placement enregistré sur le Mac');
    return true;
  } catch {
    setStorageStatus('Erreur : enregistrement sur le Mac impossible');
    return false;
  }
}

async function loadPlacementState({ announce = true } = {}) {
  try {
    const response = await fetch('/api/placements', { cache: 'no-store' });
    if (!response.ok) throw new Error('Réponse du serveur invalide');
    const restored = parseState(await response.json());
    placements = restored.placements;
    reservedIds = restored.reserve;
    if (announce) setStorageStatus('✓ Placements chargés depuis le Mac');
  } catch {
    placements = [];
    reservedIds = new Set();
    throw new Error('Placements du Mac indisponibles');
  }
}

async function refreshPlacementGrid() {
  try {
    await loadPlacementState({ announce: false });
    renderPlan();
  } catch {
    setStorageStatus('Erreur : placements du Mac indisponibles');
  }
}

function startPlacementUpdates() {
  if (!('EventSource' in window) || placementEvents) return;
  placementEvents = new EventSource('/api/placements/events');
  placementEvents.addEventListener('placements', async (event) => {
    try {
      if (JSON.parse(event.data).source === placementClientId) return;
    } catch {
      return;
    }
    await refreshPlacementGrid();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void refreshPlacementGrid();
});

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

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function updateResearchTitles() {
  for (const [field, label] of researchFamilies) {
    const title = researchCriteria.querySelector(`summary[data-family="${field}"]`);
    const count = checkedCriteria.get(field).size;
    if (title) title.textContent = count ? `${label} (${count})` : label;
  }
}

function renderResearchCriteria() {
  researchCriteria.replaceChildren();
  for (const [field, label] of researchFamilies) {
    const group = document.createElement('details');
    const legend = document.createElement('summary');
    legend.dataset.family = field;
    legend.textContent = label;
    group.append(legend);
    const values = window.RECHERCHE_VOCABULAIRES?.[field]
      || [...new Set(catalogue.flatMap((item) => window.RECHERCHE?.[item.id]?.[field] || []))];
    const orderedValues = field === 'epoque' ? values : values.sort((a, b) => a.localeCompare(b, 'fr'));
    for (const value of orderedValues) {
      const option = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = value;
      checkbox.dataset.family = field;
      checkbox.checked = checkedCriteria.get(field).has(value);
      checkbox.addEventListener('change', () => {
        const selected = checkedCriteria.get(field);
        if (checkbox.checked) selected.add(value);
        else selected.delete(value);
        updateResearchTitles();
        renderList();
      });
      option.append(checkbox, document.createTextNode(value));
      group.append(option);
    }
    researchCriteria.append(group);
  }
  updateResearchTitles();
}

function visibleObjects() {
  const text = normalizeSearch(researchInput.value.trim());
  return catalogue.filter((item) => {
    const research = window.RECHERCHE?.[item.id];
    const isPlaced = hasActivePlacement(item.id);
    return (catalogueFilter === 'all'
      || (catalogueFilter === 'placed' && isPlaced)
      || (catalogueFilter === 'reserve' && !isPlaced))
      && normalizeSearch(`${research?.designation ?? item.designation}\n${research?.particularites ?? ''}`).includes(text)
      && researchFamilies.every(([field]) => {
        const selected = checkedCriteria.get(field);
        return selected.size === 0 || (research?.[field] || []).some((value) => selected.has(value));
      });
  });
}

function renderList() {
  const visible = visibleObjects().sort((left, right) => {
    const difference = objectNumber(left.id) - objectNumber(right.id);
    return sortDescending ? -difference : difference;
  });
  catalogueFilterButtons.forEach((button) => {
    const isActive = button.dataset.catalogueFilter === catalogueFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  researchCount.textContent = `${visible.length} objet${visible.length === 1 ? '' : 's'} trouvé${visible.length === 1 ? '' : 's'}`;
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
    button.dataset.objectId = item.id;
    button.setAttribute('aria-pressed', String(item.id === selectedId));
    button.title = `${objectNumber(item.id)} — ${item.designation}`;

    const identifier = document.createElement('span');
    identifier.className = 'object-id';
    identifier.textContent = objectNumber(item.id);

    const image = document.createElement('img');
    image.className = 'list-photo';
    image.src = photoPath(item);
    image.alt = '';

    const details = document.createElement('span');
    details.className = 'object-details';

    const designation = document.createElement('span');
    designation.className = 'object-name';
    designation.textContent = item.designation;

    details.append(designation);

    button.append(identifier, image, details);
    button.addEventListener('click', () => selectObject(item.id));
    objectList.append(button);
  }
}

function selectObject(id, { scrollCatalogue = false } = {}) {
  selectedId = id;
  const item = catalogue.find((candidate) => candidate.id === id);
  if (!item) return;

  const placement = placementFor(id);
  if (placement) {
    cabinet = placement.cabinet;
    shelf = placement.shelf;
    selectedZones = [...placement.zones];
  }

  researchPanel.hidden = true;
  objectHeading.hidden = false;
  selectionContent.hidden = false;
  selectionPanel.setAttribute('aria-labelledby', 'selection-title');
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

  const ficheButton = document.createElement('button');
  ficheButton.type = 'button';
  ficheButton.className = 'fiche-link';
  ficheButton.textContent = 'Voir la fiche';
  ficheButton.addEventListener('click', () => openFiche(item));

  selectionContent.append(title, image, designation, location, ficheButton);
  objectActions.hidden = false;
  renderList();
  if (scrollCatalogue) objectList.querySelector(`[data-object-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  renderPlan();
}

function renderEmptySelection() {
  objectActions.hidden = true;
  objectHeading.hidden = true;
  selectionContent.hidden = true;
  selectionContent.replaceChildren();
  researchPanel.hidden = false;
  selectionPanel.setAttribute('aria-labelledby', 'research-title');
}

function deselectObject() {
  if (!selectedId) return;
  selectedId = null;
  renderEmptySelection();
  renderList();
  updatePlaceButton();
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
          object.className = `zone-object${item.id === selectedId ? ' is-selected' : ''}`;
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

planPanel.addEventListener('click', (event) => {
  if (event.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
  selectedZones = [];
  deselectObject();
  renderPlan();
});

shelfGrid.addEventListener('pointerdown', (event) => {
  const placedObject = event.target.closest('.zone-object');
  if (placedObject) {
    event.preventDefault();
    event.stopPropagation();
    selectObject(placedObject.dataset.objectId, { scrollCatalogue: true });
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

planHeading.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button, a, input, select, textarea, label, [role="button"]')) return;
  headingScroll = { pointerId: event.pointerId, startX: event.clientX, startLeft: document.querySelector('.grid-scroll').scrollLeft };
  planHeading.setPointerCapture?.(event.pointerId);
});

planHeading.addEventListener('pointermove', (event) => {
  if (!headingScroll || headingScroll.pointerId !== event.pointerId) return;
  const gridScroll = document.querySelector('.grid-scroll');
  gridScroll.scrollLeft = headingScroll.startLeft - (event.clientX - headingScroll.startX);
});

planHeading.addEventListener('pointerup', () => { headingScroll = null; });
planHeading.addEventListener('pointercancel', () => { headingScroll = null; });

placeButton.addEventListener('click', async () => {
  if (!selectedId || selectedZones.length === 0 || hasActivePlacement(selectedId)) return;
  const nextReservedIds = new Set(reservedIds);
  nextReservedIds.delete(selectedId);
  const nextPlacements = [...placements, {
    objectId: selectedId,
    cabinet,
    shelf,
    zones: [...selectedZones],
    displayZone: chooseDisplayZone(cabinet, shelf, selectedZones),
  }];
  if (!await savePlacementState(nextPlacements, nextReservedIds)) return;
  placements = nextPlacements;
  reservedIds = nextReservedIds;
  selectObject(selectedId);
});

moveButton.addEventListener('click', async () => {
  const placement = placementFor(selectedId);
  if (!placement || selectedZones.length === 0) return;
  const nextPlacements = placements.map((candidate) => candidate.objectId === selectedId ? {
    ...candidate,
    cabinet,
    shelf,
    zones: [...selectedZones],
    displayZone: chooseDisplayZone(cabinet, shelf, selectedZones, selectedId),
  } : candidate);
  if (!await savePlacementState(nextPlacements, reservedIds)) return;
  placements = nextPlacements;
  selectObject(selectedId);
});

removeButton.addEventListener('click', async () => {
  if (!placementFor(selectedId)) return;
  const nextPlacements = placements.filter((placement) => placement.objectId !== selectedId);
  const nextReservedIds = new Set(reservedIds);
  nextReservedIds.add(selectedId);
  if (!await savePlacementState(nextPlacements, nextReservedIds)) return;
  placements = nextPlacements;
  reservedIds = nextReservedIds;
  selectedZones = [];
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

function readFileAsText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible'));
    reader.readAsText(file);
  });
}

backupButton.addEventListener('click', () => downloadState(stateForExport()));
restoreButton.addEventListener('click', () => restoreInput.click());
restoreInput.addEventListener('change', async () => {
  const file = restoreInput.files?.[0];
  restoreInput.value = '';
  if (!file) return;
  try {
    const restored = parseState(JSON.parse(await readFileAsText(file)));
    if (!window.confirm('Restaurer cette sauvegarde JSON de secours ? Une copie de l’état actuel sera exportée avant la restauration.')) return;
    downloadState(stateForExport(), 'VITRINE-AVANT-RESTAURATION');
    if (!await savePlacementState(restored.placements, restored.reserve)) throw new Error('Le Mac n’a pas confirmé la restauration.');
    placements = restored.placements;
    reservedIds = restored.reserve;
    selectedId = null;
    selectedZones = [];
    renderEmptySelection();
    renderList();
    renderPlan();
  } catch (error) {
    window.alert('Restauration impossible : ' + error.message);
  }
});

async function loadCatalogue() {
  try {
    if (!Array.isArray(window.CATALOGUE) || window.CATALOGUE.length === 0) throw new Error('Catalogue incomplet');

    catalogue = [...window.CATALOGUE].sort((left, right) => objectNumber(left.id) - objectNumber(right.id));
    countBadge.textContent = catalogue.length;
    catalogueCount.textContent = `${catalogue.length} objets du catalogue`;
    await loadPlacementState();
    renderResearchCriteria();
    renderList();
    renderPlan();
    startPlacementUpdates();
  } catch (error) {
    countBadge.textContent = '—';
    catalogueCount.textContent = 'Catalogue indisponible';
    catalogueMessage.hidden = false;
    catalogueMessage.textContent = error.message || 'Impossible de charger VITRINES.';
  }
}

catalogueFilterButtons.forEach((button) => button.addEventListener('click', () => {
  catalogueFilter = button.dataset.catalogueFilter;
  renderList();
}));
sortToggle.addEventListener('click', () => {
  sortDescending = !sortDescending;
  sortToggle.setAttribute('aria-pressed', String(sortDescending));
  renderList();
});
researchInput.addEventListener('input', renderList);
clearResearch.addEventListener('click', () => {
  researchInput.value = '';
  checkedCriteria.forEach((values) => values.clear());
  researchCriteria.querySelectorAll('input').forEach((checkbox) => { checkbox.checked = false; });
  updateResearchTitles();
  renderList();
});
renderPlan();
loadCatalogue();
