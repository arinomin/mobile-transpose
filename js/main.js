import { 
    state,
    STEPS_COUNT,
    NOTE_NAMES,
    OCTAVES,
    WAVEFORMS,
    MAJOR_TICKS,
    INTERVAL_NAMES,
    BPM_MIN,
    BPM_MAX,
    SCALES,
    SHARE_FORMAT_VERSION,
    RATES,
    WAVE_SERIALIZE_MAP,
    WAVE_DESERIALIZE_MAP
} from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const seqMaxButtonsContainer = document.getElementById('seq-max-buttons');
    const sequencerGrid = document.getElementById('sequencer-grid');
    const stepModal = document.getElementById('step-modal');
    const closeModalBtn = document.getElementById('close-modal-button');
    const doneStepButton = document.getElementById('done-step-button');
    const modalStepNumber = document.getElementById('modal-step-number');
    const transposeValueDisplay = document.getElementById('transpose-value-display');
    const intervalNameDisplay = document.getElementById('interval-name-display');
    const finalNoteDisplay = document.getElementById('final-note-display');
    const transposeSelector = document.getElementById('transpose-selector');
    const auditionBtn = document.getElementById('audition-button');
    const resetBtn = document.getElementById('reset-button');
    const selectorTicks = document.querySelector('.selector-ticks');

    // Action Buttons
    const playStopBtn = document.getElementById('play-stop-button');
    const melodyGenBtn = document.getElementById('melody-gen-button');
    const shareBtn = document.getElementById('share-button');

    // Modal Elements
    const bpmRateModal = document.getElementById('bpm-rate-modal');
    const bpmRateDisplayButton = document.getElementById('bpm-rate-display-button');
    const closeBpmRateModalButton = document.getElementById('close-bpm-rate-modal-button');
    const doneBpmRateButton = document.getElementById('done-bpm-rate-button');
    const modalBpmValue = document.getElementById('modal-bpm-value');
    const bpmDown10 = document.getElementById('bpm-down-10');
    const bpmDown1 = document.getElementById('bpm-down-1');
    const bpmUp1 = document.getElementById('bpm-up-1');
    const bpmUp10 = document.getElementById('bpm-up-10');
    const modalRateButtons = document.getElementById('modal-rate-buttons');

    const baseNoteModal = document.getElementById('base-note-modal');
    const baseNoteDisplayButton = document.getElementById('base-note-display-button');
    const closeBaseNoteModalButton = document.getElementById('close-base-note-modal-button');
    const doneBaseNoteButton = document.getElementById('done-base-note-button');
    const modalNoteNameButtons = document.getElementById('modal-note-name-buttons');
    const modalOctaveButtons = document.getElementById('modal-octave-buttons');
    const modalWaveformButtons = document.getElementById('modal-waveform-buttons');

    const melodyGenModal = document.getElementById('melody-gen-modal');
    const closeMelodyGenModalButton = document.getElementById('close-melody-gen-modal-button');
    const melodyKeySelect = document.getElementById('melody-key-select');
    const melodyScaleSelect = document.getElementById('melody-scale-select');
    const previewMelodyButton = document.getElementById('preview-melody-button');
    const applyMelodyButton = document.getElementById('apply-melody-button');
    const melodyAlgorithmSelect = document.getElementById('melody-algorithm-select');
    const melodyRestProbability = document.getElementById('melody-rest-probability');
    const melodyRestProbabilityValue = document.getElementById('melody-rest-probability-value');

    const shareModal = document.getElementById('share-modal');
    const closeShareModalButton = document.getElementById('close-share-modal-button');
    const shareUrlInput = document.getElementById('share-url-input');
    const copyUrlButton = document.getElementById('copy-url-button');
    const shareXButton = document.getElementById('share-x-button');


    // --- Web Audio API Initialization ---
    function initAudio() {
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

    // --- Note and Frequency Calculation ---
    function noteToMidi(note, octave) {
        const noteIndex = NOTE_NAMES.indexOf(note);
        return noteIndex + (octave + 1) * 12;
    }

    function midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function getNoteName(midi) {
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

    function playAuditionSound(midiNote, duration = 0.4) {
        initAudio();
        const now = state.audioContext.currentTime;
        playNote(midiNote, now, duration);
    }
    
    // --- Unified Sequencer Logic ---
    function updatePlayButtons(playing) {
        if (playStopBtn) playStopBtn.classList.toggle('playing', playing);
    }

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
                requestAnimationFrame(updateDisabledStepsUI);
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
            const lastStepEl = sequencerGrid.querySelector('.active, .active-preview');
            if (lastStepEl) {
                lastStepEl.classList.remove('active', 'active-preview');
            }

            if (drawStepInfo.note < state.seqMax || drawStepInfo.isPreview) {
                const newStepEl = sequencerGrid.children[drawStepInfo.note];
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

    function startPlayback(mode = 'main', sequence = null) {
        initAudio();
        if (state.isPlaying) stopPlayback();

        state.playbackMode = mode;
        state.isPlaying = true;
        
        if (mode === 'preview') {
            state.previewSteps = sequence;
            previewMelodyButton.disabled = true;
            applyMelodyButton.disabled = true;
        } else {
            updatePlayButtons(true);
        }

        state.currentStep = 0;
        state.nextNoteTime = state.audioContext.currentTime + 0.1;
        scheduler();
        requestAnimationFrame(draw);
    }

    function stopPlayback() {
        if (!state.isPlaying) return;
        
        const wasPreview = state.playbackMode === 'preview';
        state.isPlaying = false;

        clearTimeout(state.schedulerTimerId);
        state.schedulerTimerId = null;
        
        if (state.pendingSeqMax !== null) {
            state.seqMax = state.pendingSeqMax;
            state.pendingSeqMax = null;
            updateDisabledStepsUI();
        }

        state.notesInQueue = [];
        const activeStepEl = sequencerGrid.querySelector('.active, .active-preview');
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
            previewMelodyButton.disabled = false;
            applyMelodyButton.disabled = state.previewSteps === null;
        } else {
            updatePlayButtons(false);
        }
    }

    // --- UI Update ---
    function formatTranspose(transpose) {
        return transpose >= 0 ? `+${transpose}` : transpose;
    }

    function updateStepUI(index, stepData) {
        const stepElement = sequencerGrid.children[index];
        stepElement.querySelector('.step-transpose').textContent = formatTranspose(stepData.transpose);
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
        const finalMidi = baseMidi + stepData.transpose;
        stepElement.querySelector('.step-note').textContent = getNoteName(finalMidi);
        stepElement.classList.toggle('step-disabled', !stepData.enabled);
    }

    function updateAllStepsUI() {
        const sequence = state.playbackMode === 'preview' && state.previewSteps ? state.previewSteps : state.steps;
        for (let i = 0; i < STEPS_COUNT; i++) {
            // Ensure sequence has a valid step object
            const stepData = sequence[i] || { transpose: 0, enabled: true };
            updateStepUI(i, stepData);
        }
        updateDisabledStepsUI();
    }

    function updateDisabledStepsUI() {
        const steps = sequencerGrid.children;
        const limit = state.pendingSeqMax !== null ? state.pendingSeqMax : state.seqMax;
        for (let i = 0; i < steps.length; i++) {
            steps[i].classList.toggle('disabled', i >= limit);
        }
    }

    function updateBaseNoteDisplay() {
        const waveText = WAVEFORMS[state.waveform] || 'ERR';
        baseNoteDisplayButton.textContent = `${state.baseNote}${state.baseOctave} / ${waveText.toUpperCase()}`;
    }

    // --- Step Modal Logic ---
    function openStepModal(stepIndex) {
        const limit = state.pendingSeqMax !== null ? state.pendingSeqMax : state.seqMax;
        if (stepIndex >= limit) return;

        if (state.isPlaying) stopPlayback();
        state.editedStepIndex = stepIndex;
        modalStepNumber.textContent = `#${stepIndex + 1}`;
        const stepData = state.steps[stepIndex];
        updateStepModalInfo(stepData.transpose);

        const toggle = document.getElementById('step-enable-toggle');
        if (toggle) {
            toggle.checked = stepData.enabled;
            // This event handler is reassigned each time the modal opens.
            toggle.onchange = (e) => {
                if (state.editedStepIndex !== null) {
                    state.steps[state.editedStepIndex].enabled = e.target.checked;
                    updateStepUI(state.editedStepIndex, state.steps[state.editedStepIndex]);
                }
            };
        }


        stepModal.style.display = 'flex';

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    function closeStepModal() {
        stepModal.style.display = 'none';
        // The state is already updated by the toggle's onchange event,
        // so we just need to hide the modal and clean up listeners.
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', endDrag);
    }

    function updateStepModalInfo(transpose, save = false) {
        transposeValueDisplay.textContent = formatTranspose(transpose);
        intervalNameDisplay.textContent = INTERVAL_NAMES[transpose] || '';
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
        const finalMidi = baseMidi + transpose;
        finalNoteDisplay.textContent = getNoteName(finalMidi);
        const handle = transposeSelector.querySelector('.selector-handle');
        const percentage = (transpose + 12) / 24;
        handle.style.left = `${percentage * 100}%`;

        if (save) {
            state.steps[state.editedStepIndex].transpose = transpose;
            updateStepUI(state.editedStepIndex, state.steps[state.editedStepIndex]);
        }
    }

    function handleSelectorInteraction(event) {
        const selectorRect = transposeSelector.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const offsetX = clientX - selectorRect.left;
        const percentage = Math.max(0, Math.min(1, offsetX / selectorRect.width));
        let transpose = Math.round(percentage * 24) - 12;
        updateStepModalInfo(transpose, true);
    }

    // --- BPM/Rate Modal Logic ---
    function openBpmRateModal() {
        if (state.isPlaying) stopPlayback();
        state.modalBpm = state.bpm;
        state.modalRate = state.rate;
        modalBpmValue.textContent = state.modalBpm;
        modalRateButtons.querySelectorAll('button').forEach(btn => {
            const btnRate = parseFloat(btn.dataset.rate);
            if (btnRate === state.modalRate) {
                btn.classList.add('selected');
                state.modalRateText = btn.textContent;
            } else {
                btn.classList.remove('selected');
            }
        });
        bpmRateModal.style.display = 'flex';
    }

    function closeBpmRateModal() {
        bpmRateModal.style.display = 'none';
    }

    function applyBpmRateChanges() {
        state.bpm = state.modalBpm;
        state.rate = state.modalRate;
        bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;
        closeBpmRateModal();
    }

    function adjustBpm(amount) {
        state.modalBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, state.modalBpm + amount));
        modalBpmValue.textContent = state.modalBpm;
    }

    // --- Base Note Modal Logic ---
    function openBaseNoteModal() {
        if (state.isPlaying) stopPlayback();
        state.modalBaseNote = state.baseNote;
        state.modalBaseOctave = state.baseOctave;
        state.modalWaveform = state.waveform;
        
        modalNoteNameButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.note === state.modalBaseNote);
        });
        modalOctaveButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.octave) === state.modalBaseOctave);
        });
        modalWaveformButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.wave === state.modalWaveform);
        });

        baseNoteModal.style.display = 'flex';
    }

    function closeBaseNoteModal() {
        baseNoteModal.style.display = 'none';
    }

    function applyBaseNoteChanges() {
        state.baseNote = state.modalBaseNote;
        state.baseOctave = state.modalBaseOctave;
        state.waveform = state.modalWaveform;
        updateBaseNoteDisplay();
        updateAllStepsUI();
        closeBaseNoteModal();
    }

    // --- Melody Gen Modal Logic ---
    function openMelodyGenModal() {
        if (state.isPlaying) stopPlayback();
        state.previewSteps = null;
        applyMelodyButton.disabled = true;
        melodyGenModal.style.display = 'flex';
    }

    function closeMelodyGenModal() {
        if (state.isPlaying) stopPlayback();
        state.previewSteps = null;
        updateAllStepsUI();
        melodyGenModal.style.display = 'none';
    }

    function generateAndPreviewMelody() {
        const key = melodyKeySelect.value;
        const scaleName = melodyScaleSelect.value;
        const scaleIntervals = SCALES[scaleName];

        const rootNoteIndex = NOTE_NAMES.indexOf(key);
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);

        const transposePool = [];
        // Generate a wider pool of notes for more variation in leaps
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
            // Rests
            const isRest = Math.random() < state.melodyGenRestProbability;
            if (isRest) {
                newMelody.push({ transpose: uniqueTransposes[currentIndex], enabled: false });
                // Don't move index on a rest to avoid large silent gaps
            } else {
                newMelody.push({ transpose: uniqueTransposes[currentIndex], enabled: true });

                // Move current index for next note
                if (state.melodyGenAlgorithm === 'simple-walk') {
                    const randomChoice = Math.random();
                    if (randomChoice < 0.2) { // Stay
                    } else if (randomChoice < 0.6) { // Step up
                        currentIndex = Math.min(uniqueTransposes.length - 1, currentIndex + 1);
                    } else { // Step down
                        currentIndex = Math.max(0, currentIndex - 1);
                    }
                } else { // leaps-and-rests
                    const randomChoice = Math.random();
                    let nextIndex;
                    if (randomChoice < 0.5) { // Small step
                        const direction = Math.random() < 0.5 ? -1 : 1;
                        nextIndex = currentIndex + direction;
                    } else { // Leap
                        const leapSize = Math.floor(Math.random() * 4) + 2; // Leap of 2 to 5
                        const direction = Math.random() < 0.5 ? -1 : 1;
                        nextIndex = currentIndex + (leapSize * direction);
                    }
                    // Clamp index to be within the pool
                    currentIndex = Math.max(0, Math.min(uniqueTransposes.length - 1, nextIndex));
                }
            }
        }

        state.previewSteps = newMelody;
        applyMelodyButton.disabled = false;
        
        for (let i = 0; i < STEPS_COUNT; i++) {
            updateStepUI(i, state.previewSteps[i]);
        }

        startPlayback('preview', newMelody);
    }

    function applyMelody() {
        if (state.previewSteps) {
            state.steps = JSON.parse(JSON.stringify(state.previewSteps));
            updateAllStepsUI();
            closeMelodyGenModal();
        }
    }

    // --- Share Modal Logic ---
    function openShareModal() {
        const dataString = serializeState();
        const url = new URL(window.location.href);
        url.hash = encodeURIComponent(dataString);
        shareUrlInput.value = url.toString();
        shareModal.style.display = 'flex';
    }

    function closeShareModal() {
        shareModal.style.display = 'none';
    }

    // --- Event Listeners ---
    function handlePlayStop() {
        if (state.isPlaying) {
            stopPlayback();
        } else {
            startPlayback('main');
        }
    }

    playStopBtn.addEventListener('click', handlePlayStop);
    melodyGenBtn.addEventListener('click', openMelodyGenModal);
    shareBtn.addEventListener('click', openShareModal);

    stepModal.addEventListener('click', (e) => { if (e.target === stepModal) closeStepModal(); });
    closeModalBtn.addEventListener('click', closeStepModal);
    doneStepButton.addEventListener('click', closeStepModal);
    resetBtn.addEventListener('click', () => updateStepModalInfo(0, true));
    auditionBtn.addEventListener('click', () => {
        initAudio();
        const percentage = parseFloat(transposeSelector.querySelector('.selector-handle').style.left) / 100;
        const transpose = Math.round(percentage * 24) - 12;
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
        const finalMidi = baseMidi + transpose;
        playAuditionSound(finalMidi);
    });

    bpmRateDisplayButton.addEventListener('click', openBpmRateModal);
    closeBpmRateModalButton.addEventListener('click', closeBpmRateModal);
    doneBpmRateButton.addEventListener('click', applyBpmRateChanges);
    bpmRateModal.addEventListener('click', (e) => { if (e.target === bpmRateModal) closeBpmRateModal(); });

    bpmDown10.addEventListener('click', () => adjustBpm(-10));
    bpmDown1.addEventListener('click', () => adjustBpm(-1));
    bpmUp1.addEventListener('click', () => adjustBpm(1));
    bpmUp10.addEventListener('click', () => adjustBpm(10));

    modalRateButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalRate = parseFloat(e.target.dataset.rate);
            state.modalRateText = e.target.textContent;
            modalRateButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    baseNoteDisplayButton.addEventListener('click', openBaseNoteModal);
    closeBaseNoteModalButton.addEventListener('click', closeBaseNoteModal);
    doneBaseNoteButton.addEventListener('click', applyBaseNoteChanges);
    baseNoteModal.addEventListener('click', (e) => { if (e.target === baseNoteModal) closeBaseNoteModal(); });

    modalNoteNameButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalBaseNote = e.target.dataset.note;
            modalNoteNameButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    modalOctaveButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalBaseOctave = parseInt(e.target.dataset.octave, 10);
            modalOctaveButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    modalWaveformButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.modalWaveform = e.target.dataset.wave;
            modalWaveformButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    closeMelodyGenModalButton.addEventListener('click', closeMelodyGenModal);
    melodyGenModal.addEventListener('click', (e) => { if (e.target === melodyGenModal) closeMelodyGenModal(); });
    previewMelodyButton.addEventListener('click', generateAndPreviewMelody);
    applyMelodyButton.addEventListener('click', applyMelody);

    melodyAlgorithmSelect.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.melodyGenAlgorithm = e.target.dataset.value;
            melodyAlgorithmSelect.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    melodyRestProbability.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        state.melodyGenRestProbability = value;
        melodyRestProbabilityValue.textContent = `${Math.round(value * 100)}%`;
    });

    shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeShareModal(); });
    closeShareModalButton.addEventListener('click', closeShareModal);

    copyUrlButton.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrlInput.value).then(() => {
            copyUrlButton.textContent = 'コピーしました！';
            setTimeout(() => { copyUrlButton.textContent = 'URLをコピー'; }, 2000);
        }, () => {
            alert('クリップボードへのコピーに失敗しました。');
        });
    });

    shareXButton.addEventListener('click', () => {
        const url = shareUrlInput.value;
        const text = 'このシーケンスをチェック！ #mobiletranspose';
        const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(xUrl, '_blank');
    });

    let isDragging = false;
    const startDrag = (e) => { isDragging = true; handleSelectorInteraction(e); };
    const onDrag = (e) => { if (isDragging) { e.preventDefault(); handleSelectorInteraction(e); } };
    const endDrag = () => { isDragging = false; };
    transposeSelector.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    transposeSelector.addEventListener('touchstart', startDrag, { passive: true });
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);

    // --- Initialization ---
    function createSequencerGrid() {
        sequencerGrid.innerHTML = '';
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

            // Open the modal on click to edit the step.
            stepElement.addEventListener('click', () => {
                openStepModal(i);
            });

            sequencerGrid.appendChild(stepElement);
        }
    }

    let dragSrcIndex = null;

    function handleDragStart(e) {
        if (e.target.classList.contains('step')) {
            dragSrcIndex = parseInt(e.target.dataset.index, 10);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.target.innerHTML);
            e.target.classList.add('dragging');
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        const target = e.target.closest('.step');
        if (target) {
            target.classList.add('drag-over');
        }
        return false;
    }

    function handleDragLeave(e) {
        const target = e.target.closest('.step');
        if (target) {
            target.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.stopPropagation();
        const dropTarget = e.target.closest('.step');
        if (dropTarget) {
            dropTarget.classList.remove('drag-over');
            const dropIndex = parseInt(dropTarget.dataset.index, 10);

            if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                const temp = state.steps[dragSrcIndex];
                state.steps[dragSrcIndex] = state.steps[dropIndex];
                state.steps[dropIndex] = temp;

                updateAllStepsUI();
            }
        }
        return false;
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        const allSteps = sequencerGrid.querySelectorAll('.step');
        allSteps.forEach(step => step.classList.remove('drag-over'));
        dragSrcIndex = null;
    }


    function createSelectorTicks() {
        selectorTicks.innerHTML = '';
        for (let i = -12; i <= 12; i++) {
            const tick = document.createElement('div');
            tick.classList.add('tick');
            if (MAJOR_TICKS.includes(i)) tick.classList.add('tick-major');
            tick.style.left = `${((i + 12) / 24) * 100}%`;
            selectorTicks.appendChild(tick);
        }
    }

    function createSeqMaxButtons() {
        seqMaxButtonsContainer.innerHTML = '';
        for (let i = 1; i <= STEPS_COUNT; i++) {
            const button = document.createElement('button');
            button.classList.add('seq-max-button');
            button.textContent = i;
            button.dataset.value = i;
            if (i === state.seqMax) button.classList.add('active');
            button.addEventListener('click', () => {
                const newSeqMax = i;
                const oldSeqMax = state.seqMax;

                const currentActive = seqMaxButtonsContainer.querySelector('.active');
                if (currentActive) currentActive.classList.remove('active');
                button.classList.add('active');

                if (state.isPlaying) {
                    if (newSeqMax < oldSeqMax && state.currentStep < newSeqMax) {
                        state.seqMax = newSeqMax;
                        state.pendingSeqMax = null;
                    } else {
                        state.pendingSeqMax = newSeqMax;
                    }
                } else {
                    state.seqMax = newSeqMax;
                }
                updateDisabledStepsUI();
            });
            seqMaxButtonsContainer.appendChild(button);
        }
    }

    function createModalNoteButtons() {
        modalNoteNameButtons.innerHTML = '';
        NOTE_NAMES.forEach(note => {
            const button = document.createElement('button');
            button.textContent = note;
            button.dataset.note = note;
            modalNoteNameButtons.appendChild(button);
        });
    }

    function createModalOctaveButtons() {
        modalOctaveButtons.innerHTML = '';
        OCTAVES.forEach(octave => {
            const button = document.createElement('button');
            button.textContent = octave;
            button.dataset.octave = octave;
            modalOctaveButtons.appendChild(button);
        });
    }

    function createModalWaveformButtons() {
        modalWaveformButtons.innerHTML = '';
        for (const [waveValue, waveText] of Object.entries(WAVEFORMS)) {
            const button = document.createElement('button');
            button.textContent = waveText;
            button.dataset.wave = waveValue;
            modalWaveformButtons.appendChild(button);
        }
    }

    // Initial UI setup
    updateBaseNoteDisplay();
    bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;
    createSequencerGrid();
    createSelectorTicks();
    createSeqMaxButtons();
    createModalNoteButtons();
    createModalOctaveButtons();
    createModalWaveformButtons();
    updateAllStepsUI();
    updatePlayButtons(false);

    sequencerGrid.addEventListener('dragstart', handleDragStart, false);
    sequencerGrid.addEventListener('dragover', handleDragOver, false);
    sequencerGrid.addEventListener('dragleave', handleDragLeave, false);
    sequencerGrid.addEventListener('drop', handleDrop, false);
    sequencerGrid.addEventListener('dragend', handleDragEnd, false);

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
            if (version !== 'v5') {
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
            const rateButton = modalRateButtons.querySelector(`button[data-rate="${state.rate}"]`);
            state.modalRateText = rateButton ? rateButton.textContent : '?';
            bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;

            state.modalBaseNote = state.baseNote;
            state.modalBaseOctave = state.baseOctave;
            state.modalWaveform = state.waveform;
            updateBaseNoteDisplay();

            const currentActive = seqMaxButtonsContainer.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            const newActive = seqMaxButtonsContainer.querySelector(`button[data-value="${state.seqMax}"]`);
            if (newActive) newActive.classList.add('active');
            
            updateAllStepsUI(); // This will now also handle the enabled state visually

            alert('URLからシーケンスを復元しました。');

        } catch (e) {
            console.error('URLからの状態復元に失敗しました:', e);
            alert('URLデータの読み込みに失敗しました。');
        }
    }

    setTimeout(loadStateFromHash, 100);

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