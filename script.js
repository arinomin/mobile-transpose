document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const bpmInput = document.getElementById('bpm');
    const rateSelect = document.getElementById('rate');
    const baseNoteSelect = document.getElementById('base-note');
    const baseOctaveSelect = document.getElementById('base-octave');
    const seqMaxButtonsContainer = document.getElementById('seq-max-buttons');
    const playOnceBtn = document.getElementById('play-once');
    const playLoopBtn = document.getElementById('play-loop');
    const stopBtn = document.getElementById('stop');
    const sequencerGrid = document.getElementById('sequencer-grid');
    const stepModal = document.getElementById('step-modal');
    const closeModalBtn = document.getElementById('close-modal-button');
    const transposeValueDisplay = document.getElementById('transpose-value-display');
    const intervalNameDisplay = document.getElementById('interval-name-display');
    const finalNoteDisplay = document.getElementById('final-note-display');
    const transposeSelector = document.getElementById('transpose-selector');
    const auditionBtn = document.getElementById('audition-button');
    const resetBtn = document.getElementById('reset-button');
    const selectorTicks = document.querySelector('.selector-ticks');

    // --- Constants ---
    const STEPS_COUNT = 16;
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const MAJOR_TICKS = [-12, -7, 0, 7, 12];
    const INTERVAL_NAMES = {
        '-12': 'Octave Down', '-7': 'Perfect 5th Down', '0': 'Unison', '7': 'Perfect 5th Up', '12': 'Octave Up',
        /* ... other interval names ... */
    };

    // --- State ---
    let audioContext;
    let bpm = parseInt(bpmInput.value, 10);
    let rate = parseFloat(rateSelect.value);
    let baseNote = baseNoteSelect.value;
    let baseOctave = parseInt(baseOctaveSelect.value, 10);
    let seqMax = STEPS_COUNT;
    let steps = Array(STEPS_COUNT).fill(0).map(() => ({ transpose: 0 }));
    let currentStep = 0;
    let isPlaying = false;
    let isLooping = false;
    let timerId = null;
    let activeStepElement = null;
    let editedStepIndex = null;

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
    function playSound(midiNote, duration = 0.15) {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(midiToFreq(midiNote), audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
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
        playSound(finalMidi);

        currentStep++;

        if (currentStep >= seqMax && !isLooping) {
            stopPlayback();
        } else {
            scheduleNextStep();
        }
    }

    function startPlayback(loop = false) {
        initAudio();
        if (isPlaying) return;
        isPlaying = true;
        isLooping = loop;
        currentStep = 0;
        step();
    }

    function stopPlayback() {
        if (!isPlaying) return;
        isPlaying = false;
        isLooping = false;
        clearTimeout(timerId);
        timerId = null;
        if (activeStepElement) {
            activeStepElement.classList.remove('active');
            activeStepElement = null;
        }
        currentStep = 0;
    }

    // --- UI Update ---
    function formatTranspose(transpose) {
        return transpose >= 0 ? `+${transpose}` : transpose;
    }

    function updateStepUI(index) {
        const stepElement = sequencerGrid.children[index];
        const stepData = steps[index];
        stepElement.querySelector('.step-transpose').textContent = formatTranspose(stepData.transpose);
        const baseMidi = noteToMidi(baseNote, baseOctave);
        const finalMidi = baseMidi + stepData.transpose;
        stepElement.querySelector('.step-note').textContent = getNoteName(finalMidi);
    }

    function updateAllStepsUI() {
        for (let i = 0; i < STEPS_COUNT; i++) {
            updateStepUI(i);
        }
    }

    // --- Modal Logic ---
    function openModal(stepIndex) {
        editedStepIndex = stepIndex;
        const transpose = steps[stepIndex].transpose;
        updateModalInfo(transpose);
        stepModal.style.display = 'flex';
    }

    function closeModal() {
        stepModal.style.display = 'none';
    }

    function updateModalInfo(transpose, save = false) {
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
            updateStepUI(editedStepIndex);
        }
    }

    function handleSelectorInteraction(event) {
        const selectorRect = transposeSelector.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const offsetX = clientX - selectorRect.left;
        const percentage = Math.max(0, Math.min(1, offsetX / selectorRect.width));
        let transpose = Math.round(percentage * 24) - 12;
        updateModalInfo(transpose, true); // Auto-save
    }

    // --- Event Listeners ---
    bpmInput.addEventListener('change', () => { bpm = parseInt(bpmInput.value, 10); });
    rateSelect.addEventListener('change', () => { rate = parseFloat(rateSelect.value); });
    baseNoteSelect.addEventListener('change', () => { baseNote = baseNoteSelect.value; updateAllStepsUI(); });
    baseOctaveSelect.addEventListener('change', () => { baseOctave = parseInt(baseOctaveSelect.value, 10); updateAllStepsUI(); });

    playOnceBtn.addEventListener('click', () => startPlayback(false));
    playLoopBtn.addEventListener('click', () => startPlayback(true));
    stopBtn.addEventListener('click', stopPlayback);

    stepModal.addEventListener('click', (e) => { if (e.target === stepModal) closeModal(); });
    closeModalBtn.addEventListener('click', closeModal);

    resetBtn.addEventListener('click', () => updateModalInfo(0, true)); // Auto-save on reset

    auditionBtn.addEventListener('click', () => {
        initAudio();
        const percentage = parseFloat(transposeSelector.querySelector('.selector-handle').style.left) / 100;
        const transpose = Math.round(percentage * 24) - 12;
        const baseMidi = noteToMidi(baseNote, baseOctave);
        const finalMidi = baseMidi + transpose;
        playSound(finalMidi);
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
            stepElement.addEventListener('click', () => openModal(i));
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

    createSequencerGrid();
    createSelectorTicks();
    createSeqMaxButtons();
    updateAllStepsUI();
});
