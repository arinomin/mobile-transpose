document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const seqMaxButtonsContainer = document.getElementById('seq-max-buttons');
    const playStopBtn = document.getElementById('play-stop-button');
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
    const melodyGenButton = document.getElementById('melody-gen-button');
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
    let audioContext;
    let bpm = 120;
    let rate = 4;
    let baseNote = 'C';
    let baseOctave = 4;
    let seqMax = STEPS_COUNT;
    let steps = Array(STEPS_COUNT).fill(0).map(() => ({ transpose: 0 }));
    let currentStep = 0;
    let isPlaying = false;
    let isLooping = false;
    let timerId = null;
    let activeStepElement = null;
    let editedStepIndex = null;
    let currentOscillator = null; // For legato playback

    // Temporary modal states
    let modalBpm = bpm;
    let modalRate = rate;
    let modalRateText = '16分';
    let modalBaseNote = baseNote;
    let modalBaseOctave = baseOctave;
    
    // Melody Generation State
    let previewSteps = null;
    let isPreviewPlaying = false;
    let previewTimerId = null;
    let currentPreviewOscillator = null; // For legato preview playback


    // --- Web Audio API Initialization ---
    function initAudio() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
    function playSound(midiNote) {
        if (!audioContext) return null;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(midiToFreq(midiNote), audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        return oscillator;
    }

    function playAuditionSound(midiNote, duration = 0.4) {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const now = audioContext.currentTime;
        const releaseTime = 0.1;
        const sustainDuration = Math.max(0, duration - releaseTime);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(midiToFreq(midiNote), now);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.setValueAtTime(0.4, now + sustainDuration);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }
    
    // --- Sequencer Logic ---
    function scheduleNextStep() {
        const interval = (60000 / bpm) / rate;
        if (isPlaying) {
            timerId = setTimeout(step, interval);
        }
    }

    function step() {
        if (!isPlaying) return;

        if (currentOscillator) {
            currentOscillator.stop(audioContext.currentTime);
        }

        if (activeStepElement) {
            activeStepElement.classList.remove('active');
        }

        currentStep = currentStep % seqMax;

        const stepData = steps[currentStep];
        const stepElement = sequencerGrid.children[currentStep];
        stepElement.classList.add('active');
        activeStepElement = stepElement;

        const baseMidi = noteToMidi(baseNote, baseOctave);
        const finalMidi = baseMidi + stepData.transpose;
        currentOscillator = playSound(finalMidi);

        currentStep++;

        if (currentStep >= seqMax && !isLooping) {
            stopPlayback();
        } else {
            scheduleNextStep();
        }
    }

    function startPlayback() {
        initAudio();
        if (isPlaying) return;
        isPlaying = true;
        isLooping = true;
        currentStep = 0;
        
        playStopBtn.textContent = 'Stop';
        playStopBtn.classList.add('playing');

        step();
    }

    function stopPlayback() {
        if (!isPlaying) return;
        isPlaying = false;
        isLooping = false;
        clearTimeout(timerId);
        timerId = null;

        if (currentOscillator) {
            currentOscillator.stop(audioContext.currentTime);
            currentOscillator = null;
        }

        if (activeStepElement) {
            activeStepElement.classList.remove('active');
            activeStepElement = null;
        }
        currentStep = 0;

        playStopBtn.textContent = 'Play';
        playStopBtn.classList.remove('playing');
    }

    // --- UI Update ---
    function formatTranspose(transpose) {
        return transpose >= 0 ? `+${transpose}` : transpose;
    }

    function updateStepUI(index, stepData) {
        const stepElement = sequencerGrid.children[index];
        stepElement.querySelector('.step-transpose').textContent = formatTranspose(stepData.transpose);
        const baseMidi = noteToMidi(baseNote, baseOctave);
        const finalMidi = baseMidi + stepData.transpose;
        stepElement.querySelector('.step-note').textContent = getNoteName(finalMidi);
    }

    function updateAllStepsUI() {
        for (let i = 0; i < STEPS_COUNT; i++) {
            updateStepUI(i, steps[i]);
        }
    }

    // --- Step Modal Logic ---
    function openStepModal(stepIndex) {
        editedStepIndex = stepIndex;
        modalStepNumber.textContent = `#${stepIndex + 1}`;
        const transpose = steps[stepIndex].transpose;
        updateStepModalInfo(transpose);
        stepModal.style.display = 'flex';
    }

    function closeStepModal() {
        stepModal.style.display = 'none';
    }

    function updateStepModalInfo(transpose, save = false) {
        transposeValueDisplay.textContent = formatTranspose(transpose);
        intervalNameDisplay.textContent = INTERVAL_NAMES[transpose] || '';
        const baseMidi = noteToMidi(baseNote, baseOctave);
        const finalMidi = baseMidi + transpose;
        finalNoteDisplay.textContent = getNoteName(finalMidi);
        const handle = transposeSelector.querySelector('.selector-handle');
        const percentage = (transpose + 12) / 24;
        handle.style.left = `${percentage * 100}%`;

        if (save) {
            steps[editedStepIndex].transpose = transpose;
            updateStepUI(editedStepIndex, steps[editedStepIndex]);
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
        modalBpm = bpm;
        modalRate = rate;
        modalBpmValue.textContent = modalBpm;
        modalRateButtons.querySelectorAll('button').forEach(btn => {
            if (parseFloat(btn.dataset.rate) === modalRate) {
                btn.classList.add('selected');
                modalRateText = btn.textContent;
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
        bpm = modalBpm;
        rate = modalRate;
        bpmRateDisplayButton.textContent = `${bpm} / ${modalRateText}`;
        closeBpmRateModal();
    }

    function adjustBpm(amount) {
        modalBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, modalBpm + amount));
        modalBpmValue.textContent = modalBpm;
    }

    // --- Base Note Modal Logic ---
    function openBaseNoteModal() {
        modalBaseNote = baseNote;
        modalBaseOctave = baseOctave;
        
        modalNoteNameButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.note === modalBaseNote);
        });
        modalOctaveButtons.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.octave) === modalBaseOctave);
        });

        baseNoteModal.style.display = 'flex';
    }

    function closeBaseNoteModal() {
        baseNoteModal.style.display = 'none';
    }

    function applyBaseNoteChanges() {
        baseNote = modalBaseNote;
        baseOctave = modalBaseOctave;
        baseNoteDisplayButton.textContent = `${baseNote}${baseOctave}`;
        updateAllStepsUI();
        closeBaseNoteModal();
    }

    // --- Melody Gen Modal Logic ---
    function openMelodyGenModal() {
        if (isPlaying) stopPlayback();
        previewSteps = null;
        applyMelodyButton.disabled = true;
        melodyGenModal.style.display = 'flex';
    }

    function stopPreview() {
        isPreviewPlaying = false;
        clearTimeout(previewTimerId);
        previewTimerId = null;

        if (currentPreviewOscillator) {
            currentPreviewOscillator.stop(audioContext.currentTime);
            currentPreviewOscillator = null;
        }

        const activePreviewStep = sequencerGrid.querySelector('.active-preview');
        if (activePreviewStep) {
            activePreviewStep.classList.remove('active-preview');
        }
        previewMelodyButton.disabled = false;
        applyMelodyButton.disabled = previewSteps === null;
    }

    function closeMelodyGenModal() {
        if (isPreviewPlaying) {
            stopPreview();
        }
        previewSteps = null;
        melodyGenModal.style.display = 'none';
    }

    function playPreview(previewSequence) {
        initAudio();
        if (isPreviewPlaying) {
            stopPreview();
        }
        isPreviewPlaying = true;
        previewMelodyButton.disabled = true;
        applyMelodyButton.disabled = true;

        let previewStep = 0;
        let previousStepEl = null;

        function previewStepPlayer() {
            if (!isPreviewPlaying) {
                if(previousStepEl) previousStepEl.classList.remove('active-preview');
                return;
            }

            if (currentPreviewOscillator) {
                currentPreviewOscillator.stop(audioContext.currentTime);
            }

            if (previousStepEl) {
                previousStepEl.classList.remove('active-preview');
            }

            const stepData = previewSequence[previewStep];
            const stepElement = sequencerGrid.children[previewStep];
            stepElement.classList.add('active-preview');
            previousStepEl = stepElement;

            const baseMidi = noteToMidi(baseNote, baseOctave);
            const finalMidi = baseMidi + stepData.transpose;
            currentPreviewOscillator = playSound(finalMidi);

            previewStep++;

            if (previewStep >= seqMax) {
                previewTimerId = setTimeout(() => {
                    stopPreview();
                }, (60000 / bpm) / rate);
            } else {
                previewTimerId = setTimeout(previewStepPlayer, (60000 / bpm) / rate);
            }
        }
        previewStepPlayer();
    }

    function generateAndPreviewMelody() {
        const key = melodyKeySelect.value;
        const scaleName = melodyScaleSelect.value;
        const scaleIntervals = SCALES[scaleName];

        const rootNoteIndex = NOTE_NAMES.indexOf(key);
        const baseMidi = noteToMidi(baseNote, baseOctave);

        const transposePool = [];
        for (let octave = -1; octave <= 1; octave++) {
            for (const interval of scaleIntervals) {
                const midiNote = rootNoteIndex + (baseOctave + octave) * 12 + interval;
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

        previewSteps = newMelody;
        applyMelodyButton.disabled = false;
        
        for (let i = 0; i < STEPS_COUNT; i++) {
            updateStepUI(i, previewSteps[i]);
        }

        playPreview(previewSteps);
    }

    function applyMelody() {
        if (previewSteps) {
            steps = JSON.parse(JSON.stringify(previewSteps)); // Deep copy
            updateAllStepsUI();
            closeMelodyGenModal();
        }
    }

    // --- Event Listeners ---
    playStopBtn.addEventListener('click', () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            startPlayback();
        }
    });

    // Step Modal
    stepModal.addEventListener('click', (e) => { if (e.target === stepModal) closeStepModal(); });
    closeModalBtn.addEventListener('click', closeStepModal);
    resetBtn.addEventListener('click', () => updateStepModalInfo(0, true));
    auditionBtn.addEventListener('click', () => {
        initAudio();
        const percentage = parseFloat(transposeSelector.querySelector('.selector-handle').style.left) / 100;
        const transpose = Math.round(percentage * 24) - 12;
        const baseMidi = noteToMidi(baseNote, baseOctave);
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
            modalRate = parseFloat(e.target.dataset.rate);
            modalRateText = e.target.textContent;
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
            modalBaseNote = e.target.dataset.note;
            modalNoteNameButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    modalOctaveButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            modalBaseOctave = parseInt(e.target.dataset.octave, 10);
            modalOctaveButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    // Melody Gen Modal
    melodyGenButton.addEventListener('click', openMelodyGenModal);
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
            if (i === seqMax) button.classList.add('active');
            button.addEventListener('click', () => {
                seqMax = i;
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
    baseNoteDisplayButton.textContent = `${baseNote}${baseOctave}`;
    bpmRateDisplayButton.textContent = `${bpm} / ${modalRateText}`;
    createSequencerGrid();
    createSelectorTicks();
    createSeqMaxButtons();
    createModalNoteButtons();
    createModalOctaveButtons();
    updateAllStepsUI();
});