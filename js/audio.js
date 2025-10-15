import { state, STEPS_COUNT } from './state.js';
import { noteToMidi, midiToFreq } from './utils.js';
import { updatePlayButtons, updateDisabledStepsUI, drawPlayback, domElements } from './ui.js';

// --- Sound Playback ---
function playNote(midiNote, startTime, duration) {
    if (!state.audioContext) return;
    
    const oscillator = state.audioContext.createOscillator();
    const gainNode = state.audioContext.createGain();
    
    oscillator.type = state.waveform;
    oscillator.frequency.setValueAtTime(midiToFreq(midiNote), startTime);

    const attackTime = 0.01;
    const releaseTime = 0.05;
    const sustainLevel = 0.4;

    gainNode.connect(state.masterGainNode);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime);
    gainNode.gain.setValueAtTime(sustainLevel, startTime + duration - releaseTime);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.connect(gainNode);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

export function playAuditionSound(midiNote, duration = 0.4) {
    initAudio();
    if (!state.audioContext) return;
    const now = state.audioContext.currentTime;
    playNote(midiNote, now, duration);
}

// --- Sequencer Engine ---
function nextNote() {
    const secondsPerBeat = 60.0 / state.bpm;
    // How many beats each step lasts
    const noteDurationInBeats = 4.0 / state.rate; 
    // How many quarter notes per step
    const quarterNotesPerStep = noteDurationInBeats / 4.0;
    state.nextNoteTime += quarterNotesPerStep * secondsPerBeat;

    const isLooping = state.playbackMode === 'main';
    let sequenceLength = state.seqMax;

    // Handle seamless sequence length changes
    if (isLooping && state.currentStep === sequenceLength - 1) {
        if (state.pendingSeqMax !== null) {
            state.seqMax = state.pendingSeqMax;
            state.pendingSeqMax = null;
            sequenceLength = state.seqMax;
            requestAnimationFrame(updateDisabledStepsUI);
        }
    }

    state.currentStep = isLooping ? (state.currentStep + 1) % sequenceLength : state.currentStep + 1;
}

function scheduleNote(stepNumber, time) {
    const isPreview = state.playbackMode === 'preview';
    const sequence = isPreview ? state.previewSteps : state.steps;
    if (!sequence || !sequence[stepNumber]) return;

    // In main mode, don't schedule notes beyond the current sequence length
    if (!isPreview && stepNumber >= state.seqMax) return;

    const stepData = sequence[stepNumber];
    state.notesInQueue.push({ note: stepNumber, time: time, isPreview: isPreview, isDisabled: !stepData.enabled });

    if (stepData.enabled) {
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
        const finalMidi = baseMidi + stepData.transpose;
        const noteDuration = (60.0 / state.bpm) / state.rate;
        playNote(finalMidi, time, noteDuration);
    }
}

function scheduler() {
    const isPreview = state.playbackMode === 'preview';
    const sequenceLength = isPreview ? STEPS_COUNT : state.seqMax;

    while (state.nextNoteTime < state.audioContext.currentTime + state.scheduleAheadTime) {
        if (state.playbackMode !== 'main' && state.currentStep >= sequenceLength) {
            stopPlayback(); // Stop if it's a one-shot playback that has ended
            break;
        }
        scheduleNote(state.currentStep, state.nextNoteTime);
        nextNote();
    }
    
    if (state.isPlaying) {
        state.schedulerTimerId = setTimeout(scheduler, state.schedulerLookahead);
    }
}

export function startPlayback(mode = 'main') {
    initAudio();
    if (!state.audioContext || state.isPlaying) return;

    state.playbackMode = mode;
    state.isPlaying = true;
    
    const isPreview = mode === 'preview';
    if (isPreview) {
        domElements.previewMelodyButton.disabled = true;
        domElements.applyMelodyButton.disabled = true;
    } else {
        updatePlayButtons(true);
    }

    state.currentStep = 0;
    state.nextNoteTime = state.audioContext.currentTime + 0.1; // Start scheduling slightly ahead
    scheduler();
    requestAnimationFrame(drawPlayback);
}

export function stopPlayback() {
    if (!state.isPlaying) return;
    
    const wasPreview = state.playbackMode === 'preview';
    state.isPlaying = false;
    state.playbackMode = 'main'; // Reset to main

    clearTimeout(state.schedulerTimerId);
    state.schedulerTimerId = null;
    
    // If a sequence length change was pending, apply it now
    if (state.pendingSeqMax !== null) {
        state.seqMax = state.pendingSeqMax;
        state.pendingSeqMax = null;
        updateDisabledStepsUI();
    }

    // Clear any scheduled notes
    state.notesInQueue = [];
    const activeStepEl = domElements.sequencerGrid.querySelector('.active, .active-preview');
    if (activeStepEl) {
        activeStepEl.classList.remove('active', 'active-preview');
    }
    state.lastStepDrawn = -1;

    // Gentle fade out to prevent clicks
    if (state.audioContext) {
        const now = state.audioContext.currentTime;
        state.masterGainNode.gain.cancelScheduledValues(now);
        state.masterGainNode.gain.setValueAtTime(state.masterGainNode.gain.value, now);
        state.masterGainNode.gain.linearRampToValueAtTime(0.0, now + 0.05);
        // Restore gain for next playback
        state.masterGainNode.gain.linearRampToValueAtTime(1.0, now + 0.1);
    }

    state.currentStep = 0;

    // Update UI state
    if (wasPreview) {
        domElements.previewMelodyButton.disabled = false;
        domElements.applyMelodyButton.disabled = state.previewSteps === null;
    } else {
        updatePlayButtons(false);
    }
}

export function initAudio() {
    if (state.audioContext) return;
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.masterGainNode = state.audioContext.createGain();
        state.masterGainNode.connect(state.audioContext.destination);
        state.masterGainNode.gain.setValueAtTime(1.0, state.audioContext.currentTime);
    } catch (e) {
        alert('Web Audio API is not supported in this browser.');
    }
}