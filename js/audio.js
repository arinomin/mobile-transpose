import {
    state,
    NOTE_NAMES,
    WAVEFORMS, 
    STEPS_COUNT
} from './state.js';

// --- DOM Elements (passed from main.js) ---
let domElements = {};

// --- Note and Frequency Calculation ---
function noteToMidi(note, octave) {
    const noteIndex = NOTE_NAMES.indexOf(note);
    return noteIndex + (octave + 1) * 12;
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return NOTE_NAMES[noteIndex] + octave;
}

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
    const now = state.audioContext.currentTime;
    playNote(midiNote, now, duration);
}

// --- Unified Sequencer Logic ---
function nextNote() {
    const secondsPerBeat = 60.0 / state.bpm;
    const noteDurationInBeats = 4.0 / state.rate;
    state.nextNoteTime += (noteDurationInBeats * secondsPerBeat) / 4;
    
    const loop = state.playbackMode === 'main';
    let sequenceLength = state.seqMax;

    if (loop && state.currentStep === sequenceLength - 1) {
        if (state.pendingSeqMax !== null) {
            state.seqMax = state.pendingSeqMax;
            state.pendingSeqMax = null;
            sequenceLength = state.seqMax;
            // This update needs to be handled in the UI module
            requestAnimationFrame(() => domElements.updateDisabledStepsUI()); 
        }
    }

    if (loop) {
        state.currentStep = (state.currentStep + 1) % sequenceLength;
    } else {
        state.currentStep++;
    }
}

function scheduleNote(stepNumber, time) {
    const isPreview = state.playbackMode === 'preview';
    const sequence = isPreview ? state.previewSteps : state.steps;
    if (!sequence) return;

    if (stepNumber >= state.seqMax && state.playbackMode === 'main') return;

    const stepData = sequence[stepNumber];
    if (!stepData.enabled) {
        state.notesInQueue.push({ note: stepNumber, time: time, isPreview: isPreview, isDisabled: true });
        return; // Do not play disabled steps
    }

    state.notesInQueue.push({ note: stepNumber, time: time, isPreview: isPreview });

    const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
    const finalMidi = baseMidi + stepData.transpose;
    const noteDuration = (60.0 / state.bpm) / state.rate;

    playNote(finalMidi, time, noteDuration);
}

function scheduler() {
    const loop = state.playbackMode === 'main';
    const currentSequenceLength = state.seqMax;

    while (state.nextNoteTime < state.audioContext.currentTime + state.scheduleAheadTime) {
        if (!loop && state.currentStep >= currentSequenceLength) {
            stopPlayback();
            break;
        }
        scheduleNote(state.currentStep, state.nextNoteTime);
        nextNote();
    }
    
    if (state.isPlaying) {
        state.schedulerTimerId = setTimeout(scheduler, state.schedulerLookahead);
    }
}

function draw() {
    let drawStepInfo = null;
    const currentTime = state.audioContext.currentTime;

    while (state.notesInQueue.length && state.notesInQueue[0].time < currentTime) {
        drawStepInfo = state.notesInQueue.shift();
    }

    if (drawStepInfo) {
        const lastStepEl = domElements.sequencerGrid.querySelector('.active, .active-preview');
        if (lastStepEl) {
            lastStepEl.classList.remove('active', 'active-preview');
        }

        if (drawStepInfo.note < state.seqMax || drawStepInfo.isPreview) {
            const newStepEl = domElements.sequencerGrid.children[drawStepInfo.note];
            if (newStepEl && !drawStepInfo.isDisabled) { // Only highlight if not disabled
                newStepEl.classList.add(drawStepInfo.isPreview ? 'active-preview' : 'active');
            }
        }
        state.lastStepDrawn = drawStepInfo.note;
    }
    
    if (state.isPlaying) {
        requestAnimationFrame(draw);
    }
}

export function startPlayback(mode = 'main', sequence = null) {
    initAudio();
    if (state.isPlaying) stopPlayback();

    state.playbackMode = mode;
    state.isPlaying = true;
    
    if (mode === 'preview') {
        state.previewSteps = sequence;
        domElements.previewMelodyButton.disabled = true;
        domElements.applyMelodyButton.disabled = true;
    } else {
        domElements.updatePlayButtons(true);
    }

    state.currentStep = 0;
    state.nextNoteTime = state.audioContext.currentTime + 0.1;
    scheduler();
    requestAnimationFrame(draw);
}

export function stopPlayback() {
    if (!state.isPlaying) return;
    
    const wasPreview = state.playbackMode === 'preview';
    state.isPlaying = false;

    clearTimeout(state.schedulerTimerId);
    state.schedulerTimerId = null;
    
    if (state.pendingSeqMax !== null) {
        state.seqMax = state.pendingSeqMax;
        state.pendingSeqMax = null;
        domElements.updateDisabledStepsUI();
    }

    state.notesInQueue = [];
    const activeStepEl = domElements.sequencerGrid.querySelector('.active, .active-preview');
    if (activeStepEl) {
        activeStepEl.classList.remove('active', 'active-preview');
    }
    state.lastStepDrawn = -1;

    if (state.audioContext) {
        state.masterGainNode.gain.cancelScheduledValues(state.audioContext.currentTime);
        state.masterGainNode.gain.setValueAtTime(state.masterGainNode.gain.value, state.audioContext.currentTime);
        state.masterGainNode.gain.linearRampToValueAtTime(0.0, state.audioContext.currentTime + 0.05);
        state.masterGainNode.gain.linearRampToValueAtTime(1.0, state.audioContext.currentTime + 0.1);
    }

    state.currentStep = 0;

    if (wasPreview) {
        domElements.previewMelodyButton.disabled = false;
        domElements.applyMelodyButton.disabled = state.previewSteps === null;
    } else {
        domElements.updatePlayButtons(false);
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

export function initAudioModule(elements) {
    domElements = elements;
}
