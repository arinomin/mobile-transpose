import { state, STEPS_COUNT, BPM_MIN, BPM_MAX } from './state.js';
import { updateAllStepsUI, updateStepUI, updateBaseNoteDisplay, updateDisabledStepsUI, domElements } from './ui.js';
import { noteToMidi } from './utils.js';

// --- State Mutation Actions ---

export function setBpm(newBpm) {
    state.bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, newBpm));
    state.modalBpm = state.bpm;
    domElements.modalBpmValue.textContent = state.modalBpm;
}

export function setRate(newRate, rateText) {
    state.rate = newRate;
    state.modalRate = newRate;
    state.modalRateText = rateText;
}

export function applyBpmRateChanges() {
    state.bpm = state.modalBpm;
    state.rate = state.modalRate;
    domElements.bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;
}

export function setBaseNote(newNote) {
    state.baseNote = newNote;
    state.modalBaseNote = newNote;
}

export function setBaseOctave(newOctave) {
    state.baseOctave = newOctave;
    state.modalBaseOctave = newOctave;
}

export function setWaveform(newWaveform) {
    state.waveform = newWaveform;
    state.modalWaveform = newWaveform;
}

export function applyBaseNoteChanges() {
    state.baseNote = state.modalBaseNote;
    state.baseOctave = state.modalBaseOctave;
    state.waveform = state.modalWaveform;
    updateBaseNoteDisplay();
    updateAllStepsUI();
}

export function setStepTranspose(stepIndex, transpose) {
    if (stepIndex !== null && state.steps[stepIndex]) {
        state.steps[stepIndex].transpose = transpose;
        updateStepUI(stepIndex, state.steps[stepIndex]);
    }
}

export function setStepEnabled(stepIndex, isEnabled) {
    if (stepIndex !== null && state.steps[stepIndex]) {
        state.steps[stepIndex].enabled = isEnabled;
        updateStepUI(stepIndex, state.steps[stepIndex]);
    }
}

export function resetStep(stepIndex) {
    if (stepIndex !== null) {
        setStepTranspose(stepIndex, 0);
    }
}

export function setSeqMax(newSeqMax) {
    if (state.isPlaying) {
        if (newSeqMax < state.seqMax && state.currentStep < newSeqMax) {
            state.seqMax = newSeqMax;
            state.pendingSeqMax = null;
        } else {
            state.pendingSeqMax = newSeqMax;
        }
    } else {
        state.seqMax = newSeqMax;
    }
    updateDisabledStepsUI();
}

export function swapSteps(indexA, indexB) {
    const temp = state.steps[indexA];
    state.steps[indexA] = state.steps[indexB];
    state.steps[indexB] = temp;
    updateAllStepsUI();
}

export function applyMelody(melody) {
    if (melody) {
        state.steps = JSON.parse(JSON.stringify(melody));
        state.previewSteps = null;
        updateAllStepsUI();
    }
}

export function setPreviewMelody(melody) {
    state.previewSteps = melody;
    updateAllStepsUI(); // Show preview on the main grid
}

export function clearPreviewMelody() {
    state.previewSteps = null;
    updateAllStepsUI(); // Revert to original steps
}
