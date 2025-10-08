document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const seqMaxButtonsContainer = document.getElementById('seq-max-buttons');
    const sequencerGrid = document.getElementById('sequencer-grid');
    const stepModal = document.getElementById('step-modal');
    const closeModalBtn = document.getElementById('close-modal-button');
    const modalStepNumber = document.getElementById('modal-step-number');
    const transposeValueDisplay = document.getElementById('transpose-value-display');
    const intervalNameDisplay = document.getElementById('interval-name-display');
    const finalNoteDisplay = document.getElementById('final-note-display');
    const transposeSelector = document.getElementById('transpose-selector');
    const auditionBtn = document.getElementById('audition-button');
    const resetBtn = document.getElementById('reset-button');
    const selectorTicks = document.querySelector('.selector-ticks');

    // Action Buttons (Desktop & Mobile)
    const playStopBtnDesktop = document.getElementById('play-stop-button-desktop');
    const playStopBtnMobile = document.getElementById('play-stop-button-mobile');
    const melodyGenBtnDesktop = document.getElementById('melody-gen-button-desktop');
    const melodyGenBtnMobile = document.getElementById('melody-gen-button-mobile');
    const shareBtnDesktop = document.getElementById('share-button-desktop');
    const shareBtnMobile = document.getElementById('share-button-mobile');
    const allPlayStopButtons = [playStopBtnDesktop, playStopBtnMobile];

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

    const melodyGenModal = document.getElementById('melody-gen-modal');
    const closeMelodyGenModalButton = document.getElementById('close-melody-gen-modal-button');
    const melodyKeySelect = document.getElementById('melody-key-select');
    const melodyScaleSelect = document.getElementById('melody-scale-select');
    const previewMelodyButton = document.getElementById('preview-melody-button');
    const applyMelodyButton = document.getElementById('apply-melody-button');


    // --- Constants ---
    const STEPS_COUNT = 16;
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const OCTAVES = [1, 2, 3, 4, 5, 6, 7];
    const MAJOR_TICKS = [-12, -7, 0, 7, 12];
    const INTERVAL_NAMES = {
        '-12': 'Octave Down', '-7': 'Perfect 5th Down', '0': 'Unison', '7': 'Perfect 5th Up', '12': 'Octave Up',
    };
    const BPM_MIN = 40;
    const BPM_MAX = 280;
    const SCALES = {
        'major': [0, 2, 4, 5, 7, 9, 11],
        'minor': [0, 2, 3, 5, 7, 8, 10],
        'majorPentatonic': [0, 2, 4, 7, 9],
        'minorPentatonic': [0, 3, 5, 7, 10]
    };

    // --- State ---
    const state = {
        audioContext: null,
        masterGainNode: null,
        bpm: 120,
        rate: 4,
        baseNote: 'C',
        baseOctave: 4,
        seqMax: STEPS_COUNT,
        steps: Array(STEPS_COUNT).fill(0).map(() => ({ transpose: 0 })),
        currentStep: 0,
        isPlaying: false, // Covers both main and preview playback
        playbackMode: 'main', // 'main' or 'preview'
        editedStepIndex: null,
        
        // Scheduler State
        nextNoteTime: 0.0,
        scheduleAheadTime: 0.1, // How far ahead to schedule audio (sec)
        schedulerLookahead: 25.0, // How often to call scheduler function (ms)
        schedulerTimerId: null,
        lastStepDrawn: -1,
        notesInQueue: [],

        // Temporary modal states
        modalBpm: 120,
        modalRate: 4,
        modalRateText: '16分',
        modalBaseNote: 'C',
        modalBaseOctave: 4,

        // Melody Generation State
        previewSteps: null,
    };


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
        
        oscillator.type = 'sine';
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
        allPlayStopButtons.forEach(btn => {
            if (btn) btn.classList.toggle('playing', playing);
        });
    }

    function nextNote() {
        const secondsPerBeat = 60.0 / state.bpm;
        const noteDurationInBeats = 4.0 / state.rate;
        state.nextNoteTime += (noteDurationInBeats * secondsPerBeat) / 4;
        
        const loop = state.playbackMode === 'main';
        const sequenceLength = state.seqMax;

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

        state.notesInQueue.push({ note: stepNumber, time: time, isPreview: isPreview });

        const stepData = sequence[stepNumber];
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
        const finalMidi = baseMidi + stepData.transpose;
        const noteDuration = (60.0 / state.bpm) / state.rate;

        playNote(finalMidi, time, noteDuration);
    }

    function scheduler() {
        const sequenceLength = state.seqMax;
        const loop = state.playbackMode === 'main';

        while (state.nextNoteTime < state.audioContext.currentTime + state.scheduleAheadTime) {
            if (!loop && state.currentStep >= sequenceLength) {
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

            const newStepEl = sequencerGrid.children[drawStepInfo.note];
            if (newStepEl) {
                newStepEl.classList.add(drawStepInfo.isPreview ? 'active-preview' : 'active');
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
        
        state.notesInQueue = [];
        const activeStepEl = sequencerGrid.querySelector('.active, .active-preview');
        if (activeStepEl) {
            activeStepEl.classList.remove('active', 'active-preview');
        }
        state.lastStepDrawn = -1;

        state.masterGainNode.gain.cancelScheduledValues(state.audioContext.currentTime);
        state.masterGainNode.gain.setValueAtTime(state.masterGainNode.gain.value, state.audioContext.currentTime);
        state.masterGainNode.gain.linearRampToValueAtTime(0.0, state.audioContext.currentTime + 0.05);
        state.masterGainNode.gain.linearRampToValueAtTime(1.0, state.audioContext.currentTime + 0.1);

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
    }

    function updateAllStepsUI() {
        const sequence = state.playbackMode === 'preview' && state.previewSteps ? state.previewSteps : state.steps;
        for (let i = 0; i < STEPS_COUNT; i++) {
            updateStepUI(i, sequence[i]);
        }
    }

    // --- Step Modal Logic ---
    function openStepModal(stepIndex) {
        if (state.isPlaying) stopPlayback();
        state.editedStepIndex = stepIndex;
        modalStepNumber.textContent = `#${stepIndex + 1}`;
        const transpose = state.steps[stepIndex].transpose;
        updateStepModalInfo(transpose);
        stepModal.style.display = 'flex';

        // Add drag listeners only when modal is open
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    function closeStepModal() {
        stepModal.style.display = 'none';

        // Clean up drag listeners
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
        updateStepModalInfo(transpose, true); // Auto-save
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
        
        modalNoteNameButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.note === state.modalBaseNote);
        });
        modalOctaveButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.octave) === state.modalBaseOctave);
        });

        baseNoteModal.style.display = 'flex';
    }

    function closeBaseNoteModal() {
        baseNoteModal.style.display = 'none';
    }

    function applyBaseNoteChanges() {
        state.baseNote = state.modalBaseNote;
        state.baseOctave = state.modalBaseOctave;
        baseNoteDisplayButton.textContent = `${state.baseNote}${state.baseOctave}`;
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
        updateAllStepsUI(); // Restore main sequence view
        melodyGenModal.style.display = 'none';
    }

    function generateAndPreviewMelody() {
        const key = melodyKeySelect.value;
        const scaleName = melodyScaleSelect.value;
        const scaleIntervals = SCALES[scaleName];

        const rootNoteIndex = NOTE_NAMES.indexOf(key);
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);

        const transposePool = [];
        for (let octave = -1; octave <= 1; octave++) {
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
            newMelody.push({ transpose: uniqueTransposes[currentIndex] });
            const randomChoice = Math.random();
            if (randomChoice < 0.2) {
                // Stay
            } else if (randomChoice < 0.6) {
                currentIndex = Math.min(uniqueTransposes.length - 1, currentIndex + 1);
            } else {
                currentIndex = Math.max(0, currentIndex - 1);
            }
        }

        state.previewSteps = newMelody;
        applyMelodyButton.disabled = false;
        
        // Update UI to show preview melody
        for (let i = 0; i < STEPS_COUNT; i++) {
            updateStepUI(i, state.previewSteps[i]);
        }

        startPlayback('preview', newMelody);
    }

    function applyMelody() {
        if (state.previewSteps) {
            state.steps = JSON.parse(JSON.stringify(state.previewSteps)); // Deep copy
            updateAllStepsUI();
            closeMelodyGenModal();
        }
    }

    // --- Event Listeners ---
    function handlePlayStop() {
        if (state.isPlaying) {
            stopPlayback();
        } else {
            startPlayback('main');
        }
    }

    allPlayStopButtons.forEach(btn => btn.addEventListener('click', handlePlayStop));

    melodyGenBtnDesktop.addEventListener('click', openMelodyGenModal);
    melodyGenBtnMobile.addEventListener('click', openMelodyGenModal);

    // Step Modal
    stepModal.addEventListener('click', (e) => { if (e.target === stepModal) closeStepModal(); });
    closeModalBtn.addEventListener('click', closeStepModal);
    resetBtn.addEventListener('click', () => updateStepModalInfo(0, true));
    auditionBtn.addEventListener('click', () => {
        initAudio();
        const percentage = parseFloat(transposeSelector.querySelector('.selector-handle').style.left) / 100;
        const transpose = Math.round(percentage * 24) - 12;
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
        const finalMidi = baseMidi + transpose;
        playAuditionSound(finalMidi);
    });

    // BPM/Rate Modal
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

    // Base Note Modal
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

    // Melody Gen Modal
    closeMelodyGenModalButton.addEventListener('click', closeMelodyGenModal);
    melodyGenModal.addEventListener('click', (e) => { if (e.target === melodyGenModal) closeMelodyGenModal(); });
    previewMelodyButton.addEventListener('click', generateAndPreviewMelody);
    applyMelodyButton.addEventListener('click', applyMelody);


    // Transpose Selector Drag Logic
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
            stepElement.addEventListener('click', () => openStepModal(i));
            sequencerGrid.appendChild(stepElement);
        }
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
                if (state.isPlaying) stopPlayback();
                state.seqMax = i;
                const currentActive = seqMaxButtonsContainer.querySelector('.active');
                if (currentActive) currentActive.classList.remove('active');
                button.classList.add('active');
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

    // Initial UI setup
    baseNoteDisplayButton.textContent = `${state.baseNote}${state.baseOctave}`;
    bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;
    createSequencerGrid();
    createSelectorTicks();
    createSeqMaxButtons();
    createModalNoteButtons();
    createModalOctaveButtons();
    updateAllStepsUI();
    updatePlayButtons(false); // Set initial state

    // --- Share & Load from URL (v3) ---
    const SHARE_FORMAT_VERSION = 'v3';
    const RATES = [4, 3, 2, 1.5, 1, 0.5, 0.25]; // For indexing

    function serializeState() {
        const rateIndex = RATES.indexOf(state.rate);
        const noteIndex = NOTE_NAMES.indexOf(state.baseNote);
        const stepStr = state.steps.map(s => (s.transpose + 12).toString(36)).join('');

        const parts = [
            SHARE_FORMAT_VERSION,
            state.bpm.toString(36).padStart(2, '0'),
            rateIndex,
            noteIndex.toString(36),
            state.baseOctave,
            state.seqMax.toString(36),
            stepStr
        ];
        return parts.join('');
    }

    function handleShare() {
        const dataString = serializeState();
        const url = new URL(window.location.href);
        url.hash = encodeURIComponent(dataString);

        navigator.clipboard.writeText(url.toString()).then(() => {
            alert('共有URLをクリップボードにコピーしました！');
        }, () => {
            alert('クリップボードへのコピーに失敗しました。手動でURLをコピーしてください。');
        });
    }

    function loadStateFromHash() {
        if (!window.location.hash) return;

        try {
            const dataString = decodeURIComponent(window.location.hash.substring(1));
            
            const version = dataString.substring(0, 2);
            if (version !== SHARE_FORMAT_VERSION) {
                console.warn(`URL data version (${version}) does not match current version (${SHARE_FORMAT_VERSION}).`);
                // ここで古いバージョン(v2, v1)のデコード処理を呼び出すことも可能
                return;
            }

            // --- Parse Fixed-Length String ---
            let pos = 2;
            const bpm = dataString.substring(pos, pos += 2);
            const rateIndex = dataString.substring(pos, pos += 1);
            const noteIndex = dataString.substring(pos, pos += 1);
            const baseOctave = dataString.substring(pos, pos += 1);
            const seqMax = dataString.substring(pos, pos += 1);
            const stepStr = dataString.substring(pos);

            // --- Restore State ---
            state.bpm = parseInt(bpm, 36);
            state.rate = RATES[parseInt(rateIndex, 10)];
            state.baseNote = NOTE_NAMES[parseInt(noteIndex, 36)];
            state.baseOctave = parseInt(baseOctave, 10);
            state.seqMax = parseInt(seqMax, 36);
            
            const transposes = [...stepStr].map(char => parseInt(char, 36) - 12);
            for (let i = 0; i < state.steps.length; i++) {
                if (transposes[i] !== undefined) {
                    state.steps[i].transpose = transposes[i];
                }
            }

            // --- Update UI from restored state ---
            // BPM / Rate
            state.modalBpm = state.bpm;
            state.modalRate = state.rate;
            const rateButton = modalRateButtons.querySelector(`button[data-rate="${state.rate}"]`);
            state.modalRateText = rateButton ? rateButton.textContent : '?';
            bpmRateDisplayButton.textContent = `${state.bpm} / ${state.modalRateText}`;

            // Base Note
            state.modalBaseNote = state.baseNote;
            state.modalBaseOctave = state.baseOctave;
            baseNoteDisplayButton.textContent = `${state.baseNote}${state.baseOctave}`;

            // SEQ MAX
            const currentActive = seqMaxButtonsContainer.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            const newActive = seqMaxButtonsContainer.querySelector(`button[data-value="${state.seqMax}"]`);
            if (newActive) newActive.classList.add('active');

            // Sequencer Grid
            updateAllStepsUI();

            alert('URLからシーケンスを復元しました。');

        } catch (e) {
            console.error('URLからの状態復元に失敗しました:', e);
            alert('URLデータの読み込みに失敗しました。');
        }
    }

    // --- Event Listeners for Share/Load ---
    shareBtnDesktop.addEventListener('click', handleShare);
    shareBtnMobile.addEventListener('click', handleShare);

    // Load state from URL when the page loads
    loadStateFromHash();
});