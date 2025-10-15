import {
    state,
    STEPS_COUNT,
    OCTAVES,
    WAVEFORMS,
    MAJOR_TICKS,
    INTERVAL_NAMES,
    BPM_MIN,
    BPM_MAX,
    SCALES,
    helpContent,
    NOTE_NAMES
} from './state.js';

import { playAuditionSound, startPlayback, stopPlayback } from './audio.js';
import { noteToMidi, getNoteName, formatTranspose } from './utils.js';

// --- DOM Elements ---
export const domElements = {
    headerContainer: document.querySelector('.header-container'),
    seqMaxButtonsContainer: document.getElementById('seq-max-buttons'),
    sequencerGrid: document.getElementById('sequencer-grid'),
    stepModal: document.getElementById('step-modal'),
    closeModalBtn: document.getElementById('close-modal-button'),
    doneStepButton: document.getElementById('done-step-button'),
    modalStepNumber: document.getElementById('modal-step-number'),
    transposeValueDisplay: document.getElementById('transpose-value-display'),
    intervalNameDisplay: document.getElementById('interval-name-display'),
    finalNoteDisplay: document.getElementById('final-note-display'),
    transposeSelector: document.getElementById('transpose-selector'),
    auditionBtn: document.getElementById('audition-button'),
    resetBtn: document.getElementById('reset-button'),
    selectorTicks: document.querySelector('.selector-ticks'),
    playStopBtn: document.getElementById('play-stop-button'),
    melodyGenBtn: document.getElementById('melody-gen-button'),
    shareBtn: document.getElementById('share-button'),
    bpmRateModal: document.getElementById('bpm-rate-modal'),
    bpmRateDisplayButton: document.getElementById('bpm-rate-display-button'),
    closeBpmRateModalButton: document.getElementById('close-bpm-rate-modal-button'),
    doneBpmRateButton: document.getElementById('done-bpm-rate-button'),
    modalBpmValue: document.getElementById('modal-bpm-value'),
    bpmDown10: document.getElementById('bpm-down-10'),
    bpmDown1: document.getElementById('bpm-down-1'),
    bpmUp1: document.getElementById('bpm-up-1'),
    bpmUp10: document.getElementById('bpm-up-10'),
    modalRateButtons: document.getElementById('modal-rate-buttons'),
    baseNoteModal: document.getElementById('base-note-modal'),
    baseNoteDisplayButton: document.getElementById('base-note-display-button'),
    closeBaseNoteModalButton: document.getElementById('close-base-note-modal-button'),
    doneBaseNoteButton: document.getElementById('done-base-note-button'),
    modalNoteNameButtons: document.getElementById('modal-note-name-buttons'),
    modalOctaveButtons: document.getElementById('modal-octave-buttons'),
    modalWaveformButtons: document.getElementById('modal-waveform-buttons'),
    melodyGenModal: document.getElementById('melody-gen-modal'),
    closeMelodyGenModalButton: document.getElementById('close-melody-gen-modal-button'),
    melodyKeySelect: document.getElementById('melody-key-select'),
    melodyScaleSelect: document.getElementById('melody-scale-select'),
    previewMelodyButton: document.getElementById('preview-melody-button'),
    applyMelodyButton: document.getElementById('apply-melody-button'),
    melodyAlgorithmSelect: document.getElementById('melody-algorithm-select'),
    melodyRestProbability: document.getElementById('melody-rest-probability'),
    melodyRestProbabilityValue: document.getElementById('melody-rest-probability-value'),
    shareModal: document.getElementById('share-modal'),
    closeShareModalButton: document.getElementById('close-share-modal-button'),
    shareUrlInput: document.getElementById('share-url-input'),
    copyUrlButton: document.getElementById('copy-url-button'),
    shareXButton: document.getElementById('share-x-button'),
    helpModal: document.getElementById('help-modal'),
    closeHelpModalButton: document.getElementById('close-help-modal-button'),
    helpModalTitle: document.getElementById('help-modal-title'),
    helpModalContent: document.getElementById('help-modal-content'),
    helpLanguageSwitcher: document.getElementById('help-language-switcher'),
    updatePlayButtons: updatePlayButtons, // Add function references that audio module needs
    updateDisabledStepsUI: updateDisabledStepsUI
};

// --- UI Update ---
export function updateStepUI(index, stepData) {
    const stepElement = domElements.sequencerGrid.children[index];
    stepElement.querySelector('.step-transpose').textContent = formatTranspose(stepData.transpose);
    const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
    const finalMidi = baseMidi + stepData.transpose;
    stepElement.querySelector('.step-note').textContent = getNoteName(finalMidi);
    stepElement.classList.toggle('step-disabled', !stepData.enabled);
}

export function updateAllStepsUI() {
    const sequence = state.playbackMode === 'preview' && state.previewSteps ? state.previewSteps : state.steps;
    for (let i = 0; i < STEPS_COUNT; i++) {
        const stepData = sequence[i] || { transpose: 0, enabled: true };
        updateStepUI(i, stepData);
    }
    updateDisabledStepsUI();
}

export function updateDisabledStepsUI() {
    const steps = domElements.sequencerGrid.children;
    const limit = state.pendingSeqMax !== null ? state.pendingSeqMax : state.seqMax;
    for (let i = 0; i < steps.length; i++) {
        steps[i].classList.toggle('disabled', i >= limit);
    }
}

export function updateBaseNoteDisplay() {
    const waveText = WAVEFORMS[state.waveform] || 'ERR';
    domElements.baseNoteDisplayButton.textContent = `${state.baseNote}${state.baseOctave} / ${waveText.toUpperCase()}`;
}

function updatePlayButtons(playing) {
    if (domElements.playStopBtn) domElements.playStopBtn.classList.toggle('playing', playing);
}

// --- Modal Logic ---
export function openStepModal(stepIndex) {
    const limit = state.pendingSeqMax !== null ? state.pendingSeqMax : state.seqMax;
    if (stepIndex >= limit) return;

    if (state.isPlaying) stopPlayback();
    state.editedStepIndex = stepIndex;
    domElements.modalStepNumber.textContent = `#${stepIndex + 1}`;
    const stepData = state.steps[stepIndex];
    updateStepModalInfo(stepData.transpose);

    const toggle = document.getElementById('step-enable-toggle');
    if (toggle) {
        toggle.checked = stepData.enabled;
        toggle.onchange = (e) => {
            if (state.editedStepIndex !== null) {
                state.steps[state.editedStepIndex].enabled = e.target.checked;
                updateStepUI(state.editedStepIndex, state.steps[state.editedStepIndex]);
            }
        };
    }

    domElements.stepModal.style.display = 'flex';
}

export function closeStepModal() {
    domElements.stepModal.style.display = 'none';
}

export function updateStepModalInfo(transpose, save = false) {
    domElements.transposeValueDisplay.textContent = formatTranspose(transpose);
    domElements.intervalNameDisplay.textContent = INTERVAL_NAMES[transpose] || '';
    const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
    const finalMidi = baseMidi + transpose;
    domElements.finalNoteDisplay.textContent = getNoteName(finalMidi);
    const handle = domElements.transposeSelector.querySelector('.selector-handle');
    const percentage = (transpose + 12) / 24;
    handle.style.left = `${percentage * 100}%`;

    if (save) {
        state.steps[state.editedStepIndex].transpose = transpose;
        updateStepUI(state.editedStepIndex, state.steps[state.editedStepIndex]);
    }
}

export function openBpmRateModal() {
    if (state.isPlaying) stopPlayback();
    state.modalBpm = state.bpm;
    state.modalRate = state.rate;
    domElements.modalBpmValue.textContent = state.modalBpm;
    domElements.modalRateButtons.querySelectorAll('button').forEach(btn => {
        const btnRate = parseFloat(btn.dataset.rate);
        if (btnRate === state.modalRate) {
            btn.classList.add('selected');
            state.modalRateText = btn.textContent;
        } else {
            btn.classList.remove('selected');
        }
    });
    domElements.bpmRateModal.style.display = 'flex';
}

export function closeBpmRateModal() {
    domElements.bpmRateModal.style.display = 'none';
}

export function applyBpmRateChanges() {
    state.bpm = state.modalBpm;
    state.rate = state.modalRate;
    domElements.bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;
    closeBpmRateModal();
}

export function adjustBpm(amount) {
    state.modalBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, state.modalBpm + amount));
    domElements.modalBpmValue.textContent = state.modalBpm;
}

export function openBaseNoteModal() {
    if (state.isPlaying) stopPlayback();
    state.modalBaseNote = state.baseNote;
    state.modalBaseOctave = state.baseOctave;
    state.modalWaveform = state.waveform;
    
    domElements.modalNoteNameButtons.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.note === state.modalBaseNote);
    });
    domElements.modalOctaveButtons.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('selected', parseInt(btn.dataset.octave) === state.modalBaseOctave);
    });
    domElements.modalWaveformButtons.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.wave === state.modalWaveform);
    });

    domElements.baseNoteModal.style.display = 'flex';
}

export function closeBaseNoteModal() {
    domElements.baseNoteModal.style.display = 'none';
}

export function applyBaseNoteChanges() {
    state.baseNote = state.modalBaseNote;
    state.baseOctave = state.modalBaseOctave;
    state.waveform = state.modalWaveform;
    updateBaseNoteDisplay();
    updateAllStepsUI();
    closeBaseNoteModal();
}

export function openMelodyGenModal() {
    if (state.isPlaying) stopPlayback();
    state.previewSteps = null;
    domElements.applyMelodyButton.disabled = true;
    domElements.melodyGenModal.style.display = 'flex';
}

export function closeMelodyGenModal() {
    if (state.isPlaying) stopPlayback();
    state.previewSteps = null;
    updateAllStepsUI();
    domElements.melodyGenModal.style.display = 'none';
}

export function generateAndPreviewMelody() {
    const key = domElements.melodyKeySelect.value;
    const scaleName = domElements.melodyScaleSelect.value;
    const scaleIntervals = SCALES[scaleName];

    const rootNoteIndex = NOTE_NAMES.indexOf(key);
    const baseMidi = noteToMidi(state.baseNote, state.baseOctave);

    const transposePool = [];
    const octaveRange = state.melodyGenAlgorithm === 'leaps-and-rests' ? 2 : 1;
    for (let octave = -octaveRange; octave <= octaveRange; octave++) {
        for (const interval of scaleIntervals) {
            const midiNote = rootNoteIndex + (state.baseOctave + octave) * 12 + interval;
            transposePool.push(midiNote - baseMidi);
        }
    }
    const uniqueTransposes = [...new Set(transposePool)].sort((a, b) => a - b);

    let currentIndex = uniqueTransposes.indexOf(
        uniqueTransposes.reduce((prev, curr) => Math.abs(curr) < Math.abs(prev) ? curr : prev, Infinity)
    );

    const newMelody = [];
    for (let i = 0; i < STEPS_COUNT; i++) {
        const isRest = Math.random() < state.melodyGenRestProbability;
        if (isRest) {
            newMelody.push({ transpose: uniqueTransposes[currentIndex], enabled: false });
        } else {
            newMelody.push({ transpose: uniqueTransposes[currentIndex], enabled: true });

            if (state.melodyGenAlgorithm === 'simple-walk') {
                const randomChoice = Math.random();
                if (randomChoice < 0.2) { 
                } else if (randomChoice < 0.6) {
                    currentIndex = Math.min(uniqueTransposes.length - 1, currentIndex + 1);
                } else {
                    currentIndex = Math.max(0, currentIndex - 1);
                }
            } else { 
                const randomChoice = Math.random();
                let nextIndex;
                if (randomChoice < 0.5) {
                    const direction = Math.random() < 0.5 ? -1 : 1;
                    nextIndex = currentIndex + direction;
                } else {
                    const leapSize = Math.floor(Math.random() * 4) + 2;
                    const direction = Math.random() < 0.5 ? -1 : 1;
                    nextIndex = currentIndex + (leapSize * direction);
                }
                currentIndex = Math.max(0, Math.min(uniqueTransposes.length - 1, nextIndex));
            }
        }
    }

    state.previewSteps = newMelody;
    domElements.applyMelodyButton.disabled = false;
    
    for (let i = 0; i < STEPS_COUNT; i++) {
        updateStepUI(i, state.previewSteps[i]);
    }

    startPlayback('preview', newMelody);
}

export function applyMelody() {
    if (state.previewSteps) {
        state.steps = JSON.parse(JSON.stringify(state.previewSteps));
        updateAllStepsUI();
        closeMelodyGenModal();
    }
}

let currentHelpTopic = '';
let currentLang = 'en';

export function openHelpModal(topic) {
    currentHelpTopic = topic;
    updateHelpContent();
    domElements.helpModal.style.display = 'flex';
}

export function closeHelpModal() {
    domElements.helpModal.style.display = 'none';
}

function updateHelpContent() {
    if (!currentHelpTopic) return;
    const topicContent = helpContent[currentHelpTopic];
    domElements.helpModalTitle.textContent = topicContent.title[currentLang];
    domElements.helpModalContent.textContent = topicContent.content[currentLang];

    domElements.helpLanguageSwitcher.querySelector('.selected').classList.remove('selected');
    domElements.helpLanguageSwitcher.querySelector(`[data-lang="${currentLang}"]`).classList.add('selected');
}

export function openShareModal() {
    // serializeState will be in main.js
    // This function needs to be passed the serialized string
    domElements.shareModal.style.display = 'flex';
}

export function closeShareModal() {
    domElements.shareModal.style.display = 'none';
}

// --- UI Creation ---
export function createSequencerGrid() {
    domElements.sequencerGrid.innerHTML = '';
    for (let i = 0; i < STEPS_COUNT; i++) {
        const stepElement = document.createElement('div');
        stepElement.classList.add('step');
        stepElement.dataset.index = i;
        stepElement.draggable = true;

        const stepNumberEl = document.createElement('div');
        stepNumberEl.classList.add('step-number');
        stepNumberEl.textContent = i + 1;
        const transposeEl = document.createElement('div');
        transposeEl.classList.add('step-transpose');
        const noteEl = document.createElement('div');
        noteEl.classList.add('step-note');
        stepElement.appendChild(stepNumberEl);
        stepElement.appendChild(transposeEl);
        stepElement.appendChild(noteEl);

        domElements.sequencerGrid.appendChild(stepElement);
    }
}

export function createSelectorTicks() {
    domElements.selectorTicks.innerHTML = '';
    for (let i = -12; i <= 12; i++) {
        const tick = document.createElement('div');
        tick.classList.add('tick');
        if (MAJOR_TICKS.includes(i)) tick.classList.add('tick-major');
        tick.style.left = `${((i + 12) / 24) * 100}%`;
        domElements.selectorTicks.appendChild(tick);
    }
}

export function createSeqMaxButtons() {
    domElements.seqMaxButtonsContainer.innerHTML = '';
    for (let i = 1; i <= STEPS_COUNT; i++) {
        const button = document.createElement('button');
        button.classList.add('seq-max-button');
        button.textContent = i;
        button.dataset.value = i;
        if (i === state.seqMax) button.classList.add('active');
        domElements.seqMaxButtonsContainer.appendChild(button);
    }
}

export function createModalNoteButtons() {
    domElements.modalNoteNameButtons.innerHTML = '';
    NOTE_NAMES.forEach(note => {
        const button = document.createElement('button');
        button.textContent = note;
        button.dataset.note = note;
        domElements.modalNoteNameButtons.appendChild(button);
    });
}

export function createModalOctaveButtons() {
    domElements.modalOctaveButtons.innerHTML = '';
    OCTAVES.forEach(octave => {
        const button = document.createElement('button');
        button.textContent = octave;
        button.dataset.octave = octave;
        domElements.modalOctaveButtons.appendChild(button);
    });
}

export function createModalWaveformButtons() {
    domElements.modalWaveformButtons.innerHTML = '';
    for (const [waveValue, waveText] of Object.entries(WAVEFORMS)) {
        const button = document.createElement('button');
        button.textContent = waveText;
        button.dataset.wave = waveValue;
        domElements.modalWaveformButtons.appendChild(button);
    }
}