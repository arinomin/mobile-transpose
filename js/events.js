import { state, NOTE_NAMES } from './state.js';
import * as actions from './actions.js';
import {
    domElements,
    openStepModal, closeStepModal, updateStepModalInfo,
    openBpmRateModal, closeBpmRateModal,
    openBaseNoteModal, closeBaseNoteModal,
    openMelodyGenModal, closeMelodyGenModal,
    openHelpModal, closeHelpModal, setHelpLanguage,
    openShareModal, closeShareModal
} from './ui.js';
import { generateAndPreviewMelody } from './melody.js';
import { startPlayback, stopPlayback, playAuditionSound } from './audio.js';
import { noteToMidi } from './utils.js';

export function setupEventListeners(serializeState) {

    function handlePlayStop() {
        if (state.isPlaying) {
            stopPlayback();
        } else {
            startPlayback('main');
        }
    }

    domElements.playStopBtn.addEventListener('click', handlePlayStop);
    domElements.melodyGenBtn.addEventListener('click', () => {
        if (state.isPlaying) stopPlayback();
        openMelodyGenModal();
    });
    domElements.shareBtn.addEventListener('click', () => {
        const dataString = serializeState();
        const url = new URL(window.location.href);
        url.hash = encodeURIComponent(dataString);
        domElements.shareUrlInput.value = url.toString();
        openShareModal();
    });

    // --- Sequencer Grid ---
    domElements.sequencerGrid.addEventListener('click', (e) => {
        const stepElement = e.target.closest('.step');
        if (stepElement) {
            if (state.isPlaying) stopPlayback();
            const index = parseInt(stepElement.dataset.index, 10);
            openStepModal(index);
        }
    });

    let dragSrcIndex = null;
    domElements.sequencerGrid.addEventListener('dragstart', (e) => {
        const stepElement = e.target.closest('.step');
        if (stepElement) {
            dragSrcIndex = parseInt(stepElement.dataset.index, 10);
            e.dataTransfer.effectAllowed = 'move';
            // A temporary semi-transparent element is created by the browser
            // You can style it with a class if needed
            setTimeout(() => {
                stepElement.classList.add('dragging');
            }, 0);
        }
    });

    domElements.sequencerGrid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.step');
        if (target) {
            // Basic visual feedback
            target.classList.add('drag-over');
        }
    });

    domElements.sequencerGrid.addEventListener('dragleave', (e) => {
        const target = e.target.closest('.step');
        if (target) {
            target.classList.remove('drag-over');
        }
    });

    domElements.sequencerGrid.addEventListener('drop', (e) => {
        e.stopPropagation();
        const dropTarget = e.target.closest('.step');
        if (dropTarget) {
            dropTarget.classList.remove('drag-over');
            const dropIndex = parseInt(dropTarget.dataset.index, 10);
            if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
                actions.swapSteps(dragSrcIndex, dropIndex);
            }
        }
    });

    domElements.sequencerGrid.addEventListener('dragend', (e) => {
        const stepElement = e.target.closest('.step');
        if(stepElement) {
            stepElement.classList.remove('dragging');
        }
        // Clean up all drag-over classes
        domElements.sequencerGrid.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        dragSrcIndex = null;
    });

    // --- Step Modal ---
    domElements.stepModal.addEventListener('click', (e) => { if (e.target === domElements.stepModal) closeStepModal(); });
    domElements.closeModalBtn.addEventListener('click', closeStepModal);
    domElements.doneStepButton.addEventListener('click', closeStepModal);
    domElements.resetBtn.addEventListener('click', () => {
        if (state.editedStepIndex !== null) {
            actions.resetStep(state.editedStepIndex);
            updateStepModalInfo(0);
        }
    });
    domElements.auditionBtn.addEventListener('click', () => {
        const percentage = parseFloat(domElements.transposeSelector.querySelector('.selector-handle').style.left) / 100;
        const transpose = Math.round(percentage * 24) - 12;
        const baseMidi = noteToMidi(state.baseNote, state.baseOctave);
        const finalMidi = baseMidi + transpose;
        playAuditionSound(finalMidi);
    });
    const stepEnableToggle = document.getElementById('step-enable-toggle');
    if (stepEnableToggle) {
        stepEnableToggle.onchange = (e) => {
            if (state.editedStepIndex !== null) {
                actions.setStepEnabled(state.editedStepIndex, e.target.checked);
            }
        };
    }
    // Listener for the transpose selector slider
    // This is a complex control, so it gets its own logic
    setupTransposeSelector(domElements.transposeSelector);


    // --- BPM/Rate Modal ---
    domElements.bpmRateDisplayButton.addEventListener('click', () => {
        if (state.isPlaying) stopPlayback();
        openBpmRateModal();
    });
    domElements.closeBpmRateModalButton.addEventListener('click', closeBpmRateModal);
    domElements.doneBpmRateButton.addEventListener('click', () => {
        actions.applyBpmRateChanges();
        closeBpmRateModal();
    });
    domElements.bpmRateModal.addEventListener('click', (e) => {
        if (e.target === domElements.bpmRateModal) {
            closeBpmRateModal();
        } else if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.bpmDown10.addEventListener('click', () => actions.setBpm(state.modalBpm - 10));
    domElements.bpmDown1.addEventListener('click', () => actions.setBpm(state.modalBpm - 1));
    domElements.bpmUp1.addEventListener('click', () => actions.setBpm(state.modalBpm + 1));
    domElements.bpmUp10.addEventListener('click', () => actions.setBpm(state.modalBpm + 10));
    domElements.modalRateButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const newRate = parseFloat(e.target.dataset.rate);
            actions.setRate(newRate, e.target.textContent);
            domElements.modalRateButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    // --- Base Note Modal ---
    domElements.baseNoteDisplayButton.addEventListener('click', () => {
        if (state.isPlaying) stopPlayback();
        openBaseNoteModal();
    });
    domElements.closeBaseNoteModalButton.addEventListener('click', closeBaseNoteModal);
    domElements.doneBaseNoteButton.addEventListener('click', () => {
        actions.applyBaseNoteChanges();
        closeBaseNoteModal();
    });
    domElements.baseNoteModal.addEventListener('click', (e) => {
        if (e.target === domElements.baseNoteModal) {
            closeBaseNoteModal();
        } else if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.modalNoteNameButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            actions.setBaseNote(e.target.dataset.note);
            domElements.modalNoteNameButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });
    domElements.modalOctaveButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            actions.setBaseOctave(parseInt(e.target.dataset.octave, 10));
            domElements.modalOctaveButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });
    domElements.modalWaveformButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            actions.setWaveform(e.target.dataset.wave);
            domElements.modalWaveformButtons.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });

    // --- Melody Gen Modal ---
    domElements.closeMelodyGenModalButton.addEventListener('click', closeMelodyGenModal);
    domElements.melodyGenModal.addEventListener('click', (e) => {
        if (e.target === domElements.melodyGenModal) {
            closeMelodyGenModal();
        } else if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.previewMelodyButton.addEventListener('click', generateAndPreviewMelody);
    domElements.applyMelodyButton.addEventListener('click', () => {
        actions.applyMelody(state.previewSteps);
        closeMelodyGenModal();
    });
    domElements.melodyAlgorithmSelect.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            state.melodyGenAlgorithm = e.target.dataset.value;
            domElements.melodyAlgorithmSelect.querySelector('.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });
    domElements.melodyRestProbability.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        state.melodyGenRestProbability = value;
        domElements.melodyRestProbabilityValue.textContent = `${Math.round(value * 100)}%`;
    });

    // --- Share & Help Modals ---
    domElements.shareModal.addEventListener('click', (e) => { if (e.target === domElements.shareModal) closeShareModal(); });
    domElements.closeShareModalButton.addEventListener('click', closeShareModal);
    domElements.closeHelpModalButton.addEventListener('click', closeHelpModal);
    domElements.helpModal.addEventListener('click', (e) => { if (e.target === domElements.helpModal) closeHelpModal(); });
    domElements.helpLanguageSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            setHelpLanguage(e.target.dataset.lang);
        }
    });
    domElements.headerContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('help-button')) {
            openHelpModal(e.target.dataset.helpTopic);
        }
    });
    domElements.copyUrlButton.addEventListener('click', () => {
        navigator.clipboard.writeText(domElements.shareUrlInput.value).then(() => {
            domElements.copyUrlButton.textContent = 'Copied!';
            setTimeout(() => { domElements.copyUrlButton.textContent = 'Copy URL'; }, 2000);
        }, () => {
            alert('Failed to copy to clipboard.');
        });
    });
    domElements.shareXButton.addEventListener('click', () => {
        const url = domElements.shareUrlInput.value;
        const text = 'Check out this sequence! #mobiletranspose';
        const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(xUrl, '_blank');
    });

    // --- Seq Max Buttons ---
    domElements.seqMaxButtonsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const newSeqMax = parseInt(e.target.dataset.value, 10);
            
            const currentActive = domElements.seqMaxButtonsContainer.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            e.target.classList.add('active');

            actions.setSeqMax(newSeqMax);
        }
    });
}

// --- Special handler for the transpose selector ---
function setupTransposeSelector(selector) {
    let isDragging = false;

    const getTransposeFromEvent = (e) => {
        const rect = selector.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        return Math.round(percentage * 24) - 12;
    };

    const handleMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const transpose = getTransposeFromEvent(e);
        updateStepModalInfo(transpose);
    };

    const handleEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        // The final state update is already handled by updateStepModalInfo
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchend', handleEnd);
    };

    const handleStart = (e) => {
        isDragging = true;
        const transpose = getTransposeFromEvent(e);
        updateStepModalInfo(transpose);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchend', handleEnd);
    };

    selector.addEventListener('mousedown', handleStart);
    selector.addEventListener('touchstart', handleStart);
}
