import {
    state,
    RATES,
    NOTE_NAMES,
    WAVE_SERIALIZE_MAP,
    WAVE_DESERIALIZE_MAP,
    SHARE_FORMAT_VERSION
} from './state.js';

import {
    domElements,
    createSequencerGrid,
    createSelectorTicks,
    createSeqMaxButtons,
    createModalNoteButtons,
    createModalOctaveButtons,
    createModalWaveformButtons,
    updateAllStepsUI,
    updateBaseNoteDisplay,
    updateDisabledStepsUI
} from './ui.js';

import { initAudioModule } from './audio.js';
import { setupEventListeners } from './events.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Initialization ---

    // Pass UI elements to the audio module
    initAudioModule(domElements);

    // Initial UI setup
    updateBaseNoteDisplay();
    domElements.bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;
    createSequencerGrid();
    createSelectorTicks();
    createSeqMaxButtons();
    createModalNoteButtons();
    createModalOctaveButtons();
    createModalWaveformButtons();
    updateAllStepsUI();
    domElements.updatePlayButtons(false);

    // Setup all event listeners
    setupEventListeners(serializeState);

    // Load state from URL if present
    setTimeout(loadStateFromHash, 100);

    // Setup Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, err => {
          console.log('ServiceWorker registration failed: ', err);
        });
      });
    }
});

// --- State Serialization/Deserialization ---
function serializeState() {
    const rateIndex = RATES.indexOf(state.rate);
    const noteIndex = NOTE_NAMES.indexOf(state.baseNote);
    const waveChar = WAVE_SERIALIZE_MAP[state.waveform] || 'w';
    const stepStr = state.steps.map(s => (s.transpose + 12).toString(36)).join('');
    const enabledFlags = state.steps.slice(0, 16).reduce((acc, step, i) => acc | ((step.enabled ? 1 : 0) << i), 0);
    const enabledStr = enabledFlags.toString(36).padStart(4, '0');

    const parts = [
        SHARE_FORMAT_VERSION,
        state.bpm.toString(36).padStart(2, '0'),
        rateIndex,
        noteIndex.toString(36),
        state.baseOctave,
        waveChar,
        state.seqMax.toString(36),
        enabledStr,
        stepStr
    ];
    return parts.join('');
}

function loadStateFromHash() {
    if (!window.location.hash) return;

    try {
        const dataString = decodeURIComponent(window.location.hash.substring(1));
        
        const version = dataString.substring(0, 2);
        if (version !== SHARE_FORMAT_VERSION) {
            console.warn(`URL data version (${version}) is not supported.`);
            return;
        }

        let pos = 2;
        const bpm = parseInt(dataString.substring(pos, pos += 2), 36);
        const rateIndex = parseInt(dataString.substring(pos, pos += 1), 10);
        const noteIndex = parseInt(dataString.substring(pos, pos += 1), 36);
        const baseOctave = parseInt(dataString.substring(pos, pos += 1), 10);
        
        const waveChar = dataString.substring(pos, pos += 1);
        const waveform = WAVE_DESERIALIZE_MAP[waveChar] || 'sawtooth';

        const seqMax = parseInt(dataString.substring(pos, pos += 1), 36);

        const enabledStr = dataString.substring(pos, pos += 4);
        const enabledFlags = parseInt(enabledStr, 36);
        
        const stepStr = dataString.substring(pos);
        const transposes = [...stepStr].map(char => parseInt(char, 36) - 12);

        // Update state
        state.bpm = bpm;
        state.rate = RATES[rateIndex];
        state.baseNote = NOTE_NAMES[noteIndex];
        state.baseOctave = baseOctave;
        state.waveform = waveform;
        state.seqMax = seqMax;
        
        for (let i = 0; i < state.steps.length; i++) {
            state.steps[i].enabled = (enabledFlags & (1 << i)) !== 0;
            if (transposes[i] !== undefined) {
                state.steps[i].transpose = transposes[i];
            }
        }

        // --- Update UI from loaded state ---
        state.modalBpm = state.bpm;
        state.modalRate = state.rate;
        const rateButton = domElements.modalRateButtons.querySelector(`button[data-rate="${state.rate}"]`);
        state.modalRateText = rateButton ? rateButton.textContent : '?';
        domElements.bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;

        state.modalBaseNote = state.baseNote;
        state.modalBaseOctave = state.baseOctave;
        state.modalWaveform = state.waveform;
        updateBaseNoteDisplay();

        const currentActive = domElements.seqMaxButtonsContainer.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        const newActive = domElements.seqMaxButtonsContainer.querySelector(`button[data-value="${state.seqMax}"]`);
        if (newActive) newActive.classList.add('active');
        
        updateAllStepsUI();

        alert('URLからシーケンスを復元しました。');

    } catch (e) {
        console.error('URLからの状態復元に失敗しました:', e);
        alert('URLデータの読み込みに失敗しました。');
    }
}